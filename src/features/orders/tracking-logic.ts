import type { OrderStatusResponse } from '../../../shared/api/contracts'
import { orderStatusRequestSchema } from '../../../shared/api/public-schemas'

/** Lógica del seguimiento público de pedidos. Sin React: se prueba sola. */

export interface TrackingStep {
  /** Estados del pedido que corresponden a este paso. */
  statuses: readonly string[]
  title: string
  body: string
}

/** Pasos que ve el cliente. Los textos describen los estados reales del sistema; no prometen plazos. */
export const trackingSteps: readonly TrackingStep[] = [
  { statuses: ['pending_confirmation'], title: 'Recibimos tu pedido', body: 'Lo revisamos y lo confirmamos contigo.' },
  { statuses: ['confirmed'], title: 'Pedido confirmado', body: 'Reservamos lo necesario para tu pedido.' },
  { statuses: ['in_production'], title: 'En producción', body: 'Un artesano trabaja tu pieza en el taller.' },
  { statuses: ['ready'], title: 'Lista', body: 'Tu pedido está terminado y preparado.' },
  { statuses: ['shipped', 'delivered'], title: 'En camino y entregado', body: 'Sale de nuestro taller hacia tu mesa.' },
]

/** Índice del paso actual, o -1 si el estado no está en el recorrido (por ejemplo, cancelado). */
export function currentStepIndex(status: string): number {
  return trackingSteps.findIndex((step) => step.statuses.includes(status))
}

export const statusHeadline: Record<string, string> = {
  pending_confirmation: 'Estamos esperando confirmar tu pedido.',
  confirmed: 'Tu pedido está confirmado.',
  in_production: 'Tu pedido está en producción.',
  ready: 'Tu pedido está listo.',
  shipped: 'Tu pedido va en camino.',
  delivered: 'Tu pedido fue entregado.',
  cancelled: 'Este pedido fue cancelado. Escríbenos si tienes dudas.',
}

export type TrackingFormErrors = { code?: string; contact?: string }

/** Valida con el mismo esquema que el servidor. */
export function validateTracking(code: string, contact: string): { ok: true; body: { code: string; contact: string } } | { ok: false; errors: TrackingFormErrors } {
  const parsed = orderStatusRequestSchema.safeParse({ code, contact })
  if (parsed.success) return { ok: true, body: parsed.data }
  const errors: TrackingFormErrors = {}
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] === 'code' ? 'code' : 'contact'
    if (!errors[field]) {
      errors[field] = field === 'code' ? 'El código tiene el formato PED-000123.' : 'Escribe el correo o el teléfono con el que hiciste el pedido.'
    }
  }
  return { ok: false, errors }
}

export function trackingHeadline(order: Pick<OrderStatusResponse, 'status'>): string {
  return statusHeadline[order.status] ?? 'Estado de tu pedido actualizado.'
}
