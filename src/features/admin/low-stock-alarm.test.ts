import { describe, expect, it } from 'vitest'
import type { InventoryLevel } from '../../../shared/api/panel-contracts'
import { levelName, lowStockItems, nextAnnounced, readAnnounced, readSoundEnabled, spokenMessage, toAnnounce, writeAnnounced, writeSoundEnabled } from './low-stock-alarm'

const level = (over: Partial<InventoryLevel> & { variantId: string }): InventoryLevel => ({
  sku: 'SKU',
  product: 'Moshaco',
  productSlug: 'moshaco',
  collection: null,
  variant: 'Large',
  dimensionsLabel: null,
  onHand: 100,
  reserved: 0,
  available: 100,
  minStock: 30,
  custodian: null,
  lowStock: false,
  ...over,
})

const memory = () => {
  const data = new Map<string, string>()
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) }
}

describe('stock bajo', () => {
  it('detecta lo que llegó al mínimo o lo tiene abierto, las más escasas primero', () => {
    const levels = [
      level({ variantId: 'a', available: 100 }),
      level({ variantId: 'b', product: 'Ñañito', variant: 'Estándar', available: 30, onHand: 30 }),
      level({ variantId: 'c', available: 5, onHand: 5, lowStock: true }),
      level({ variantId: 'd', available: 0, onHand: 0, minStock: null }),
      level({ variantId: 'e', available: 31, onHand: 31 }),
    ]
    expect(lowStockItems(levels).map((l) => l.variantId)).toEqual(['c', 'b'])
  })

  it('sin mínimo configurado no hay alarma, aunque no haya stock', () => {
    expect(lowStockItems([level({ variantId: 'x', available: 0, onHand: 0, minStock: null })])).toEqual([])
  })

  it('en el mínimo exacto (30 de 30) ya es stock bajo', () => {
    expect(lowStockItems([level({ variantId: 'x', available: 30, onHand: 30 })])).toHaveLength(1)
  })
})

describe('qué suena y cuándo', () => {
  const low = [level({ variantId: 'a', available: 30, onHand: 30 }), level({ variantId: 'b', product: 'Ya Vuelta', variant: 'Circular', available: 12, onHand: 12 })]

  it('suena una vez por variante mientras siga baja', () => {
    expect(toAnnounce(low, new Set()).map((l) => l.variantId)).toEqual(['a', 'b'])
    expect(toAnnounce(low, new Set(['a'])).map((l) => l.variantId)).toEqual(['b'])
    expect(toAnnounce(low, nextAnnounced(low))).toEqual([])
  })

  it('al reponer se olvida y, si vuelve a bajar, suena otra vez', () => {
    let announced = nextAnnounced(low)
    announced = nextAnnounced([]) // se repuso todo
    expect(toAnnounce(low, announced)).toHaveLength(2)
  })

  it('la voz dice cuál producto es y cuántas unidades quedan', () => {
    expect(spokenMessage([low[0]!])).toBe('Atención. Stock bajo: Moshaco Large. Quedan 30 unidades.')
    expect(spokenMessage([level({ variantId: 'z', available: 1, onHand: 1 })])).toContain('Quedan 1 unidad.')
    expect(spokenMessage(low)).toBe('Atención. 2 productos con stock bajo: Moshaco Large, Ya Vuelta Circular.')
    const many = Array.from({ length: 6 }, (_, i) => level({ variantId: `v${i}`, variant: `T${i}`, available: i, onHand: i }))
    expect(spokenMessage(many)).toContain('y 2 más')
    expect(spokenMessage([])).toBe('')
  })

  it('el nombre del producto para el aviso', () => {
    expect(levelName(low[1]!)).toBe('Ya Vuelta · Circular')
  })
})

describe('memoria del navegador', () => {
  it('recuerda lo anunciado y el interruptor del sonido', () => {
    const store = memory()
    expect(readAnnounced(store).size).toBe(0)
    writeAnnounced(store, new Set(['a', 'b']))
    expect([...readAnnounced(store)].sort()).toEqual(['a', 'b'])
    expect(readSoundEnabled(store)).toBe(true)
    writeSoundEnabled(store, false)
    expect(readSoundEnabled(store)).toBe(false)
    writeSoundEnabled(store, true)
    expect(readSoundEnabled(store)).toBe(true)
  })

  it('si el navegador bloquea el almacenamiento, todo sigue funcionando', () => {
    const broken = {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('bloqueado')
      },
    }
    expect(readAnnounced(broken).size).toBe(0)
    expect(() => writeAnnounced(broken, new Set(['a']))).not.toThrow()
    expect(readSoundEnabled(broken)).toBe(true)
    expect(() => writeSoundEnabled(broken, false)).not.toThrow()
    expect(readAnnounced(null).size).toBe(0)
    expect(readSoundEnabled(null)).toBe(true)
  })

  it('un valor guardado dañado no rompe nada', () => {
    const store = memory()
    store.setItem('woodland-panel-low-stock-announced', '{no es json')
    expect(readAnnounced(store).size).toBe(0)
    store.setItem('woodland-panel-low-stock-announced', '[1, "ok", null]')
    expect([...readAnnounced(store)]).toEqual(['ok'])
  })
})
