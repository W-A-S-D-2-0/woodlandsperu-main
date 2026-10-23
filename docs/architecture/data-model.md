# Modelo de datos · Woodland Perú

Base de datos: Supabase PostgreSQL. Migraciones en `supabase/migrations/` (se aplican en orden).
Todas las tablas tienen RLS activado. Montos en soles (PEN), `numeric(12,2)`.

## Diagrama

```
categories 1─┐
             └─* products 1──* product_variants 1──* price_tiers
                                    │ 1
                                    ├──1 variant_internal_pricing   (solo admin: costo, precio conversado)
                                    ├──1 inventory_levels           (físico, reservado, disponible, mínimo, custodio)
                                    ├──* inventory_movements ──* orders
                                    └──* stock_alerts

customers 1──* quotes 1──* quote_items *──1 product_variants
    │ 1          │ 0..1
    ├──* orders ─┘ 1──* order_items *──1 product_variants
    └──* customer_notes

auth.users 1──1 staff_members (admin | workshop)
audit_log · business_settings
```

## Tablas

| Tabla | Propósito | Notas |
| --- | --- | --- |
| `staff_members` | Personal con acceso al panel y su rol | Altas solo por SQL (no hay registro público) |
| `business_settings` | Umbrales comerciales | Valores en null hasta que Woodland los defina |
| `audit_log` | Acciones sensibles | Solo inserción. Precios, costos, roles, estados de pedido y pago |
| `categories` | Líneas de producto | |
| `products` | Modelo comercial (p. ej. "Super Grill") | Nace inactivo |
| `product_variants` | Presentación vendible con SKU, medidas y precio | `dimensions_label` guarda el texto original (`65*46*4`). `catalog_price` null = a cotizar. `fulfillment_type`: `stock` o `made_to_order` |
| `price_tiers` | Precios por volumen | `min_quantity` ≥ 2, una escala por cantidad |
| `variant_internal_pricing` | Costo unitario y precio conversado | Solo administración |
| `inventory_levels` | Existencias por variante | `available = on_hand - reserved` (columna generada). Sin negativos |
| `inventory_movements` | Historial de movimientos | Solo inserción. Guarda saldos resultantes, actor y pedido |
| `stock_alerts` | Alertas de reposición | Una abierta por variante como máximo |
| `customers` / `customer_notes` | Clientes y observaciones | Email único (sin distinguir mayúsculas); exige email o teléfono |
| `quotes` / `quote_items` | Cotizaciones (`COT-000001`) | Subtotal recalculado desde los ítems; ítem sin precio ⇒ revisión humana |
| `orders` / `order_items` | Pedidos (`PED-000001`) | Transiciones de estado validadas; estado de pago protegido |

## Reglas implementadas en la base

### Precios
`app.resolve_unit_price(variant, cantidad)`: aplica la escala con el mayor `min_quantity` alcanzado;
si no hay, el precio de catálogo; si no hay precio publicado devuelve null (la cotización pasa a
revisión). Solo considera variantes y productos activos. Es interna: la usan las funciones del backend.

### Inventario
`public.apply_inventory_movement(variante, tipo, cantidad, motivo, pedido, clave_idempotencia)` es la
única forma de cambiar existencias:

| Tipo | Efecto | Requisitos | Quién |
| --- | --- | --- | --- |
| `production_in` | físico + | — | admin, taller, backend |
| `adjustment_in` | físico + | motivo | admin, backend |
| `adjustment_out` | físico − | motivo; no puede dejar reservas sin respaldo | admin, backend |
| `reservation` | reservado + | pedido; disponible suficiente | admin, backend |
| `reservation_release` | reservado − | pedido | admin, backend |
| `sale_out` | físico − y reservado − | pedido; consume la reserva | admin, backend |
| `return_in` | físico + | — | admin, backend |

- Bloquea la fila (`FOR UPDATE`): dos operaciones simultáneas no pueden sobrevender.
- Con la misma clave de idempotencia, el movimiento se aplica una sola vez (reintentos seguros).
- Las variantes `made_to_order` no llevan inventario.
- `public.update_inventory_settings` (admin) fija el mínimo y el custodio.
- `public.get_variant_availability` (público) responde `in_stock`, `out_of_stock` o `made_to_order`, nunca
  cantidades. **La web pública ya no la usa**: por decisión de Woodland (Canvas de ventas) no muestra
  stock ni disponibilidad; muestra plazos estimados según la cantidad (`src/content/delivery.ts`).

### Alertas de stock mínimo
Trigger sobre `inventory_levels`: si `available <= min_stock` abre una alerta (sin duplicar); al
reponer por encima del mínimo la resuelve. Con `min_stock` null no hay alertas.

### Pedidos
- Estados: `pending_confirmation → confirmed → in_production → ready → shipped → delivered`, con
  cancelación (con motivo) hasta `ready`. Confirmar exige `customer_confirmed_at`.
- `payment_status` no tiene permiso de escritura para el personal y, además, un trigger bloquea
  cualquier cambio (incluso del backend) salvo que lo haga una función de pago que active
  `woodland.payment_update` en su transacción (Fase 5). Un pedido no puede crearse como pagado.

### Flujo comercial (migración 006)

| Función | Quién | Qué hace |
| --- | --- | --- |
| `submit_quote_request(jsonb)` | Backend | Crea o reutiliza el cliente (por correo o teléfono, sin sobrescribir sus datos), calcula precios con `resolve_unit_price` y marca revisión humana. Idempotente con `request_id` |
| `set_quote_item_price(item, precio)` | Admin | Fija el precio de un ítem a medida o personalizado |
| `send_quote(cotización, descuento, vigencia, plazo)` | Admin | Exige todos los precios; vigencia por defecto según `quote_validity_days` |
| `accept_quote(cotización)` | Admin / backend | El cliente acepta; vence si pasó `valid_until` |
| `convert_quote_to_order(cotización, confirmado, dirección)` | Admin / backend | Copia ítems y precios; lo personalizado pasa a `made_to_order`. Idempotente |
| `confirm_order(pedido, confirmado)` | Admin / backend | Exige confirmación del cliente y **reserva** el stock de cada ítem (una vez) |
| `dispatch_order(pedido, shipped/delivered)` | Admin / backend | Desde `ready`: **descuenta** el stock reservado (una vez) |
| `cancel_order(pedido, motivo)` | Admin / backend | **Libera** las reservas no despachadas |
| `get_order_status_public(código, contacto)` | Backend | Estado del pedido si el correo o teléfono coincide; sin datos personales |
| `get_admin_dashboard()` | Admin | Cotizaciones pendientes, pedidos por estado, ventas confirmadas (30 días), stock bajo |

Los estados `confirmed`, `shipped`, `delivered` y `cancelled` solo se alcanzan con estas funciones
(un `update` directo se rechaza), así ninguna venta queda sin su movimiento de inventario.
`in_production` y `ready` se cambian directamente desde el panel.

**Precio de catálogo pendiente:** el precio del Excel se guarda en
`variant_internal_pricing.catalog_price_reference` (solo admin) y `product_variants.catalog_price`
queda en null ("a cotizar") hasta que Woodland confirme qué precio se publica.

## Permisos por rol

| Recurso | Público | Autenticado sin rol | Taller | Admin | Backend |
| --- | --- | --- | --- | --- | --- |
| Catálogo activo | Lee | Lee | Lee todo | Gestiona | Todo |
| Costos / precio conversado | — | — | — | Gestiona | Todo |
| Inventario y movimientos | Disponibilidad | — | Lee; registra producción | Lee; mueve vía función | Vía función |
| Clientes y notas | — | — | — | Gestiona | Todo |
| Cotizaciones | — | — | — | Lee; cambia estado | Todo |
| Pedidos | — | — | Lee | Lee; cambia estado y notas | Todo menos pago directo |
| Personal | — | Su propia fila | Su propia fila | Lee | Todo |
| Auditoría | — | — | — | Lee | Inserta |

## Relación con INVENTARIO.xlsx (importación en Fase 3)

| Columna del Excel | Destino |
| --- | --- |
| TABLA | `products.name` + `product_variants.name` (p. ej. "Super Grill" / "XL") — a validar con la empresa |
| Stock inicial Primera Producción | Movimiento `production_in` (no se escribe el saldo directamente) |
| Medidas | `product_variants.dimensions_label` (y medidas numéricas si se confirman las unidades) |
| Quién tiene el stock | `inventory_levels.custodian` |
| PRECIO CATALOGO | `product_variants.catalog_price` |
| Costo Unitario | `variant_internal_pricing.unit_cost` |
| PRECIO CONVERSADO | `variant_internal_pricing.negotiated_price` |
| Columnas de valor total | No se importan: se calculan |

El archivo es confidencial y no se versiona.

### Importador

```bash
node scripts/import-inventory.ts ruta/INVENTARIO.xlsx --groups "Super Grill,Serving Board,Serving" --activate
```

No se conecta a ninguna base. Genera en `.data/` (ignorado por git) un reporte de observaciones para
revisar con Woodland y `import-catalog.sql`, transaccional e idempotente, para ejecutar en el editor SQL
de Supabase. `--groups` agrupa filas como variantes de un producto (agrupación a validar con la
empresa); `--activate` publica productos sin precio ("a cotizar"). Si hay observaciones bloqueantes
no genera el SQL.
