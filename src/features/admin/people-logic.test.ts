import { describe, expect, it } from 'vitest'
import type { AppointmentItem } from '../../../shared/api/panel-contracts'
import { appointmentHour, customerSummary, dayTitle, groupAppointmentsByDay, isOverdue } from './people-logic'

// Lunes 2 de noviembre de 2026, 10:00 a. m. en Lima.
const now = new Date('2026-11-02T15:00:00Z')

const appointment = (id: string, startsAt: string, status: AppointmentItem['status'] = 'pending'): AppointmentItem => ({
  id,
  customerName: 'Ana',
  contactPhone: '987654321',
  startsAt,
  status,
  createdAt: '2026-11-01T12:00:00Z',
  conversationId: null,
})

describe('citas', () => {
  it('nombra los días cercanos con palabras', () => {
    expect(dayTitle('2026-11-02', now)).toBe('Hoy')
    expect(dayTitle('2026-11-03', now)).toBe('Mañana')
    expect(dayTitle('2026-11-01', now)).toBe('Ayer')
    expect(dayTitle('2026-11-06', now)).toMatch(/^Viernes 6 de noviembre/)
  })

  it('muestra la hora de Lima', () => {
    expect(appointmentHour('2026-11-02T22:00:00Z')).toBe('5:00 p. m.')
  })

  it('agrupa por día de Lima, aunque en UTC ya sea el día siguiente', () => {
    const groups = groupAppointmentsByDay(
      [appointment('a', '2026-11-02T22:00:00Z'), appointment('b', '2026-11-03T02:00:00Z'), appointment('c', '2026-11-03T14:00:00Z')],
      now,
    )
    expect(groups.map((g) => [g.title, g.items.map((i) => i.id)])).toEqual([
      ['Hoy', ['a', 'b']],
      ['Mañana', ['c']],
    ])
  })

  it('avisa si una cita pendiente ya pasó', () => {
    expect(isOverdue(appointment('a', '2026-11-02T14:00:00Z'), now)).toBe(true)
    expect(isOverdue(appointment('a', '2026-11-02T14:00:00Z', 'done'), now)).toBe(false)
    expect(isOverdue(appointment('a', '2026-11-02T16:00:00Z'), now)).toBe(false)
  })
})

describe('customerSummary', () => {
  it('suma lo comprado sin contar pedidos ni cotizaciones cancelados', () => {
    const summary = customerSummary({
      orders: [
        { id: '1', code: 'PED-1', status: 'confirmed', total: 100.1, createdAt: '' },
        { id: '2', code: 'PED-2', status: 'cancelled', total: 999, createdAt: '' },
        { id: '3', code: 'PED-3', status: 'delivered', total: 50.2, createdAt: '' },
      ],
      quotes: [{ id: 'q', code: 'COT-1', status: 'cancelled', total: 0, createdAt: '' }],
    })
    expect(summary).toEqual({ orders: 2, spent: 150.3, quotes: 0 })
  })
})
