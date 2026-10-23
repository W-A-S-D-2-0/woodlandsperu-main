-- =============================================================================
-- Woodland Perú · 003 · Ventas: clientes, cotizaciones y pedidos
-- =============================================================================
-- Los clientes no tienen cuenta: sus solicitudes entran por la web, el chat o WhatsApp
-- a través del backend (clave de servicio), que valida los datos y calcula los importes.
-- El estado de pago de un pedido solo lo cambian las funciones de pago (Fase 5).

create type public.customer_type as enum ('individual', 'business');
create type public.sales_channel as enum ('web', 'web_chat', 'whatsapp', 'admin');
create type public.quote_status as enum (
  'submitted', 'under_review', 'sent', 'accepted', 'rejected', 'expired', 'converted', 'cancelled'
);
create type public.order_status as enum (
  'pending_confirmation', 'confirmed', 'in_production', 'ready', 'shipped', 'delivered', 'cancelled'
);
create type public.payment_status as enum (
  'unpaid', 'pending', 'paid', 'failed', 'refunded', 'partially_refunded', 'charged_back'
);

-- -----------------------------------------------------------------------------
-- Clientes
-- -----------------------------------------------------------------------------

create table public.customers (
  id               uuid primary key default gen_random_uuid(),
  customer_type    public.customer_type not null,
  full_name        text not null check (char_length(btrim(full_name)) between 1 and 160),
  company_name     text check (char_length(btrim(company_name)) between 1 and 200),
  document_type    text check (document_type in ('DNI', 'RUC', 'CE', 'PASAPORTE')),
  document_number  text check (document_number ~ '^[0-9A-Z]{6,15}$'),
  email            text check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone            text check (phone ~ '^\+?[0-9]{7,15}$'),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint customers_contact_required check (email is not null or phone is not null),
  constraint customers_business_company check (customer_type <> 'business' or company_name is not null),
  constraint customers_document_pair check ((document_type is null) = (document_number is null))
);

create unique index customers_email_unique on public.customers (lower(email)) where email is not null;
create index customers_phone_idx on public.customers (phone) where phone is not null;

alter table public.customers enable row level security;

create trigger customers_touch before update on public.customers
  for each row execute function app.touch_updated_at();

create table public.customer_notes (
  id           bigint generated always as identity primary key,
  customer_id  uuid not null references public.customers (id) on delete cascade,
  body         text not null check (char_length(btrim(body)) between 1 and 2000),
  created_by   uuid references auth.users (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);

create index customer_notes_customer_idx on public.customer_notes (customer_id, created_at desc);

alter table public.customer_notes enable row level security;

-- -----------------------------------------------------------------------------
-- Cotizaciones
-- -----------------------------------------------------------------------------

create sequence public.quote_code_seq;

create table public.quotes (
  id                      uuid primary key default gen_random_uuid(),
  code                    text not null unique default ('COT-' || to_char(nextval('public.quote_code_seq'), 'FM000000')),
  customer_id             uuid not null references public.customers (id) on delete restrict,
  channel                 public.sales_channel not null,
  status                  public.quote_status not null default 'submitted',
  -- Toda cotización se revisa salvo que el backend determine lo contrario con los umbrales configurados.
  requires_review         boolean not null default true,
  review_reason           text check (char_length(review_reason) <= 500),
  customer_message        text check (char_length(customer_message) <= 2000),
  subtotal                numeric(12, 2) not null default 0 check (subtotal >= 0),
  discount_total          numeric(12, 2) not null default 0 check (discount_total >= 0),
  total                   numeric(12, 2) generated always as (subtotal - discount_total) stored,
  currency                char(3) not null default 'PEN' check (currency = 'PEN'),
  valid_until             date,
  -- Los plazos son siempre estimados y sujetos a confirmación.
  delivery_estimate_note  text check (char_length(delivery_estimate_note) <= 300),
  converted_order_id      uuid,
  reviewed_by             uuid references auth.users (id) on delete set null,
  reviewed_at             timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint quotes_discount_le_subtotal check (discount_total <= subtotal)
);

create index quotes_customer_idx on public.quotes (customer_id);
create index quotes_status_idx on public.quotes (status, created_at desc);

alter table public.quotes enable row level security;

create trigger quotes_touch before update on public.quotes
  for each row execute function app.touch_updated_at();

create trigger quotes_audit_status after update of status on public.quotes
  for each row when (old.status is distinct from new.status)
  execute function app.audit_row_change();

create function app.guard_quote_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status in ('converted', 'cancelled') and new.status is distinct from old.status then
    raise exception 'La cotización % está cerrada (%): no puede cambiar de estado.', old.code, old.status
      using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger quotes_guard_status before update of status on public.quotes
  for each row execute function app.guard_quote_status();

create table public.quote_items (
  id                 uuid primary key default gen_random_uuid(),
  quote_id           uuid not null references public.quotes (id) on delete cascade,
  -- Null para piezas totalmente a medida que no existen en el catálogo.
  variant_id         uuid references public.product_variants (id) on delete restrict,
  description        text not null check (char_length(btrim(description)) between 1 and 300),
  quantity           integer not null check (quantity between 1 and 100000),
  -- Null mientras el equipo no defina el precio (medidas especiales o personalización).
  unit_price         numeric(12, 2) check (unit_price >= 0),
  line_total         numeric(12, 2) generated always as (quantity * unit_price) stored,
  price_source       public.price_source,
  custom_dimensions  text check (char_length(custom_dimensions) <= 120),
  customization      text check (char_length(customization) <= 1000),
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now(),
  constraint quote_items_price_source check ((unit_price is null) = (price_source is null))
);

create index quote_items_quote_idx on public.quote_items (quote_id);

alter table public.quote_items enable row level security;

-- -----------------------------------------------------------------------------
-- Pedidos
-- -----------------------------------------------------------------------------

create sequence public.order_code_seq;

create table public.orders (
  id                      uuid primary key default gen_random_uuid(),
  code                    text not null unique default ('PED-' || to_char(nextval('public.order_code_seq'), 'FM000000')),
  customer_id             uuid not null references public.customers (id) on delete restrict,
  quote_id                uuid unique references public.quotes (id) on delete set null,
  channel                 public.sales_channel not null,
  status                  public.order_status not null default 'pending_confirmation',
  payment_status          public.payment_status not null default 'unpaid',
  subtotal                numeric(12, 2) not null default 0 check (subtotal >= 0),
  discount_total          numeric(12, 2) not null default 0 check (discount_total >= 0),
  shipping_total          numeric(12, 2) not null default 0 check (shipping_total >= 0),
  total                   numeric(12, 2) generated always as (subtotal - discount_total + shipping_total) stored,
  currency                char(3) not null default 'PEN' check (currency = 'PEN'),
  -- El pedido solo se vuelve definitivo cuando el cliente lo confirma.
  customer_confirmed_at   timestamptz,
  delivery_estimate_note  text check (char_length(delivery_estimate_note) <= 300),
  shipping_address        text check (char_length(shipping_address) <= 500),
  internal_notes          text check (char_length(internal_notes) <= 2000),
  cancel_reason           text check (char_length(cancel_reason) <= 500),
  cancelled_at            timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint orders_discount_le_subtotal check (discount_total <= subtotal),
  constraint orders_cancel_reason check (status <> 'cancelled' or cancel_reason is not null)
);

create index orders_customer_idx on public.orders (customer_id);
create index orders_status_idx on public.orders (status, created_at desc);

alter table public.orders enable row level security;

alter table public.quotes
  add constraint quotes_converted_order_fk
  foreign key (converted_order_id) references public.orders (id) on delete set null;

create trigger orders_touch before update on public.orders
  for each row execute function app.touch_updated_at();

create trigger orders_audit after update of status, payment_status on public.orders
  for each row when (old.status is distinct from new.status or old.payment_status is distinct from new.payment_status)
  execute function app.audit_row_change();

-- Flujo permitido del estado operativo del pedido.
create function app.order_status_transition_allowed(p_from public.order_status, p_to public.order_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_from = p_to or (p_from, p_to) in (
    ('pending_confirmation'::public.order_status, 'confirmed'::public.order_status),
    ('pending_confirmation', 'cancelled'),
    ('confirmed', 'in_production'),
    ('confirmed', 'ready'),
    ('confirmed', 'cancelled'),
    ('in_production', 'ready'),
    ('in_production', 'cancelled'),
    ('ready', 'shipped'),
    ('ready', 'delivered'),
    ('ready', 'cancelled'),
    ('shipped', 'delivered')
  );
$$;

-- Solo las funciones de pago (Fase 5) activan esta bandera, local a su transacción.
create function app.payment_update_allowed()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('woodland.payment_update', true), '') = 'on';
$$;

create function app.guard_order_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.payment_status <> 'unpaid' and not app.payment_update_allowed() then
      raise exception 'Un pedido nuevo no puede registrarse como pagado.' using errcode = '42501';
    end if;
    if new.status not in ('pending_confirmation', 'confirmed') then
      raise exception 'Un pedido nuevo debe iniciar pendiente de confirmación o confirmado.' using errcode = '22023';
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

  if new.status = 'confirmed' and old.status <> 'confirmed' and new.customer_confirmed_at is null then
    raise exception 'El pedido requiere la confirmación del cliente antes de confirmarse.' using errcode = '22023';
  end if;

  if new.status = 'cancelled' and old.status <> 'cancelled' then
    new.cancelled_at := now();
  end if;

  return new;
end;
$$;

create trigger orders_guard before insert or update on public.orders
  for each row execute function app.guard_order_changes();

create table public.order_items (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.orders (id) on delete cascade,
  variant_id         uuid references public.product_variants (id) on delete restrict,
  description        text not null check (char_length(btrim(description)) between 1 and 300),
  quantity           integer not null check (quantity between 1 and 100000),
  unit_price         numeric(12, 2) not null check (unit_price >= 0),
  line_total         numeric(12, 2) generated always as (quantity * unit_price) stored,
  price_source       public.price_source not null,
  -- Copia al momento del pedido: define si se reserva stock o se fabrica.
  fulfillment_type   public.fulfillment_type not null,
  custom_dimensions  text check (char_length(custom_dimensions) <= 120),
  customization      text check (char_length(customization) <= 1000),
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now(),
  constraint order_items_custom_is_made_to_order check (variant_id is not null or fulfillment_type = 'made_to_order')
);

create index order_items_order_idx on public.order_items (order_id);

alter table public.order_items enable row level security;

-- -----------------------------------------------------------------------------
-- Totales: los subtotales se recalculan siempre desde los ítems
-- -----------------------------------------------------------------------------

create function app.recalculate_quote_subtotal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote_id uuid := coalesce(new.quote_id, old.quote_id);
begin
  update public.quotes q
     set subtotal = coalesce((select sum(i.line_total) from public.quote_items i where i.quote_id = v_quote_id), 0),
         -- Un ítem sin precio definido obliga a revisión humana.
         requires_review = q.requires_review
           or exists (select 1 from public.quote_items i where i.quote_id = v_quote_id and i.unit_price is null)
   where q.id = v_quote_id;
  return null;
end;
$$;

create trigger quote_items_totals after insert or update or delete on public.quote_items
  for each row execute function app.recalculate_quote_subtotal();

create function app.recalculate_order_subtotal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid := coalesce(new.order_id, old.order_id);
begin
  update public.orders o
     set subtotal = coalesce((select sum(i.line_total) from public.order_items i where i.order_id = v_order_id), 0)
   where o.id = v_order_id;
  return null;
end;
$$;

create trigger order_items_totals after insert or update or delete on public.order_items
  for each row execute function app.recalculate_order_subtotal();
