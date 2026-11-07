import { describe, expect, it } from 'vitest'
import { dimensionsText, formatPrice, tierLabel, toOrderModel } from './catalog-format'

describe('catalog-format', () => {
  it('muestra "A cotizar" cuando no hay precio publicado', () => {
    expect(formatPrice(null)).toBe('A cotizar')
    expect(formatPrice(120)).toContain('120.00')
  })

  it('arma el modelo de pedido de cada medida con sus centímetros y su precio', () => {
    const model = toOrderModel({ name: 'Moshaco' }, { name: 'Small', dimensionsLabel: '35*25*2', price: 197 })
    expect(model).toMatchObject({ product: 'Moshaco', variant: 'Small', dimensions: '35 × 25 × 2 cm' })
    expect(model.price).toContain('197.00')
    expect(dimensionsText(null)).toBeNull()
  })

  it('describe las escalas por volumen', () => {
    expect(tierLabel({ minQuantity: 10, unitPrice: 80 })).toContain('desde 10 u.')
  })

})
