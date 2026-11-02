import type {
  InventoryMovementType,
  OrderListItem,
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
  pending_confirmation: 'Por confirmar',
  confirmed: 'Confirmado',
  in_production: 'En el taller',
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
  production_in: 'Producción terminada',
  adjustment_in: 'Corrección: se sumaron',
  adjustment_out: 'Corrección: se restaron',
  return_in: 'Devolución de un cliente',
  reservation: 'Apartadas para un pedido',
  reservation_release: 'Se soltó un apartado',
  sale_out: 'Salieron en un pedido',
}

export const fulfillmentLabels = { stock: 'Stock', made_to_order: 'A medida' } as const

export const channelLabels: Record<string, string> = {
  web: 'Web',
  web_chat: 'Chat web',
  whatsapp: 'WhatsApp',
  admin: 'Equipo',
}

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

// --- Cotizaciones: filtros, pasos y siguiente acción ----------------------------------------------

export type QuoteFilter = 'todas' | 'responder' | 'esperando' | 'aceptadas' | 'cerradas'

export const quoteFilters: { id: QuoteFilter; label: string; hint: string }[] = [
  { id: 'todas', label: 'Todas', hint: 'Todas las cotizaciones vigentes, de la más nueva a la más antigua.' },
  { id: 'responder', label: 'Por responder', hint: 'Clientes que esperan tu propuesta: ponle precio a lo que falte y envíala.' },
  { id: 'esperando', label: 'Esperando al cliente', hint: 'Ya enviaste la propuesta; falta que el cliente responda.' },
  { id: 'aceptadas', label: 'Aceptadas', hint: 'El cliente aceptó: crea el pedido.' },
  { id: 'cerradas', label: 'Cerradas', hint: 'Convertidas en pedido, rechazadas, vencidas o archivadas.' },
]

export function parseQuoteFilter(value: string | null): QuoteFilter {
  return quoteFilters.find((f) => f.id === value)?.id ?? 'todas'
}

export function matchesQuoteFilter(status: QuoteStatus, filter: QuoteFilter): boolean {
  switch (filter) {
    case 'responder':
      return status === 'submitted' || status === 'under_review'
    case 'esperando':
      return status === 'sent'
    case 'aceptadas':
      return status === 'accepted'
    case 'cerradas':
      return status === 'converted' || status === 'rejected' || status === 'expired' || status === 'cancelled'
    default:
      // Las archivadas no ensucian la vista general; se ven en «Cerradas».
      return status !== 'cancelled'
  }
}

const quoteStepLabels = ['Poner precios', 'Enviar al cliente', 'Cliente acepta', 'Crear pedido'] as const

/** Pasos de una cotización. Rechazada, vencida o archivada no siguen la línea: todo queda pendiente. */
export function quoteSteps(status: QuoteStatus, missingPrices: number): { label: string; state: StepState }[] {
  const at =
    status === 'submitted' || status === 'under_review'
      ? missingPrices > 0
        ? 0
        : 1
      : status === 'sent'
        ? 2
        : status === 'accepted'
          ? 3
          : status === 'converted'
            ? 4
            : -1
  return quoteStepLabels.map((label, i) => ({ label, state: at < 0 ? 'pending' : i < at ? 'done' : i === at ? 'current' : 'pending' }))
}

/** Qué toca hacer ahora con la cotización, en palabras simples. */
export function quoteNextStep(status: QuoteStatus, missingPrices: number): { title: string; help: string } {
  switch (status) {
    case 'submitted':
    case 'under_review':
      return missingPrices > 0
        ? {
            title: missingPrices === 1 ? 'Poner el precio que falta' : `Poner los ${missingPrices} precios que faltan`,
            help: 'Escribe el precio por unidad en las tablas marcadas «Falta precio».',
          }
        : { title: 'Enviar la propuesta', help: 'Cuando se la hayas mandado al cliente, márcala como enviada.' }
    case 'sent':
      return { title: 'Esperar la respuesta del cliente', help: 'Cuando el cliente diga que sí, regístralo aquí.' }
    case 'accepted':
      return { title: 'Crear el pedido', help: 'El pedido aparta las tablas del stock si el cliente ya lo confirmó.' }
    case 'converted':
      return { title: 'Ya es un pedido', help: 'Sigue su avance desde Pedidos.' }
    case 'rejected':
      return { title: 'El cliente la rechazó', help: 'No hay nada más que hacer con esta cotización.' }
    case 'expired':
      return { title: 'La cotización venció', help: 'Si el cliente vuelve, puede pedir una nueva desde el chat.' }
    case 'cancelled':
      return { title: 'Cotización archivada', help: 'Se guardó solo como registro.' }
  }
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

/** good = listo o pagado · warn = falta algo · alert = problema · info = en marcha · muted = cerrado. */
export type StatusTone = 'neutral' | 'good' | 'warn' | 'alert' | 'info' | 'muted'

/** Color de cada estado de cotización: lo que espera al equipo llama la atención. */
export function quoteTone(status: QuoteStatus): StatusTone {
  if (status === 'submitted' || status === 'under_review') return 'warn'
  if (status === 'sent') return 'info'
  if (status === 'accepted' || status === 'converted') return 'good'
  return 'muted'
}

export function orderTone(status: OrderStatus): StatusTone {
  if (status === 'pending_confirmation') return 'warn'
  if (status === 'in_production') return 'info'
  if (status === 'delivered') return 'good'
  if (status === 'cancelled') return 'muted'
  return 'neutral'
}

export function paymentTone(status: PaymentStatus): StatusTone {
  if (status === 'paid') return 'good'
  if (status === 'failed' || status === 'charged_back') return 'alert'
  if (status === 'unpaid' || status === 'pending') return 'warn'
  return 'muted'
}

// --- Pedidos: filtros, pasos y siguiente acción -------------------------------------------------

type OrderLike = Pick<OrderListItem, 'status' | 'paymentStatus'>

/** Pedido vigente (ni por confirmar ni cancelado) cuyo pago el equipo aún no verificó. */
export function needsPayment(order: OrderLike): boolean {
  if (order.status === 'cancelled' || order.status === 'pending_confirmation') return false
  return order.paymentStatus === 'unpaid' || order.paymentStatus === 'pending' || order.paymentStatus === 'failed'
}

/** Pago tal como se ve en la lista: en un pedido cancelado o por confirmar no se pide cobrar. */
export function orderPaymentBadge(order: OrderLike): { label: string; tone: StatusTone } {
  if (needsPayment(order)) return { label: order.paymentStatus === 'failed' ? 'Pago fallido' : 'Falta pago', tone: paymentTone(order.paymentStatus) }
  if (order.paymentStatus === 'paid') return { label: 'Pagado', tone: 'good' }
  return { label: paymentStatusLabels[order.paymentStatus], tone: 'muted' }
}

export type OrderFilter = 'todos' | 'cobrar' | 'confirmar' | 'taller' | 'entregar'

export const orderFilters: { id: OrderFilter; label: string; hint: string }[] = [
  { id: 'todos', label: 'Todos', hint: 'Todos los pedidos, del más nuevo al más antiguo.' },
  { id: 'cobrar', label: 'Por cobrar', hint: 'Pedidos vigentes cuyo pago todavía no está verificado.' },
  { id: 'confirmar', label: 'Por confirmar', hint: 'El cliente o el equipo aún no confirmó estos pedidos.' },
  { id: 'taller', label: 'En el taller', hint: 'Pedidos que el taller está fabricando.' },
  { id: 'entregar', label: 'Por entregar', hint: 'Listos o despachados, aún sin entregar.' },
]

export function parseOrderFilter(value: string | null): OrderFilter {
  return orderFilters.find((f) => f.id === value)?.id ?? 'todos'
}

export function matchesOrderFilter(order: OrderLike, filter: OrderFilter): boolean {
  switch (filter) {
    case 'cobrar':
      return needsPayment(order)
    case 'confirmar':
      return order.status === 'pending_confirmation'
    case 'taller':
      return order.status === 'in_production'
    case 'entregar':
      return order.status === 'ready' || order.status === 'shipped'
    default:
      return true
  }
}

/** Camino de un pedido vigente. "Por confirmar" y "Cancelado" quedan fuera de la línea. */
export const orderPath = ['confirmed', 'in_production', 'ready', 'shipped', 'delivered'] as const satisfies readonly OrderStatus[]

export const orderStepLabels: Record<(typeof orderPath)[number], string> = {
  confirmed: 'Confirmado',
  in_production: 'En el taller',
  ready: 'Listo',
  shipped: 'Despachado',
  delivered: 'Entregado',
}

export type StepState = 'done' | 'current' | 'pending'

/** Estado de cada paso de la línea. Entregado cuenta como hecho; por confirmar y cancelado dejan todo pendiente. */
export function orderSteps(status: OrderStatus): { status: (typeof orderPath)[number]; label: string; state: StepState }[] {
  const at = orderPath.indexOf(status as (typeof orderPath)[number])
  return orderPath.map((s, i) => ({
    status: s,
    label: orderStepLabels[s],
    state: at < 0 ? 'pending' : i < at || status === 'delivered' ? 'done' : i === at ? 'current' : 'pending',
  }))
}

/** Enlace de WhatsApp para un celular peruano (9 dígitos) o con código de país. Null si no parece un número. */
export function whatsappLink(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (/^9\d{8}$/.test(digits)) return `https://wa.me/51${digits}`
  if (/^519\d{8}$/.test(digits)) return `https://wa.me/${digits}`
  return null
}

/** Qué toca hacer ahora con el pedido, en palabras simples. */
export function orderNextStep(status: OrderStatus): { title: string; help: string } {
  switch (status) {
    case 'pending_confirmation':
      return { title: 'Confirmar el pedido', help: 'Cuando el cliente confirme, se apartan las tablas del stock.' }
    case 'confirmed':
      return { title: 'Mandarlo al taller', help: 'El taller verá este pedido para fabricarlo.' }
    case 'in_production':
      return { title: 'Esperar a que el taller lo termine', help: 'Cuando las tablas estén terminadas y empacadas, márcalo como listo.' }
    case 'ready':
      return { title: 'Enviarlo al cliente', help: 'Al despachar se descuentan del stock las tablas apartadas.' }
    case 'shipped':
      return { title: 'Confirmar la entrega', help: 'Cuando el cliente ya tenga sus tablas.' }
    case 'delivered':
      return { title: 'Pedido entregado', help: 'No hay nada más que hacer con este pedido.' }
    case 'cancelled':
      return { title: 'Pedido cancelado', help: 'Las tablas apartadas volvieron al stock.' }
  }
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

/** Tablas publicadas (producto y tamaño activos) que aún no tienen precio: la web las muestra «a cotizar». */
export function variantsWithoutPrice(products: readonly { isActive: boolean; variants: readonly { isActive: boolean; catalogPrice: number | null }[] }[]): number {
  return products.filter((p) => p.isActive).reduce((n, p) => n + p.variants.filter((v) => v.isActive && v.catalogPrice === null).length, 0)
}
