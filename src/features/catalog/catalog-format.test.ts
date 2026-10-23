import { describe, expect, it } from 'vitest'
import { formatPrice, tierLabel } from './catalog-format'

describe('catalog-format', () => {
  it('muestra "A cotizar" cuando no hay precio publicado', () => {
    expect(formatPrice(null)).toBe('A cotizar')
    expect(formatPrice(120)).toContain('120.00')
  })

  it('describe las escalas por volumen', () => {
    expect(tierLabel({ minQuantity: 10, unitPrice: 80 })).toContain('desde 10 u.')
  })

})
