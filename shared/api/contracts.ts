/**
 * Contratos HTTP compartidos entre el Worker (/api) y el frontend.
 * Cada endpoint nuevo declara aquí la forma de su respuesta para que ambos lados
 * se validen con el mismo tipo.
 */
import type { AppEnv } from '../config/app-env'

/** Forma estándar de los errores de la API. Nunca incluye trazas ni secretos. */
export interface ApiErrorBody {
  error: {
    code: string
    message: string
    requestId?: string
  }
}

/** Roles del personal (enum `app_role` de la base de datos). */
export type StaffRole = 'admin' | 'workshop'

/** Personal autenticado y activo, resuelto por el backend a partir del JWT de Supabase. */
export interface StaffIdentity {
  userId: string
  role: StaffRole
  fullName: string
}

/** GET /api/admin/me */
export type StaffMeResponse = StaffIdentity

export interface HealthResponse {
  status: 'ok'
  service: 'woodland-api'
  environment: AppEnv
  timestamp: string
}

// -----------------------------------------------------------------------------
// API pública (sin sesión)
// -----------------------------------------------------------------------------

export interface CatalogPriceTier {
  minQuantity: number
  unitPrice: number
}

export interface CatalogVariant {
  id: string
  sku: string
  name: string
  dimensionsLabel: string | null
  /** Precio público en soles. Null = a cotizar. */
  price: number | null
  priceTiers: CatalogPriceTier[]
}

export interface CatalogProduct {
  id: string
  slug: string
  name: string
  description: string | null
  category: { slug: string; name: string } | null
  isCustomizable: boolean
  variants: CatalogVariant[]
}

/** GET /api/catalog. Sin stock ni disponibilidad: es una decisión de Woodland. */
export interface CatalogResponse {
  currency: 'PEN'
  products: CatalogProduct[]
}

export interface QuoteItemSummary {
  description: string
  quantity: number
  unitPrice: number | null
  lineTotal: number | null
  customDimensions: string | null
  customization: string | null
}

/** POST /api/quotes (201 al crear; 200 si es un reintento de la misma solicitud). */
export interface QuoteSubmittedResponse {
  quoteId: string
  code: string
  status: string
  /** Si es true, el equipo revisa la cotización antes de enviarla al cliente. */
  requiresReview: boolean
  subtotal: number
  total: number
  currency: 'PEN'
  items: QuoteItemSummary[]
}

/**
 * Pedido hecho desde el chat. `confirmed` = el pedido quedó confirmado y su stock reservado por la base
 * (sin decirle al cliente cuánto stock hay); si no se pudo reservar, queda pendiente de confirmación.
 */
export interface OrderSubmittedResponse {
  orderId: string
  code: string
  status: string
  confirmed: boolean
  total: number
  currency: 'PEN'
}

/** POST /api/orders/status */
export interface OrderStatusResponse {
  code: string
  status: string
  paymentStatus: string
  total: number
  currency: 'PEN'
  deliveryEstimateNote: string | null
  createdAt: string
  items: { description: string; quantity: number }[]
}
