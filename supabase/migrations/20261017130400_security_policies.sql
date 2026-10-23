-- =============================================================================
-- Woodland Perú · 005 · Seguridad: privilegios mínimos y políticas RLS
-- =============================================================================
-- Modelo:
--   anon           → solo lectura del catálogo activo y disponibilidad sin cantidades.
--   authenticated  → nada, salvo que sea personal activo (staff_members):
--                      admin    → gestión completa (escrituras críticas vía funciones).
--                      workshop → catálogo, inventario y pedidos en lectura; registra producción.
--   service_role   → backend (Worker). Omite RLS, pero no los triggers de integridad:
--                    stock, pagos, auditoría y movimientos siguen protegidos.
-- Toda tabla nueva en migraciones futuras debe declarar sus grants y políticas.

-- -----------------------------------------------------------------------------
-- 1. Partir de cero
-- -----------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema app from public, anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema app revoke execute on functions from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Backend (service_role)
-- -----------------------------------------------------------------------------

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
grant execute on all functions in schema app to service_role;

-- -----------------------------------------------------------------------------
-- 3. Funciones auxiliares usadas por las políticas
-- -----------------------------------------------------------------------------

grant execute on function
  app.jwt_role(),
  app.is_service_role(),
  app.current_staff_role(),
  app.is_staff(),
  app.is_admin()
to anon, authenticated;

-- Usadas por triggers de integridad que se ejecutan con el rol de quien modifica.
grant execute on function
  app.order_status_transition_allowed(public.order_status, public.order_status),
  app.payment_update_allowed()
to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Catálogo
-- -----------------------------------------------------------------------------

grant select on public.categories, public.products, public.product_variants, public.price_tiers to anon, authenticated;
grant insert, update, delete on public.categories, public.products, public.product_variants, public.price_tiers to authenticated;

-- Categorías
create policy categories_public_read on public.categories
  for select to anon, authenticated
  using (is_active);

create policy categories_staff_read on public.categories
  for select to authenticated
  using ((select app.is_staff()));

create policy categories_admin_insert on public.categories
  for insert to authenticated with check ((select app.is_admin()));
create policy categories_admin_update on public.categories
  for update to authenticated using ((select app.is_admin())) with check ((select app.is_admin()));
create policy categories_admin_delete on public.categories
  for delete to authenticated using ((select app.is_admin()));

-- Productos
create policy products_public_read on public.products
  for select to anon, authenticated
  using (is_active);

create policy products_staff_read on public.products
  for select to authenticated
  using ((select app.is_staff()));

create policy products_admin_insert on public.products
  for insert to authenticated with check ((select app.is_admin()));
create policy products_admin_update on public.products
  for update to authenticated using ((select app.is_admin())) with check ((select app.is_admin()));
create policy products_admin_delete on public.products
  for delete to authenticated using ((select app.is_admin()));

-- Variantes
create policy product_variants_public_read on public.product_variants
  for select to anon, authenticated
  using (
    is_active
    and exists (select 1 from public.products p where p.id = product_id and p.is_active)
  );

create policy product_variants_staff_read on public.product_variants
  for select to authenticated
  using ((select app.is_staff()));

create policy product_variants_admin_insert on public.product_variants
  for insert to authenticated with check ((select app.is_admin()));
create policy product_variants_admin_update on public.product_variants
  for update to authenticated using ((select app.is_admin())) with check ((select app.is_admin()));
create policy product_variants_admin_delete on public.product_variants
  for delete to authenticated using ((select app.is_admin()));

-- Precios escalonados
create policy price_tiers_public_read on public.price_tiers
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = variant_id and v.is_active and p.is_active
    )
  );

create policy price_tiers_staff_read on public.price_tiers
  for select to authenticated
  using ((select app.is_staff()));

create policy price_tiers_admin_insert on public.price_tiers
  for insert to authenticated with check ((select app.is_admin()));
create policy price_tiers_admin_update on public.price_tiers
  for update to authenticated using ((select app.is_admin())) with check ((select app.is_admin()));
create policy price_tiers_admin_delete on public.price_tiers
  for delete to authenticated using ((select app.is_admin()));

-- Costos y precio conversado: solo administración
grant select, insert, update, delete on public.variant_internal_pricing to authenticated;

create policy variant_internal_pricing_admin_all on public.variant_internal_pricing
  for all to authenticated
  using ((select app.is_admin()))
  with check ((select app.is_admin()));

grant execute on function public.get_variant_availability(uuid[]) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. Inventario (escrituras solo mediante funciones)
-- -----------------------------------------------------------------------------

grant select on public.inventory_levels, public.inventory_movements, public.stock_alerts to authenticated;

create policy inventory_levels_staff_read on public.inventory_levels
  for select to authenticated using ((select app.is_staff()));

create policy inventory_movements_staff_read on public.inventory_movements
  for select to authenticated using ((select app.is_staff()));

create policy stock_alerts_staff_read on public.stock_alerts
  for select to authenticated using ((select app.is_staff()));

-- Las funciones verifican el rol internamente (producción: admin o taller; resto: admin).
grant execute on function
  public.apply_inventory_movement(uuid, public.inventory_movement_type, integer, text, uuid, text),
  public.update_inventory_settings(uuid, integer, text)
to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Clientes (solo administración)
-- -----------------------------------------------------------------------------

grant select, insert, update on public.customers to authenticated;
grant select, insert on public.customer_notes to authenticated;

create policy customers_admin_read on public.customers
  for select to authenticated using ((select app.is_admin()));
create policy customers_admin_insert on public.customers
  for insert to authenticated with check ((select app.is_admin()));
create policy customers_admin_update on public.customers
  for update to authenticated using ((select app.is_admin())) with check ((select app.is_admin()));

create policy customer_notes_admin_read on public.customer_notes
  for select to authenticated using ((select app.is_admin()));
create policy customer_notes_admin_insert on public.customer_notes
  for insert to authenticated
  with check ((select app.is_admin()) and created_by = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- 7. Cotizaciones (administración; importes e ítems los gestiona el backend)
-- -----------------------------------------------------------------------------

grant select on public.quotes, public.quote_items to authenticated;
grant update (status, review_reason, valid_until, delivery_estimate_note, reviewed_by, reviewed_at)
  on public.quotes to authenticated;

create policy quotes_admin_read on public.quotes
  for select to authenticated using ((select app.is_admin()));
create policy quotes_admin_update on public.quotes
  for update to authenticated using ((select app.is_admin())) with check ((select app.is_admin()));

create policy quote_items_admin_read on public.quote_items
  for select to authenticated using ((select app.is_admin()));

-- -----------------------------------------------------------------------------
-- 8. Pedidos (administración gestiona; taller consulta). Sin grant sobre payment_status.
-- -----------------------------------------------------------------------------

grant select on public.orders, public.order_items to authenticated;
grant update (status, delivery_estimate_note, shipping_address, internal_notes, cancel_reason)
  on public.orders to authenticated;

create policy orders_staff_read on public.orders
  for select to authenticated using ((select app.is_staff()));
create policy orders_admin_update on public.orders
  for update to authenticated using ((select app.is_admin())) with check ((select app.is_admin()));

create policy order_items_staff_read on public.order_items
  for select to authenticated using ((select app.is_staff()));

-- -----------------------------------------------------------------------------
-- 9. Personal, ajustes y auditoría
-- -----------------------------------------------------------------------------

grant select on public.staff_members to authenticated;

create policy staff_members_self_read on public.staff_members
  for select to authenticated using (user_id = (select auth.uid()));
create policy staff_members_admin_read on public.staff_members
  for select to authenticated using ((select app.is_admin()));
-- Altas, bajas y cambios de rol: solo por SQL con privilegios de propietario (ver README).

grant select on public.business_settings to authenticated;
grant update (value, updated_by) on public.business_settings to authenticated;

create policy business_settings_admin_read on public.business_settings
  for select to authenticated using ((select app.is_admin()));
create policy business_settings_admin_update on public.business_settings
  for update to authenticated using ((select app.is_admin())) with check ((select app.is_admin()));

grant select on public.audit_log to authenticated;

create policy audit_log_admin_read on public.audit_log
  for select to authenticated using ((select app.is_admin()));
