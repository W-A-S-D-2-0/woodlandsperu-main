import type { ChatMessage, ChatRole, ChatStatus } from '../../shared/api/chat'
import type { HistoryMessage } from '../services/assistant'

export type ChatChannel = 'web_chat' | 'whatsapp'

/** Error de negocio de la base apto para mostrar (límite de mensajes, datos no válidos). */
export class ChatDataError extends Error {
  readonly code: 'rate_limited' | 'invalid_request'

  constructor(code: 'rate_limited' | 'invalid_request', message: string) {
    super(message)
    this.code = code
  }
}

export interface RecordInput {
  channel: ChatChannel
  /** Web: hash del token de sesión. WhatsApp: teléfono del cliente. */
  ref: string
  role: 'customer' | 'assistant' | 'system'
  body: string
  contactName?: string
  contactPhone?: string
  /** Id del mensaje en el proveedor: un reintento con el mismo id no se duplica. */
  externalId?: string
  /** Ruta de la imagen adjunta, ya guardada con `storeProof`. */
  attachmentPath?: string
}

export interface RecordedMessage {
  conversationId: string
  messageId: number
  status: ChatStatus
  duplicate: boolean
}

export interface ConversationInfo {
  id: string
  channel: ChatChannel
  status: ChatStatus
  quoteId: string | null
  contactPhone: string | null
}

/** Pedido de la conversación que espera (o ya tiene) su pago. */
export interface PaymentTarget {
  conversationId: string
  orderId: string
  code: string
  total: number
  status: string
  paymentStatus: string
}

/** Captura de pago ya validada (tipo y tamaño). */
export interface ProofImage {
  bytes: Uint8Array
  contentType: string
  ext: string
}

export interface PaymentResult {
  code: string
  status: string
  paymentStatus: string
  alreadyPaid: boolean
}

export interface BookedAppointment {
  id: string
  startsAt: string
}

/** Persistencia de las conversaciones. Se inyecta para probar sin red; la real usa la clave de servicio. */
export interface ChatData {
  record(input: RecordInput): Promise<RecordedMessage>
  /** Últimos mensajes, del más antiguo al más reciente. */
  history(conversationId: string, limit: number): Promise<HistoryMessage[]>
  info(conversationId: string): Promise<ConversationInfo | null>
  handoff(conversationId: string, reason: string): Promise<void>
  linkQuote(conversationId: string, quoteId: string): Promise<void>
  /** El último pedido que Teca registró en esta conversación, o null si no hay. */
  findPaymentTarget(channel: ChatChannel, ref: string): Promise<PaymentTarget | null>
  /** Guarda la captura y registra el pago: el pedido queda pagado, confirmado y en producción. */
  /** ¿Ya hay un pago registrado con ese número de operación de Yape o Plin? */
  operationUsed(provider: 'yape' | 'plin', code: string): Promise<boolean>
  /** Guarda la captura en el bucket privado y devuelve su ruta. `folder` agrupa las capturas de una misma conversación. */
  storeProof(image: ProofImage, folder: string): Promise<string>
  /** La imagen de un mensaje de esa conversación (web: `ref` es el hash del token). Null si no existe o no es de esa conversación. */
  readAttachment(input: { messageId: number; channel: ChatChannel; ref: string }): Promise<{ bytes: Uint8Array; contentType: string } | null>
  recordPayment(input: { orderId: string; conversationId: string; proofPath: string; operation?: { provider: 'yape' | 'plin'; code: string } }): Promise<PaymentResult>
  /** Registra una cita con la administración. Lanza ChatDataError si la hora ya fue tomada o los datos no son válidos. */
  bookAppointment(input: { ref: string; name: string; phone: string; startsAt: string }): Promise<BookedAppointment>
  /** Horas ya tomadas (ISO) en el rango [from, to). */
  takenAppointmentSlots(from: string, to: string): Promise<string[]>
  /** Mensajes visibles para el cliente posteriores a `afterId`. Null si la conversación no existe. */
  messagesAfter(channel: ChatChannel, ref: string, afterId: number): Promise<{ status: ChatStatus; messages: ChatMessage[] } | null>
}

export type ChatDataFactory = (env: Env) => ChatData | null

export type { ChatRole }
