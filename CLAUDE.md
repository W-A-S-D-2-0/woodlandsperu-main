# Woodland Perú · guía para asistentes

Plataforma comercial de Woodland Perú (Hackathon Transforma+ MIPYME 2026, equipo WASD).
Lee `README.md` y `docs/architecture/README.md` antes de cambios grandes.
**Si retomas el trabajo en una sesión nueva, empieza por `docs/CONTINUAR.md`** (estado, decisiones y próximos pasos).

- Stack: React + Vite + TypeScript + Tailwind 4 + React Router 8 (SPA) y Hono en Cloudflare Workers (`worker/`). Datos en Supabase desde la Fase 2.
- Trabajo por fases; no adelantar integraciones (pagos, IA, WhatsApp, Sheets) sin autorización. No desplegar.
- No inventar datos de la empresa (productos, precios, fotos, cifras, plazos, certificaciones). Textos en `src/content/`.
- Sin pantallas simuladas: lo no implementado usa `PendingModule`.
- Lógica de negocio fuera de los componentes React. Importes, stock y pagos solo en el backend; contratos en `shared/`.
- Nunca exponer secretos al frontend (`VITE_*` es público). Secretos del Worker en `.dev.vars` / `wrangler secret`.
- Colores y fuentes solo con los tokens de `src/styles/index.css`.
- Base de datos: cambios solo con migraciones nuevas en `supabase/migrations` (nunca editar una ya aplicada). Cada tabla nueva declara RLS, grants y políticas, y suma pruebas en `supabase/tests`. Stock solo vía `apply_inventory_movement`; `payment_status` solo vía funciones de pago. No aplicar migraciones a bases remotas sin autorización.
- Antes de entregar: `npm run check`. Si `npm install` falla por red, usar `npm_config_registry=https://registry.yarnpkg.com`.
