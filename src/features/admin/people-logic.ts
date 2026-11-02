import type { AppointmentItem, CustomerDetail } from '../../../shared/api/panel-contracts'
import { dayLabel, hourLabel, limaDate } from '../../../shared/config/appointments'

/** Clientes y citas: textos y agrupaciones para el panel. Sin React: se prueban solos. */

const LIMA_OFFSET_MS = -5 * 60 * 60 * 1000

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** «Hoy», «Mañana», «Ayer» o «Viernes 30 de octubre», según el día de Lima. */
export function dayTitle(date: string, now: Date): string {
  const today = limaDate(now)
  if (date === today) return 'Hoy'
  if (date === addDays(today, 1)) return 'Mañana'
  if (date === addDays(today, -1)) return 'Ayer'
  const label = dayLabel(date)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Hora de la cita en Lima: «5:00 p. m.». */
export function appointmentHour(startsAt: string): string {
  return hourLabel(Number(new Date(new Date(startsAt).getTime() + LIMA_OFFSET_MS).toISOString().slice(11, 13)))
}

/** Citas agrupadas por día (en el orden en que llegan), con su título. */
export function groupAppointmentsByDay(items: readonly AppointmentItem[], now: Date): { date: string; title: string; items: AppointmentItem[] }[] {
  const groups = new Map<string, AppointmentItem[]>()
  for (const item of items) {
    const date = limaDate(new Date(item.startsAt))
    groups.set(date, [...(groups.get(date) ?? []), item])
  }
  return [...groups].map(([date, list]) => ({ date, title: dayTitle(date, now), items: list }))
}

/** Una cita pendiente cuya hora ya pasó: conviene llamar o marcarla. */
export function isOverdue(item: Pick<AppointmentItem, 'status' | 'startsAt'>, now: Date): boolean {
  return item.status === 'pending' && new Date(item.startsAt).getTime() < now.getTime()
}

/** Resumen del cliente: cuántos pedidos hizo y cuánto compró (sin contar cancelados). */
export function customerSummary(customer: Pick<CustomerDetail, 'orders' | 'quotes'>): { orders: number; spent: number; quotes: number } {
  const active = customer.orders.filter((o) => o.status !== 'cancelled')
  return {
    orders: active.length,
    spent: Math.round(active.reduce((sum, o) => sum + o.total, 0) * 100) / 100,
    quotes: customer.quotes.filter((q) => q.status !== 'cancelled').length,
  }
}

export const customerTypeLabels = { individual: 'Particular', business: 'Empresa' } as const
