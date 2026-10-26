import type {
  ConversationChannel,
  ConversationDetail,
  ConversationListItem,
  CustomerDetail,
  CustomerListItem,
  DashboardResponse,
  InventoryLevel,
  InventoryMovement,
  ListResponse,
  OrderDetail,
  OrderListItem,
  PanelProduct,
  QuoteDetail,
  QuoteListItem,
  ReportOrderRow,
  ReportQuoteRow,
} from '../../shared/api/panel-contracts'
import type {
  DirectOrderInput,
  inventoryMovementBody,
  inventorySettingsBody,
  orderPatch,
  productPatch,
  variantPatch,
} from '../../shared/api/panel-schemas'
import type { z } from 'zod'

/** Error de negocio o de permisos que la base devolvió con un mensaje apto para mostrar. */
export class PanelDataError extends Error {
  readonly status: 403 | 404 | 409 | 422
  readonly code: 'forbidden' | 'not_found' | 'conflict' | 'invalid_request'

  constructor(status: 403 | 404 | 409 | 422, code: PanelDataError['code'], message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export type MovementInput = z.infer<typeof inventoryMovementBody>
export type InventorySettingsInput = z.infer<typeof inventorySettingsBody>
export type ProductPatch = z.infer<typeof productPatch>
export type VariantPatch = z.infer<typeof variantPatch>
export type OrderPatch = z.infer<typeof orderPatch>

/**
 * Operaciones del panel. La implementación real usa el JWT del propio usuario, así que
 * RLS y los chequeos de rol de las funciones SQL siguen siendo la barrera final.
 */
export interface PanelData {
  getDashboard(): Promise<DashboardResponse>

  listProducts(): Promise<ListResponse<PanelProduct>>
  updateProduct(id: string, patch: ProductPatch): Promise<void>
  updateVariant(id: string, patch: VariantPatch): Promise<void>

  listInventory(): Promise<ListResponse<InventoryLevel>>
  listMovements(variantId: string, limit: number): Promise<ListResponse<InventoryMovement>>
  applyMovement(input: MovementInput): Promise<InventoryMovement>
  updateInventorySettings(variantId: string, input: InventorySettingsInput): Promise<void>

  listQuotes(status?: string): Promise<ListResponse<QuoteListItem>>
  getQuote(id: string): Promise<QuoteDetail | null>
  setQuoteItemPrice(itemId: string, unitPrice: number): Promise<void>
  sendQuote(id: string, input: { discountTotal: number; validUntil?: string; deliveryEstimateNote?: string }): Promise<void>
  acceptQuote(id: string): Promise<void>
  /** Archiva la cotización (estado cancelado); las ya convertidas en pedido no se pueden cancelar. */
  cancelQuote(id: string): Promise<void>
  /** Devuelve el id del pedido creado. */
  convertQuote(id: string, input: { customerConfirmed: boolean; shippingAddress?: string }): Promise<string>

  listOrders(status?: string): Promise<ListResponse<OrderListItem>>
  getOrder(id: string): Promise<OrderDetail | null>
  /** Venta directa sin cotización. Devuelve el id del pedido. */
  createDirectOrder(input: DirectOrderInput): Promise<string>
  confirmOrder(id: string, customerConfirmed: boolean): Promise<void>
  setOrderStatus(id: string, status: 'in_production' | 'ready'): Promise<void>
  dispatchOrder(id: string, finalStatus: 'shipped' | 'delivered'): Promise<void>
  cancelOrder(id: string, reason: string): Promise<void>
  updateOrder(id: string, patch: OrderPatch): Promise<void>

  listCustomers(search?: string): Promise<ListResponse<CustomerListItem>>
  getCustomer(id: string): Promise<CustomerDetail | null>
  addCustomerNote(customerId: string, body: string): Promise<void>

  listConversations(status?: string): Promise<ListResponse<ConversationListItem>>
  getConversation(id: string): Promise<ConversationDetail | null>
  /** Marca la conversación como revisada (open) o la cierra (closed). El equipo no chatea con el cliente. */
  setConversationStatus(id: string, status: 'open' | 'closed'): Promise<void>
  deleteConversation(id: string): Promise<void>

  /** Registros creados en [start, end) para armar un reporte, más el inventario actual. */
  getReportSource(range: { start: string; end: string }): Promise<ReportSource>
}

/** Materia prima de un reporte. Los totales los calcula `buildReport` (worker/services/reports.ts). */
export interface ReportSource {
  conversations: { channel: ConversationChannel; handedOff: boolean }[]
  quotes: (Omit<ReportQuoteRow, 'total'> & { total: number })[]
  orders: (ReportOrderRow & { items: { description: string; quantity: number; lineTotal: number | null }[] })[]
  inventory: InventoryLevel[]
  /** Alguna lectura llegó al máximo de filas. */
  truncated: boolean
}

/** Devuelve null cuando la base no está configurada en este ambiente. */
export type PanelDataFactory = (env: Env, accessToken: string) => PanelData | null
