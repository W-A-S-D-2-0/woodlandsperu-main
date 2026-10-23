-- =============================================================================
-- Woodland Perú · 004 · Inventario: existencias, movimientos y alertas de reposición
-- =============================================================================
-- Stock disponible = stock físico - stock reservado.
-- Las existencias solo cambian con public.apply_inventory_movement, que bloquea la fila,
-- valida, registra el movimiento (solo inserción) y es idempotente con una clave.
-- Las variantes fabricadas bajo pedido (made_to_order) no llevan inventario.

create type public.inventory_movement_type as enum (
  'production_in',        -- entrada por producción
  'adjustment_in',        -- ajuste positivo (requiere motivo)
  'sale_out',             -- salida por venta o despacho (consume la reserva del pedido)
  'adjustment_out',       -- ajuste negativo (requiere motivo)
  'reservation',          -- reserva para un pedido
  'reservation_release',  -- liberación de una reserva
  'return_in'             -- devolución
);

-- -----------------------------------------------------------------------------
-- Existencias por variante
-- -----------------------------------------------------------------------------

create table public.inventory_levels (
  variant_id  uuid primary key references public.product_variants (id) on delete restrict,
  on_hand     integer not null default 0 check (on_hand >= 0),
  reserved    integer not null default 0 check (reserved >= 0),
  available   integer generated always as (on_hand - reserved) stored,
  -- Umbral de reposición. Null = sin mínimo configurado (no genera alertas).
  min_stock   integer check (min_stock >= 0),
  -- "Quién tiene el stock" en el inventario de la empresa.
  custodian   text check (char_length(btrim(custodian)) between 1 and 120),
  updated_at  timestamptz not null default now(),
  constraint inventory_reserved_le_on_hand check (reserved <= on_hand)
);

alter table public.inventory_levels enable row level security;

-- -----------------------------------------------------------------------------
-- Movimientos (historial inmutable)
-- -----------------------------------------------------------------------------

create table public.inventory_movements (
  id               bigint generated always as identity primary key,
  variant_id       uuid not null references public.product_variants (id) on delete restrict,
  movement_type    public.inventory_movement_type not null,
  quantity         integer not null check (quantity > 0),
  on_hand_after    integer not null,
  reserved_after   integer not null,
  order_id         uuid references public.orders (id) on delete restrict,
  reason           text check (char_length(reason) <= 500),
  idempotency_key  text unique check (char_length(idempotency_key) between 8 and 200),
  created_by       uuid references auth.users (id) on delete set null,
  actor_role       text not null,
  created_at       timestamptz not null default now()
);

create index inventory_movements_variant_idx on public.inventory_movements (variant_id, created_at desc);
create index inventory_movements_order_idx on public.inventory_movements (order_id) where order_id is not null;

alter table public.inventory_movements enable row level security;

create trigger inventory_movements_append_only before update or delete on public.inventory_movements
  for each row execute function app.prevent_mutation();

-- -----------------------------------------------------------------------------
-- Alertas de reposición (una abierta como máximo por variante)
-- -----------------------------------------------------------------------------

create table public.stock_alerts (
  id                    bigint generated always as identity primary key,
  variant_id            uuid not null references public.product_variants (id) on delete cascade,
  available_at_trigger  integer not null,
  min_stock_at_trigger  integer not null,
  created_at            timestamptz not null default now(),
  resolved_at           timestamptz
);

create unique index stock_alerts_one_open_per_variant on public.stock_alerts (variant_id) where resolved_at is null;

alter table public.stock_alerts enable row level security;

create function app.sync_stock_alert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.min_stock is not null and new.available <= new.min_stock then
    insert into public.stock_alerts (variant_id, available_at_trigger, min_stock_at_trigger)
    values (new.variant_id, new.available, new.min_stock)
    on conflict (variant_id) where resolved_at is null do nothing;
  else
    update public.stock_alerts
       set resolved_at = now()
     where variant_id = new.variant_id
       and resolved_at is null;
  end if;
  return null;
end;
$$;

create trigger inventory_levels_alerts after insert or update of on_hand, reserved, min_stock on public.inventory_levels
  for each row execute function app.sync_stock_alert();

-- -----------------------------------------------------------------------------
-- Operación atómica de inventario
-- -----------------------------------------------------------------------------

create function public.apply_inventory_movement(
  p_variant_id uuid,
  p_movement_type public.inventory_movement_type,
  p_quantity integer,
  p_reason text default null,
  p_order_id uuid default null,
  p_idempotency_key text default null
)
returns public.inventory_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text;
  v_fulfillment public.fulfillment_type;
  v_level public.inventory_levels;
  v_existing public.inventory_movements;
  v_result public.inventory_movements;
  v_on_hand integer;
  v_reserved integer;
  v_reason text := nullif(btrim(p_reason), '');
begin
  -- Autorización: backend (clave de servicio) o personal con el rol adecuado.
  if app.is_service_role() then
    v_actor := 'service';
  else
    v_actor := app.current_staff_role()::text;
    if v_actor is null then
      raise exception 'No autorizado para registrar movimientos de inventario.' using errcode = '42501';
    end if;
    if p_movement_type = 'production_in' then
      if v_actor not in ('admin', 'workshop') then
        raise exception 'No autorizado para registrar producción.' using errcode = '42501';
      end if;
    elsif v_actor <> 'admin' then
      raise exception 'Solo administración puede registrar este tipo de movimiento.' using errcode = '42501';
    end if;
  end if;

  -- Validaciones de entrada.
  if p_variant_id is null or p_movement_type is null then
    raise exception 'La variante y el tipo de movimiento son obligatorios.' using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor que cero.' using errcode = '22023';
  end if;
  if p_movement_type in ('adjustment_in', 'adjustment_out') and v_reason is null then
    raise exception 'Los ajustes de inventario requieren un motivo.' using errcode = '22023';
  end if;
  if p_movement_type in ('reservation', 'reservation_release', 'sale_out') and p_order_id is null then
    raise exception 'Las reservas y salidas por venta requieren un pedido.' using errcode = '22023';
  end if;

  select v.fulfillment_type into v_fulfillment
  from public.product_variants v
  where v.id = p_variant_id;

  if not found then
    raise exception 'La variante no existe.' using errcode = 'P0002';
  end if;
  if v_fulfillment <> 'stock' then
    raise exception 'Las variantes fabricadas bajo pedido no llevan inventario.' using errcode = '22023';
  end if;

  -- Bloqueo de la fila de existencias (se crea en el primer movimiento).
  insert into public.inventory_levels (variant_id) values (p_variant_id)
  on conflict (variant_id) do nothing;

  select * into v_level
  from public.inventory_levels
  where variant_id = p_variant_id
  for update;

  -- Idempotencia: se comprueba con la fila bloqueada para que dos llamadas
  -- concurrentes con la misma clave no apliquen el movimiento dos veces.
  if p_idempotency_key is not null then
    select * into v_existing
    from public.inventory_movements
    where idempotency_key = p_idempotency_key;

    if found then
      if v_existing.variant_id <> p_variant_id
         or v_existing.movement_type <> p_movement_type
         or v_existing.quantity <> p_quantity
         or v_existing.order_id is distinct from p_order_id then
        raise exception 'La clave de idempotencia ya se usó con otros datos.' using errcode = '23505';
      end if;
      return v_existing;
    end if;
  end if;

  v_on_hand := v_level.on_hand;
  v_reserved := v_level.reserved;

  case p_movement_type
    when 'production_in', 'adjustment_in', 'return_in' then
      v_on_hand := v_on_hand + p_quantity;
    when 'adjustment_out' then
      if v_on_hand - p_quantity < v_reserved then
        raise exception 'Stock insuficiente: el ajuste dejaría reservas sin respaldo (disponible: %).', v_level.available
          using errcode = '23514';
      end if;
      v_on_hand := v_on_hand - p_quantity;
    when 'reservation' then
      if v_level.available < p_quantity then
        raise exception 'Stock disponible insuficiente para reservar.' using errcode = '23514';
      end if;
      v_reserved := v_reserved + p_quantity;
    when 'reservation_release' then
      if v_reserved < p_quantity then
        raise exception 'No hay suficiente stock reservado para liberar.' using errcode = '23514';
      end if;
      v_reserved := v_reserved - p_quantity;
    when 'sale_out' then
      if v_reserved < p_quantity then
        raise exception 'La salida por venta requiere stock reservado para el pedido.' using errcode = '23514';
      end if;
      v_on_hand := v_on_hand - p_quantity;
      v_reserved := v_reserved - p_quantity;
  end case;

  update public.inventory_levels
     set on_hand = v_on_hand,
         reserved = v_reserved,
         updated_at = now()
   where variant_id = p_variant_id;

  insert into public.inventory_movements (
    variant_id, movement_type, quantity, on_hand_after, reserved_after,
    order_id, reason, idempotency_key, created_by, actor_role
  ) values (
    p_variant_id, p_movement_type, p_quantity, v_on_hand, v_reserved,
    p_order_id, v_reason, p_idempotency_key, auth.uid(), v_actor
  )
  returning * into v_result;

  return v_result;
end;
$$;

comment on function public.apply_inventory_movement is 'Única vía para cambiar existencias. Atómica, sin stock negativo e idempotente con p_idempotency_key.';

-- -----------------------------------------------------------------------------
-- Configuración de mínimo y custodio (administración)
-- -----------------------------------------------------------------------------

create function public.update_inventory_settings(
  p_variant_id uuid,
  p_min_stock integer,
  p_custodian text
)
returns public.inventory_levels
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fulfillment public.fulfillment_type;
  v_result public.inventory_levels;
begin
  if not (app.is_service_role() or app.is_admin()) then
    raise exception 'Solo administración puede configurar el inventario.' using errcode = '42501';
  end if;
  if p_min_stock is not null and p_min_stock < 0 then
    raise exception 'El stock mínimo no puede ser negativo.' using errcode = '22023';
  end if;

  select v.fulfillment_type into v_fulfillment from public.product_variants v where v.id = p_variant_id;
  if not found then
    raise exception 'La variante no existe.' using errcode = 'P0002';
  end if;
  if v_fulfillment <> 'stock' then
    raise exception 'Las variantes fabricadas bajo pedido no llevan inventario.' using errcode = '22023';
  end if;

  insert into public.inventory_levels (variant_id, min_stock, custodian)
  values (p_variant_id, p_min_stock, nullif(btrim(p_custodian), ''))
  on conflict (variant_id) do update
    set min_stock = excluded.min_stock,
        custodian = excluded.custodian,
        updated_at = now()
  returning * into v_result;

  perform app.audit('update_inventory_settings', 'inventory_levels', p_variant_id::text,
    jsonb_build_object('min_stock', p_min_stock, 'custodian', v_result.custodian));

  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- Disponibilidad pública (sin cantidades)
-- -----------------------------------------------------------------------------

create function public.get_variant_availability(p_variant_ids uuid[])
returns table (variant_id uuid, availability text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_variant_ids is null or cardinality(p_variant_ids) = 0 then
    return;
  end if;
  if cardinality(p_variant_ids) > 100 then
    raise exception 'Se pueden consultar como máximo 100 variantes por vez.' using errcode = '22023';
  end if;

  return query
  select v.id,
         case
           when v.fulfillment_type = 'made_to_order' then 'made_to_order'
           when coalesce(l.available, 0) > 0 then 'in_stock'
           else 'out_of_stock'
         end
  from public.product_variants v
  join public.products p on p.id = v.product_id
  left join public.inventory_levels l on l.variant_id = v.id
  where v.id = any (p_variant_ids)
    and v.is_active
    and p.is_active;
end;
$$;

comment on function public.get_variant_availability is 'Disponibilidad para el público: in_stock | out_of_stock | made_to_order. Nunca expone cantidades.';
