import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type {
  ConversationDetail,
  ConversationListItem,
  CustomerDetail,
  CustomerListItem,
  DashboardResponse,
  InventoryLevel,
  InventoryMovement,
  OrderDetail,
  OrderListItem,
  PanelProduct,
  QuoteDetail,
  QuoteListItem,
} from '../../shared/api/panel-contracts'
import type { DirectOrderInput } from '../../shared/api/panel-schemas'
import { readSupabaseConfig } from '../auth/supabase-auth'
import { PanelDataError, type PanelData, type PanelDataFactory, type ReportSource } from './panel-data'

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
} as const

const LIST_LIMIT = 200

// --- Utilidades puras (probadas sin red) -------------------------------------

const toCamel = (key: string) => key.replace(/_([a-z0-9])/g, (_, ch: string) => ch.toUpperCase())

/** Convierte recursivamente las claves de snake_case a camelCase. Los valores no se tocan. */
export function camelize<T = unknown>(value: unknown): T {
  if (Array.isArray(value)) return value.map((v) => camelize(v)) as T
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [toCamel(k), camelize(v)])) as T
  }
  return value as T
}

/**
 * Traduce un error de PostgREST/Postgres. Los errores lanzados a propósito por las funciones
 * (22023, P0002, 42501) traen mensajes en español aptos para el usuario; el resto se propaga (500).
 */
export function mapDbError(error: { code?: string; message: string }): never {
  switch (error.code) {
    case '42501':
      throw new PanelDataError(403, 'forbidden', 'No tienes permiso para esta acción.')
    case 'P0002':
      throw new PanelDataError(404, 'not_found', error.message)
    case '22023':
      throw new PanelDataError(422, 'invalid_request', error.message)
    case '23505':
    case '23503':
    case '23P01':
      throw new PanelDataError(409, 'conflict', 'La operación entra en conflicto con los datos actuales.')
    case '23514':
    case '22P02':
      throw new PanelDataError(422, 'invalid_request', 'Los datos enviados no son válidos.')
    default:
      throw new Error(`db: ${error.code ?? 'error'}`)
  }
}

/** Quita caracteres que tienen significado en los filtros `or(...)` de PostgREST. */
export function sanitizeSearch(term: string) {
  return term.replace(/[,()*%\\:"']/g, ' ').replace(/\s+/g, ' ').trim()
}

const bySortOrder = (a: { sort_order?: number }, b: { sort_order?: number }) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
const newestFirst = (a: { createdAt: string }, b: { createdAt: string }) => b.createdAt.localeCompare(a.createdAt)

type Row = Record<string, any> // eslint-disable-line -- filas de PostgREST sin esquema generado

export function toDashboard(json: Row): DashboardResponse {
  return {
    quotesPending: json.quotes_pending,
    quotesSent: json.quotes_sent,
    // Las claves son estados: se conservan tal cual.
    ordersByStatus: json.orders_by_status ?? {},
    confirmedSales30d: json.confirmed_sales_30d,
    lowStock: camelize(json.low_stock),
    recentOrders: camelize(json.recent_orders),
    recentQuotes: camelize(json.recent_quotes),
  }
}

export function toQuoteListItem({ items, ...row }: Row): QuoteListItem {
  const pendingPrices = ((items as Row[] | null) ?? []).filter((item) => item.unit_price === null).length
  return { ...camelize<Omit<QuoteListItem, 'pendingPrices'>>(row), pendingPrices }
}

export function toPanelProduct(row: Row): PanelProduct {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    isCustomizable: row.is_customizable,
    category: row.category,
    variants: [...(row.variants as Row[])].sort(bySortOrder).map((v) => {
      // Relación uno a uno: PostgREST la entrega como objeto (o lista de un elemento).
      const internal: Row | null = Array.isArray(v.internal) ? (v.internal[0] ?? null) : (v.internal ?? null)
      return {
        id: v.id,
        sku: v.sku,
        name: v.name,
        dimensionsLabel: v.dimensions_label,
        catalogPrice: v.catalog_price,
        fulfillmentType: v.fulfillment_type,
        isActive: v.is_active,
        priceTiers: [...(v.price_tiers as Row[])]
          .sort((a, b) => a.min_quantity - b.min_quantity)
          .map((t) => ({ minQuantity: t.min_quantity, unitPrice: t.unit_price })),
        internalPricing: internal
          ? {
              unitCost: internal.unit_cost,
              negotiatedPrice: internal.negotiated_price,
              catalogPriceReference: internal.catalog_price_reference,
            }
          : null,
      }
    }),
  }
}

export function toInventoryLevel(row: Row, openAlerts: ReadonlySet<string>): InventoryLevel {
  return {
    variantId: row.variant_id,
    sku: row.variant.sku,
    product: row.variant.product.name,
    productSlug: row.variant.product.slug,
    collection: row.variant.product.category ?? null,
    variant: row.variant.name,
    dimensionsLabel: row.variant.dimensions_label,
    onHand: row.on_hand,
    reserved: row.reserved,
    available: row.available,
    minStock: row.min_stock,
    custodian: row.custodian,
    lowStock: openAlerts.has(row.variant_id),
  }
}

/** Convierte la solicitud validada al JSON que espera `create_direct_order`. */
export function toDirectOrderPayload(input: DirectOrderInput) {
  const c = input.customer
  return {
    channel: input.channel,
    customer:
      'id' in c
        ? { id: c.id }
        : {
            type: c.type,
            full_name: c.fullName,
            company_name: c.companyName ?? null,
            document_type: c.documentType ?? null,
            document_number: c.documentNumber ?? null,
            email: c.email ?? null,
            phone: c.phone ?? null,
          },
    items: input.items.map((i) => ({
      variant_id: i.variantId ?? null,
      description: i.description ?? null,
      quantity: i.quantity,
      unit_price: i.unitPrice ?? null,
      custom_dimensions: i.customDimensions || null,
      customization: i.customization || null,
    })),
    discount_total: input.discountTotal,
    shipping_address: input.shippingAddress || null,
    internal_notes: input.internalNotes || null,
    delivery_estimate_note: input.deliveryEstimateNote || null,
    customer_confirmed: input.customerConfirmed,
    confirm: input.confirm,
  }
}

// --- Selecciones -------------------------------------------------------------

const CUSTOMER_REF = 'id, full_name, company_name, email, phone'

const INVENTORY_SELECT = `
  id, sku, name, dimensions_label, is_active,
  product:products ( slug, name, is_active, category:categories ( slug, name ) ),
  level:inventory_levels ( on_hand, reserved, available, min_stock, custodian )`

const PRODUCT_SELECT = `
  id, slug, name, description, is_active, is_customizable, sort_order,
  category:categories ( slug, name ),
  variants:product_variants (
    id, sku, name, dimensions_label, catalog_price, fulfillment_type, is_active, sort_order,
    price_tiers ( min_quantity, unit_price ),
    internal:variant_internal_pricing ( unit_cost, negotiated_price, catalog_price_reference )
  )`

const QUOTE_LIST_SELECT = `id, code, status, requires_review, review_reason, total, created_at,
  customer:customers ( full_name, company_name ),
  items:quote_items ( unit_price )`

const QUOTE_DETAIL_SELECT = `id, code, status, requires_review, review_reason, total, created_at,
  channel, customer_message, subtotal, discount_total, currency, valid_until, delivery_estimate_note, converted_order_id,
  customer:customers ( ${CUSTOMER_REF} ),
  items:quote_items ( id, variant_id, description, quantity, unit_price, line_total, price_source, custom_dimensions, customization, sort_order )`

const ORDER_LIST_SELECT = `id, code, status, payment_status, total, created_at,
  customer:customers ( full_name, company_name )`

const ORDER_DETAIL_SELECT = `id, code, status, payment_status, total, created_at,
  channel, quote_id, subtotal, discount_total, shipping_total, currency, customer_confirmed_at,
  delivery_estimate_note, shipping_address, internal_notes, cancel_reason,
  customer:customers ( ${CUSTOMER_REF} ),
  items:order_items ( id, variant_id, description, quantity, unit_price, line_total, fulfillment_type, custom_dimensions, customization, sort_order )`

const CONVERSATION_LIST_SELECT =
  'id, channel, status, contact_name, contact_phone, handoff_reason, handoff_requested_at, created_at, last_message_at, quote_id'

/** Las que esperan a una persona primero; dentro de cada grupo, la más reciente arriba. */
const STATUS_PRIORITY: Record<string, number> = { needs_human: 0, with_human: 1, open: 2, closed: 3 }

/**
 * `triage`: las que esperan a una persona van primero. En la bandeja «Todas» no (`triage: false`): se ordena solo por
 * la última actividad, así una conversación nueva de hoy no queda enterrada bajo las antiguas.
 */
export function toConversationList(rows: Row[], options: { triage?: boolean } = {}): ConversationListItem[] {
  const triage = options.triage ?? true
  return rows
    .map((row) => {
      const { last, ...rest } = row
      const lastMessage = Array.isArray(last) && last.length > 0 ? { role: last[0].role, body: last[0].body } : null
      return { ...camelize<Omit<ConversationListItem, 'lastMessage'>>(rest), lastMessage }
    })
    .sort(
      (a, b) =>
        (triage ? (STATUS_PRIORITY[a.status] ?? 9) - (STATUS_PRIORITY[b.status] ?? 9) : 0) || b.lastMessageAt.localeCompare(a.lastMessageAt),
    )
}

export function toConversationDetail(row: Row): ConversationDetail {
  const detail = camelize<ConversationDetail>(row)
  return {
    ...detail,
    customer: detail.customer ?? null,
    quote: detail.quote ?? null,
    messages: [...detail.messages].sort((a, b) => a.id - b.id),
  }
}

const MOVEMENT_SELECT =
  'id, variant_id, movement_type, quantity, on_hand_after, reserved_after, order_id, reason, actor_role, created_at'

// --- Implementación con Supabase y el JWT del usuario ------------------------

/**
 * Todas las consultas se hacen con el token del usuario (clave publicable + Authorization),
 * nunca con la clave secreta: los permisos de cada rol los decide la base de datos.
 */
export const createSupabasePanelData: PanelDataFactory = (env, accessToken) => {
  const config = readSupabaseConfig(env)
  if (!config) return null

  const db: SupabaseClient = createClient(config.url, config.publishableKey, {
    ...clientOptions,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })

  const check = <T>({ data, error }: { data: T; error: { code?: string; message: string } | null }): T => {
    if (error) mapDbError(error)
    return data
  }

  /** Actualiza una fila y falla con 404 si no existe o RLS no la dejó modificar. */
  async function updateRow(table: string, id: string, values: Row) {
    const rows = check(await db.from(table).update(values).eq('id', id).select('id'))
    if (!rows || rows.length === 0) throw new PanelDataError(404, 'not_found', 'El registro no existe.')
  }

  const rpc = async (fn: string, args: Row) => check(await db.rpc(fn, args))

  const provider: PanelData = {
    async getDashboard() {
      return toDashboard((await rpc('get_admin_dashboard', {})) as Row)
    },

    // Productos
    async listProducts() {
      const rows = check(await db.from('products').select(PRODUCT_SELECT).order('sort_order').order('name')) as Row[]
      return { items: rows.map(toPanelProduct) }
    },
    async updateProduct(id, patch) {
      const values: Row = {}
      if (patch.isActive !== undefined) values.is_active = patch.isActive
      if (patch.name !== undefined) values.name = patch.name
      if (patch.description !== undefined) values.description = patch.description === '' ? null : patch.description
      await updateRow('products', id, values)
    },
    async updateVariant(id, patch) {
      const values: Row = {}
      if (patch.isActive !== undefined) values.is_active = patch.isActive
      if (patch.catalogPrice !== undefined) values.catalog_price = patch.catalogPrice
      await updateRow('product_variants', id, values)
    },

    // Inventario
    async listInventory() {
      // Se parte de las variantes (no de las filas de existencias) para que un modelo nuevo aparezca con 0 antes de su primera producción.
      const variants = check(
        await db.from('product_variants').select(INVENTORY_SELECT).eq('fulfillment_type', 'stock'),
      ) as Row[]
      const levels = variants
        .map((v) => ({ v, level: (Array.isArray(v.level) ? v.level[0] : v.level) as Row | null | undefined }))
        // Lo retirado del catálogo (variante o producto oculto) no se muestra en el inventario.
        .filter(({ v }) => v.is_active && v.product.is_active)
        .map(({ v, level }) => ({
          variant_id: v.id,
          on_hand: level?.on_hand ?? 0,
          reserved: level?.reserved ?? 0,
          available: level?.available ?? 0,
          min_stock: level?.min_stock ?? null,
          custodian: level?.custodian ?? null,
          variant: v,
        })) as Row[]
      const alerts = check(await db.from('stock_alerts').select('variant_id').is('resolved_at', null)) as Row[]
      const open = new Set(alerts.map((a) => a.variant_id as string))
      const items = levels
        .map((l) => toInventoryLevel(l, open))
        .sort((a, b) => a.product.localeCompare(b.product) || a.variant.localeCompare(b.variant))
      return { items }
    },
    async listMovements(variantId, limit) {
      const rows = check(
        await db
          .from('inventory_movements')
          .select(MOVEMENT_SELECT)
          .eq('variant_id', variantId)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(limit),
      )
      return { items: camelize<InventoryMovement[]>(rows) }
    },
    async applyMovement(input) {
      const row = await rpc('apply_inventory_movement', {
        p_variant_id: input.variantId,
        p_movement_type: input.type,
        p_quantity: input.quantity,
        p_reason: input.reason || null,
        p_order_id: null,
        p_idempotency_key: input.idempotencyKey,
      })
      const { idempotencyKey: _omit, createdBy: _omit2, ...movement } = camelize<Row>(row)
      return movement as InventoryMovement
    },
    async updateInventorySettings(variantId, input) {
      await rpc('update_inventory_settings', {
        p_variant_id: variantId,
        p_min_stock: input.minStock,
        p_custodian: input.custodian,
      })
    },

    // Cotizaciones
    async listQuotes(status) {
      let query = db.from('quotes').select(QUOTE_LIST_SELECT).order('created_at', { ascending: false }).limit(LIST_LIMIT)
      if (status) query = query.eq('status', status)
      return { items: (check(await query) as Row[]).map(toQuoteListItem) }
    },
    async getQuote(id) {
      const row = check(await db.from('quotes').select(QUOTE_DETAIL_SELECT).eq('id', id).maybeSingle()) as Row | null
      if (!row) return null
      const items = [...(row.items as Row[])].sort(bySortOrder).map(({ sort_order: _s, ...item }) => item)
      return camelize<QuoteDetail>({ ...row, items })
    },
    async setQuoteItemPrice(itemId, unitPrice) {
      await rpc('set_quote_item_price', { p_item_id: itemId, p_unit_price: unitPrice })
    },
    async sendQuote(id, input) {
      await rpc('send_quote', {
        p_quote_id: id,
        p_discount_total: input.discountTotal,
        p_valid_until: input.validUntil ?? null,
        p_delivery_estimate_note: input.deliveryEstimateNote || null,
      })
    },
    async acceptQuote(id) {
      await rpc('accept_quote', { p_quote_id: id })
    },
    async cancelQuote(id) {
      await rpc('cancel_quote', { p_quote_id: id })
    },
    async convertQuote(id, input) {
      const orderId = await rpc('convert_quote_to_order', {
        p_quote_id: id,
        p_customer_confirmed: input.customerConfirmed,
        p_shipping_address: input.shippingAddress || null,
      })
      return orderId as string
    },

    // Pedidos
    async listOrders(status) {
      let query = db.from('orders').select(ORDER_LIST_SELECT).order('created_at', { ascending: false }).limit(LIST_LIMIT)
      if (status) query = query.eq('status', status)
      return { items: camelize<OrderListItem[]>(check(await query)) }
    },
    async getOrder(id) {
      const row = check(await db.from('orders').select(ORDER_DETAIL_SELECT).eq('id', id).maybeSingle()) as Row | null
      if (!row) return null
      const items = [...(row.items as Row[])].sort(bySortOrder).map(({ sort_order: _s, ...item }) => item)
      const paymentRows = check(
        await db.from('order_payments').select('id, method, amount, proof_path, created_at').eq('order_id', id).order('created_at', { ascending: false }),
      ) as Row[]
      const payments = await Promise.all(
        paymentRows.map(async ({ proof_path, ...payment }) => {
          const signed = proof_path ? await db.storage.from('payment-proofs').createSignedUrl(proof_path as string, 3600) : null
          return { ...payment, amount: Number(payment.amount), proof_url: signed?.data?.signedUrl ?? null }
        }),
      )
      return camelize<OrderDetail>({ ...row, items, payments })
    },
    async createDirectOrder(input) {
      return (await rpc('create_direct_order', { p_request: toDirectOrderPayload(input) })) as string
    },
    async confirmOrder(id, customerConfirmed) {
      await rpc('confirm_order', { p_order_id: id, p_customer_confirmed: customerConfirmed })
    },
    async setOrderStatus(id, status) {
      await updateRow('orders', id, { status })
    },
    async dispatchOrder(id, finalStatus) {
      await rpc('dispatch_order', { p_order_id: id, p_final_status: finalStatus })
    },
    async cancelOrder(id, reason) {
      await rpc('cancel_order', { p_order_id: id, p_reason: reason })
    },
    async updateOrder(id, patch) {
      const values: Row = {}
      if (patch.internalNotes !== undefined) values.internal_notes = patch.internalNotes || null
      if (patch.shippingAddress !== undefined) values.shipping_address = patch.shippingAddress || null
      if (patch.deliveryEstimateNote !== undefined) values.delivery_estimate_note = patch.deliveryEstimateNote || null
      await updateRow('orders', id, values)
    },

    // Clientes
    async listCustomers(search) {
      let query = db
        .from('customers')
        .select(`${CUSTOMER_REF}, customer_type, created_at`)
        .order('created_at', { ascending: false })
        .limit(LIST_LIMIT)
      const term = search ? sanitizeSearch(search) : ''
      if (term) {
        const like = `%${term}%`
        query = query.or(`full_name.ilike.${like},company_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
      }
      return { items: camelize<CustomerListItem[]>(check(await query)) }
    },
    async getCustomer(id) {
      const row = check(
        await db
          .from('customers')
          .select(
            `${CUSTOMER_REF}, customer_type, document_type, document_number, created_at,
             notes:customer_notes ( id, body, created_at ),
             quotes ( id, code, status, total, created_at ),
             orders ( id, code, status, total, created_at )`,
          )
          .eq('id', id)
          .maybeSingle(),
      ) as Row | null
      if (!row) return null
      const customer = camelize<CustomerDetail>(row)
      return {
        ...customer,
        notes: [...customer.notes].sort(newestFirst),
        quotes: [...customer.quotes].sort(newestFirst),
        orders: [...customer.orders].sort(newestFirst),
      }
    },
    async addCustomerNote(customerId, body) {
      check(await db.from('customer_notes').insert({ customer_id: customerId, body }))
    },

    // Conversaciones
    async listConversations(status) {
      let query = db
        .from('conversations')
        .select(`${CONVERSATION_LIST_SELECT}, last:conversation_messages ( id, role, body )`)
        .order('last_message_at', { ascending: false })
        .order('id', { referencedTable: 'conversation_messages', ascending: false })
        .limit(1, { referencedTable: 'conversation_messages' })
        .limit(LIST_LIMIT)
      if (status) query = query.eq('status', status)
      const rows = check(await query) as Row[]
      return { items: toConversationList(rows, { triage: status !== undefined }) }
    },
    async getConversation(id) {
      const row = check(
        await db
          .from('conversations')
          .select(
            `${CONVERSATION_LIST_SELECT},
             customer:customers ( ${CUSTOMER_REF} ),
             quote:quotes ( id, code, status ),
             messages:conversation_messages ( id, role, body, created_at )`,
          )
          .eq('id', id)
          .maybeSingle(),
      ) as Row | null
      return row ? toConversationDetail(row) : null
    },
    async setConversationStatus(id, status) {
      await rpc('set_conversation_status', { p_conversation_id: id, p_status: status })
    },

    // Reportes: solo lectura del rango [start, end).
    async getReportSource({ start, end }) {
      const inRange = (table: string, select: string) =>
        db.from(table).select(select).gte('created_at', start).lt('created_at', end).order('created_at').limit(REPORT_ROW_LIMIT)
      const [conversations, quotes, orders, inventory] = await Promise.all([
        inRange('conversations', 'channel, handoff_requested_at'),
        inRange('quotes', REPORT_QUOTE_SELECT),
        inRange('orders', REPORT_ORDER_SELECT),
        provider.listInventory(),
      ])
      const lists = [check(conversations), check(quotes), check(orders)] as unknown as Row[][]
      return toReportSource(lists[0]!, lists[1]!, lists[2]!, inventory.items, lists.some((rows) => rows.length >= REPORT_ROW_LIMIT))
    },
  }
  return provider
}

/** Máximo de filas por lectura en un reporte (el tope por defecto de PostgREST en Supabase). */
const REPORT_ROW_LIMIT = 1000

const REPORT_QUOTE_SELECT = `code, status, channel, total, created_at,
  customer:customers ( full_name, company_name ),
  items:quote_items ( unit_price )`

const REPORT_ORDER_SELECT = `code, status, payment_status, channel, total, created_at,
  customer:customers ( full_name, company_name ),
  items:order_items ( description, quantity, line_total )`

/** En los reportes se identifica al cliente por su empresa y, si no tiene, por su nombre. */
const customerName = (customer: Row | null) => customer?.company_name ?? customer?.full_name ?? '—'

export function toReportSource(conversations: Row[], quotes: Row[], orders: Row[], inventory: InventoryLevel[], truncated: boolean): ReportSource {
  return {
    conversations: conversations.map((c) => ({ channel: c.channel, handedOff: c.handoff_requested_at !== null })),
    quotes: quotes.map((q) => ({
      code: q.code,
      createdAt: q.created_at,
      customer: customerName(q.customer),
      channel: q.channel,
      status: q.status,
      total: Number(q.total),
      pendingPrices: ((q.items as Row[] | null) ?? []).filter((item) => item.unit_price === null).length,
    })),
    orders: orders.map((o) => ({
      code: o.code,
      createdAt: o.created_at,
      customer: customerName(o.customer),
      channel: o.channel,
      status: o.status,
      paymentStatus: o.payment_status,
      total: Number(o.total),
      items: ((o.items as Row[] | null) ?? []).map((item) => ({
        description: item.description,
        quantity: item.quantity,
        lineTotal: item.line_total === null ? null : Number(item.line_total),
      })),
    })),
    inventory,
    truncated,
  }
}
