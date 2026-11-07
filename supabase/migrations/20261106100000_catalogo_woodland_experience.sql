-- =============================================================================
-- Woodland Perú · Catálogo «The Woodland Experience» (PDF entregado por Woodland el 2026-11-06)
-- =============================================================================
--  * Precios nuevos de los 6 modelos del catálogo oficial.
--  * Huambrilla pasa a medir 52 × 20 × 1.5 cm (antes 53).
--  * Nueva colección «Edición Limitada» (Limited Edition) con Pishcota y Nuiti, con su precio publicado.
--  * Los SKU existentes no cambian: inventario, pedidos y cotizaciones siguen apuntando a las mismas variantes.
--  * Butcher Chunky Pro (edición especial hecha a pedido) no se agrega: el PDF no publica su precio ni su medida.
--  * Es idempotente. Nada se borra. Precios en PEN (S/).

insert into public.categories (slug, name, description, sort_order)
values ('edicion-limitada', 'Colección Edición Limitada', 'Limited Edition', 3)
on conflict (slug) do update
  set name = excluded.name, description = excluded.description, sort_order = excluded.sort_order;

insert into public.products (slug, name, description, category_id, is_active, sort_order)
select p.slug, p.name, p.description, c.id, true, p.sort_order
from (values
  ('pishcota', 'Pishcota',
   'Muchacha inquieta. La fusión perfecta entre una tabla de parrilla y una pieza para servir. Ideal para acompañarte en almuerzos, cenas y parrillas, desde la preparación hasta la mesa.',
   'edicion-limitada', 62),
  ('nuiti', 'Nuiti',
   'Amor. Elegancia y funcionalidad en una sola pieza: una tabla diseñada para transformar cada encuentro en una experiencia especial.',
   'edicion-limitada', 64)
) as p (slug, name, description, category_slug, sort_order)
join public.categories c on c.slug = p.category_slug
on conflict (slug) do update
  set name = excluded.name,
      description = excluded.description,
      category_id = excluded.category_id,
      is_active = true,
      sort_order = excluded.sort_order;

insert into public.product_variants (product_id, sku, name, dimensions_label, catalog_price, is_active, sort_order)
select p.id, v.sku, v.name, v.dimensions_label, v.price, true, v.sort_order
from (values
  ('moshaco',            'SUPER-GRILL-XL',     'Large',     '65*46*4',   389.00, 1),
  ('moshaco',            'SUPER-GRILL-L',      'Medium',    '50*38*4',   341.00, 2),
  ('moshaco',            'SUPER-GRILL-PETIT',  'Small',     '35*25*2',   170.00, 3),
  ('ya-vuelta',          'YA-VUELTA',          'Circular',  '40*1.5',    267.00, 1),
  ('sacha-paleta',       'SACHA-PALETA',       'Con mango', '52*30*2',   302.00, 1),
  ('bosques-amazonicos', 'BOSQUES-AMAZONICOS', 'Estándar',  '40*16*1.5', 170.00, 1),
  ('huambrilla',         'SERVING-SMALL',      'Estándar',  '52*20*1.5', 195.00, 1),
  ('nanito',             'NANITO',             'Estándar',  '30*18*1.5', 175.00, 1),
  ('pishcota',           'PISHCOTA',           'Estándar',  '60*26*2',   225.00, 1),
  ('nuiti',              'NUITI',              'Estándar',  '60*26*2',   342.00, 1)
) as v (product_slug, sku, name, dimensions_label, price, sort_order)
join public.products p on p.slug = v.product_slug
on conflict (sku) do update
  set product_id = excluded.product_id,
      name = excluded.name,
      dimensions_label = excluded.dimensions_label,
      catalog_price = excluded.catalog_price,
      is_active = true,
      sort_order = excluded.sort_order;
