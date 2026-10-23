-- =============================================================================
-- Woodland Perú · 001 · Base: esquema interno, roles del personal, ajustes y auditoría
-- =============================================================================
-- Convenciones:
--   * Tablas de negocio en `public` (expuestas por la API de Supabase, protegidas con RLS).
--   * Funciones auxiliares internas en `app` (no expuesto por la API).
--   * Funciones SECURITY DEFINER siempre con `search_path = ''` y nombres calificados.
--   * Montos en soles (PEN) con numeric(12,2).

create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------

create function app.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Bloquea UPDATE/DELETE en tablas de solo inserción (auditoría, movimientos de inventario).
create function app.prevent_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'La tabla % es de solo inserción: no se permite %.', tg_table_name, tg_op
    using errcode = '42501';
end;
$$;

-- -----------------------------------------------------------------------------
-- Personal y roles
-- -----------------------------------------------------------------------------

create type public.app_role as enum ('admin', 'workshop');

comment on type public.app_role is 'admin: administración completa · workshop: taller (catálogo, inventario y pedidos en modo lectura; registra producción).';

create table public.staff_members (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  role        public.app_role not null,
  full_name   text not null check (char_length(btrim(full_name)) between 1 and 120),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.staff_members is 'Personal de Woodland con acceso al panel. Las altas se hacen manualmente (no hay registro público).';

alter table public.staff_members enable row level security;

create trigger staff_members_touch before update on public.staff_members
  for each row execute function app.touch_updated_at();

-- Claims del JWT de la petición actual (Supabase/PostgREST los define por transacción).
create function app.jwt_role()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'role', '');
$$;

-- true solo cuando la petición usa la clave de servicio (backend). Nunca desde el navegador.
create function app.is_service_role()
returns boolean
language sql
stable
set search_path = ''
as $$
  select app.jwt_role() = 'service_role';
$$;

-- Rol del usuario autenticado si es personal activo; null en cualquier otro caso.
create function app.current_staff_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select s.role
  from public.staff_members s
  where s.user_id = auth.uid()
    and s.is_active;
$$;

create function app.is_staff()
returns boolean
language sql
stable
set search_path = ''
as $$
  select app.current_staff_role() is not null;
$$;

create function app.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(app.current_staff_role() = 'admin', false);
$$;

-- Etiqueta del actor para auditoría: 'admin' | 'workshop' | 'service' | 'system'.
create function app.actor_label()
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when app.is_service_role() then 'service'
    else coalesce(app.current_staff_role()::text, 'system')
  end;
$$;

-- -----------------------------------------------------------------------------
-- Ajustes comerciales (valores definidos por Woodland; null = no configurado)
-- -----------------------------------------------------------------------------

create table public.business_settings (
  key          text primary key check (key ~ '^[a-z][a-z0-9_]{2,62}$'),
  value        jsonb,
  description  text not null,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users (id) on delete set null
);

alter table public.business_settings enable row level security;

create trigger business_settings_touch before update on public.business_settings
  for each row execute function app.touch_updated_at();

-- Sin valores inventados: Woodland debe definirlos. Mientras sean null, el sistema
-- aplica la opción más conservadora (por ejemplo, revisión humana de toda cotización).
insert into public.business_settings (key, value, description) values
  ('quote_review_min_total', null, 'Monto total (PEN) desde el cual una cotización o pedido requiere revisión humana. Null: se revisan todos.'),
  ('quote_review_min_quantity', null, 'Cantidad total de unidades desde la cual se requiere revisión humana. Null: se revisan todos.'),
  ('quote_validity_days', null, 'Días de vigencia de una cotización enviada. Null: sin fecha de vencimiento automática.');

-- -----------------------------------------------------------------------------
-- Auditoría de acciones sensibles (solo inserción)
-- -----------------------------------------------------------------------------

create table public.audit_log (
  id             bigint generated always as identity primary key,
  occurred_at    timestamptz not null default now(),
  actor_user_id  uuid,
  actor_role     text not null,
  action         text not null check (char_length(action) between 1 and 80),
  entity_type    text not null check (char_length(entity_type) between 1 and 80),
  entity_id      text,
  details        jsonb not null default '{}'::jsonb
);

create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);
create index audit_log_occurred_idx on public.audit_log (occurred_at desc);

alter table public.audit_log enable row level security;

create trigger audit_log_append_only before update or delete on public.audit_log
  for each row execute function app.prevent_mutation();

create function app.audit(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_details jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (actor_user_id, actor_role, action, entity_type, entity_id, details)
  values (auth.uid(), app.actor_label(), p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;

-- Trigger genérico: registra altas, cambios y bajas con el estado anterior y nuevo.
create function app.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text;
begin
  v_id := coalesce(to_jsonb(new), to_jsonb(old)) ->> coalesce(tg_argv[0], 'id');
  perform app.audit(
    lower(tg_op),
    tg_table_name,
    v_id,
    jsonb_strip_nulls(jsonb_build_object(
      'old', case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
      'new', case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
    ))
  );
  return coalesce(new, old);
end;
$$;

create trigger staff_members_audit after insert or update or delete on public.staff_members
  for each row execute function app.audit_row_change('user_id');

create trigger business_settings_audit after update on public.business_settings
  for each row execute function app.audit_row_change('key');
