import { describe, expect, it } from 'vitest'
import { firstName, greeting, todayLabel, todayTasks, type TodayInput } from './today-logic'

const calmDay: TodayInput = {
  lowStock: 0,
  quotesPending: 0,
  ordersToConfirm: 0,
  ordersToCollect: 0,
  conversationsWaiting: 0,
  appointmentsPending: 0,
}

describe('todayTasks', () => {
  it('sin pendientes, todo queda en orden', () => {
    const { tasks, calm } = todayTasks(calmDay)
    expect(tasks).toEqual([])
    expect(calm).toContain('Stock sobre el mínimo')
    expect(calm).toHaveLength(6)
  })

  it('pone primero el stock bajo y concuerda singular y plural', () => {
    const { tasks } = todayTasks({ ...calmDay, quotesPending: 6, lowStock: 1, ordersToCollect: 5 })
    expect(tasks.map((t) => t.id)).toEqual(['stock', 'cobrar', 'cotizaciones'])
    expect(tasks[0]).toMatchObject({ tone: 'alert', title: '1 tabla llegó a su mínimo', to: '/inventario' })
    expect(tasks[1]?.title).toBe('5 pedidos esperan confirmar el pago')
    expect(tasks[2]?.title).toBe('6 cotizaciones esperan tu respuesta')
  })

  it('lo que aún carga no aparece en ninguna lista', () => {
    const { tasks, calm } = todayTasks({ ...calmDay, conversationsWaiting: null, ordersToCollect: null })
    expect(tasks).toEqual([])
    expect(calm).not.toContain('Chats revisados')
    expect(calm).not.toContain('Pagos al día')
  })
})

describe('saludo', () => {
  it('cambia según la hora de Lima (UTC−5)', () => {
    expect(greeting(new Date('2026-11-02T14:00:00Z'))).toBe('Buenos días')
    expect(greeting(new Date('2026-11-02T20:00:00Z'))).toBe('Buenas tardes')
    expect(greeting(new Date('2026-11-03T01:00:00Z'))).toBe('Buenas noches')
  })

  it('escribe el día con mayúscula inicial', () => {
    expect(todayLabel(new Date('2026-11-02T15:00:00Z'))).toBe('Lunes, 2 de noviembre')
  })

  it('usa el primer nombre', () => {
    expect(firstName('Brigitte Giraud Durazo')).toBe('Brigitte')
    expect(firstName('  Alex ')).toBe('Alex')
  })
})
