import { describe, expect, it } from 'vitest'
import { buildDirectOrder, emptySale, saleSubtotal, suggestedPrice, type SaleLine, type SaleValues } from './direct-sale-logic'

const VARIANT = '3f2b8c1e-5d4a-4e7b-9a10-2c6d8e9f0a1b'
const line = (over: Partial<SaleLine> = {}): SaleLine => ({
  key: 'a',
  variantId: VARIANT,
  label: 'Super Grill · XL',
  quantity: '2',
  unitPrice: '',
  customization: '',
  ...over,
})
const sale = (over: Partial<SaleValues> = {}): SaleValues => ({
  ...emptySale(),
  customer: { type: 'individual', fullName: 'Ana Pérez', companyName: '', email: '', phone: '987654321' },
  lines: [line()],
  ...over,
})

describe('buildDirectOrder', () => {
  it('arma el cuerpo con precio vacío para usar la regla de siempre', () => {
    const result = buildDirectOrder(sale())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.body.items[0]).toMatchObject({ variantId: VARIANT, quantity: 2 })
      expect(result.body.items[0]?.unitPrice).toBeUndefined()
      expect(result.body.channel).toBe('whatsapp')
    }
  })

  it('lleva el precio escrito y la personalización', () => {
    const result = buildDirectOrder(sale({ lines: [line({ unitPrice: '120,50', customization: 'Grabado: "Ana"' })] }))
    expect(result.ok && result.body.items[0]).toMatchObject({ unitPrice: 120.5, customization: 'Grabado: "Ana"' })
  })

  it('una pieza a medida exige precio', () => {
    const custom = line({ variantId: undefined, label: 'Tabla especial' })
    expect(buildDirectOrder(sale({ lines: [custom] })).ok).toBe(false)
    expect(buildDirectOrder(sale({ lines: [{ ...custom, unitPrice: '200' }] })).ok).toBe(true)
  })

  it('exige productos, contacto y confirmación del cliente para reservar', () => {
    expect(buildDirectOrder(sale({ lines: [] })).ok).toBe(false)
    expect(buildDirectOrder(sale({ customer: { ...sale().customer, phone: '' } })).ok).toBe(false)
    expect(buildDirectOrder(sale({ confirm: true })).ok).toBe(false)
    expect(buildDirectOrder(sale({ confirm: true, customerConfirmed: true })).ok).toBe(true)
  })

  it('rechaza precios y descuentos mal escritos con un mensaje claro', () => {
    const badPrice = buildDirectOrder(sale({ lines: [line({ unitPrice: 'abc' })] }))
    expect(!badPrice.ok && badPrice.errors[0]).toMatch(/precio del producto 1/)
    const badDiscount = buildDirectOrder(sale({ discount: '1.234' }))
    expect(!badDiscount.ok && badDiscount.errors[0]).toMatch(/descuento/)
  })

  it('una empresa necesita su razón social', () => {
    const business = sale({ customer: { ...sale().customer, type: 'business' } })
    expect(buildDirectOrder(business).ok).toBe(false)
    expect(buildDirectOrder({ ...business, customer: { ...business.customer, companyName: 'Acme SAC' } }).ok).toBe(true)
  })
})

describe('precios sugeridos y subtotal', () => {
  const variant = { catalogPrice: 100, priceTiers: [{ minQuantity: 10, unitPrice: 80 }] }

  it('sugiere el precio por rango de cantidad', () => {
    expect(suggestedPrice(variant, 2)).toBe(100)
    expect(suggestedPrice(variant, 10)).toBe(80)
    expect(suggestedPrice({ catalogPrice: null, priceTiers: [] }, 2)).toBeNull()
  })

  it('suma con el precio escrito o el sugerido e ignora lo que aún no tiene precio', () => {
    const lines = [line({ quantity: '2' }), line({ key: 'b', quantity: '1', unitPrice: '50' }), line({ key: 'c', quantity: '3' })]
    const priceOf = (l: SaleLine) => (l.key === 'c' ? null : 100)
    expect(saleSubtotal(lines, priceOf)).toBe(2 * 100 + 50)
  })
})
