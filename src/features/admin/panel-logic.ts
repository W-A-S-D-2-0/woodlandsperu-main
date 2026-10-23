import type {
  InventoryMovementType,
  OrderStatus,
  PaymentStatus,
  QuoteDetailItem,
  QuoteStatus,
} from '../../../shared/api/panel-contracts'

/** Textos y reglas de presentación del panel. Sin React: se prueban solos. */

export const quoteStatusLabels: Record<QuoteStatus, string> = {
  submitted: 'Recibida',
  under_review: 'En revisión',
  sent: 'Enviada al cliente',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  expired: 'Vencida',
  converted: 'Convertida en pedido',
  cancelled: 'Cancelada',
}

export const orderStatusLabels: Record<OrderStatus, string> = {
  pending_confirmation: 'Pendiente de confirmación',
  confirmed: 'Confirmado',
  in_production: 'En producción',
  ready: 'Listo',
  shipped: 'Despachado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  unpaid: 'Sin pago',
  pending: 'Pago pendiente',
  paid: 'Pagado',
  failed: 'Pago fallido',
  refunded: 'Reembolsado',
  partially_refunded: 'Reembolso parcial',
  charged_back: 'Contracargo',
}

export const movementLabels: Record<InventoryMovementType, string> = {
  production_in: 'Entrada por producción',
  adjustment_in: 'Ajuste (+)',
  adjustment_out: 'Ajuste (−)',
  return_in: 'Devolución',
  reservation: 'Reserva',
  reservation_release: 'Liberación de reserva',
  sale_out: 'Salida por venta',
}

export const fulfillmentLabels = { stock: 'Stock', made_to_order: 'A medida' } as const

export const channelLabels: Record<string, string> = {
  web: 'Web',
  web_chat: 'Chat web',
  whatsapp: 'WhatsApp',
  admin: 'Equipo',
}

export type ManualMovementType = 'production_in' | 'adjustment_in' | 'adjustment_out' | 'return_in'

/** Tipos que el panel permite registrar a mano (reservas y ventas las generan los pedidos). */
export const manualMovementOptions: { value: ManualMovementType; label: string }[] = [
  { value: 'production_in', label: movementLabels.production_in },
  { value: 'adjustment_in', label: movementLabels.adjustment_in },
  { value: 'adjustment_out', label: movementLabels.adjustment_out },
  { value: 'return_in', label: movementLabels.return_in },
]

const money = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })
const dateTime = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Lima' })
const dateOnly = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeZone: 'UTC' })

export function formatMoney(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : money.format(value)
}

export function formatDateTime(iso: string | null | undefined): string {
  return iso ? dateTime.format(new Date(iso)) : '—'
}

/** "1 pedido", "3 pedidos". El plural irregular se pasa aparte ("1 precio pendiente", "2 precios pendientes"). */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

/** Fecha sin hora (AAAA-MM-DD) tal cual, sin corrimiento por zona horaria. */
export function formatDate(value: string | null | undefined): string {
  return value ? dateOnly.format(new Date(`${value}T00:00:00Z`)) : '—'
}

export type OrderAction =
  | { kind: 'confirm' }
  | { kind: 'status'; status: 'in_production' | 'ready'; label: string }
  | { kind: 'dispatch'; finalStatus: 'shipped' | 'delivered'; label: string }
  | { kind: 'cancel' }

/** Acciones disponibles según el estado. La base valida igualmente cada transición. */
export function orderActions(status: OrderStatus): OrderAction[] {
  switch (status) {
    case 'pending_confirmation':
      return [{ kind: 'confirm' }, { kind: 'cancel' }]
    case 'confirmed':
      return [{ kind: 'status', status: 'in_production', label: 'Pasar a producción' }, { kind: 'cancel' }]
    case 'in_production':
      return [{ kind: 'status', status: 'ready', label: 'Marcar como listo' }, { kind: 'cancel' }]
    case 'ready':
      return [
        { kind: 'dispatch', finalStatus: 'shipped', label: 'Despachar' },
        { kind: 'dispatch', finalStatus: 'delivered', label: 'Marcar entregado' },
        { kind: 'cancel' },
      ]
    case 'shipped':
      return [{ kind: 'dispatch', finalStatus: 'delivered', label: 'Marcar entregado' }]
    default:
      return []
  }
}

export type QuoteAction = 'price_and_send' | 'accept' | 'convert' | 'archive'

export function quoteActions(status: QuoteStatus): QuoteAction[] {
  if (status === 'submitted' || status === 'under_review') return ['price_and_send', 'archive']
  if (status === 'sent') return ['accept', 'archive']
  if (status === 'accepted') return ['convert', 'archive']
  // Rechazadas y vencidas también se pueden archivar; las convertidas (ya son pedido) y las canceladas, no.
  if (status === 'rejected' || status === 'expired') return ['archive']
  return []
}

/** Una cotización se puede enviar cuando todos sus productos tienen precio. */
export function pendingPriceCount(items: readonly Pick<QuoteDetailItem, 'unitPrice'>[]): number {
  return items.filter((item) => item.unitPrice === null).length
}

/** Clave para que reintentar un movimiento no lo duplique. */
export function newIdempotencyKey(): string {
  return `panel-${crypto.randomUUID()}`
}

/** Convierte el texto de un campo monetario. Vacío = null; inválido = NaN. */
export function parseDecimal(text: string): number | null {
  const normalized = text.trim().replace(',', '.')
  if (normalized === '') return null
  return /^\d+(\.\d{1,2})?$/.test(normalized) ? Number(normalized) : Number.NaN
}

export function parseWholeNumber(text: string): number | null {
  const normalized = text.trim()
  if (normalized === '') return null
  return /^\d+$/.test(normalized) ? Number(normalized) : Number.NaN
}

export type StatusTone = 'neutral' | 'good' | 'warn' | 'info' | 'muted'

/** Color de cada estado de cotización: lo que espera al equipo llama la atención. */
export function quoteTone(status: QuoteStatus): StatusTone {
  if (status === 'submitted' || status === 'under_review') return 'warn'
  if (status === 'sent') return 'info'
  if (status === 'accepted' || status === 'converted') return 'good'
  return 'muted'
}

export function orderTone(status: OrderStatus): StatusTone {
  if (status === 'pending_confirmation') return 'warn'
  if (status === 'delivered') return 'good'
  if (status === 'cancelled') return 'muted'
  return 'info'
}

export function paymentTone(status: PaymentStatus): StatusTone {
  if (status === 'paid') return 'good'
  if (status === 'failed' || status === 'charged_back') return 'warn'
  if (status === 'unpaid') return 'muted'
  return 'info'
}

export interface Collection {
  slug: string
  name: string
}

/** Colecciones distintas de una lista, en el orden en que aparecen. Los sin colección no suman. */
export function uniqueCollections(list: readonly (Collection | null)[]): Collection[] {
  return [...new Map(list.flatMap((c) => (c ? [[c.slug, c] as const] : []))).values()]
}

/** «Colección Parrilla y Cocina» → «Parrilla y Cocina», para botones y etiquetas cortas. */
export const shortCollectionName = (name: string) => name.replace(/^Colección\s+/i, '')

/** Deja solo lo de la colección elegida; sin elegir (vacío) devuelve todo. */
export function inCollection<T>(items: readonly T[], collection: string, collectionOf: (item: T) => Collection | null): T[] {
  return collection ? items.filter((item) => collectionOf(item)?.slug === collection) : [...items]
}
