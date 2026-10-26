-- Una constancia de pago no se puede usar en dos pedidos: se guarda el número de operación que lee el backend
-- de la captura (Yape o Plin) y no se repite por medio de pago.

alter table public.order_payments
  add column provider text check (provider in ('yape', 'plin')),
  add column operation_code text check (char_length(operation_code) between 1 and 40);

-- Un número de operación vale una sola vez por medio de pago.
create unique index order_payments_operation_uidx on public.order_payments (provider, operation_code) where operation_code is not null;

-- Misma función de pago, ahora con el número de operación y el medio. Las llamadas anteriores (3 parámetros) siguen válidas.
drop function public.record_chat_payment(uuid, text, uuid);

create function public.record_chat_payment(
  p_order_id uuid,
  p_proof_path text,
  p_conversation_id uuid default null,
  p_operation_code text default null,
  p_provider text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_status public.order_status;
  v_code text := nullif(btrim(p_operation_code), '');
  v_provider text := case when p_provider in ('yape', 'plin') then p_provider else null end;
begin
  perform app.require_service();

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'El pedido no existe.' using errcode = 'P0002';
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'El pedido % está cancelado.', v_order.code using errcode = '22023';
  end if;
  if v_order.payment_status = 'paid' then
    return jsonb_build_object('code', v_order.code, 'status', v_order.status, 'payment_status', v_order.payment_status, 'already_paid', true);
  end if;
  if v_code is not null and v_provider is not null and exists (
    select 1 from public.order_payments where provider = v_provider and operation_code = v_code
  ) then
    raise exception 'Esa constancia de pago ya se usó en otro pedido.' using errcode = '22023';
  end if;

  insert into public.order_payments (order_id, method, amount, proof_path, conversation_id, provider, operation_code)
  values (p_order_id, 'yape', v_order.total, p_proof_path, p_conversation_id, case when v_code is null then null else v_provider end, case when v_provider is null then null else v_code end);

  perform set_config('woodland.payment_update', 'on', true);
  update public.orders
     set payment_status = 'paid',
         internal_notes = left(coalesce(v_order.internal_notes || E'\n', '') || 'Pago por Yape o Plin registrado con captura desde el chat: verificar en la app.', 2000)
   where id = p_order_id;
  perform set_config('woodland.payment_update', 'off', true);

  if v_order.status = 'pending_confirmation' then
    begin
      perform public.confirm_order(p_order_id, true);
    exception when check_violation then
      -- Sin stock para reservar: se fabrica a pedido y se confirma sin reservar.
      update public.order_items set fulfillment_type = 'made_to_order' where order_id = p_order_id and fulfillment_type = 'stock';
      perform public.confirm_order(p_order_id, true);
    end;
  end if;

  select status into v_status from public.orders where id = p_order_id;
  if v_status = 'confirmed' then
    update public.orders set status = 'in_production' where id = p_order_id;
    v_status := 'in_production';
  end if;

  return jsonb_build_object('code', v_order.code, 'status', v_status, 'payment_status', 'paid', 'already_paid', false);
end;
$$;

comment on function public.record_chat_payment is 'Pago por Yape o Plin con captura desde el chat: registra el pago (y su número de operación, que no se repite), deja el pedido pagado, lo confirma y lo pasa a producción. Solo el backend.';

revoke execute on function public.record_chat_payment(uuid, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_chat_payment(uuid, text, uuid, text, text) to service_role;
