-- =============================================================================
-- Woodland Perú · 008 · Conversaciones (chat web y WhatsApp) con derivación a una persona
-- =============================================================================
-- El asistente atiende por chat web y por WhatsApp. Todo queda registrado, y cuando el cliente
-- pide una persona (o el asistente no puede resolver) la conversación pasa a "needs_human" para
-- que el equipo la tome desde el panel.
--
-- Estados de una conversación:
--   open         · la atiende el asistente
--   needs_human  · espera a una persona (derivada por el cliente o por el asistente)
--   with_human   · una persona del equipo ya la tomó: el asistente deja de responder
--   closed       · cerrada; si el cliente escribe de nuevo, se reabre
--
-- Quién escribe qué: los mensajes y los cambios de estado de clientes y del asistente los hace el
-- backend (service_role) con las funciones de abajo. El personal (admin) lee, responde, toma,
-- devuelve al asistente y cierra. Nadie escribe las tablas directamente.

create type public.conversation_channel as enum ('web_chat', 'whatsapp');
create type public.conversation_status as enum ('open', 'needs_human', 'with_human', 'closed');
create type public.message_role as enum ('customer', 'assistant', 'staff', 'system');

create table public.conversations (
  id                    uuid primary key default gen_random_uuid(),
  channel               public.conversation_channel not null,
  -- Web: hash del token de sesión del navegador. WhatsApp: teléfono del cliente (solo dígitos).
  external_ref          text not null check (char_length(external_ref) between 6 and 128),
  customer_id           uuid references public.customers (id) on delete set null,
  contact_name          text check (char_length(contact_name) <= 160),
  contact_phone         text check (char_length(contact_phone) <= 40),
  contact_email         text check (char_length(contact_email) <= 254),
  status                public.conversation_status not null default 'open',
  handoff_reason        text check (char_length(handoff_reason) <= 500),
  handoff_requested_at  timestamptz,
  assigned_to           uuid references auth.users (id) on delete set null,
  quote_id              uuid references public.quotes (id) on delete set null,
  last_message_at       timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (channel, external_ref)
);

create index conversations_status_idx on public.conversations (status, last_message_at desc);
create index conversations_customer_idx on public.conversations (customer_id);

create trigger conversations_touch before update on public.conversations
  for each row execute function app.touch_updated_at();

create table public.conversation_messages (
  id               bigint generated always as identity primary key,
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  role             public.message_role not null,
  body             text not null check (char_length(btrim(body)) between 1 and 4000),
  sender_id        uuid references auth.users (id) on delete set null,
  -- Id del mensaje en el proveedor (WhatsApp): hace idempotentes los reintentos del webhook.
  external_id      text check (char_length(external_id) <= 200),
  created_at       timestamptz not null default now()
);

create index conversation_messages_thread_idx on public.conversation_messages (conversation_id, id);
create unique index conversation_messages_external_idx on public.conversation_messages (external_id) where external_id is not null;

-- El registro es de solo inserción: lo dicho en una conversación no se edita ni se borra.
create trigger conversation_messages_append_only before update or delete on public.conversation_messages
  for each row execute function app.prevent_mutation();

alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;

revoke all on public.conversations, public.conversation_messages from anon, authenticated;
grant select on public.conversations, public.conversation_messages to authenticated;
grant select, insert, update, delete on public.conversations, public.conversation_messages to service_role;
grant usage, select on sequence public.conversation_messages_id_seq to service_role;

create policy conversations_admin_read on public.conversations
  for select to authenticated using (app.is_admin());
create policy conversation_messages_admin_read on public.conversation_messages
  for select to authenticated using (app.is_admin());

-- -----------------------------------------------------------------------------
-- Funciones del backend
-- -----------------------------------------------------------------------------

-- Registra un mensaje. Crea la conversación si no existe (por canal + referencia externa).
-- p_request: { channel, external_ref, role: 'customer'|'assistant'|'system', body,
--              contact_name?, contact_phone?, external_id? }
-- Devuelve { conversation_id, message_id, status, duplicate }.
-- Un mensaje del cliente reabre una conversación cerrada. Límite: 60 mensajes del cliente por
-- hora en una misma conversación (frena abusos y bucles).
create function public.record_conversation_message(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_channel public.conversation_channel := (p_request ->> 'channel')::public.conversation_channel;
  v_ref text := nullif(btrim(p_request ->> 'external_ref'), '');
  v_role public.message_role := coalesce(p_request ->> 'role', 'customer')::public.message_role;
  v_body text := btrim(coalesce(p_request ->> 'body', ''));
  v_external_id text := nullif(btrim(p_request ->> 'external_id'), '');
  v_name text := nullif(btrim(p_request ->> 'contact_name'), '');
  v_phone text := nullif(regexp_replace(coalesce(p_request ->> 'contact_phone', ''), '[^0-9+]', '', 'g'), '');
  v_conversation public.conversations;
  v_message_id bigint;
  v_existing bigint;
  v_existing_conversation uuid;
begin
  perform app.require_service();

  if v_role = 'staff' then
    raise exception 'Las respuestas del equipo se registran desde el panel.' using errcode = '22023';
  end if;
  if v_ref is null then
    raise exception 'Falta la referencia de la conversación.' using errcode = '22023';
  end if;
  if char_length(v_body) not between 1 and 4000 then
    raise exception 'El mensaje debe tener entre 1 y 4000 caracteres.' using errcode = '22023';
  end if;

  -- Reintento del proveedor: no se duplica.
  if v_external_id is not null then
    select m.id, m.conversation_id into v_existing, v_existing_conversation
    from public.conversation_messages m where m.external_id = v_external_id;
    if found then
      select * into v_conversation from public.conversations where id = v_existing_conversation;
      return jsonb_build_object(
        'conversation_id', v_conversation.id, 'message_id', v_existing,
        'status', v_conversation.status, 'duplicate', true);
    end if;
  end if;

  insert into public.conversations (channel, external_ref, contact_name, contact_phone)
  values (v_channel, v_ref, v_name, case when v_channel = 'whatsapp' then coalesce(v_phone, v_ref) else v_phone end)
  on conflict (channel, external_ref) do nothing;

  select * into v_conversation from public.conversations
  where channel = v_channel and external_ref = v_ref
  for update;

  if v_role = 'customer' and (
    select count(*) from public.conversation_messages m
    where m.conversation_id = v_conversation.id and m.role = 'customer' and m.created_at > now() - interval '1 hour'
  ) >= 60 then
    raise exception 'Demasiados mensajes en poco tiempo. Intenta de nuevo más tarde.' using errcode = '54000';
  end if;

  insert into public.conversation_messages (conversation_id, role, body, external_id)
  values (v_conversation.id, v_role, v_body, v_external_id)
  returning id into v_message_id;

  update public.conversations c set
    last_message_at = now(),
    contact_name = coalesce(c.contact_name, v_name),
    status = case when v_role = 'customer' and c.status = 'closed' then 'open'::public.conversation_status else c.status end
  where c.id = v_conversation.id
  returning * into v_conversation;

  return jsonb_build_object(
    'conversation_id', v_conversation.id, 'message_id', v_message_id,
    'status', v_conversation.status, 'duplicate', false);
end;
$$;

-- Deriva la conversación a una persona. Si ya la tomó alguien del equipo, no cambia nada.
create function public.request_handoff(p_conversation_id uuid, p_reason text default null)
returns public.conversation_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.conversation_status;
begin
  perform app.require_service();

  update public.conversations c set
    status = case when c.status in ('open', 'closed') then 'needs_human'::public.conversation_status else c.status end,
    handoff_reason = case when c.status in ('open', 'closed') then nullif(left(btrim(coalesce(p_reason, '')), 500), '') else c.handoff_reason end,
    handoff_requested_at = case when c.status in ('open', 'closed') then now() else c.handoff_requested_at end
  where c.id = p_conversation_id
  returning c.status into v_status;

  if not found then
    raise exception 'La conversación no existe.' using errcode = 'P0002';
  end if;

  perform app.audit('conversation_handoff', 'conversations', p_conversation_id::text,
    jsonb_build_object('reason', left(coalesce(p_reason, ''), 200)));
  return v_status;
end;
$$;

-- Asocia la cotización creada por el asistente y el cliente que quedó registrado.
create function public.link_conversation_quote(p_conversation_id uuid, p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.require_service();

  update public.conversations c set
    quote_id = q.id,
    customer_id = coalesce(q.customer_id, c.customer_id)
  from public.quotes q
  where c.id = p_conversation_id and q.id = p_quote_id;

  if not found then
    raise exception 'La conversación o la cotización no existe.' using errcode = 'P0002';
  end if;

  perform app.audit('conversation_quote_linked', 'conversations', p_conversation_id::text,
    jsonb_build_object('quote_id', p_quote_id));
end;
$$;

-- -----------------------------------------------------------------------------
-- Funciones del panel (administración)
-- -----------------------------------------------------------------------------

create function app.require_admin()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not app.is_admin() then
    raise exception 'Solo administración puede hacer esto.' using errcode = '42501';
  end if;
end;
$$;

-- Responde como persona. Quien responde toma la conversación: el asistente deja de contestar.
create function public.staff_reply(p_conversation_id uuid, p_body text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_body text := btrim(coalesce(p_body, ''));
  v_message_id bigint;
begin
  perform app.require_admin();

  if char_length(v_body) not between 1 and 4000 then
    raise exception 'El mensaje debe tener entre 1 y 4000 caracteres.' using errcode = '22023';
  end if;

  update public.conversations set
    status = 'with_human',
    assigned_to = coalesce(assigned_to, auth.uid()),
    last_message_at = now()
  where id = p_conversation_id;
  if not found then
    raise exception 'La conversación no existe.' using errcode = 'P0002';
  end if;

  insert into public.conversation_messages (conversation_id, role, body, sender_id)
  values (p_conversation_id, 'staff', v_body, auth.uid())
  returning id into v_message_id;

  return v_message_id;
end;
$$;

-- Toma la conversación sin escribir todavía.
create function public.take_conversation(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.require_admin();

  update public.conversations set status = 'with_human', assigned_to = auth.uid()
  where id = p_conversation_id and status <> 'closed';
  if not found then
    raise exception 'La conversación no existe o está cerrada.' using errcode = 'P0002';
  end if;

  perform app.audit('conversation_taken', 'conversations', p_conversation_id::text);
end;
$$;

-- Devuelve la conversación al asistente o la cierra.
create function public.set_conversation_status(p_conversation_id uuid, p_status public.conversation_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.require_admin();

  if p_status not in ('open', 'closed') then
    raise exception 'Solo se puede devolver al asistente o cerrar.' using errcode = '22023';
  end if;

  update public.conversations set
    status = p_status,
    assigned_to = case when p_status = 'open' then null else assigned_to end,
    handoff_reason = case when p_status = 'open' then null else handoff_reason end
  where id = p_conversation_id;
  if not found then
    raise exception 'La conversación no existe.' using errcode = 'P0002';
  end if;

  perform app.audit('conversation_status', 'conversations', p_conversation_id::text,
    jsonb_build_object('status', p_status));
end;
$$;

comment on table public.conversations is 'Conversaciones del chat web y de WhatsApp con el asistente comercial y derivación a una persona.';
comment on table public.conversation_messages is 'Mensajes de las conversaciones. Solo inserción.';

revoke execute on function
  public.record_conversation_message(jsonb),
  public.request_handoff(uuid, text),
  public.link_conversation_quote(uuid, uuid),
  public.staff_reply(uuid, text),
  public.take_conversation(uuid),
  public.set_conversation_status(uuid, public.conversation_status),
  app.require_admin()
from public, anon, authenticated;

grant execute on function
  public.record_conversation_message(jsonb),
  public.request_handoff(uuid, text),
  public.link_conversation_quote(uuid, uuid),
  app.require_admin()
to service_role;

grant execute on function
  public.staff_reply(uuid, text),
  public.take_conversation(uuid),
  public.set_conversation_status(uuid, public.conversation_status),
  app.require_admin()
to authenticated;
