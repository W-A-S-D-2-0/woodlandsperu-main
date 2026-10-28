import { describe, expect, it } from 'vitest'
import { APPOINTMENT_DAYS_AHEAD, appointmentLabel, availableDays, dayLabel, hourLabel, isOfferedSlot, limaDate, slotInstant } from './appointments'

// 2026-10-28 es miércoles. 10:00 a. m. en Lima = 15:00 UTC.
const now = new Date('2026-10-28T15:00:00Z')

describe('citas: horarios', () => {
  it('escribe el día y la hora como el cliente los lee', () => {
    expect(dayLabel('2026-10-28')).toBe('miércoles 28 de octubre')
    expect(hourLabel(17)).toBe('5:00 p. m.')
    expect(hourLabel(9)).toBe('9:00 a. m.')
    expect(hourLabel(12)).toBe('12:00 p. m.')
    expect(appointmentLabel(slotInstant('2026-10-28', 17))).toBe('miércoles 28 de octubre de 2026 a las 5:00 p. m.')
  })

  it('usa la fecha de Lima, no la de UTC', () => {
    expect(limaDate(new Date('2026-10-29T02:00:00Z'))).toBe('2026-10-28')
  })

  it('exige dos horas de antelación y no ofrece domingos', () => {
    const days = availableDays(now)
    expect(days[0]!.date).toBe('2026-10-28')
    // Son las 10:00: la hora de las 12:00 cumple justo las dos horas de antelación.
    expect(days[0]!.hours).toEqual([12, 15, 16, 17])
    expect(days.some((d) => d.date === '2026-11-01')).toBe(false)
    expect(days.length).toBeLessThanOrEqual(APPOINTMENT_DAYS_AHEAD)
  })

  it('quita las horas ya tomadas', () => {
    const taken = [slotInstant('2026-10-28', 15).toISOString()]
    expect(availableDays(now, taken)[0]!.hours).toEqual([12, 16, 17])
  })

  it('solo acepta horas exactas que se ofrecen', () => {
    expect(isOfferedSlot(slotInstant('2026-10-29', 9), now)).toBe(true)
    expect(isOfferedSlot(new Date(slotInstant('2026-10-29', 9).getTime() + 60_000), now)).toBe(false)
    expect(isOfferedSlot(slotInstant('2026-10-29', 20), now)).toBe(false)
    expect(isOfferedSlot(slotInstant('2026-11-01', 10), now)).toBe(false)
    expect(isOfferedSlot(slotInstant('2026-10-28', 10), now)).toBe(false)
    expect(isOfferedSlot(slotInstant('2026-12-30', 10), now)).toBe(false)
    expect(isOfferedSlot(new Date('x'), now)).toBe(false)
  })
})
