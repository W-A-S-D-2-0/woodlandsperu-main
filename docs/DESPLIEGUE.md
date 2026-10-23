# Despliegue en producción (preparado; nada se ha desplegado)

Tres piezas independientes, todas desde este mismo repositorio:

| Pieza | Dónde | Qué es | Comando de build / salida |
| --- | --- | --- | --- |
| **API** | Cloudflare Workers (`woodland-peru-api`) | Hono: catálogo, cotizaciones, chat con IA, WhatsApp, API del panel | `npm run deploy:api` (usa `wrangler.api.jsonc`) |
| **Landing** | Proyecto de Vercel 1 | Web pública, solo estática | `npm run build:landing` → `dist-landing` |
| **Panel** | Proyecto de Vercel 2 | Sistema interno, solo estático, en la raíz de su dominio | `npm run build:panel` → `dist-panel` |

La landing **no enlaza al panel** y los bundles están separados (se comprobó que la landing no contiene código del
panel ni al revés). Ambos proyectos reenvían `/api/*` al Worker con una reescritura de `vercel.json`, así que el
navegador solo habla con su propio dominio (no hay CORS).

`npm run dev` y `npm run build` siguen funcionando como antes (todo junto, para desarrollo local).

## Orden recomendado

### 1. API en Cloudflare

```bash
npx wrangler login
npm run deploy:api
```

Anota la dirección que muestra (`https://woodland-peru-api.<cuenta>.workers.dev`). Luego carga los secretos, uno por uno
(cada comando pide el valor; **no los pegues en el chat**):

```bash
npx wrangler secret put SUPABASE_URL --config wrangler.api.jsonc
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY --config wrangler.api.jsonc
npx wrangler secret put SUPABASE_SECRET_KEY --config wrangler.api.jsonc
```

**Sin costo de IA**: no se carga `GEMINI_API_KEY`; el chat funciona en modo guiado (**no crea pedidos solo**: eso lo hace el
asistente con IA; sin clave se pide por /cotizar) (responde precios, plazos, grabado y
cómo pagar, y manda a /cotizar para pedir). Si algún día se quiere el asistente con IA (cuesta), basta cargar
`GEMINI_API_KEY` con `wrangler secret put`; no hay que cambiar código.

Opcionales, cuando Woodland los tenga: `GEMINI_API_KEY`, `GEMINI_MODEL`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
`WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`,
`GOOGLE_SHEETS_REPORT_ID`. Comprueba: `https://<worker>/api/health` responde.

### 2. Dirección de la API en `vercel.json`

En `vercel.json` cambia `REEMPLAZAR` por la dirección real del Worker
(`https://woodland-peru-api.<cuenta>.workers.dev/api/:path*`). Haz commit. **Mientras diga REEMPLAZAR, `/api` no funciona.**

### 3. Landing (proyecto de Vercel 1)

- Importar el repositorio de GitHub. Framework: **Other**.
- Build Command: `npm run build:landing` · Output Directory: `dist-landing` · Install Command: `npm install`.
- Variables de entorno: ninguna necesaria.

### 4. Panel (proyecto de Vercel 2)

- Importar **el mismo** repositorio como un segundo proyecto. Framework: **Other**.
- Build Command: `npm run build:panel` · Output Directory: `dist-panel`.
- Variables de entorno (públicas, quedan dentro del bundle; solo la clave *publicable*, nunca la secreta):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `VITE_PUBLIC_SITE_URL` = dirección de la landing (para el enlace «Ir a la web pública»).
- Poner el panel en su propio dominio o subdominio (p. ej. `panel.<dominio>`). No se indexa (`robots.txt` con
  `Disallow: /`, `noindex` y `X-Frame-Options: DENY`).

### 5. Supabase (lo hace el dueño de la cuenta)

En Authentication › URL Configuration, agrega las direcciones finales de la landing y del panel a *Site URL* /
*Redirect URLs*. No se cambia nada en la base de datos para desplegar.

## Cosas a tener presentes

- **Límite de uso por visitante**: detrás de Vercel la conexión llega desde su proxy, así que la API usa la primera IP de
  `X-Forwarded-For` (`worker/routes/client-key.ts`). Es una barrera contra abuso, no de seguridad; si alguien llama al
  Worker directamente puede falsear ese encabezado. La defensa real es la base (RLS, límites de las funciones SQL).
- **Seguridad del panel**: la protección real es la sesión de Supabase + el rol que verifican el Worker y RLS en cada
  operación. Opcional: poner Vercel Password Protection o similar delante del dominio del panel.
- **Dos proyectos, un repositorio**: cada push a `main` los reconstruye a ambos.
- **Vista previa local de cada build**: `npm run build:panel && npx vite preview --config vite.panel.config.ts`
  (idem con `vite.landing.config.ts`). Sin la API detrás, las pantallas que llaman a `/api` mostrarán error.
- **El Worker «todo en uno»** (`wrangler.jsonc`, `npm run deploy`) sigue disponible, pero no es el camino de producción.
