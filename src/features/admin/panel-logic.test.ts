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
  matchesOrderFilter,
  needsPayment,
  orderNextStep,
  orderPaymentBadge,
  orderSteps,
  parseOrderFilter,
  whatsappLink,
  matchesQuoteFilter,
  parseQuoteFilter,
  quoteNextStep,
  quoteSteps,
  variantsWithoutPrice,
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
    expect(paymentTone('failed')).toBe('alert')
    expect(paymentTone('unpaid')).toBe('warn')
    expect(paymentTone('refunded')).toBe('muted')
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

describe('pedidos: cobro y filtros', () => {
  it('pide cobrar solo los pedidos vigentes sin pago verificado', () => {
    expect(needsPayment({ status: 'confirmed', paymentStatus: 'unpaid' })).toBe(true)
    expect(needsPayment({ status: 'in_production', paymentStatus: 'pending' })).toBe(true)
    expect(needsPayment({ status: 'confirmed', paymentStatus: 'paid' })).toBe(false)
    expect(needsPayment({ status: 'cancelled', paymentStatus: 'unpaid' })).toBe(false)
    expect(needsPayment({ status: 'pending_confirmation', paymentStatus: 'unpaid' })).toBe(false)
  })

  it('muestra el pago con palabras y color', () => {
    expect(orderPaymentBadge({ status: 'confirmed', paymentStatus: 'unpaid' })).toEqual({ label: 'Falta pago', tone: 'warn' })
    expect(orderPaymentBadge({ status: 'confirmed', paymentStatus: 'failed' })).toEqual({ label: 'Pago fallido', tone: 'alert' })
    expect(orderPaymentBadge({ status: 'cancelled', paymentStatus: 'paid' })).toEqual({ label: 'Pagado', tone: 'good' })
    expect(orderPaymentBadge({ status: 'cancelled', paymentStatus: 'unpaid' })).toEqual({ label: 'Sin pago', tone: 'muted' })
  })

  it('filtra por lo que hay que hacer', () => {
    const ready = { status: 'ready', paymentStatus: 'paid' } as const
    expect(matchesOrderFilter(ready, 'entregar')).toBe(true)
    expect(matchesOrderFilter(ready, 'cobrar')).toBe(false)
    expect(matchesOrderFilter({ status: 'in_production', paymentStatus: 'unpaid' }, 'taller')).toBe(true)
    expect(matchesOrderFilter({ status: 'pending_confirmation', paymentStatus: 'unpaid' }, 'confirmar')).toBe(true)
    expect(matchesOrderFilter(ready, 'todos')).toBe(true)
  })

  it('lee el filtro de la URL y cae en «Todos» si no lo conoce', () => {
    expect(parseOrderFilter('cobrar')).toBe('cobrar')
    expect(parseOrderFilter('otro')).toBe('todos')
    expect(parseOrderFilter(null)).toBe('todos')
  })
})

describe('pedidos: pasos', () => {
  const states = (status: Parameters<typeof orderSteps>[0]) => orderSteps(status).map((s) => s.state)

  it('marca hecho lo anterior y actual el paso en curso', () => {
    expect(states('confirmed')).toEqual(['current', 'pending', 'pending', 'pending', 'pending'])
    expect(states('ready')).toEqual(['done', 'done', 'current', 'pending', 'pending'])
  })

  it('entregado completa la línea; por confirmar y cancelado la dejan pendiente', () => {
    expect(states('delivered')).toEqual(['done', 'done', 'done', 'done', 'done'])
    expect(states('pending_confirmation').every((s) => s === 'pending')).toBe(true)
    expect(states('cancelled').every((s) => s === 'pending')).toBe(true)
  })

  it('dice el siguiente paso en palabras simples', () => {
    expect(orderNextStep('confirmed').title).toBe('Mandarlo al taller')
    expect(orderNextStep('delivered').title).toBe('Pedido entregado')
  })
})

describe('whatsappLink', () => {
  it('arma el enlace para celulares peruanos', () => {
    expect(whatsappLink('987 654 321')).toBe('https://wa.me/51987654321')
    expect(whatsappLink('+51 987654321')).toBe('https://wa.me/51987654321')
    expect(whatsappLink('01 4567890')).toBeNull()
    expect(whatsappLink(null)).toBeNull()
  })
})

describe('cotizaciones: filtros y pasos', () => {
  it('agrupa por lo que hay que hacer y esconde las archivadas de «Todas»', () => {
    expect(matchesQuoteFilter('submitted', 'responder')).toBe(true)
    expect(matchesQuoteFilter('under_review', 'responder')).toBe(true)
    expect(matchesQuoteFilter('sent', 'esperando')).toBe(true)
    expect(matchesQuoteFilter('cancelled', 'todas')).toBe(false)
    expect(matchesQuoteFilter('cancelled', 'cerradas')).toBe(true)
    expect(parseQuoteFilter('nada')).toBe('todas')
  })

  it('el primer paso es poner precios solo si falta alguno', () => {
    const states = (status: Parameters<typeof quoteSteps>[0], missing: number) => quoteSteps(status, missing).map((s) => s.state)
    expect(states('submitted', 2)).toEqual(['current', 'pending', 'pending', 'pending'])
    expect(states('submitted', 0)).toEqual(['done', 'current', 'pending', 'pending'])
    expect(states('accepted', 0)).toEqual(['done', 'done', 'done', 'current'])
    expect(states('converted', 0)).toEqual(['done', 'done', 'done', 'done'])
    expect(states('rejected', 0).every((s) => s === 'pending')).toBe(true)
  })

  it('dice el siguiente paso con la cantidad de precios que faltan', () => {
    expect(quoteNextStep('submitted', 1).title).toBe('Poner el precio que falta')
    expect(quoteNextStep('submitted', 3).title).toBe('Poner los 3 precios que faltan')
    expect(quoteNextStep('submitted', 0).title).toBe('Enviar la propuesta')
  })
})

describe('variantsWithoutPrice', () => {
  it('cuenta solo lo publicado sin precio', () => {
    const products = [
      { isActive: true, variants: [{ isActive: true, catalogPrice: null }, { isActive: true, catalogPrice: 250 }, { isActive: false, catalogPrice: null }] },
      { isActive: false, variants: [{ isActive: true, catalogPrice: null }] },
    ]
    expect(variantsWithoutPrice(products)).toBe(1)
  })
})
