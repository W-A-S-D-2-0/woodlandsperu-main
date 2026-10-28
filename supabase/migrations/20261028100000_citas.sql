-- Citas: el cliente agenda desde el chat un día y una hora para hablar con la administración (Brigitte).
-- El Worker crea la cita con la llave de servicio; la administración las ve y las atiende desde el panel.
-- Los horarios disponibles los define la aplicación (shared/config/appointments.ts); aquí solo se evita
-- que dos clientes tomen la misma hora.

create type public.appointment_status as enum ('pending', 'done', 'cancelled');

create table public.appointments (
  id               uuid primary key default gen_random_uuid(),
  customer_name    text not null check (char_length(btrim(customer_name)) between 2 and 120),
  contact_phone    text not null check (char_length(contact_phone) between 6 and 20),
  starts_at        timestamptz not null,
  note             text check (char_length(note) <= 300),
  status           public.appointment_status not null default 'pending',
  -- Conversación de la que salió la cita (no se pierde la cita si luego se elimina el chat).
  conversation_id  uuid references public.conversations (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Una sola cita pendiente por hora.
create unique index appointments_slot_idx on public.appointments (starts_at) where status = 'pending';
create index appointments_status_idx on public.appointments (status, starts_at);

create trigger appointments_touch before update on public.appointments
  for each row execute function app.touch_updated_at();

alter table public.appointments enable row level security;

revoke all on public.appointments from anon, authenticated;
grant select on public.appointments to authenticated;
grant select, insert, update, delete on public.appointments to service_role;

create policy appointments_admin_read on public.appointments
  for select to authenticated using (app.is_admin());

comment on table public.appointments is 'Citas que los clientes agendan desde el chat para hablar con la administración.';

-- -----------------------------------------------------------------------------
-- Funciones
-- -----------------------------------------------------------------------------

-- Crea la cita. La hora debe ser futura y estar libre. Devuelve la cita creada.
create function public.create_appointment(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_request ->> 'customer_name', ''));
  v_phone text := regexp_replace(coalesce(p_request ->> 'contact_phone', ''), '[^0-9+]', '', 'g');
  v_starts timestamptz := (p_request ->> 'starts_at')::timestamptz;
  v_note text := nullif(btrim(coalesce(p_request ->> 'note', '')), '');
  v_ref text := nullif(btrim(coalesce(p_request ->> 'external_ref', '')), '');
  v_conversation uuid;
  v_row public.appointments;
begin
  perform app.require_service();

  if char_length(v_name) not between 2 and 120 then
    raise exception 'Escribe tu nombre.' using errcode = '22023';
  end if;
  if char_length(v_phone) not between 6 and 20 then
    raise exception 'Escribe un celular válido.' using errcode = '22023';
  end if;
  if v_starts is null or v_starts <= now() then
    raise exception 'Elige un día y una hora que aún no hayan pasado.' using errcode = '22023';
  end if;
  if exists (select 1 from public.appointments where starts_at = v_starts and status = 'pending') then
    raise exception 'Esa hora ya fue tomada. Elige otra.' using errcode = '23505';
  end if;

  if v_ref is not null then
    select id into v_conversation from public.conversations where channel = 'web_chat' and external_ref = v_ref;
  end if;

  insert into public.appointments (customer_name, contact_phone, starts_at, note, conversation_id)
  values (v_name, v_phone, v_starts, v_note, v_conversation)
  returning * into v_row;

  return jsonb_build_object('id', v_row.id, 'starts_at', v_row.starts_at);
end;
$$;

-- Horas ya tomadas en un rango, para no ofrecerlas.
create function public.taken_appointment_slots(p_from timestamptz, p_to timestamptz)
returns timestamptz[]
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.require_service();
  return coalesce(
    (select array_agg(starts_at order by starts_at) from public.appointments
      where status = 'pending' and starts_at >= p_from and starts_at < p_to),
    '{}');
end;
$$;

-- La administración marca la cita como atendida o cancelada (o la devuelve a pendiente si la hora sigue libre).
create function public.set_appointment_status(p_appointment_id uuid, p_status public.appointment_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.require_admin();

  update public.appointments set status = p_status where id = p_appointment_id;
  if not found then
    raise exception 'La cita no existe.' using errcode = 'P0002';
  end if;

  perform app.audit('appointment_status', 'appointments', p_appointment_id::text, jsonb_build_object('status', p_status));
end;
$$;

revoke execute on function
  public.create_appointment(jsonb),
  public.taken_appointment_slots(timestamptz, timestamptz),
  public.set_appointment_status(uuid, public.appointment_status)
from public, anon, authenticated;

grant execute on function
  public.create_appointment(jsonb),
  public.taken_appointment_slots(timestamptz, timestamptz)
to service_role;

grant execute on function public.set_appointment_status(uuid, public.appointment_status) to authenticated;
