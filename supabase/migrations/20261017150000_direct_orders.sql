-- =============================================================================
-- Woodland Perú · 007 · Venta directa (sin cotización previa)
-- =============================================================================
-- Woodland también vende por WhatsApp o en persona. Esta función crea el pedido completo desde el
-- panel (o el backend) en una sola transacción: cliente, ítems con precio, y opcionalmente lo
-- confirma, lo que reserva el stock con la misma función de siempre (confirm_order).
-- Un pedido nunca nace pagado ni confirmado: el estado de pago lo controlan las funciones de pago.
--
-- p_request:
-- {
--   "channel"?: "admin" | "whatsapp" | "web_chat"   (por defecto "admin"),
--   "customer": { "id"? } | { "type", "full_name", "company_name"?, "document_type"?,
--                             "document_number"?, "email"?, "phone"? },
--   "items": [ { "variant_id"?, "description"?, "quantity", "unit_price"?, "custom_dimensions"?, "customization"? } ],
--   "discount_total"?, "shipping_address"?, "internal_notes"?, "delivery_estimate_note"?,
--   "customer_confirmed"?: boolean,   -- el cliente confirmó el pedido
--   "confirm"?: boolean               -- confirmar ya (reserva stock); exige customer_confirmed
-- }
-- Sin "unit_price" el precio sale de la regla de siempre (app.resolve_unit_price). Una pieza sin
-- variante necesita descripción y precio, y se fabrica a pedido.

create function public.create_direct_order(p_request jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_channel public.sales_channel := coalesce(nullif(p_request ->> 'channel', ''), 'admin')::public.sales_channel;
  v_customer jsonb := p_request -> 'customer';
  v_customer_id uuid := nullif(v_customer ->> 'id', '')::uuid;
  v_email text := nullif(lower(btrim(v_customer ->> 'email')), '');
  v_phone text := nullif(regexp_replace(coalesce(v_customer ->> 'phone', ''), '[\s()-]', '', 'g'), '');
  v_confirmed boolean := coalesce((p_request ->> 'customer_confirmed')::boolean, false);
  v_confirm boolean := coalesce((p_request ->> 'confirm')::boolean, false);
  v_discount numeric := coalesce((p_request ->> 'discount_total')::numeric, 0);
  v_order_id uuid;
  v_item jsonb;
  v_index integer := 0;
  v_variant_id uuid;
  v_description text;
  v_quantity integer;
  v_unit_price numeric;
  v_source public.price_source;
  v_fulfillment public.fulfillment_type;
  v_custom_dimensions text;
  v_customization text;
  v_manual_price numeric;
begin
  perform app.require_admin_or_service();

  if jsonb_typeof(p_request -> 'items') <> 'array'
     or jsonb_array_length(p_request -> 'items') = 0
     or jsonb_array_length(p_request -> 'items') > 50 then
    raise exception 'El pedido debe incluir entre 1 y 50 productos.' using errcode = '22023';
  end if;
  if v_discount < 0 then
    raise exception 'El descuento no puede ser negativo.' using errcode = '22023';
  end if;
  if v_confirm and not v_confirmed then
    raise exception 'Para confirmar el pedido y reservar stock, el cliente debe haberlo confirmado.' using errcode = '22023';
  end if;

  -- Cliente: uno existente, o se reutiliza por correo o teléfono, o se crea.
  if v_customer_id is not null then
    if not exists (select 1 from public.customers c where c.id = v_customer_id) then
      raise exception 'El cliente no existe.' using errcode = 'P0002';
    end if;
  else
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
  end if;

  insert into public.orders (
    customer_id, channel, customer_confirmed_at, shipping_address, internal_notes, delivery_estimate_note
  ) values (
    v_customer_id, v_channel,
    case when v_confirmed then now() end,
    nullif(btrim(p_request ->> 'shipping_address'), ''),
    nullif(btrim(p_request ->> 'internal_notes'), ''),
    nullif(btrim(p_request ->> 'delivery_estimate_note'), '')
  )
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_request -> 'items') loop
    v_index := v_index + 1;
    v_variant_id := nullif(v_item ->> 'variant_id', '')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    v_manual_price := (v_item ->> 'unit_price')::numeric;
    v_custom_dimensions := nullif(btrim(v_item ->> 'custom_dimensions'), '');
    v_customization := nullif(btrim(v_item ->> 'customization'), '');

    if v_quantity is null or v_quantity < 1 or v_quantity > 100000 then
      raise exception 'Cantidad no válida en el producto %.', v_index using errcode = '22023';
    end if;
    if v_manual_price is not null and v_manual_price < 0 then
      raise exception 'El precio del producto % no puede ser negativo.', v_index using errcode = '22023';
    end if;

    if v_variant_id is not null then
      select p.name || ' · ' || v.name, v.fulfillment_type
        into v_description, v_fulfillment
      from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = v_variant_id;
      if not found then
        raise exception 'El producto % no existe.', v_index using errcode = 'P0002';
      end if;

      if v_manual_price is not null then
        v_unit_price := round(v_manual_price, 2);
        v_source := 'manual';
      else
        select r.unit_price, r.price_source into v_unit_price, v_source
        from app.resolve_unit_price(v_variant_id, v_quantity) r;
        if v_unit_price is null then
          raise exception 'El producto % no tiene precio publicado: indica el precio.', v_index using errcode = '22023';
        end if;
      end if;

      -- Lo personalizado se fabrica a pedido; lo demás sale del stock según la variante.
      if v_custom_dimensions is not null or v_customization is not null then
        v_fulfillment := 'made_to_order';
      end if;
    else
      v_description := nullif(btrim(v_item ->> 'description'), '');
      if v_description is null then
        raise exception 'El producto % a medida necesita una descripción.', v_index using errcode = '22023';
      end if;
      if v_manual_price is null then
        raise exception 'El producto % a medida necesita un precio.', v_index using errcode = '22023';
      end if;
      v_unit_price := round(v_manual_price, 2);
      v_source := 'manual';
      v_fulfillment := 'made_to_order';
    end if;

    insert into public.order_items (
      order_id, variant_id, description, quantity, unit_price, price_source,
      fulfillment_type, custom_dimensions, customization, sort_order
    ) values (
      v_order_id, v_variant_id, v_description, v_quantity, v_unit_price, v_source,
      v_fulfillment, v_custom_dimensions, v_customization, v_index
    );
  end loop;

  if v_discount > 0 then
    update public.orders set discount_total = round(v_discount, 2) where id = v_order_id;
  end if;

  perform app.audit('direct_order_created', 'orders', v_order_id::text,
    jsonb_build_object('channel', v_channel, 'items', v_index, 'confirm', v_confirm));

  -- Confirmar reserva el stock; si no alcanza, toda la operación se revierte (nada queda a medias).
  if v_confirm then
    perform public.confirm_order(v_order_id, true);
  end if;

  return v_order_id;
end;
$$;

comment on function public.create_direct_order is 'Venta directa desde el panel o el backend: crea cliente, pedido e ítems y, opcionalmente, lo confirma reservando stock.';

revoke execute on function public.create_direct_order(jsonb) from public, anon, authenticated;
grant execute on function public.create_direct_order(jsonb) to authenticated, service_role;
