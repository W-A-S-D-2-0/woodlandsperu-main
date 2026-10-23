import { describe, expect, it } from 'vitest'
import { reportQuery } from '../../shared/api/panel-schemas'
import type { ReportSource } from '../data/panel-data'
import { buildReport, reportBounds } from './reports'

const level = (sku: string, available: number, minStock: number | null, lowStock = false) => ({
  variantId: sku, sku, product: 'Moshaco', productSlug: 'moshaco', collection: null, variant: sku, dimensionsLabel: null,
  onHand: available, reserved: 0, available, minStock, custodian: null, lowStock,
})

const order = (code: string, status: ReportSource['orders'][number]['status'], total: number, items: ReportSource['orders'][number]['items'] = []) => ({
  code, createdAt: '2026-10-10T15:00:00Z', customer: 'Ana', channel: 'admin' as const, status, paymentStatus: 'unpaid' as const, total, items,
})

const source = (patch: Partial<ReportSource> = {}): ReportSource => ({
  conversations: [], quotes: [], orders: [], inventory: [], truncated: false, ...patch,
})

describe('reportBounds', () => {
  it('convierte días de Lima en instantes con el día final incluido', () => {
    expect(reportBounds('2026-10-01', '2026-10-31')).toEqual({ start: '2026-10-01T00:00:00-05:00', end: '2026-11-01T00:00:00-05:00' })
    expect(reportBounds('2026-12-31', '2026-12-31').end).toBe('2027-01-01T00:00:00-05:00')
  })
})

describe('reportQuery', () => {
  it('rechaza rangos invertidos o de más de un año', () => {
    expect(reportQuery.safeParse({ from: '2026-10-01', to: '2026-10-31' }).success).toBe(true)
    expect(reportQuery.safeParse({ from: '2026-10-31', to: '2026-10-01' }).success).toBe(false)
    expect(reportQuery.safeParse({ from: '2025-01-01', to: '2026-10-01' }).success).toBe(false)
    expect(reportQuery.safeParse({ from: '01/10/2026', to: '2026-10-31' }).success).toBe(false)
  })
})

describe('buildReport', () => {
  const range = { from: '2026-10-01', to: '2026-10-31' }

  it('cuenta solo como venta lo confirmado o más avanzado y calcula el ticket promedio', () => {
    const report = buildReport(
      source({ orders: [order('PED-1', 'confirmed', 100), order('PED-2', 'delivered', 50.5), order('PED-3', 'cancelled', 999), order('PED-4', 'pending_confirmation', 70)] }),
      range,
    )
    expect(report.sales).toEqual({ count: 2, total: 150.5, averageTicket: 75.25 })
    expect(report.orders.total).toBe(4)
    expect(report.orders.byStatus).toEqual({ confirmed: 1, delivered: 1, cancelled: 1, pending_confirmation: 1 })
    expect(report.orderRows[0]).not.toHaveProperty('items')
  })

  it('sin ventas no inventa promedios ni tasas', () => {
    const report = buildReport(source(), range)
    expect(report.sales).toEqual({ count: 0, total: 0, averageTicket: null })
    expect(report.quotes.conversionRate).toBeNull()
  })

  it('calcula la conversión y deja sin total las cotizaciones con precios pendientes', () => {
    const quote = (code: string, status: 'converted' | 'submitted', pendingPrices: number) => ({
      code, createdAt: '2026-10-02T15:00:00Z', customer: 'Ana', channel: 'web' as const, status, total: 40, pendingPrices,
    })
    const report = buildReport(source({ quotes: [quote('COT-1', 'converted', 0), quote('COT-2', 'submitted', 1), quote('COT-3', 'submitted', 0), quote('COT-4', 'submitted', 0)] }), range)
    expect(report.quotes.converted).toBe(1)
    expect(report.quotes.conversionRate).toBe(0.25)
    expect(report.quotes.byChannel).toEqual({ web: 4 })
    expect(report.quoteRows.map((q) => q.total)).toEqual([40, null, 40, 40])
  })

  it('agrupa lo más vendido por unidades, solo en ventas', () => {
    const report = buildReport(
      source({
        orders: [
          order('PED-1', 'confirmed', 0, [{ description: 'Super Grill · XL', quantity: 2, lineTotal: 300 }, { description: 'Chunky', quantity: 1, lineTotal: null }]),
          order('PED-2', 'ready', 0, [{ description: 'Super Grill · XL', quantity: 3, lineTotal: 450 }]),
          order('PED-3', 'cancelled', 0, [{ description: 'Chunky', quantity: 50, lineTotal: 10 }]),
        ],
      }),
      range,
    )
    expect(report.topProducts).toEqual([
      { description: 'Super Grill · XL', quantity: 5, total: 750 },
      { description: 'Chunky', quantity: 1, total: 0 },
    ])
  })

  it('separa consultas por canal y las derivadas a una persona', () => {
    const report = buildReport(
      source({ conversations: [{ channel: 'web_chat', handedOff: true }, { channel: 'web_chat', handedOff: false }, { channel: 'whatsapp', handedOff: false }] }),
      range,
    )
    expect(report.inquiries).toEqual({ conversations: 3, byChannel: { web_chat: 2, whatsapp: 1 }, handedOff: 1 })
  })

  it('lista lo que está en su mínimo o por debajo y lo que no tiene stock', () => {
    const report = buildReport(
      source({ inventory: [level('A', 5, 5), level('B', 6, 5), level('C', 0, null), level('D', 9, null, true)] }),
      range,
    )
    expect(report.lowStock.map((r) => r.sku)).toEqual(['A', 'D'])
    expect(report.outOfStock.map((r) => r.sku)).toEqual(['C'])
  })
})
