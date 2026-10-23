-- =============================================================================
-- Woodland Perú · 006 · Flujo comercial
-- =============================================================================
-- Encadena el ciclo completo con funciones transaccionales:
--   solicitud de cotización → revisión y envío → aceptación → pedido →
--   confirmación (reserva stock) → despacho (descuenta stock) | cancelación (libera).
-- Los estados que mueven inventario (confirmed, shipped, delivered, cancelled) solo se
-- alcanzan a través de estas funciones; así ninguna venta queda sin su movimiento de stock.

-- -----------------------------------------------------------------------------
-- Precio de catálogo pendiente de confirmación
-- -----------------------------------------------------------------------------
-- Woodland debe confirmar qué precio publica. Mientras tanto el precio del Excel se guarda
-- como referencia interna y product_variants.catalog_price queda en null ("a cotizar").

alter table public.variant_internal_pricing
  add column catalog_price_reference numeric(12, 2) check (catalog_price_reference >= 0);

comment on column public.variant_internal_pricing.catalog_price_reference is
  'Precio de catálogo del inventario de la empresa, aún no publicado. Se publica copiándolo a product_variants.catalog_price.';

-- -----------------------------------------------------------------------------
-- Idempotencia de solicitudes públicas
-- -----------------------------------------------------------------------------

alter table public.quotes
  add column request_id text unique check (request_id ~ '^[A-Za-z0-9_-]{8,100}$');

comment on column public.quotes.request_id is 'Identificador generado por el cliente: reenviar la misma solicitud no duplica la cotización.';

-- -----------------------------------------------------------------------------
-- Autorización común
-- -----------------------------------------------------------------------------

-- Devuelve 'service' o 'admin'; cualquier otro actor recibe un error de permisos.
create function app.require_admin_or_service()
returns text
language plpgsql
stable
set search_path = ''
as $$
begin
  if app.is_service_role() then
    return 'service';
  end if;
  if app.is_admin() then
    return 'admin';
  end if;
  raise exception 'Solo administración puede realizar esta operación.' using errcode = '42501';
end;
$$;

create function app.require_service()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not app.is_service_role() then
    raise exception 'Operación reservada al backend.' using errcode = '42501';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Estados de pedido controlados por funciones
-- -----------------------------------------------------------------------------

create function app.order_flow_allowed()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('woodland.order_flow', true), '') = 'on';
$$;

create or replace function app.guard_order_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.payment_status <> 'unpaid' and not app.payment_update_allowed() then
      raise exception 'Un pedido nuevo no puede registrarse como pagado.' using errcode = '42501';
    end if;
    if new.status <> 'pending_confirmation' then
      raise exception 'Un pedido nuevo debe iniciar pendiente de confirmación.' using errcode = '22023';
    end if;
    return new;
  end if;

  if new.payment_status is distinct from old.payment_status and not app.payment_update_allowed() then
    raise exception 'El estado de pago solo cambia con una confirmación verificada del proveedor de pagos.'
      using errcode = '42501';
  end if;

  if not app.order_status_transition_allowed(old.status, new.status) then
    raise exception 'Transición de estado no permitida: % → %.', old.status, new.status
      using errcode = '22023';
  end if;

  -- Estos estados mueven inventario: solo se alcanzan con confirm_order, dispatch_order o cancel_order.
  if new.status is distinct from old.status
     and new.status in ('confirmed', 'shipped', 'delivered', 'cancelled')
     and not app.order_flow_allowed() then
    raise exception 'Usa la operación de pedido correspondiente (confirmar, despachar o cancelar) para pasar a %.', new.status
      using errcode = '42501';
  end if;

  if new.status = 'confirmed' and old.status <> 'confirmed' and new.customer_confirmed_at is null then
    raise exception 'El pedido requiere la confirmación del cliente antes de confirmarse.' using errcode = '22023';
  end if;

  if new.status = 'cancelled' and old.status <> 'cancelled' then
    new.cancelled_at := now();
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. Solicitud de cotización (web, chat o WhatsApp a través del backend)
-- -----------------------------------------------------------------------------
-- p_request:
-- {
--   "request_id": "...", "channel": "web" | "web_chat" | "whatsapp",
--   "customer": { "type": "individual" | "business", "full_name", "company_name"?,
--                 "document_type"?, "document_number"?, "email"?, "phone"? },
--   "message"?: "...",
--   "items": [ { "variant_id"?, "description"?, "quantity", "custom_dimensions"?, "customization"? } ]
-- }
-- Los precios se calculan aquí con app.resolve_unit_price; nunca se aceptan del cliente.

create function app.quote_summary(p_quote_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'quote_id', q.id,
    'code', q.code,
    'status', q.status,
    'requires_review', q.requires_review,
    'subtotal', q.subtotal,
    'discount_total', q.discount_total,
    'total', q.total,
    'currency', q.currency,
    'valid_until', q.valid_until,
    'delivery_estimate_note', q.delivery_estimate_note,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'description', i.description,
        'quantity', i.quantity,
        'unit_price', i.unit_price,
        'line_total', i.line_total,
        'custom_dimensions', i.custom_dimensions,
        'customization', i.customization
      ) order by i.sort_order)
      from public.quote_items i
      where i.quote_id = q.id
    ), '[]'::jsonb)
  )
  from public.quotes q
  where q.id = p_quote_id;
$$;

create function public.submit_quote_request(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_id text := nullif(btrim(p_request ->> 'request_id'), '');
  v_channel public.sales_channel;
  v_customer jsonb := p_request -> 'customer';
  v_email text := nullif(lower(btrim(v_customer ->> 'email')), '');
  v_phone text := nullif(regexp_replace(coalesce(v_customer ->> 'phone', ''), '[\s()-]', '', 'g'), '');
  v_customer_id uuid;
  v_quote_id uuid;
  v_item jsonb;
  v_index integer := 0;
  v_variant_id uuid;
  v_description text;
  v_quantity integer;
  v_custom_dimensions text;
  v_customization text;
  v_price numeric;
  v_source public.price_source;
  v_total numeric := 0;
  v_units integer := 0;
  v_unpriced boolean := false;
  v_min_total numeric;
  v_min_quantity integer;
  v_reasons text[] := '{}';
begin
  perform app.require_service();

  -- Reintento de la misma solicitud: se devuelve la cotización ya creada.
  if v_request_id is not null then
    select q.id into v_quote_id from public.quotes q where q.request_id = v_request_id;
    if found then
      return app.quote_summary(v_quote_id);
    end if;
  end if;

  v_channel := coalesce(p_request ->> 'channel', 'web')::public.sales_channel;
  if v_channel = 'admin' then
    raise exception 'Canal no válido para una solicitud pública.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_request -> 'items') <> 'array'
     or jsonb_array_length(p_request -> 'items') = 0
     or jsonb_array_length(p_request -> 'items') > 50 then
    raise exception 'La solicitud debe incluir entre 1 y 50 productos.' using errcode = '22023';
  end if;

  -- Cliente: se reutiliza por correo o teléfono; los datos existentes no se sobrescriben
  -- desde una solicitud pública.
  if v_email is not null then
    select c.id into v_customer_id from public.customers c where lower(c.email) = v_email;
  end if;
  if v_customer_id is null and v_phone is not null then
    select c.id into v_customer_id from public.customers c where c.phone = v_phone order by c.created_at limit 1;
  end if;
  if v_customer_id is null then
    insert into public.customers (customer_type, full_name, company_name, document_type, document_number, email, phone)
    values (
      coalesce(v_customer ->> 'type', 'individual')::public.customer_type,
      btrim(v_customer ->> 'full_name'),
      nullif(btrim(v_customer ->> 'company_name'), ''),
      nullif(upper(btrim(v_customer ->> 'document_type')), ''),
      nullif(upper(btrim(v_customer ->> 'document_number')), ''),
      v_email,
      v_phone
    )
    returning id into v_customer_id;
  end if;

  insert into public.quotes (customer_id, channel, request_id, customer_message, requires_review)
  values (v_customer_id, v_channel, v_request_id, nullif(btrim(p_request ->> 'message'), ''), true)
  returning id into v_quote_id;

  for v_item in select value from jsonb_array_elements(p_request -> 'items') loop
    v_index := v_index + 1;
    v_variant_id := nullif(v_item ->> 'variant_id', '')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    v_custom_dimensions := nullif(btrim(v_item ->> 'custom_dimensions'), '');
    v_customization := nullif(btrim(v_item ->> 'customization'), '');
    v_price := null;
    v_source := null;

    if v_quantity is null or v_quantity < 1 or v_quantity > 100000 then
      raise exception 'Cantidad no válida en el producto %.', v_index using errcode = '22023';
    end if;

    if v_variant_id is not null then
      select p.name || ' · ' || v.name into v_description
      from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = v_variant_id and v.is_active and p.is_active;
      if not found then
        raise exception 'El producto % no existe o no está disponible.', v_index using errcode = 'P0002';
      end if;

      -- Medidas especiales o personalización: el precio lo define el equipo.
      if v_custom_dimensions is null and v_customization is null then
        select r.unit_price, r.price_source into v_price, v_source
        from app.resolve_unit_price(v_variant_id, v_quantity) r;
      end if;
    else
      v_description := nullif(btrim(v_item ->> 'description'), '');
      if v_description is null then
        raise exception 'El producto % a medida necesita una descripción.', v_index using errcode = '22023';
      end if;
    end if;

    insert into public.quote_items (
      quote_id, variant_id, description, quantity, unit_price, price_source,
      custom_dimensions, customization, sort_order
    ) values (
      v_quote_id, v_variant_id, v_description, v_quantity, v_price, v_source,
      v_custom_dimensions, v_customization, v_index
    );

    v_units := v_units + v_quantity;
    if v_price is null then
      v_unpriced := true;
    else
      v_total := v_total + v_price * v_quantity;
    end if;
  end loop;

  -- Revisión humana: precio pendiente o límites comerciales (si no están definidos, se revisa todo).
  select (value #>> '{}')::numeric into v_min_total from public.business_settings where key = 'quote_review_min_total';
  select (value #>> '{}')::integer into v_min_quantity from public.business_settings where key = 'quote_review_min_quantity';

  if v_unpriced then
    v_reasons := array_append(v_reasons, 'Hay productos sin precio publicado o con personalización.');
  end if;
  if v_min_total is null or v_min_quantity is null then
    v_reasons := array_append(v_reasons, 'Límite comercial no configurado.');
  end if;
  if v_min_total is not null and v_total >= v_min_total then
    v_reasons := array_append(v_reasons, format('Monto desde S/ %s.', v_min_total));
  end if;
  if v_min_quantity is not null and v_units >= v_min_quantity then
    v_reasons := array_append(v_reasons, format('Cantidad desde %s unidades.', v_min_quantity));
  end if;

  update public.quotes
     set requires_review = cardinality(v_reasons) > 0,
         review_reason = nullif(array_to_string(v_reasons, ' '), '')
   where id = v_quote_id;

  perform app.audit('quote_submitted', 'quotes', v_quote_id::text, jsonb_build_object('channel', v_channel, 'items', v_index));

  return app.quote_summary(v_quote_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Revisión y envío de la cotización (administración)
-- -----------------------------------------------------------------------------

create function public.set_quote_item_price(p_item_id uuid, p_unit_price numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.quote_status;
  v_quote_id uuid;
begin
  perform app.require_admin_or_service();

  if p_unit_price is null or p_unit_price < 0 then
    raise exception 'El precio debe ser cero o mayor.' using errcode = '22023';
  end if;

  select q.status, q.id into v_status, v_quote_id
  from public.quote_items i
  join public.quotes q on q.id = i.quote_id
  where i.id = p_item_id
  for update of q;

  if not found then
    raise exception 'El ítem de cotización no existe.' using errcode = 'P0002';
  end if;
  if v_status not in ('submitted', 'under_review') then
    raise exception 'Solo se pueden ajustar precios de cotizaciones en revisión.' using errcode = '22023';
  end if;

  update public.quote_items set unit_price = round(p_unit_price, 2), price_source = 'manual' where id = p_item_id;
  update public.quotes set status = 'under_review' where id = v_quote_id and status = 'submitted';
end;
$$;

create function public.send_quote(
  p_quote_id uuid,
  p_discount_total numeric default 0,
  p_valid_until date default null,
  p_delivery_estimate_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.quotes;
  v_validity_days integer;
begin
  perform app.require_admin_or_service();

  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then
    raise exception 'La cotización no existe.' using errcode = 'P0002';
  end if;
  if v_quote.status not in ('submitted', 'under_review') then
    raise exception 'La cotización % ya fue enviada o cerrada (%).', v_quote.code, v_quote.status using errcode = '22023';
  end if;
  if exists (select 1 from public.quote_items i where i.quote_id = p_quote_id and i.unit_price is null) then
    raise exception 'Define el precio de todos los productos antes de enviar la cotización.' using errcode = '22023';
  end if;
  if coalesce(p_discount_total, 0) < 0 or coalesce(p_discount_total, 0) > v_quote.subtotal then
    raise exception 'El descuento debe estar entre 0 y el subtotal.' using errcode = '22023';
  end if;

  select (value #>> '{}')::integer into v_validity_days from public.business_settings where key = 'quote_validity_days';

  update public.quotes
     set status = 'sent',
         discount_total = round(coalesce(p_discount_total, 0), 2),
         valid_until = coalesce(p_valid_until, case when v_validity_days is not null then current_date + v_validity_days end),
         delivery_estimate_note = coalesce(nullif(btrim(p_delivery_estimate_note), ''), delivery_estimate_note),
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_quote_id;

  return app.quote_summary(p_quote_id);
end;
$$;

-- El cliente acepta la cotización enviada (registrado por el equipo o por el backend).
create function public.accept_quote(p_quote_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.quotes;
begin
  perform app.require_admin_or_service();

  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then
    raise exception 'La cotización no existe.' using errcode = 'P0002';
  end if;
  if v_quote.status = 'accepted' then
    return app.quote_summary(p_quote_id);
  end if;
  if v_quote.status <> 'sent' then
    raise exception 'Solo se puede aceptar una cotización enviada.' using errcode = '22023';
  end if;
  if v_quote.valid_until is not null and v_quote.valid_until < current_date then
    update public.quotes set status = 'expired' where id = p_quote_id;
    raise exception 'La cotización % venció el %.', v_quote.code, v_quote.valid_until using errcode = '22023';
  end if;

  update public.quotes set status = 'accepted' where id = p_quote_id;
  return app.quote_summary(p_quote_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Pedido a partir de una cotización aceptada
-- -----------------------------------------------------------------------------

create function public.convert_quote_to_order(
  p_quote_id uuid,
  p_customer_confirmed boolean default false,
  p_shipping_address text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.quotes;
  v_order_id uuid;
begin
  perform app.require_admin_or_service();

  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then
    raise exception 'La cotización no existe.' using errcode = 'P0002';
  end if;
  if v_quote.status = 'converted' then
    return v_quote.converted_order_id;
  end if;
  if v_quote.status <> 'accepted' then
    raise exception 'Solo una cotización aceptada por el cliente se convierte en pedido.' using errcode = '22023';
  end if;

  insert into public.orders (
    customer_id, quote_id, channel, customer_confirmed_at, delivery_estimate_note, shipping_address
  ) values (
    v_quote.customer_id, v_quote.id, v_quote.channel,
    case when p_customer_confirmed then now() end,
    v_quote.delivery_estimate_note,
    nullif(btrim(p_shipping_address), '')
  )
  returning id into v_order_id;

  -- Lo personalizado o sin variante se fabrica a pedido; lo demás sale del stock.
  insert into public.order_items (
    order_id, variant_id, description, quantity, unit_price, price_source,
    fulfillment_type, custom_dimensions, customization, sort_order
  )
  select v_order_id, i.variant_id, i.description, i.quantity, i.unit_price, i.price_source,
         case
           when i.variant_id is null or i.custom_dimensions is not null or i.customization is not null
             then 'made_to_order'::public.fulfillment_type
           else v.fulfillment_type
         end,
         i.custom_dimensions, i.customization, i.sort_order
  from public.quote_items i
  left join public.product_variants v on v.id = i.variant_id
  where i.quote_id = v_quote.id;

  update public.orders set discount_total = v_quote.discount_total where id = v_order_id;
  update public.quotes set status = 'converted', converted_order_id = v_order_id where id = v_quote.id;

  return v_order_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Confirmación del pedido: reserva el stock de lo que ya está producido
-- -----------------------------------------------------------------------------

create function public.confirm_order(p_order_id uuid, p_customer_confirmed boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_item record;
begin
  perform app.require_admin_or_service();

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'El pedido no existe.' using errcode = 'P0002';
  end if;
  if v_order.status = 'confirmed' then
    return;
  end if;
  if v_order.status <> 'pending_confirmation' then
    raise exception 'El pedido % no está pendiente de confirmación.', v_order.code using errcode = '22023';
  end if;
  if not exists (select 1 from public.order_items where order_id = p_order_id) then
    raise exception 'El pedido no tiene productos.' using errcode = '22023';
  end if;

  if v_order.customer_confirmed_at is null and p_customer_confirmed then
    update public.orders set customer_confirmed_at = now() where id = p_order_id;
  end if;

  for v_item in
    select i.id, i.variant_id, i.quantity, i.description
    from public.order_items i
    where i.order_id = p_order_id and i.fulfillment_type = 'stock'
    order by i.variant_id -- orden estable de bloqueo para evitar interbloqueos
  loop
    begin
      perform public.apply_inventory_movement(
        v_item.variant_id, 'reservation', v_item.quantity,
        'Reserva para el pedido ' || v_order.code, p_order_id,
        'order:' || p_order_id || ':item:' || v_item.id || ':reservation'
      );
    exception when check_violation then
      raise exception 'Stock disponible insuficiente para "%" (pedido %). Registra producción o ajusta el pedido.',
        v_item.description, v_order.code using errcode = '23514';
    end;
  end loop;

  perform set_config('woodland.order_flow', 'on', true);
  update public.orders set status = 'confirmed' where id = p_order_id;
  perform set_config('woodland.order_flow', 'off', true);
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Despacho: la venta descuenta el stock reservado
-- -----------------------------------------------------------------------------

create function public.dispatch_order(p_order_id uuid, p_final_status public.order_status default 'delivered')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_item record;
begin
  perform app.require_admin_or_service();

  if p_final_status not in ('shipped', 'delivered') then
    raise exception 'El despacho termina en "shipped" o "delivered".' using errcode = '22023';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'El pedido no existe.' using errcode = 'P0002';
  end if;
  if v_order.status = p_final_status then
    return;
  end if;
  if not (v_order.status = 'ready' or (v_order.status = 'shipped' and p_final_status = 'delivered')) then
    raise exception 'Solo se despacha un pedido listo (estado actual: %).', v_order.status using errcode = '22023';
  end if;

  -- Una sola salida por ítem (clave idempotente); de shipped a delivered ya no mueve stock.
  if v_order.status = 'ready' then
    for v_item in
      select i.id, i.variant_id, i.quantity
      from public.order_items i
      where i.order_id = p_order_id and i.fulfillment_type = 'stock'
      order by i.variant_id
    loop
      perform public.apply_inventory_movement(
        v_item.variant_id, 'sale_out', v_item.quantity,
        'Despacho del pedido ' || v_order.code, p_order_id,
        'order:' || p_order_id || ':item:' || v_item.id || ':sale'
      );
    end loop;
  end if;

  perform set_config('woodland.order_flow', 'on', true);
  update public.orders set status = p_final_status where id = p_order_id;
  perform set_config('woodland.order_flow', 'off', true);
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Cancelación: libera las reservas pendientes
-- -----------------------------------------------------------------------------

create function public.cancel_order(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_item record;
  v_reason text := nullif(btrim(p_reason), '');
begin
  perform app.require_admin_or_service();

  if v_reason is null then
    raise exception 'Indica el motivo de la cancelación.' using errcode = '22023';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'El pedido no existe.' using errcode = 'P0002';
  end if;
  if v_order.status = 'cancelled' then
    return;
  end if;
  if v_order.status not in ('pending_confirmation', 'confirmed', 'in_production', 'ready') then
    raise exception 'No se puede cancelar un pedido %.', v_order.status using errcode = '22023';
  end if;

  -- Se libera solo lo que quedó reservado y no salió del almacén.
  for v_item in
    select i.id, i.variant_id, i.quantity
    from public.order_items i
    where i.order_id = p_order_id
      and i.fulfillment_type = 'stock'
      and exists (
        select 1 from public.inventory_movements m
        where m.idempotency_key = 'order:' || p_order_id || ':item:' || i.id || ':reservation'
      )
      and not exists (
        select 1 from public.inventory_movements m
        where m.idempotency_key = 'order:' || p_order_id || ':item:' || i.id || ':sale'
      )
    order by i.variant_id
  loop
    perform public.apply_inventory_movement(
      v_item.variant_id, 'reservation_release', v_item.quantity,
      'Cancelación del pedido ' || v_order.code || ': ' || v_reason, p_order_id,
      'order:' || p_order_id || ':item:' || v_item.id || ':release'
    );
  end loop;

  perform set_config('woodland.order_flow', 'on', true);
  update public.orders set status = 'cancelled', cancel_reason = v_reason where id = p_order_id;
  perform set_config('woodland.order_flow', 'off', true);
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Consulta pública del estado de un pedido (código + correo o teléfono)
-- -----------------------------------------------------------------------------

create function public.get_order_status_public(p_code text, p_contact text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_contact text := lower(regexp_replace(coalesce(p_contact, ''), '[\s()-]', '', 'g'));
  v_result jsonb;
begin
  perform app.require_service();

  select jsonb_build_object(
    'code', o.code,
    'status', o.status,
    'payment_status', o.payment_status,
    'total', o.total,
    'currency', o.currency,
    'delivery_estimate_note', o.delivery_estimate_note,
    'created_at', o.created_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('description', i.description, 'quantity', i.quantity) order by i.sort_order)
      from public.order_items i where i.order_id = o.id
    ), '[]'::jsonb)
  ) into v_result
  from public.orders o
  join public.customers c on c.id = o.customer_id
  where o.code = upper(btrim(p_code))
    and v_contact <> ''
    and (lower(c.email) = v_contact or c.phone = v_contact);

  -- Mismo resultado (null) si el pedido no existe o el contacto no coincide.
  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. Resumen del panel (administración)
-- -----------------------------------------------------------------------------

create function public.get_admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.require_admin_or_service();

  return jsonb_build_object(
    'quotes_pending', (select count(*) from public.quotes where status in ('submitted', 'under_review')),
    'quotes_sent', (select count(*) from public.quotes where status = 'sent'),
    'orders_by_status', coalesce((
      select jsonb_object_agg(status, total) from (
        select status, count(*) as total from public.orders group by status
      ) s
    ), '{}'::jsonb),
    -- Ventas confirmadas: pedidos confirmados o más avanzados, no cancelados, últimos 30 días.
    'confirmed_sales_30d', jsonb_build_object(
      'count', (select count(*) from public.orders
                where status in ('confirmed', 'in_production', 'ready', 'shipped', 'delivered')
                  and created_at >= now() - interval '30 days'),
      'total', (select coalesce(sum(total), 0) from public.orders
                where status in ('confirmed', 'in_production', 'ready', 'shipped', 'delivered')
                  and created_at >= now() - interval '30 days')
    ),
    'low_stock', coalesce((
      select jsonb_agg(jsonb_build_object(
        'variant_id', a.variant_id, 'sku', v.sku, 'product', p.name, 'variant', v.name,
        'available', l.available, 'min_stock', l.min_stock, 'since', a.created_at
      ) order by a.created_at)
      from public.stock_alerts a
      join public.product_variants v on v.id = a.variant_id
      join public.products p on p.id = v.product_id
      join public.inventory_levels l on l.variant_id = a.variant_id
      where a.resolved_at is null
    ), '[]'::jsonb),
    'recent_orders', coalesce((
      select jsonb_agg(r) from (
        select o.id, o.code, o.status, o.payment_status, o.total, o.created_at, c.full_name as customer
        from public.orders o join public.customers c on c.id = o.customer_id
        order by o.created_at desc limit 5
      ) r
    ), '[]'::jsonb),
    'recent_quotes', coalesce((
      select jsonb_agg(r) from (
        select q.id, q.code, q.status, q.requires_review, q.total, q.created_at, c.full_name as customer
        from public.quotes q join public.customers c on c.id = q.customer_id
        order by q.created_at desc limit 5
      ) r
    ), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------

-- Las funciones nuevas no heredan permisos (ver migración 005); se declaran explícitamente.
revoke execute on function
  app.require_admin_or_service(), app.require_service(), app.order_flow_allowed(), app.quote_summary(uuid),
  public.submit_quote_request(jsonb), public.set_quote_item_price(uuid, numeric),
  public.send_quote(uuid, numeric, date, text), public.accept_quote(uuid),
  public.convert_quote_to_order(uuid, boolean, text), public.confirm_order(uuid, boolean),
  public.dispatch_order(uuid, public.order_status), public.cancel_order(uuid, text),
  public.get_order_status_public(text, text), public.get_admin_dashboard()
  from public, anon, authenticated;

-- Usada por el trigger de pedidos, que corre con el rol de quien modifica.
grant execute on function app.order_flow_allowed() to authenticated;

-- Flujo comercial del personal: entra con su sesión y cada función verifica el rol.
grant execute on function
  public.set_quote_item_price(uuid, numeric),
  public.send_quote(uuid, numeric, date, text),
  public.accept_quote(uuid),
  public.convert_quote_to_order(uuid, boolean, text),
  public.confirm_order(uuid, boolean),
  public.dispatch_order(uuid, public.order_status),
  public.cancel_order(uuid, text),
  public.get_admin_dashboard()
  to authenticated;

-- El backend atiende además las solicitudes y consultas del público.
grant execute on function
  app.require_admin_or_service(), app.require_service(), app.order_flow_allowed(), app.quote_summary(uuid),
  public.submit_quote_request(jsonb), public.set_quote_item_price(uuid, numeric),
  public.send_quote(uuid, numeric, date, text), public.accept_quote(uuid),
  public.convert_quote_to_order(uuid, boolean, text), public.confirm_order(uuid, boolean),
  public.dispatch_order(uuid, public.order_status), public.cancel_order(uuid, text),
  public.get_order_status_public(text, text), public.get_admin_dashboard()
  to service_role;
