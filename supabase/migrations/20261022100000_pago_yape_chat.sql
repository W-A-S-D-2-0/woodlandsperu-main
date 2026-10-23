-- =============================================================================
-- Woodland Perú · Pago por Yape desde el chat
-- =============================================================================
-- El cliente paga por Yape al número de la empresa y sube la captura en el chat. El backend guarda la
-- captura (bucket privado «payment-proofs»), registra el pago y deja el pedido pagado y en producción.
-- Quién lo hace: solo el backend (service_role) con record_chat_payment. El pago queda registrado con
-- su captura para que el equipo lo verifique en el panel.

create table public.order_payments (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders (id) on delete restrict,
  method           text not null check (method in ('yape')),
  amount           numeric(12, 2) not null check (amount >= 0),
  -- Ruta de la captura en el bucket «payment-proofs».
  proof_path       text check (char_length(proof_path) <= 300),
  conversation_id  uuid references public.conversations (id) on delete set null,
  created_at       timestamptz not null default now()
);

create index order_payments_order_idx on public.order_payments (order_id, created_at desc);

-- Un pago registrado no se edita ni se borra.
create trigger order_payments_append_only before update or delete on public.order_payments
  for each row execute function app.prevent_mutation();

alter table public.order_payments enable row level security;

revoke all on public.order_payments from anon, authenticated;
grant select on public.order_payments to authenticated;
grant select, insert on public.order_payments to service_role;

create policy order_payments_admin_read on public.order_payments
  for select to authenticated using (app.is_admin());

-- Bucket privado de capturas. En la base de pruebas (sin Storage) no existe el esquema y se omite.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('payment-proofs', 'payment-proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Registrar el pago con captura
-- -----------------------------------------------------------------------------
-- Marca el pedido como pagado, lo confirma (reserva el stock) si estaba pendiente y lo pasa a producción.
-- Si no alcanza el stock para confirmarlo, el pago igual queda registrado y el pedido espera al equipo.
-- Repetir la llamada con un pedido ya pagado no hace nada (idempotente).

create function public.record_chat_payment(p_order_id uuid, p_proof_path text, p_conversation_id uuid default null)
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
      null; -- sin stock para reservar: queda pendiente de confirmación para que el equipo lo resuelva
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

comment on function public.record_chat_payment is 'Pago por Yape con captura desde el chat: registra el pago, deja el pedido pagado, lo confirma y lo pasa a producción. Solo el backend.';

revoke execute on function public.record_chat_payment(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.record_chat_payment(uuid, text, uuid) to service_role;

-- El personal administrador ve las capturas desde el panel (URL firmada con su sesión).
do $$
begin
  if to_regclass('storage.objects') is not null then
    execute $policy$
      create policy payment_proofs_admin_read on storage.objects
        for select to authenticated using (bucket_id = 'payment-proofs' and app.is_admin())
    $policy$;
  end if;
end;
$$;
