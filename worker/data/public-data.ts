import type {
  CatalogResponse,
  OrderStatusResponse,
  OrderSubmittedResponse,
  QuoteSubmittedResponse,
} from '../../shared/api/contracts'
import type { OrderStatusRequestInput, QuoteRequestInput } from '../../shared/api/public-schemas'

/** Error de negocio que la base devolvió con un mensaje apto para mostrar al cliente. */
export class PublicDataError extends Error {
  readonly code: 'invalid_request' | 'not_found'

  constructor(code: 'invalid_request' | 'not_found', message: string) {
    super(message)
    this.code = code
  }
}

/**
 * Acceso a datos de la API pública. Se inyecta para probar las rutas sin red
 * y para no acoplarlas a Supabase.
 */
export interface PublicData {
  listCatalog(): Promise<CatalogResponse>
  /** Idempotente: repetir el mismo requestId devuelve la cotización ya creada. */
  submitQuote(request: QuoteRequestInput, channel?: 'web' | 'web_chat' | 'whatsapp'): Promise<QuoteSubmittedResponse>
  getOrderStatus(request: OrderStatusRequestInput): Promise<OrderStatusResponse | null>
  /**
   * Pedido hecho por el cliente en el chat: la base lo crea, lo confirma y reserva el stock en una sola
   * operación (precios siempre de la base). Si no alcanza el stock queda pendiente de confirmación; si algún
   * producto no tiene precio publicado, lanza PublicDataError (el asistente cae a una cotización).
   */
  submitOrder(request: QuoteRequestInput, channel: 'web_chat' | 'whatsapp'): Promise<OrderSubmittedResponse>
}

/** Devuelve null cuando la base no está configurada en este ambiente. */
export type PublicDataFactory = (env: Env) => PublicData | null
