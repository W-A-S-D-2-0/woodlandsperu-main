import { describe, expect, it } from 'vitest'
import { currentStepIndex, statusHeadline, trackingHeadline, trackingSteps, validateTracking } from './tracking-logic'

describe('currentStepIndex', () => {
  it('ubica cada estado del flujo en su paso', () => {
    expect(currentStepIndex('pending_confirmation')).toBe(0)
    expect(currentStepIndex('in_production')).toBe(2)
    expect(currentStepIndex('shipped')).toBe(4)
    expect(currentStepIndex('delivered')).toBe(4)
  })

  it('devuelve -1 para estados fuera del recorrido', () => {
    expect(currentStepIndex('cancelled')).toBe(-1)
    expect(currentStepIndex('otro')).toBe(-1)
  })

  it('cubre todos los estados de pedido con un texto', () => {
    for (const status of ['pending_confirmation', 'confirmed', 'in_production', 'ready', 'shipped', 'delivered', 'cancelled']) {
      expect(statusHeadline[status]).toBeTruthy()
    }
    expect(trackingSteps.length).toBeGreaterThan(3)
    expect(trackingHeadline({ status: 'desconocido' })).toMatch(/actualizado/)
  })
})

describe('validateTracking', () => {
  it('normaliza el código y acepta correo o teléfono', () => {
    const result = validateTracking(' ped-000012 ', 'ana@example.com')
    expect(result.ok && result.body.code).toBe('PED-000012')
  })

  it('rechaza código y contacto inválidos con mensajes claros', () => {
    const result = validateTracking('123', 'ab')
    expect(!result.ok && result.errors.code).toMatch(/PED-/)
    expect(!result.ok && result.errors.contact).toMatch(/correo o el teléfono/)
  })
})
