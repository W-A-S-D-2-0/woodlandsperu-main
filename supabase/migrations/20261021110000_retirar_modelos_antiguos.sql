-- =============================================================================
-- Woodland Perú · Retira del catálogo los modelos que no están en el catálogo oficial
-- =============================================================================
-- Decisión del usuario (2026-10-21): fuera Chunky, Serving Board y Serving (el X Long).
-- No se borran filas: pedidos, cotizaciones e inventario las referencian (on delete restrict).
-- Se desactivan, y dejan de verse en la web, en el chat y en el catálogo público.
-- Es idempotente.

update public.product_variants
set is_active = false
where product_id in (select id from public.products where slug in ('chunky', 'serving-board', 'serving'));

update public.products
set is_active = false
where slug in ('chunky', 'serving-board', 'serving');
