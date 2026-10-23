# ADR 0001 · Stack base y estructura del proyecto

- **Fecha:** 2026-10-17
- **Estado:** aceptada

## Contexto

Hay que construir en la hackathon una plataforma comercial (web pública + panel administrativo)
para Woodland Perú, desplegable en el plan gratuito de Cloudflare, con un backend seguro para
pedidos, inventario y pagos. El equipo es pequeño y el tiempo es corto.

## Decisión

1. **Plantilla oficial de Cloudflare** (`npm create cloudflare@latest -- --framework=react`,
   create-cloudflare 2.74.0): React + Vite + TypeScript con `@cloudflare/vite-plugin`. El
   desarrollo local corre el Worker en `workerd`, igual que en producción.
2. **Un solo Worker** sirve la SPA (Static Assets) y la API (`/api/*` con `run_worker_first`).
   Sin microservicios.
3. **Hono** para el enrutamiento de la API: ligero, tipado y nativo de Workers.
4. **React Router 8 en modo datos** (`createBrowserRouter`) con carga diferida del panel admin.
5. **Tailwind CSS 4** con tokens de marca en `@theme` (sin archivo de configuración JS).
6. **Vitest** con configuración propia (`vitest.config.ts`) para probar lógica pura del Worker,
   del frontend y de `shared/` sin levantar el runtime de Cloudflare.
7. **oxlint** (incluido por la plantilla) como linter.
8. **Carpeta `shared/`** para contratos y reglas comunes a frontend y Worker.
9. **Fuentes autoalojadas** (Fraunces y Manrope vía `@fontsource-variable`).

## Dependencias descartadas por ahora

- React Hook Form y Zod: se incorporarán en la Fase 3, con los primeros formularios y validaciones
  de API reales.
- Librerías de íconos y de componentes: los pocos íconos actuales son SVG en línea.
- Supabase JS: se instala en la Fase 2 junto con las migraciones.

## Consecuencias

- `npm run dev` y `npm run preview` reproducen el entorno de Workers localmente.
- Al cambiar `wrangler.jsonc` o `.dev.vars` hay que correr `npm run cf-typegen`.
- `tsconfig.worker.json` usa resolución `bundler` (Wrangler/Vite empaquetan el Worker), para no
  exigir extensiones `.ts` en los imports.
