/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL del proyecto Supabase (pública). */
  readonly VITE_SUPABASE_URL?: string
  /** Clave publicable de Supabase (pública, protegida por RLS). Nunca la clave secreta. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  /** Base de rutas del panel. En el despliegue propio del panel vale "/"; en local, "/panel". */
  readonly VITE_PANEL_BASE?: string
  /** URL de la web pública para el enlace «Ir a la web pública» del panel (despliegue separado). */
  readonly VITE_PUBLIC_SITE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
