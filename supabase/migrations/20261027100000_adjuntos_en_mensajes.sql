-- Imagen adjunta en un mensaje de la conversación (la captura de pago que sube el cliente).
-- La imagen vive en el bucket privado «payment-proofs»; aquí solo se guarda su ruta. El cliente la ve en su chat y
-- la administración en Conversaciones; el Worker la sirve comprobando antes quién la pide.

alter table public.conversation_messages add column attachment_path text check (char_length(attachment_path) <= 300);

-- Misma función de registro, que ahora acepta attachment_path en la solicitud.
create or replace function public.record_conversation_message(p_request jsonb)
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
  -- Ruta de la imagen adjunta (captura de pago) en el bucket privado «payment-proofs».
  v_attachment text := nullif(btrim(p_request ->> 'attachment_path'), '');
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

  insert into public.conversation_messages (conversation_id, role, body, external_id, attachment_path)
  values (v_conversation.id, v_role, v_body, v_external_id, v_attachment)
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
