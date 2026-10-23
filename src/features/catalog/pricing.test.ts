import { describe, expect, it } from 'vitest'
import { deliveryEstimate, isOverWebLimit, lineTotal, parseQuantity, resolveUnitPrice } from './pricing'

const variant = {
  price: 100,
  priceTiers: [
    { minQuantity: 10, unitPrice: 80 },
    { minQuantity: 5, unitPrice: 90 },
  ],
}

describe('resolveUnitPrice', () => {
  it('usa la escala con mayor cantidad mínima alcanzada', () => {
    expect(resolveUnitPrice(variant, 1)).toBe(100)
    expect(resolveUnitPrice(variant, 4)).toBe(100)
    expect(resolveUnitPrice(variant, 5)).toBe(90)
    expect(resolveUnitPrice(variant, 9)).toBe(90)
    expect(resolveUnitPrice(variant, 10)).toBe(80)
    expect(resolveUnitPrice(variant, 100)).toBe(80)
  })

  it('sin precio publicado ni escala alcanzada es "a cotizar"', () => {
    expect(resolveUnitPrice({ price: null, priceTiers: [] }, 3)).toBeNull()
    expect(resolveUnitPrice({ price: null, priceTiers: [{ minQuantity: 10, unitPrice: 80 }] }, 3)).toBeNull()
    expect(resolveUnitPrice({ price: null, priceTiers: [{ minQuantity: 10, unitPrice: 80 }] }, 10)).toBe(80)
  })

  it('calcula el total de la línea con dos decimales', () => {
    expect(lineTotal(33.33, 3)).toBe(99.99)
    expect(lineTotal(null, 3)).toBeNull()
  })
})

describe('tope web y cantidades', () => {
  it('desde 101 unidades se deriva a WhatsApp', () => {
    expect(isOverWebLimit(100)).toBe(false)
    expect(isOverWebLimit(101)).toBe(true)
  })

  it('lee cantidades enteras positivas', () => {
    expect(parseQuantity('12')).toBe(12)
    expect(parseQuantity(' 7 ')).toBe(7)
    expect(parseQuantity('0')).toBeNaN()
    expect(parseQuantity('1.5')).toBeNaN()
    expect(parseQuantity('')).toBeNaN()
  })
})

describe('deliveryEstimate', () => {
  it('usa los plazos que Woodland definió', () => {
    expect(deliveryEstimate(2)).toMatch(/2 días/)
    expect(deliveryEstimate(25)).toMatch(/1 semana/)
    expect(deliveryEstimate(200)).toMatch(/3 semanas/)
  })

  it('en los tramos sin definir no inventa un plazo', () => {
    expect(deliveryEstimate(10)).toMatch(/por confirmar/)
    expect(deliveryEstimate(60)).toMatch(/por confirmar/)
  })
})
