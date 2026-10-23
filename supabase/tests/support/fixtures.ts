import type { PGlite } from '@electric-sql/pglite'

/**
 * Datos ficticios SOLO para pruebas. No representan productos, precios ni clientes
 * reales de Woodland.
 */
export const ids = {
  admin: '00000000-0000-4000-8000-000000000001',
  workshop: '00000000-0000-4000-8000-000000000002',
  outsider: '00000000-0000-4000-8000-000000000003',
  inactiveStaff: '00000000-0000-4000-8000-000000000004',
  category: '10000000-0000-4000-8000-000000000001',
  product: '20000000-0000-4000-8000-000000000001',
  hiddenProduct: '20000000-0000-4000-8000-000000000002',
  variantStock: '30000000-0000-4000-8000-000000000001',
  variantMadeToOrder: '30000000-0000-4000-8000-000000000002',
  variantNoPrice: '30000000-0000-4000-8000-000000000003',
  variantHidden: '30000000-0000-4000-8000-000000000004',
  customer: '40000000-0000-4000-8000-000000000001',
  order: '50000000-0000-4000-8000-000000000001',
} as const

export async function seedFixtures(db: PGlite): Promise<void> {
  // La migración del catálogo oficial deja el catálogo real cargado; las pruebas parten de un catálogo vacío.
  await db.exec(`
    delete from public.product_variants;
    delete from public.products;
    delete from public.categories;

    insert into auth.users (id, email) values
      ('${ids.admin}', 'admin@test.local'),
      ('${ids.workshop}', 'taller@test.local'),
      ('${ids.outsider}', 'otro@test.local'),
      ('${ids.inactiveStaff}', 'baja@test.local');

    insert into public.staff_members (user_id, role, full_name, is_active) values
      ('${ids.admin}', 'admin', 'Admin de prueba', true),
      ('${ids.workshop}', 'workshop', 'Taller de prueba', true),
      ('${ids.inactiveStaff}', 'admin', 'Admin dado de baja', false);

    insert into public.categories (id, slug, name) values ('${ids.category}', 'categoria-prueba', 'Categoría de prueba');

    insert into public.products (id, slug, name, category_id, is_active) values
      ('${ids.product}', 'producto-prueba', 'Producto de prueba', '${ids.category}', true),
      ('${ids.hiddenProduct}', 'producto-oculto', 'Producto oculto', '${ids.category}', false);

    insert into public.product_variants (id, product_id, sku, name, dimensions_label, catalog_price, fulfillment_type, is_active) values
      ('${ids.variantStock}', '${ids.product}', 'TEST-STOCK', 'Stock', '10*10*1', 100.00, 'stock', true),
      ('${ids.variantMadeToOrder}', '${ids.product}', 'TEST-MTO', 'A pedido', null, 150.00, 'made_to_order', true),
      ('${ids.variantNoPrice}', '${ids.product}', 'TEST-NOPRICE', 'Sin precio', null, null, 'stock', true),
      ('${ids.variantHidden}', '${ids.hiddenProduct}', 'TEST-HIDDEN', 'Oculta', null, 80.00, 'stock', true);

    insert into public.price_tiers (variant_id, min_quantity, unit_price) values
      ('${ids.variantStock}', 10, 90.00),
      ('${ids.variantStock}', 50, 80.00);

    insert into public.variant_internal_pricing (variant_id, unit_cost, negotiated_price, cost_source)
    values ('${ids.variantStock}', 40.00, 70.00, 'prueba');

    insert into public.customers (id, customer_type, full_name, email) values
      ('${ids.customer}', 'individual', 'Cliente de prueba', 'cliente@test.local');

    insert into public.orders (id, customer_id, channel) values ('${ids.order}', '${ids.customer}', 'web');
  `)
}
