import type { StaffIdentity } from '../shared/api/contracts'

declare global {
  interface Env {
    /** Clave secreta de Supabase (omite RLS). Solo backend; se carga con `wrangler secret put`. */
    SUPABASE_SECRET_KEY?: string
    /** Clave de Gemini para el asistente. Sin ella, el asistente responde en modo guiado. */
    GEMINI_API_KEY?: string
    GEMINI_MODEL?: string
    /** WhatsApp Cloud API (Meta). Sin estos secretos el canal queda desactivado. */
    WHATSAPP_ACCESS_TOKEN?: string
    WHATSAPP_PHONE_NUMBER_ID?: string
    WHATSAPP_APP_SECRET?: string
    WHATSAPP_VERIFY_TOKEN?: string
    /** Exportación de Reportes a Google Sheets (cuenta de servicio). Sin ellos el botón no aparece. */
    GOOGLE_SERVICE_ACCOUNT_EMAIL?: string
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?: string
    GOOGLE_SHEETS_REPORT_ID?: string
  }
}

/** Tipos de contexto de Hono compartidos por todas las rutas del Worker. */
export type AppBindings = {
  Bindings: Env
  Variables: {
    /** Lo define `requireStaff` en las rutas protegidas. */
    staff: StaffIdentity
    /** JWT del usuario: las consultas del panel lo reenvían a Supabase para que apliquen RLS y roles. */
    accessToken: string
  }
}
