import { Hono } from 'hono'
import { requestId } from 'hono/request-id'
import { secureHeaders } from 'hono/secure-headers'
import type { ApiErrorBody } from '../shared/api/contracts'
import type { StaffAuthFactory } from './auth/staff-auth'
import { createSupabaseStaffAuth } from './auth/supabase-auth'
import type { ChatDataFactory } from './data/chat-data'
import type { PanelDataFactory } from './data/panel-data'
import type { PublicDataFactory } from './data/public-data'
import { createSupabaseChatData } from './data/supabase-chat'
import { createSupabasePanelData } from './data/supabase-panel'
import { createSupabasePublicData } from './data/supabase-public'
import { adminRoutes } from './routes/admin'
import { defaultReceiptReader, type ReceiptReaderFactory } from './integrations/receipt-reader'
import { chatRoutes } from './routes/chat'
import { healthRoutes } from './routes/health'
import { publicRoutes } from './routes/public'
import { whatsappRoutes } from './routes/whatsapp'
import { createAssistantModel, type AssistantModelFactory } from './services/chat'
import type { AppBindings } from './types'

export interface AppOptions {
  /** Autenticación del personal. Por defecto, Supabase; las pruebas inyectan una falsa. */
  staffAuth?: StaffAuthFactory
  /** Datos de la API pública (catálogo, cotizaciones). Por defecto, Supabase. */
  publicData?: PublicDataFactory
  /** Datos del panel (con el JWT del personal). Por defecto, Supabase. */
  panelData?: PanelDataFactory
  /** Conversaciones del chat web y de WhatsApp. Por defecto, Supabase con la clave de servicio. */
  chatData?: ChatDataFactory
  /** Modelo del asistente. Por defecto, Gemini si hay clave y modo guiado si no. */
  assistantModel?: AssistantModelFactory
  /** Lector de capturas de pago (IA). Por defecto, el de Gemini con la clave del Worker. */
  receiptReader?: ReceiptReaderFactory
  /** fetch para llamadas salientes (WhatsApp). Las pruebas inyectan uno falso. */
  fetchImpl?: typeof fetch
}

/**
 * API HTTP de Woodland. Todas las rutas viven bajo /api; el resto de rutas
 * lo resuelve la SPA (ver `assets.run_worker_first` en wrangler.jsonc).
 */
export function createApp({
  staffAuth = createSupabaseStaffAuth,
  publicData = createSupabasePublicData,
  panelData = createSupabasePanelData,
  chatData = createSupabaseChatData,
  assistantModel = createAssistantModel,
  receiptReader = defaultReceiptReader,
  fetchImpl,
}: AppOptions = {}) {
  const app = new Hono<AppBindings>().basePath('/api')

  app.use('*', requestId())
  app.use('*', secureHeaders())
  app.use('*', async (c, next) => {
    await next()
    // Las respuestas de la API nunca deben quedar en caché compartida.
    if (!c.res.headers.has('Cache-Control')) c.header('Cache-Control', 'no-store')
  })

  app.route('/health', healthRoutes)
  app.route('/', publicRoutes(publicData))
  app.route('/', chatRoutes(chatData, publicData, assistantModel, receiptReader))
  app.route('/', whatsappRoutes(chatData, publicData, assistantModel, fetchImpl))
  app.route('/admin', adminRoutes(staffAuth, panelData, { fetchImpl }))

  app.notFound((c) =>
    c.json<ApiErrorBody>(
      { error: { code: 'not_found', message: 'Recurso no encontrado.', requestId: c.get('requestId') } },
      404,
    ),
  )

  app.onError((err, c) => {
    // Se registra solo el mensaje: nunca cabeceras, cuerpos ni variables de entorno.
    console.error(`[api] ${c.req.method} ${c.req.path} → ${err.message}`)
    return c.json<ApiErrorBody>(
      { error: { code: 'internal_error', message: 'Ocurrió un error inesperado.', requestId: c.get('requestId') } },
      500,
    )
  })

  return app
}
