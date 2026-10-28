/**
 * Citas con la administración: qué días y horas se ofrecen en el chat.
 * Los horarios son provisionales hasta que Brigitte confirme su disponibilidad: se cambian solo aquí.
 * Todo se calcula en hora de Lima (UTC−5, sin horario de verano).
 */

/** Horas de inicio disponibles por día de la semana (0 = domingo). Cada cita dura una hora. */
export const APPOINTMENT_HOURS: Readonly<Record<number, readonly number[]>> = {
  0: [],
  1: [9, 10, 11, 12, 15, 16, 17],
  2: [9, 10, 11, 12, 15, 16, 17],
  3: [9, 10, 11, 12, 15, 16, 17],
  4: [9, 10, 11, 12, 15, 16, 17],
  5: [9, 10, 11, 12, 15, 16, 17],
  6: [9, 10, 11, 12],
}

/** Cuántos días hacia adelante se puede agendar (contando desde hoy). */
export const APPOINTMENT_DAYS_AHEAD = 14
/** Antelación mínima: no se ofrece una hora que empieza en menos de esto. */
export const APPOINTMENT_MIN_LEAD_MS = 2 * 60 * 60 * 1000

const LIMA_OFFSET_MS = -5 * 60 * 60 * 1000
const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const pad = (n: number) => String(n).padStart(2, '0')

/** Fecha de Lima («2026-10-28») de un instante. */
export function limaDate(at: Date): string {
  const shifted = new Date(at.getTime() + LIMA_OFFSET_MS)
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`
}

/** Instante en que empieza la hora `hour` (hora de Lima) del día `date` («2026-10-28»). */
export function slotInstant(date: string, hour: number): Date {
  return new Date(`${date}T${pad(hour)}:00:00-05:00`)
}

/** Día de la semana (0 = domingo) de una fecha de Lima. */
function weekday(date: string): number {
  return new Date(`${date}T12:00:00-05:00`).getUTCDay()
}

/** Suma días a una fecha de Lima. */
function addDays(date: string, days: number): string {
  return limaDate(new Date(new Date(`${date}T12:00:00-05:00`).getTime() + days * 86_400_000))
}

/** Horas ofrecidas ese día (sin descontar las ya tomadas ni las que pasaron). */
export function hoursOf(date: string): readonly number[] {
  return APPOINTMENT_HOURS[weekday(date)] ?? []
}

/** ¿Es una hora que se ofrece, con antelación suficiente y dentro del rango? (taken: horas ya tomadas, en ISO). */
export function isOfferedSlot(startsAt: Date, now: Date, taken: readonly string[] = []): boolean {
  if (Number.isNaN(startsAt.getTime())) return false
  if (startsAt.getTime() - now.getTime() < APPOINTMENT_MIN_LEAD_MS) return false
  const date = limaDate(startsAt)
  const last = addDays(limaDate(now), APPOINTMENT_DAYS_AHEAD - 1)
  if (date > last) return false
  const hour = Number(new Date(startsAt.getTime() + LIMA_OFFSET_MS).toISOString().slice(11, 13))
  const exact = startsAt.getTime() === slotInstant(date, hour).getTime()
  if (!exact || !hoursOf(date).includes(hour)) return false
  return !taken.some((t) => new Date(t).getTime() === startsAt.getTime())
}

export interface AppointmentDay {
  date: string
  /** «miércoles 28 de octubre». */
  label: string
  /** Horas libres (inicio de cada cita). */
  hours: number[]
}

/** Días con alguna hora libre, a partir de hoy. */
export function availableDays(now: Date, taken: readonly string[] = []): AppointmentDay[] {
  const today = limaDate(now)
  const days: AppointmentDay[] = []
  for (let i = 0; i < APPOINTMENT_DAYS_AHEAD; i += 1) {
    const date = addDays(today, i)
    const hours = hoursOf(date).filter((h) => isOfferedSlot(slotInstant(date, h), now, taken))
    if (hours.length > 0) days.push({ date, label: dayLabel(date), hours })
  }
  return days
}

/** «miércoles 28 de octubre» */
export function dayLabel(date: string): string {
  const [, month, day] = date.split('-').map(Number)
  return `${DAY_NAMES[weekday(date)]} ${day} de ${MONTH_NAMES[month! - 1]}`
}

/** «5:00 p. m.» */
export function hourLabel(hour: number): string {
  const suffix = hour >= 12 ? 'p. m.' : 'a. m.'
  const h = hour % 12 === 0 ? 12 : hour % 12
  return `${h}:00 ${suffix}`
}

/** «miércoles 28 de octubre de 2026 a las 5:00 p. m.» */
export function appointmentLabel(startsAt: Date): string {
  const date = limaDate(startsAt)
  const hour = Number(new Date(startsAt.getTime() + LIMA_OFFSET_MS).toISOString().slice(11, 13))
  return `${dayLabel(date)} de ${date.slice(0, 4)} a las ${hourLabel(hour)}`
}
