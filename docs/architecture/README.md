# Arquitectura · Woodland Perú

## Vista general

Un solo proyecto y un solo despliegue en Cloudflare Workers (plan gratuito):

```
Navegador ──► Cloudflare Workers
               ├─ Static Assets ──► web pública (index.html)
               │    · not_found_handling = single-page-application
               ├─ Worker ──► /panel/*  sistema interno (panel/index.html, noindex)
               └─ Worker (Hono) ──► /api/*  (run_worker_first)
                    ├─ Supabase PostgreSQL + Auth (Fase 2)
                    ├─ Proveedor de IA (Fase 4)
                    ├─ Mercado Pago (Fase 5) ◄── webhooks
                    ├─ WhatsApp Cloud API (Fase 6) ◄── webhooks
                    └─ Google Sheets (Fase 8, solo exportación)
```

- La web pública (`/`, `/catalogo`, …) la sirve el sistema de assets sin invocar el Worker.
- El **sistema interno** es otra aplicación (`panel/index.html` → `src/panel/`), separada de la
  landing: la web pública no tiene rutas, enlaces ni código del panel. Toda navegación bajo `/panel`
  pasa por el Worker (`worker/panel.ts`), que entrega el HTML del panel con `X-Robots-Tag: noindex`
  y `Cache-Control: no-store`.
- Para que nadie fuera del equipo vea siquiera el login, en producción se recomienda **Cloudflare
  Access** (Zero Trust, gratis hasta 50 usuarios) como aplicación sobre `<dominio>/panel*`, con la
  lista de correos del personal. Es configuración en Cloudflare, sin cambios de código. Si se prefiere
  un subdominio (`panel.<dominio>`), basta con apuntarlo al mismo Worker y redirigir su raíz a `/panel`.
- El frontend **solo** habla con `/api`. Nunca llama a Supabase con privilegios, a Mercado Pago, a
  WhatsApp ni al proveedor de IA con credenciales privadas.

## Módulos

Monolito modular: cada módulo de negocio tiene su carpeta en el frontend (`src/features/<módulo>`) y,
cuando lo necesite, su ruta y servicio en el Worker (`worker/routes/<módulo>.ts`,
`worker/services/<módulo>.ts`). Las carpetas se crean cuando hay código real, no antes.

| Módulo | Frontend | Worker | Fase |
| --- | --- | --- | --- |
| Catálogo | `features/catalog` | `routes/catalog` | 3 |
| Clientes | `features/customers` | `routes/customers` | 2–3 |
| Cotizaciones | `features/quotes` | `routes/quotes` | 3 |
| Pedidos | `features/orders` | `routes/orders` | 3 |
| Inventario | `features/inventory` | `routes/inventory` + funciones SQL | 3 |
| Pagos | `features/payments` | `routes/payments`, `integrations/mercadopago` | 5 |
| Conversaciones / IA | `features/chatbot` | `services/assistant`, `integrations/ai` | 4 |
| WhatsApp | — | `routes/whatsapp`, `integrations/whatsapp` | 6 |
| Administración | `features/admin` | middleware de auth y roles | 2 |
| Reportes | `features/admin` | `services/reports`, `integrations/sheets` | 8 |

## Capas y responsabilidades

1. **Componentes React**: presentación y estado de interfaz. Sin reglas de negocio ni cálculos de
   importes.
2. **`shared/`**: contratos HTTP (`shared/api/contracts.ts`) y reglas puras que deben coincidir en
   ambos lados (por ejemplo, validaciones). Sin dependencias de React ni de Workers.
3. **Worker (`worker/`)**: validación de entrada, autorización, orquestación y llamadas a
   proveedores. Formato de error único (`ApiErrorBody`) con `requestId`.
4. **PostgreSQL**: fuente de verdad. Las operaciones críticas (movimientos de inventario,
   confirmación de pedidos y pagos) se implementarán como funciones transaccionales e idempotentes.

## Seguridad (base de Fase 1)

- `APP_ENV` vale `production` por defecto en `wrangler.jsonc`; cualquier valor desconocido se
  interpreta como producción (`shared/config/app-env.ts`). Las funciones de prueba (como el
  proveedor de pagos MOCK) solo se habilitarán fuera de producción.
- Cabeceras de seguridad: Hono `secureHeaders` en `/api/*` y `public/_headers` en los assets.
  La Content-Security-Policy se definirá al integrar Supabase, Mercado Pago y la IA.
- Las respuestas de la API usan `Cache-Control: no-store`.
- Los errores internos se registran sin cabeceras, cuerpos ni variables de entorno.
- El panel `/admin` exige sesión de Supabase Auth y que `GET /api/admin/me` confirme personal activo.
  Sin configuración de Supabase el panel queda cerrado. La interfaz no decide permisos: el Worker y
  RLS los vuelven a verificar en cada operación.

## Autenticación (Fase 2)

```
Navegador ── signInWithPassword ──► Supabase Auth ──► sesión (JWT)
Navegador ── Authorization: Bearer <JWT> ──► Worker /api/admin/*
   Worker ── auth.getClaims(JWT) ──► firma y vigencia verificadas
   Worker ── staff_members con el JWT del usuario (RLS) ──► rol admin | workshop
```

- El cliente de Supabase del navegador (clave publicable) solo gestiona la sesión y vive únicamente
  en la app del panel (`/panel/ingresar`, `/panel/*`); la web pública no lo descarga.
- `requireStaff` (`worker/auth/staff-auth.ts`) responde 401 sin sesión, 403 sin rol y 503 si la
  autenticación no está configurada o no responde. El proveedor es inyectable para las pruebas.
- Las reglas de datos y permisos se detallan en [data-model.md](data-model.md).

## Rendimiento

- El código del panel administrativo se carga bajo demanda (rutas `lazy`), así la web pública no lo
  descarga.
- Fuentes autoalojadas (`@fontsource-variable`): sin dependencia de Google Fonts y con subconjuntos
  por `unicode-range`.
