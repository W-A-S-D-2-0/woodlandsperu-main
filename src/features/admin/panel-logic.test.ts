import { describe, expect, it } from 'vitest'
import {
  formatDate,
  formatMoney,
  newIdempotencyKey,
  orderTone,
  paymentTone,
  quoteTone,
  orderActions,
  parseDecimal,
  parseWholeNumber,
  pendingPriceCount,
  plural,
  quoteActions,
  inCollection,
  shortCollectionName,
  uniqueCollections,
} from './panel-logic'

describe('orderActions', () => {
  it('ofrece confirmar y cancelar mientras está pendiente', () => {
    expect(orderActions('pending_confirmation').map((a) => a.kind)).toEqual(['confirm', 'cancel'])
  })

  it('sigue el flujo confirmado → producción → listo → despacho', () => {
    expect(orderActions('confirmed')[0]).toMatchObject({ kind: 'status', status: 'in_production' })
    expect(orderActions('in_production')[0]).toMatchObject({ kind: 'status', status: 'ready' })
    expect(orderActions('ready').map((a) => a.kind)).toEqual(['dispatch', 'dispatch', 'cancel'])
  })

  it('no permite cancelar lo despachado ni lo cerrado', () => {
    expect(orderActions('shipped').some((a) => a.kind === 'cancel')).toBe(false)
    expect(orderActions('delivered')).toEqual([])
    expect(orderActions('cancelled')).toEqual([])
  })
})

describe('quoteActions', () => {
  it('guía el flujo precio → envío → aceptación → pedido', () => {
    expect(quoteActions('submitted')).toEqual(['price_and_send', 'archive'])
    expect(quoteActions('under_review')).toEqual(['price_and_send', 'archive'])
    expect(quoteActions('sent')).toEqual(['accept', 'archive'])
    expect(quoteActions('accepted')).toEqual(['convert', 'archive'])
    expect(quoteActions('converted')).toEqual([])
  })

  it('permite archivar solo lo que sigue abierto', () => {
    expect(quoteActions('expired')).toEqual(['archive'])
    expect(quoteActions('cancelled')).toEqual([])
  })

  it('cuenta los productos sin precio', () => {
    expect(pendingPriceCount([{ unitPrice: null }, { unitPrice: 0 }, { unitPrice: 10 }])).toBe(1)
  })
})

describe('formato y lectura de números', () => {
  it('formatea soles y valores vacíos', () => {
    expect(formatMoney(1234.5)).toContain('1,234.50')
    expect(formatMoney(null)).toBe('—')
  })

  it('muestra fechas sin corrimiento de zona horaria', () => {
    expect(formatDate('2026-10-17')).toContain('17')
    expect(formatDate(null)).toBe('—')
  })

  it('lee decimales con coma o punto y rechaza texto inválido', () => {
    expect(parseDecimal('12,5')).toBe(12.5)
    expect(parseDecimal('')).toBeNull()
    expect(parseDecimal('1.234')).toBeNaN()
    expect(parseDecimal('abc')).toBeNaN()
    expect(parseDecimal('-1')).toBeNaN()
  })

  it('lee enteros', () => {
    expect(parseWholeNumber('15')).toBe(15)
    expect(parseWholeNumber(' ')).toBeNull()
    expect(parseWholeNumber('1.5')).toBeNaN()
  })

  it('genera claves de idempotencia distintas y suficientemente largas', () => {
    const a = newIdempotencyKey()
    expect(a.length).toBeGreaterThanOrEqual(8)
    expect(a).not.toBe(newIdempotencyKey())
  })
})

describe('colores de estado', () => {
  it('resalta lo que espera una acción y apaga lo cerrado', () => {
    expect(quoteTone('submitted')).toBe('warn')
    expect(quoteTone('converted')).toBe('good')
    expect(quoteTone('expired')).toBe('muted')
    expect(orderTone('pending_confirmation')).toBe('warn')
    expect(orderTone('in_production')).toBe('info')
    expect(orderTone('cancelled')).toBe('muted')
    expect(paymentTone('paid')).toBe('good')
    expect(paymentTone('failed')).toBe('warn')
  })
})

describe('plural', () => {
  it('concuerda la palabra con la cantidad', () => {
    expect(plural(1, 'pedido')).toBe('1 pedido')
    expect(plural(0, 'pedido')).toBe('0 pedidos')
    expect(plural(2, 'precio pendiente', 'precios pendientes')).toBe('2 precios pendientes')
  })
})

describe('colecciones', () => {
  const grill = { slug: 'parrilla-y-cocina', name: 'Colección Parrilla y Cocina' }
  const piqueo = { slug: 'piqueo-y-servir', name: 'Colección Piqueo y Servir' }

  it('lista cada colección una vez, en orden, sin los productos sin colección', () => {
    expect(uniqueCollections([grill, null, piqueo, grill])).toEqual([grill, piqueo])
    expect(uniqueCollections([null])).toEqual([])
  })

  it('acorta el nombre para los botones', () => {
    expect(shortCollectionName(grill.name)).toBe('Parrilla y Cocina')
    expect(shortCollectionName('Otra línea')).toBe('Otra línea')
  })

  it('filtra por colección y, sin elegir, deja todo', () => {
    const items = [{ id: 1, c: grill }, { id: 2, c: piqueo }, { id: 3, c: null }]
    expect(inCollection(items, 'piqueo-y-servir', (i) => i.c).map((i) => i.id)).toEqual([2])
    expect(inCollection(items, '', (i) => i.c)).toHaveLength(3)
  })
})
