/** Contratos de las respuestas del panel (/api/admin/*). Todas las claves en camelCase. */

export type QuoteStatus =
  | 'submitted' | 'under_review' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted' | 'cancelled'
export type OrderStatus =
  | 'pending_confirmation' | 'confirmed' | 'in_production' | 'ready' | 'shipped' | 'delivered' | 'cancelled'
export type PaymentStatus =
  | 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded' | 'charged_back'
export type FulfillmentType = 'stock' | 'made_to_order'
export type InventoryMovementType =
  | 'production_in' | 'adjustment_in' | 'sale_out' | 'adjustment_out' | 'reservation' | 'reservation_release' | 'return_in'

export interface ListResponse<T> {
  items: T[]
}

// --- Resumen -----------------------------------------------------------------

export interface DashboardResponse {
  quotesPending: number
  quotesSent: number
  ordersByStatus: Partial<Record<OrderStatus, number>>
  confirmedSales30d: { count: number; total: number }
  lowStock: {
    variantId: string
    sku: string
    product: string
    variant: string
    available: number
    minStock: number
    since: string
  }[]
  recentOrders: { id: string; code: string; status: OrderStatus; paymentStatus: PaymentStatus; total: number; createdAt: string; customer: string }[]
  recentQuotes: { id: string; code: string; status: QuoteStatus; requiresReview: boolean; total: number; createdAt: string; customer: string }[]
}

// --- Productos ---------------------------------------------------------------

export interface PanelVariant {
  id: string
  sku: string
  name: string
  dimensionsLabel: string | null
  catalogPrice: number | null
  fulfillmentType: FulfillmentType
  isActive: boolean
  priceTiers: { minQuantity: number; unitPrice: number }[]
  /** Solo administración. */
  internalPricing: { unitCost: number | null; negotiatedPrice: number | null; catalogPriceReference: number | null } | null
}

export interface PanelProduct {
  id: string
  slug: string
  name: string
  description: string | null
  isActive: boolean
  isCustomizable: boolean
  category: { slug: string; name: string } | null
  variants: PanelVariant[]
}

// --- Inventario --------------------------------------------------------------

export interface InventoryLevel {
  variantId: string
  sku: string
  product: string
  /** Slug del producto: sirve para buscar su foto. */
  productSlug: string
  /** Colección a la que pertenece el producto. */
  collection: { slug: string; name: string } | null
  variant: string
  dimensionsLabel: string | null
  onHand: number
  reserved: number
  available: number
  minStock: number | null
  custodian: string | null
  /** Hay una alerta de reposición abierta. */
  lowStock: boolean
}

export interface InventoryMovement {
  id: number
  variantId: string
  movementType: InventoryMovementType
  quantity: number
  onHandAfter: number
  reservedAfter: number
  orderId: string | null
  reason: string | null
  actorRole: string
  createdAt: string
}

// --- Cotizaciones ------------------------------------------------------------

export interface CustomerRef {
  id: string
  fullName: string
  companyName: string | null
  email: string | null
  phone: string | null
}

export interface QuoteListItem {
  id: string
  code: string
  status: QuoteStatus
  requiresReview: boolean
  reviewReason: string | null
  total: number
  createdAt: string
  customer: Pick<CustomerRef, 'fullName' | 'companyName'> | null
  /** Productos sin precio definido: mientras haya alguno, el total aún no es el final. */
  pendingPrices: number
}

export interface QuoteDetailItem {
  id: string
  variantId: string | null
  description: string
  quantity: number
  /** Null = precio pendiente de definir por el equipo. */
  unitPrice: number | null
  lineTotal: number | null
  priceSource: string | null
  customDimensions: string | null
  customization: string | null
}

export interface QuoteDetail extends Omit<QuoteListItem, 'pendingPrices'> {
  channel: string
  customerMessage: string | null
  subtotal: number
  discountTotal: number
  currency: 'PEN'
  validUntil: string | null
  deliveryEstimateNote: string | null
  convertedOrderId: string | null
  customer: CustomerRef | null
  items: QuoteDetailItem[]
}

// --- Pedidos -----------------------------------------------------------------

export interface OrderListItem {
  id: string
  code: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  total: number
  createdAt: string
  /** Null para el taller, que no ve datos de clientes. */
  customer: Pick<CustomerRef, 'fullName' | 'companyName'> | null
}

/** Pago registrado de un pedido (hoy, Yape con captura desde el chat). */
export interface OrderPayment {
  id: string
  method: 'yape'
  amount: number
  createdAt: string
  /** URL firmada (temporal) de la captura; null si no hay captura o no se pudo firmar. */
  proofUrl: string | null
}

export interface OrderDetail extends OrderListItem {
  channel: string
  quoteId: string | null
  subtotal: number
  discountTotal: number
  shippingTotal: number
  currency: 'PEN'
  customerConfirmedAt: string | null
  deliveryEstimateNote: string | null
  shippingAddress: string | null
  internalNotes: string | null
  cancelReason: string | null
  payments: OrderPayment[]
  customer: CustomerRef | null
  items: {
    id: string
    variantId: string | null
    description: string
    quantity: number
    unitPrice: number
    lineTotal: number
    fulfillmentType: FulfillmentType
    customDimensions: string | null
    customization: string | null
  }[]
}

// --- Clientes ----------------------------------------------------------------

export interface CustomerListItem extends CustomerRef {
  customerType: 'individual' | 'business'
  createdAt: string
}

export interface CustomerDetail extends CustomerListItem {
  documentType: string | null
  documentNumber: string | null
  notes: { id: number; body: string; createdAt: string }[]
  quotes: { id: string; code: string; status: QuoteStatus; total: number; createdAt: string }[]
  orders: { id: string; code: string; status: OrderStatus; total: number; createdAt: string }[]
}

// --- Conversaciones (chat web y WhatsApp) ------------------------------------

export type ConversationChannel = 'web_chat' | 'whatsapp'
export type ConversationStatus = 'open' | 'needs_human' | 'with_human' | 'closed'
export type MessageRole = 'customer' | 'assistant' | 'staff' | 'system'

export interface ConversationListItem {
  id: string
  channel: ConversationChannel
  status: ConversationStatus
  contactName: string | null
  contactPhone: string | null
  handoffReason: string | null
  handoffRequestedAt: string | null
  /** Cuándo empezó la conversación: cada nueva (aunque sea el mismo día) es una fila aparte. */
  createdAt: string
  lastMessageAt: string
  quoteId: string | null
  /** Último mensaje, para reconocer la conversación en la lista. */
  lastMessage: { role: MessageRole; body: string } | null
}

export interface ConversationMessage {
  id: number
  role: MessageRole
  body: string
  createdAt: string
  /** Lleva una imagen (la captura de pago): se pide con GET /api/admin/conversations/messages/:id/attachment. */
  attachment?: boolean
}

export interface ConversationDetail extends Omit<ConversationListItem, 'lastMessage'> {
  customer: CustomerRef | null
  quote: { id: string; code: string; status: QuoteStatus } | null
  messages: ConversationMessage[]
}

// --- Reportes ----------------------------------------------------------------

export type SalesChannel = 'web' | 'web_chat' | 'whatsapp' | 'admin'

/** Fila de cotización para revisar o exportar. `total` es null mientras falten precios. */
export interface ReportQuoteRow {
  code: string
  createdAt: string
  customer: string
  channel: SalesChannel
  status: QuoteStatus
  total: number | null
  pendingPrices: number
}

export interface ReportOrderRow {
  code: string
  createdAt: string
  customer: string
  channel: SalesChannel
  status: OrderStatus
  paymentStatus: PaymentStatus
  total: number
}

export interface ReportStockRow {
  sku: string
  product: string
  variant: string
  available: number
  minStock: number | null
}

/**
 * Indicadores comerciales de un rango de fechas (días calendario de Lima, ambos incluidos).
 * Todos los importes los calcula el servidor a partir de los registros de la base.
 */
export interface ReportResponse {
  range: { from: string; to: string }
  generatedAt: string
  /** Se alcanzó el máximo de filas leídas: el rango es demasiado grande y las cifras quedan cortas. */
  truncated: boolean
  inquiries: { conversations: number; byChannel: Record<ConversationChannel, number>; handedOff: number }
  quotes: {
    total: number
    byStatus: Partial<Record<QuoteStatus, number>>
    byChannel: Partial<Record<SalesChannel, number>>
    converted: number
    /** Cotizaciones convertidas en pedido sobre el total del rango. Null si no hubo cotizaciones. */
    conversionRate: number | null
  }
  orders: { total: number; byStatus: Partial<Record<OrderStatus, number>>; byChannel: Partial<Record<SalesChannel, number>> }
  /** Pedidos confirmados o más avanzados (no cancelados), igual que en el Resumen. */
  sales: { count: number; total: number; averageTicket: number | null }
  /** Lo más vendido en esas ventas, por unidades. */
  topProducts: { description: string; quantity: number; total: number }[]
  /** Variantes por debajo de su stock mínimo (estado actual, no depende del rango). */
  lowStock: ReportStockRow[]
  /** Variantes sin unidades disponibles (estado actual). */
  outOfStock: ReportStockRow[]
  quoteRows: ReportQuoteRow[]
  orderRows: ReportOrderRow[]
}

/** Respuesta de GET /reports: el reporte y si el Worker tiene Google Sheets configurado. */
export interface ReportPayload extends ReportResponse {
  canExport: boolean
}

/** Respuesta de POST /reports/export. */
export interface ReportExportResponse {
  spreadsheetUrl: string
  /** Filas de datos escritas por hoja (sin el encabezado). */
  sheets: { title: string; rows: number }[]
}
