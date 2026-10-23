-- =============================================================================
-- Woodland Perú · Catálogo oficial (CATALOGO B2B + sitio de Canva de Woodland)
-- =============================================================================
-- Fuente y decisiones: docs/marca/CATALOGO-OFICIAL.md (entregado por Woodland el 2026-10-21).
--
--  * Super Grill pasa a llamarse Moshaco (coinciden las 3 medidas) y su variante XL/L/Petit
--    pasa a Large/Medium/Small, con precio. Los SKU NO cambian: inventario, pedidos y
--    cotizaciones existentes siguen apuntando a las mismas variantes.
--  * Serving Small (53*20*1.5) pasa a ser Huambrilla.
--  * Se agregan Ya Vuelta, Sacha Paleta, Bosques Amazónicos y Ñañito.
--  * Chunky, Serving Board y Serving X Long se mantienen publicados, sin cambios (decisión del usuario).
--  * Es idempotente: se puede correr dos veces. En una base local vacía crea el catálogo oficial.
--
-- Nada se borra. Precios en PEN (S/).

insert into public.categories (slug, name, description, sort_order)
values
  ('parrilla-y-cocina', 'Colección Parrilla y Cocina', 'The Master Series', 1),
  ('piqueo-y-servir', 'Colección Piqueo y Servir', 'The Social Series', 2)
on conflict (slug) do update
  set name = excluded.name, description = excluded.description, sort_order = excluded.sort_order;

-- Super Grill -> Moshaco (misma fila, mismo id).
update public.products set slug = 'moshaco' where slug = 'super-grill';

insert into public.products (slug, name, description, category_id, is_active, sort_order)
select p.slug, p.name, p.description, c.id, true, p.sort_order
from (values
  ('moshaco', 'Moshaco',
   'La joya de la corona de nuestra Colección Parrilla y Cocina. La tabla Moshaco es la síntesis perfecta entre volumen, resistencia y una estética imponente. Diseñada para el parrillero o cocinera que exige perfección.',
   'parrilla-y-cocina', 10),
  ('ya-vuelta', 'Ya Vuelta',
   'La opción perfecta para usar tu creatividad: una fusión perfecta de maderas, colores y texturas, para pizzas, piqueos, postres, panes, carnes, o lo que quieras.',
   'parrilla-y-cocina', 20),
  ('sacha-paleta', 'Sacha Paleta',
   'The Forest Paddle. Ergonomía, arte y resistencia en una sola pieza, diseñada para quienes ven en el servicio un arte. Incluye el mango.',
   'parrilla-y-cocina', 30),
  ('bosques-amazonicos', 'Bosques Amazónicos',
   'Tabla de presentación delicada y minimalista.',
   'piqueo-y-servir', 40),
  ('huambrilla', 'Huambrilla',
   'Tabla diseñada para la presentación de piqueos, quesos y embutidos.',
   'piqueo-y-servir', 50),
  ('nanito', 'Ñañito',
   'Tabla versátil para el servicio individual, con los costados boleados.',
   'piqueo-y-servir', 60)
) as p (slug, name, description, category_slug, sort_order)
join public.categories c on c.slug = p.category_slug
on conflict (slug) do update
  set name = excluded.name,
      description = excluded.description,
      category_id = excluded.category_id,
      sort_order = excluded.sort_order;

-- Lo que se mantiene publicado va después del catálogo oficial.
update public.products set sort_order = 70 where slug = 'chunky';
update public.products set sort_order = 80 where slug = 'serving-board';
update public.products set sort_order = 90 where slug = 'serving';

-- Variantes. Si el SKU ya existe se actualiza (y, en Huambrilla, se mueve de producto).
insert into public.product_variants (product_id, sku, name, dimensions_label, catalog_price, is_active, sort_order)
select p.id, v.sku, v.name, v.dimensions_label, v.price, true, v.sort_order
from (values
  ('moshaco',            'SUPER-GRILL-XL',    'Large',    '65*46*4',  433.90, 1),
  ('moshaco',            'SUPER-GRILL-L',     'Medium',   '50*38*4',  378.90, 2),
  ('moshaco',            'SUPER-GRILL-PETIT', 'Small',    '35*25*2',  197.00, 3),
  ('ya-vuelta',          'YA-VUELTA',         'Circular', '40*1.5',   297.00, 1),
  ('sacha-paleta',       'SACHA-PALETA',      'Con mango','52*30*2',  335.90, 1),
  ('bosques-amazonicos', 'BOSQUES-AMAZONICOS','Estándar', '40*16*1.5',190.00, 1),
  ('huambrilla',         'SERVING-SMALL',     'Estándar', '53*20*1.5',216.00, 1),
  ('nanito',             'NANITO',            'Estándar', '30*18*1.5',178.00, 1)
) as v (product_slug, sku, name, dimensions_label, price, sort_order)
join public.products p on p.slug = v.product_slug
on conflict (sku) do update
  set product_id = excluded.product_id,
      name = excluded.name,
      dimensions_label = excluded.dimensions_label,
      catalog_price = excluded.catalog_price,
      sort_order = excluded.sort_order;
