# Woodland Perú · Plataforma comercial

Plataforma comercial de **Corporación Wood Land Peru S.A.C.** desarrollada por el equipo WASD en la
Hackathon Transforma+ MIPYME 2026. Une una web comercial (catálogo, cotizaciones, pedidos, pagos y
asistente con IA) y un panel administrativo (productos, inventario, cotizaciones, pedidos, clientes
y reportes) sobre una misma API y una misma base de datos.

> **Estado: Fase 2 — Datos y seguridad.** Además de la base de la Fase 1, ya existen el modelo de
> datos con migraciones SQL, las políticas RLS, el inventario transaccional en la base de datos y el
> acceso del personal con Supabase Auth. Las migraciones **no se han aplicado a ninguna base remota**.
> Catálogo público, cotizador, pagos, IA y WhatsApp **todavía no están implementados**.

## Stack

| Capa | Tecnología |
| --- | --- |
| Frontend | React 19 · Vite 8 · TypeScript · Tailwind CSS 4 · React Router 8 |
| Backend | Cloudflare Workers · Hono · plugin oficial `@cloudflare/vite-plugin` |
| Datos | Supabase PostgreSQL · Supabase Auth · RLS · migraciones SQL (Supabase CLI) |
| Pruebas | Vitest · PGlite (PostgreSQL en WASM) · oxlint · `tsc -b` |

## Ejecutar en local

Requisitos: Node.js 22 o superior.

```bash
npm install
cp .dev.vars.example .dev.vars     # variables del Worker (APP_ENV=development)
npm run dev                        # http://localhost:5173
```

`npm run dev` levanta en un solo proceso la SPA y el Worker (en el runtime real de Workers, `workerd`).

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo (SPA + API) |
| `npm run build` | Typecheck + build de cliente y Worker en `dist/` |
| `npm run preview` | Build y ejecución local del resultado en el runtime de Workers |
| `npm run lint` | oxlint |
| `npm run typecheck` | `tsc -b` sobre app, Worker y configuración |
| `npm run test` | Pruebas unitarias y de base de datos (migraciones, RLS, inventario) |
| `npm run check` | Lint + typecheck + pruebas + build. Correr antes de cada entrega |
| `npm run cf-typegen` | Regenera `worker-configuration.d.ts` tras cambiar `wrangler.jsonc` o `.dev.vars` |
| `npm run deploy` | **No usar todavía.** Despliegue a Cloudflare, pendiente de autorización |

### Red de la sede: registro npm

En la red de la hackathon `registry.npmjs.org` corta la conexión. Si `npm install` falla con
`ECONNRESET`, usa el espejo oficial de Yarn (mismo contenido del registro npm) solo para ese comando:

```bash
npm_config_registry=https://registry.yarnpkg.com npm install
```

El `package-lock.json` conserva las URLs canónicas de `registry.npmjs.org`.

## Rutas

La web pública y el sistema interno son **dos aplicaciones separadas** en el mismo proyecto, cada una
con su HTML y su código (`index.html` → `src/main.tsx`; `panel/index.html` → `src/panel/main.tsx`).
La landing no contiene rutas, enlaces ni código del sistema.

**Web pública**

| Ruta | Contenido | Estado |
| --- | --- | --- |
| `/` | Portada Woodland | Implementada (fotos provisionales) |
| `/catalogo` | Catálogo | Pendiente · Fase 3 |
| `/corporativo` | Pedidos corporativos y cotizador | Pendiente · Fase 3 |
| `/nosotros` | Historia de la empresa | Pendiente · Fase 7 |

**Sistema interno** (`/panel`, no indexable; ver docs/architecture/README.md)

| Ruta | Contenido | Estado |
| --- | --- | --- |
| `/panel/ingresar` | Ingreso del personal (correo y contraseña) | Implementada (requiere Supabase) |
| `/panel` | Resumen | Protegida: sesión + personal activo |
| `/panel/:modulo` | productos, inventario, cotizaciones, pedidos, clientes, conversaciones, reportes | Protegida · pantallas en construcción |

**API**

| Ruta | Contenido | Estado |
| --- | --- | --- |
| `GET /api/health` | Estado del Worker | Implementada |
| `GET /api/admin/me` | Identidad y rol del personal autenticado | Implementada (401 / 403 / 503) |
| `/api/*` (otras) | Error JSON estándar 404 | Implementada |

## Variables de entorno

| Archivo | Para qué | Se publica |
| --- | --- | --- |
| `wrangler.jsonc` → `vars` | Variables no secretas del Worker. `APP_ENV` es `production` por defecto | Sí (repositorio) |
| `.dev.vars` | Secretos del Worker en local. Plantilla: `.dev.vars.example` | No (`.gitignore`) |
| `.env.local` | Variables **públicas** del frontend (`VITE_*`). Plantilla: `.env.example` | No (`.gitignore`) |

Reglas: ningún secreto en el frontend ni en el repositorio; en Cloudflare los secretos se cargan con
`npx wrangler secret put NOMBRE`. No se solicitan credenciales hasta la fase que las necesite.

| Variable | Dónde | Pública | Uso |
| --- | --- | --- | --- |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | `.dev.vars` / Cloudflare | Sí | El Worker verifica sesiones y lee roles |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env.local` | Sí | El navegador inicia y cierra sesión |
| `SUPABASE_SECRET_KEY` | `.dev.vars` / secreto de Cloudflare | **No** | Backend, desde la Fase 3 |

Sin estas variables el panel queda **cerrado** (la API responde 503 y `/admin` no se muestra).
Las variables `VITE_*` se incorporan al compilar: deben estar definidas al ejecutar `npm run build`.

## Base de datos (Supabase)

Migraciones en `supabase/migrations/`; modelo y permisos en
[docs/architecture/data-model.md](docs/architecture/data-model.md). Las pruebas
(`npm run test`) aplican todas las migraciones en PGlite, sin Docker ni base externa.

Cuando el equipo tenga un proyecto de Supabase **de pruebas** (y autorización para usarlo):

```bash
npx supabase login
npx supabase link --project-ref <ref-del-proyecto>
npx supabase db push          # aplica las migraciones pendientes
```

Con Docker en marcha también se puede levantar Supabase completo en local: `npx supabase start`.

En el panel de Supabase: desactivar el registro público (Authentication → Sign In / Providers) y crear
las cuentas del personal manualmente. Luego, desde el editor SQL, asignar el rol:

```sql
insert into public.staff_members (user_id, role, full_name)
select id, 'admin', 'Nombre Apellido' from auth.users where email = 'correo@empresa.pe';
-- role: 'admin' (administración) o 'workshop' (taller)
```

## Estructura

```
src/                  SPA (React)
  app/                router, 404 y límite de errores
  components/layout/  layouts público y encabezados
  components/ui/      componentes reutilizables (botones, contenedor, estados pendientes)
  content/            textos de marca y portada (no escribir textos dentro de componentes)
  features/<módulo>/  páginas y lógica por módulo: home, catalog, quotes, auth, admin…
  hooks/  lib/        utilidades de React y cliente de la API
  styles/             Tailwind y tokens de marca
worker/               API en Cloudflare Workers (Hono)
  auth/               verificación de sesión y rol del personal
  routes/             un archivo por recurso (/api/<recurso>)
supabase/
  migrations/         esquema, funciones y políticas RLS (SQL versionado)
  tests/              pruebas de base de datos con PGlite
shared/               contratos y reglas usados por frontend y Worker
docs/                 arquitectura, decisiones (ADR) y pruebas
```

Más detalle en [docs/architecture/README.md](docs/architecture/README.md) y en
[docs/decisions/](docs/decisions/).

## Reglas del proyecto

- No inventar datos de Woodland: productos, precios, fotos, certificaciones, testimonios ni plazos.
  Los textos de `src/content/` se limitan a lo confirmado por la empresa.
- Sin pantallas que simulen funcionalidades: lo que no existe se muestra como "En construcción".
- Los importes, el stock y los pagos se resuelven solo en el backend.
- El stock exacto, costos y márgenes nunca llegan al usuario público.
- Colores y tipografías solo mediante los tokens de `src/styles/index.css`.
