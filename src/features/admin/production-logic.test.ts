import { describe, expect, it } from 'vitest'
import type { InventoryLevel } from '../../../shared/api/panel-contracts'
import { filterLevels, groupByProduct, parseProductionQuantity, PRODUCTION_MAX } from './production-logic'

const level = (over: Partial<InventoryLevel>): InventoryLevel => ({
  variantId: 'v',
  sku: 'SG-XL',
  product: 'Super Grill',
  productSlug: 'moshaco',
  collection: null,
  variant: 'XL',
  dimensionsLabel: '65*46*4',
  onHand: 5,
  reserved: 0,
  available: 5,
  minStock: null,
  custodian: null,
  lowStock: false,
  ...over,
})

const levels = [level({ variantId: '1' }), level({ variantId: '2', variant: 'L', sku: 'SG-L', dimensionsLabel: '50*38*4' }), level({ variantId: '3', product: 'Serving Board', variant: 'Rectángulo', sku: 'SB-R' })]

describe('parseProductionQuantity', () => {
  it('acepta enteros de 1 al máximo', () => {
    expect(parseProductionQuantity('3')).toBe(3)
    expect(parseProductionQuantity(' 12 ')).toBe(12)
    expect(parseProductionQuantity(String(PRODUCTION_MAX))).toBe(PRODUCTION_MAX)
  })

  it('rechaza cero, negativos, decimales, texto y excesos', () => {
    for (const text of ['0', '-1', '1.5', 'abc', '', String(PRODUCTION_MAX + 1)]) expect(parseProductionQuantity(text)).toBeNaN()
  })
})

describe('filterLevels y groupByProduct', () => {
  it('filtra sin distinguir tildes ni mayúsculas, por producto, medidas o SKU', () => {
    expect(filterLevels(levels, 'rectangulo').map((l) => l.variantId)).toEqual(['3'])
    expect(filterLevels(levels, 'SUPER').map((l) => l.variantId)).toEqual(['1', '2'])
    expect(filterLevels(levels, '50*38').map((l) => l.variantId)).toEqual(['2'])
    expect(filterLevels(levels, 'sb-r')).toHaveLength(1)
    expect(filterLevels(levels, '')).toHaveLength(3)
  })

  it('agrupa por producto en orden de aparición', () => {
    const groups = groupByProduct(levels)
    expect(groups.map((g) => g.product)).toEqual(['Super Grill', 'Serving Board'])
    expect(groups[0]?.levels).toHaveLength(2)
  })
})
