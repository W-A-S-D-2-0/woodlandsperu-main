-- Pago por Yape desde el chat: lo que no tiene stock se fabrica.
-- Si al pagar no alcanza el stock para reservar, los productos de stock del pedido pasan a «a pedido» (se
-- fabrican) y el pedido se confirma y entra a producción igual. Antes quedaba pagado pero pendiente.

create or replace function public.record_chat_payment(p_order_id uuid, p_proof_path text, p_conversation_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_status public.order_status;
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

  insert into public.order_payments (order_id, method, amount, proof_path, conversation_id)
  values (p_order_id, 'yape', v_order.total, p_proof_path, p_conversation_id);

  perform set_config('woodland.payment_update', 'on', true);
  update public.orders
     set payment_status = 'paid',
         internal_notes = left(coalesce(v_order.internal_notes || E'\n', '') || 'Pago por Yape registrado con captura desde el chat: verificar en la app de Yape.', 2000)
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
