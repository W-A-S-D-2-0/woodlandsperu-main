# Estrategia de pruebas

## Niveles

| Nivel | Herramienta | Qué cubre |
| --- | --- | --- |
| Unitarias | Vitest (`npm run test`) | Reglas de `shared/`, rutas del Worker con `app.request()`, utilidades del frontend |
| Base de datos | Vitest + PGlite (`supabase/tests`) | Migraciones, RLS por rol, inventario, precios, estados de pedido y pago |
| Integración (Fase 5–6) | Vitest + sandbox de proveedores | Webhooks de Mercado Pago y WhatsApp: firmas, duplicados, estados |
| Manual / demo | Navegador | Flujos completos de compra y cotización |

## Pruebas actuales

- `shared/config/app-env.test.ts`: valores desconocidos de `APP_ENV` se tratan como producción.
- `worker/app.test.ts`: `/api/health`, cabeceras de seguridad, `no-store` y formato de error 404.
- `src/lib/api.test.ts`: cliente de la API (éxito, error estándar, error HTTP, red, rutas inválidas).
- `src/features/admin/modules.test.ts`: rutas del panel únicas y válidas.
- `src/features/auth/auth-context.test.ts`: tras el login solo se redirige a rutas del panel.
- `worker/routes/admin.test.ts`: `/api/admin/me` (401, 403, 503, 200) y validación de configuración.
- `supabase/tests/security.test.ts`: qué puede leer y escribir cada rol (anónimo, autenticado sin rol,
  taller, administración, backend), auditoría inmutable, estado de pago protegido, flujo de pedidos.
- `supabase/tests/inventory.test.ts`: movimientos, stock nunca negativo, reservas, idempotencia,
  historial inmutable, permisos por rol y alertas de stock mínimo sin duplicados.
- `supabase/tests/pricing-and-quotes.test.ts`: precios escalonados, cotizaciones, clientes.

### Cómo funcionan las pruebas de base de datos

`supabase/tests/support/test-db.ts` crea un PostgreSQL en memoria (PGlite), agrega un shim de
Supabase (roles `anon`, `authenticated`, `service_role`, `auth.uid()`, `auth.jwt()` y los privilegios
por defecto de Supabase) y aplica todas las migraciones. `as(db, actor, fn)` ejecuta consultas como
lo haría la API para ese actor y revierte la transacción. Los datos de `fixtures.ts` son ficticios.

Límites: PGlite es una sola conexión (no prueba concurrencia real) y usa PostgreSQL 18 (Supabase usa 17).

## Casos críticos previstos

- Precios: importes y escalas calculados solo en el backend.
- Pagos: notificación duplicada, importe o moneda distintos, referencia desconocida, pago
  pendiente o rechazado, intento de confirmar desde el cliente o el chatbot, MOCK en producción.
- IA: no inventa precios, stock, plazos ni confirmaciones de pago.

Antes de cada entrega: `npm run check`.
