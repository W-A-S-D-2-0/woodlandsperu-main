-- =============================================================================
-- Woodland Perú · 002 · Catálogo: categorías, productos, variantes y precios
-- =============================================================================
-- Producto = modelo comercial (p. ej. "Super Grill"); variante = presentación vendible
-- con SKU, medidas y precio (p. ej. "XL"). El público ve solo lo activo; costos y
-- precios negociados viven aparte y son exclusivos de administración.

create type public.fulfillment_type as enum ('stock', 'made_to_order');

comment on type public.fulfillment_type is 'stock: pieza ya producida que se descuenta del inventario · made_to_order: se fabrica bajo pedido y no lleva inventario.';

create type public.price_source as enum ('catalog', 'tier', 'negotiated', 'manual');

-- -----------------------------------------------------------------------------
-- Categorías
-- -----------------------------------------------------------------------------

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  description text check (char_length(description) <= 500),
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.categories enable row level security;

create trigger categories_touch before update on public.categories
  for each row execute function app.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Productos
-- -----------------------------------------------------------------------------

create table public.products (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name             text not null check (char_length(btrim(name)) between 1 and 120),
  description      text check (char_length(description) <= 4000),
  category_id      uuid references public.categories (id) on delete restrict,
  is_customizable  boolean not null default false,
  -- Un producto nuevo nace inactivo: se publica cuando la empresa valida sus datos.
  is_active        boolean not null default false,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index products_category_idx on public.products (category_id);

alter table public.products enable row level security;

create trigger products_touch before update on public.products
  for each row execute function app.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Variantes
-- -----------------------------------------------------------------------------

create table public.product_variants (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references public.products (id) on delete restrict,
  sku               text not null unique check (sku ~ '^[A-Z0-9][A-Z0-9-]{1,39}$'),
  name              text not null check (char_length(btrim(name)) between 1 and 120),
  -- Medidas tal como las registra la empresa (p. ej. '65*46*4'). Las numéricas son opcionales.
  dimensions_label  text check (char_length(dimensions_label) <= 60),
  length_cm         numeric(6, 1) check (length_cm > 0),
  width_cm          numeric(6, 1) check (width_cm > 0),
  thickness_cm      numeric(5, 1) check (thickness_cm > 0),
  -- Precio público de catálogo en PEN. Null = precio a cotizar (no se vende directo).
  catalog_price     numeric(12, 2) check (catalog_price >= 0),
  fulfillment_type  public.fulfillment_type not null default 'stock',
  is_active         boolean not null default false,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index product_variants_product_idx on public.product_variants (product_id);

alter table public.product_variants enable row level security;

create trigger product_variants_touch before update on public.product_variants
  for each row execute function app.touch_updated_at();

create trigger product_variants_audit_price
  after update of catalog_price, is_active, fulfillment_type on public.product_variants
  for each row
  when (old.catalog_price is distinct from new.catalog_price
        or old.is_active is distinct from new.is_active
        or old.fulfillment_type is distinct from new.fulfillment_type)
  execute function app.audit_row_change();

-- -----------------------------------------------------------------------------
-- Precios escalonados (autorizados por la empresa)
-- -----------------------------------------------------------------------------

create table public.price_tiers (
  id            uuid primary key default gen_random_uuid(),
  variant_id    uuid not null references public.product_variants (id) on delete cascade,
  min_quantity  integer not null check (min_quantity >= 2),
  unit_price    numeric(12, 2) not null check (unit_price > 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (variant_id, min_quantity)
);

alter table public.price_tiers enable row level security;

create trigger price_tiers_touch before update on public.price_tiers
  for each row execute function app.touch_updated_at();

create trigger price_tiers_audit after insert or update or delete on public.price_tiers
  for each row execute function app.audit_row_change();

-- -----------------------------------------------------------------------------
-- Datos internos de precio (solo administración)
-- -----------------------------------------------------------------------------

create table public.variant_internal_pricing (
  variant_id        uuid primary key references public.product_variants (id) on delete cascade,
  unit_cost         numeric(12, 2) check (unit_cost >= 0),
  -- "Precio conversado" del inventario de la empresa. Su uso comercial está por confirmar.
  negotiated_price  numeric(12, 2) check (negotiated_price >= 0),
  cost_source       text check (char_length(cost_source) <= 200),
  notes             text check (char_length(notes) <= 1000),
  updated_at        timestamptz not null default now(),
  updated_by        uuid references auth.users (id) on delete set null default auth.uid()
);

alter table public.variant_internal_pricing enable row level security;

create trigger variant_internal_pricing_touch before update on public.variant_internal_pricing
  for each row execute function app.touch_updated_at();

create trigger variant_internal_pricing_audit after insert or update or delete on public.variant_internal_pricing
  for each row execute function app.audit_row_change('variant_id');

-- -----------------------------------------------------------------------------
-- Regla de precio unitario (única fuente de verdad, usada por cotizaciones y pedidos)
-- -----------------------------------------------------------------------------
-- Escala con el mayor min_quantity <= cantidad; si no hay, precio de catálogo.
-- Devuelve unit_price null si la variante no tiene precio publicado (requiere cotización).
-- Solo considera variantes y productos activos.

create function app.resolve_unit_price(p_variant_id uuid, p_quantity integer)
returns table (unit_price numeric, price_source public.price_source)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_catalog_price numeric;
  v_tier_price numeric;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor que cero.' using errcode = '22023';
  end if;

  select v.catalog_price
    into v_catalog_price
  from public.product_variants v
  join public.products p on p.id = v.product_id
  where v.id = p_variant_id
    and v.is_active
    and p.is_active;

  if not found then
    raise exception 'La variante no existe o no está disponible.' using errcode = 'P0002';
  end if;

  select t.unit_price
    into v_tier_price
  from public.price_tiers t
  where t.variant_id = p_variant_id
    and t.min_quantity <= p_quantity
  order by t.min_quantity desc
  limit 1;

  if v_tier_price is not null then
    return query select v_tier_price, 'tier'::public.price_source;
  elsif v_catalog_price is not null then
    return query select v_catalog_price, 'catalog'::public.price_source;
  else
    return query select null::numeric, null::public.price_source;
  end if;
end;
$$;
