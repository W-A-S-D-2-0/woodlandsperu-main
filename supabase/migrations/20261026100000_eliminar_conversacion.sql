-- Eliminar una conversación desde el panel (chats de prueba o que no deben conservarse).
-- Los mensajes son de solo inserción: el trigger solo deja borrarlos cuando lo hace esta función.

create function app.conversation_messages_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and current_setting('app.deleting_conversation', true) = 'on' then
    return old;
  end if;
  raise exception 'La tabla % es de solo inserción: no se permite %.', tg_table_name, tg_op
    using errcode = '42501';
end;
$$;

drop trigger conversation_messages_append_only on public.conversation_messages;
create trigger conversation_messages_append_only before update or delete on public.conversation_messages
  for each row execute function app.conversation_messages_guard();

create function public.delete_conversation(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation public.conversations;
  v_messages integer;
begin
  perform app.require_admin();

  select * into v_conversation from public.conversations where id = p_conversation_id for update;
  if not found then
    raise exception 'La conversación no existe.' using errcode = 'P0002';
  end if;

  select count(*) into v_messages from public.conversation_messages where conversation_id = p_conversation_id;

  perform set_config('app.deleting_conversation', 'on', true);
  delete from public.conversations where id = p_conversation_id;
  perform set_config('app.deleting_conversation', 'off', true);

  -- Queda constancia de quién la eliminó, no del contenido.
  perform app.audit('conversation_deleted', 'conversations', p_conversation_id::text,
    jsonb_build_object('channel', v_conversation.channel, 'messages', v_messages));
end;
$$;

comment on function public.delete_conversation is 'Elimina una conversación con todos sus mensajes. Los pagos y cotizaciones vinculados se conservan.';

revoke execute on function public.delete_conversation(uuid) from public, anon, authenticated;
grant execute on function public.delete_conversation(uuid) to authenticated;
