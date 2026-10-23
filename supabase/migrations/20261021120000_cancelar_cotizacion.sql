-- Archivar una cotización desde el panel: pasa a "cancelled" (no se borra, queda en el historial y en la auditoría).
-- Sirve para sacar de la lista las solicitudes de prueba o las que el cliente descartó.

create function public.cancel_quote(p_quote_id uuid)
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
  if v_quote.status = 'cancelled' then
    return app.quote_summary(p_quote_id);
  end if;
  if v_quote.status = 'converted' then
    raise exception 'La cotización % ya es un pedido: cancela el pedido, no la cotización.', v_quote.code using errcode = '22023';
  end if;

  update public.quotes set status = 'cancelled' where id = p_quote_id;
  return app.quote_summary(p_quote_id);
end;
$$;

comment on function public.cancel_quote is 'Archiva una cotización (estado cancelled). Las ya convertidas en pedido no se pueden cancelar desde aquí.';

revoke execute on function public.cancel_quote(uuid) from public, anon, authenticated;
grant execute on function public.cancel_quote(uuid) to authenticated, service_role;
