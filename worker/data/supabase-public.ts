import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type {
  CatalogProduct,
  CatalogResponse,
  OrderStatusResponse,
  OrderSubmittedResponse,
  QuoteSubmittedResponse,
} from '../../shared/api/contracts'
import type { QuoteRequestInput } from '../../shared/api/public-schemas'
import { readSupabaseConfig } from '../auth/supabase-auth'
import { PublicDataError, type PublicData, type PublicDataFactory } from './public-data'

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
} as const

// --- Filas tal como las devuelve PostgREST ----------------------------------

interface VariantRow {
  id: string
  sku: string
  name: string
  dimensions_label: string | null
  catalog_price: number | null
  sort_order: number
  price_tiers: { min_quantity: number; unit_price: number }[]
}

interface ProductRow {
  id: string
  slug: string
  name: string
  description: string | null
  is_customizable: boolean
  sort_order: number
  category: { slug: string; name: string } | null
  variants: VariantRow[]
}

interface QuoteSummaryJson {
  quote_id: string
  code: string
  status: string
  requires_review: boolean
  subtotal: number
  total: number
  currency: 'PEN'
  items: {
    description: string
    quantity: number
    unit_price: number | null
    line_total: number | null
    custom_dimensions: string | null
    customization: string | null
  }[]
}

interface OrderStatusJson {
  code: string
  status: string
  payment_status: string
  total: number
  delivery_estimate_note: string | null
  created_at: string
  items: { description: string; quantity: number }[]
}

// --- Transformaciones puras (probadas sin red) -------------------------------

/**
 * Arma la respuesta del catálogo. Por decisión de Woodland la web pública NO expone el stock ni su
 * disponibilidad: solo precio publicado y escalas por volumen.
 */
export function buildCatalog(rows: ProductRow[]): CatalogResponse {
  const bySort = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order
  const products: CatalogProduct[] = [...rows]
    .sort(bySort)
    .filter((p) => p.variants.length > 0)
    .map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      category: p.category,
      isCustomizable: p.is_customizable,
      variants: [...p.variants].sort(bySort).map((v) => ({
        id: v.id,
        sku: v.sku,
        name: v.name,
        dimensionsLabel: v.dimensions_label,
        price: v.catalog_price,
        priceTiers: [...v.price_tiers]
          .sort((a, b) => a.min_quantity - b.min_quantity)
          .map((t) => ({ minQuantity: t.min_quantity, unitPrice: t.unit_price })),
      })),
    }))
  return { currency: 'PEN', products }
}

/** Convierte la solicitud validada al JSON que espera `submit_quote_request`. */
export function toQuoteRpcPayload(request: QuoteRequestInput, channel: 'web' | 'web_chat' | 'whatsapp' = 'web') {
  const { customer } = request
  return {
    request_id: request.requestId,
    channel,
    customer: {
      type: customer.type,
      full_name: customer.fullName,
      company_name: customer.companyName ?? null,
      document_type: customer.documentType ?? null,
      document_number: customer.documentNumber ?? null,
      email: customer.email ?? null,
      phone: customer.phone ?? null,
    },
    message: request.message ?? null,
    items: request.items.map((item) => ({
      variant_id: item.variantId ?? null,
      description: item.description ?? null,
      quantity: item.quantity,
      custom_dimensions: item.customDimensions ?? null,
      customization: item.customization ?? null,
    })),
  }
}

/** Nota interna de todo pedido nacido en el chat: el pago por Yape/Plin lo verifica el equipo. */
export const CHAT_ORDER_NOTE = 'Pedido hecho por el chat. El pago (Yape/Plin) lo verifica el equipo; no está pagado.'

/** Cuerpo de create_direct_order para un pedido del chat. Sin precios: los calcula la base. */
export function toOrderRpcPayload(request: QuoteRequestInput, channel: 'web_chat' | 'whatsapp', confirm: boolean) {
  const { customer } = request
  return {
    channel,
    customer: {
      type: customer.type,
      full_name: customer.fullName,
      company_name: customer.companyName ?? null,
      document_type: customer.documentType ?? null,
      document_number: customer.documentNumber ?? null,
      email: customer.email ?? null,
      phone: customer.phone ?? null,
    },
    items: request.items.map((item) => ({
      variant_id: item.variantId ?? null,
      description: item.description ?? null,
      quantity: item.quantity,
      custom_dimensions: item.customDimensions ?? null,
      customization: item.customization ?? null,
    })),
    shipping_address: request.shippingAddress ?? null,
    internal_notes: request.message ? `${CHAT_ORDER_NOTE} Cliente: ${request.message}` : CHAT_ORDER_NOTE,
    customer_confirmed: true,
    confirm,
  }
}

export function toQuoteResponse(json: QuoteSummaryJson): QuoteSubmittedResponse {
  return {
    quoteId: json.quote_id,
    code: json.code,
    status: json.status,
    requiresReview: json.requires_review,
    subtotal: json.subtotal,
    total: json.total,
    currency: json.currency,
    items: json.items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unit_price,
      lineTotal: i.line_total,
      customDimensions: i.custom_dimensions,
      customization: i.customization,
    })),
  }
}

export function toOrderStatusResponse(json: OrderStatusJson): OrderStatusResponse {
  return {
    code: json.code,
    status: json.status,
    paymentStatus: json.payment_status,
    total: json.total,
    currency: 'PEN',
    deliveryEstimateNote: json.delivery_estimate_note,
    createdAt: json.created_at,
    items: json.items,
  }
}

/**
 * Los errores que la base lanza a propósito (22023 datos no válidos, P0002 recurso inexistente)
 * traen un mensaje en español pensado para el cliente. Cualquier otro se propaga como 500.
 */
function rethrow(error: { code?: string; message: string }): never {
  if (error.code === '22023' || error.code === 'P0002') {
    throw new PublicDataError('invalid_request', error.message)
  }
  throw new Error(`rpc: ${error.code ?? 'error'}`)
}

// --- Implementación con Supabase --------------------------------------------

const CATALOG_SELECT = `
  id, slug, name, description, is_customizable, sort_order,
  category:categories ( slug, name ),
  variants:product_variants (
    id, sku, name, dimensions_label, catalog_price, sort_order,
    price_tiers ( min_quantity, unit_price )
  )`

/**
 * - Catálogo: clave publicable; RLS ya limita la lectura a lo activo.
 * - Cotizaciones y estado de pedido: clave secreta (las funciones exigen rol de servicio).
 */
export const createSupabasePublicData: PublicDataFactory = (env) => {
  const config = readSupabaseConfig(env)
  if (!config) return null
  const secretKey = env.SUPABASE_SECRET_KEY?.trim()

  const anon = (): SupabaseClient => createClient(config.url, config.publishableKey, clientOptions)
  const service = (): SupabaseClient => {
    if (!secretKey) throw new Error('SUPABASE_SECRET_KEY no configurada')
    return createClient(config.url, secretKey, clientOptions)
  }

  const provider: PublicData = {
    async listCatalog() {
      const { data, error } = await anon()
        .from('products')
        .select(CATALOG_SELECT)
        .eq('is_active', true)
        .eq('product_variants.is_active', true)
        .overrideTypes<ProductRow[], { merge: false }>()
      if (error) throw new Error(`catalog: ${error.code ?? 'error'}`)

      return buildCatalog(data)
    },

    async submitQuote(request, channel) {
      const { data, error } = await service().rpc('submit_quote_request', { p_request: toQuoteRpcPayload(request, channel) })
      if (error) rethrow(error)
      return toQuoteResponse(data as QuoteSummaryJson)
    },

    async submitOrder(request, channel) {
      const client = service()
      // Primero se intenta confirmar (reserva el stock). Si no alcanza (23514) la operación se revierte
      // entera y se crea el pedido sin confirmar: el equipo lo ve y coordina. Nunca se muestra el stock.
      let reserved = true
      let created = await client.rpc('create_direct_order', { p_request: toOrderRpcPayload(request, channel, true) })
      if (created.error?.code === '23514') {
        reserved = false
        created = await client.rpc('create_direct_order', { p_request: toOrderRpcPayload(request, channel, false) })
      }
      if (created.error) rethrow(created.error)

      const orderId = created.data as string
      const { data, error } = await client.from('orders').select('code, status, total').eq('id', orderId).single()
      if (error || !data) throw new Error(`order: ${error?.code ?? 'error'}`)
      const order: OrderSubmittedResponse = {
        orderId,
        code: data.code,
        status: data.status,
        confirmed: reserved && data.status === 'confirmed',
        total: Number(data.total),
        currency: 'PEN',
      }
      return order
    },

    async getOrderStatus({ code, contact }) {
      const { data, error } = await service().rpc('get_order_status_public', { p_code: code, p_contact: contact })
      if (error) rethrow(error)
      return data ? toOrderStatusResponse(data as OrderStatusJson) : null
    },
  }
  return provider
}
