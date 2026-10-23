import { describe, expect, it } from 'vitest'
import type { ReportResponse } from '../../../shared/api/panel-contracts'
import { formatPercent, limaToday, presetRange, rangeFromParams, reportFileName, reportSheetRows, toCsv } from './report-logic'

// 17 oct 2026, 02:00 en UTC = 16 oct, 21:00 en Lima.
const NOW = new Date('2026-10-17T02:00:00Z')

const report: ReportResponse = {
  range: { from: '2026-10-01', to: '2026-10-16' },
  generatedAt: '2026-10-17T02:00:00Z',
  truncated: false,
  inquiries: { conversations: 4, byChannel: { web_chat: 4, whatsapp: 0 }, handedOff: 2 },
  quotes: { total: 4, byStatus: { converted: 1, submitted: 3 }, byChannel: { web: 4 }, converted: 1, conversionRate: 0.25 },
  orders: { total: 1, byStatus: { confirmed: 1 }, byChannel: { admin: 1 } },
  sales: { count: 1, total: 450, averageTicket: 450 },
  topProducts: [],
  lowStock: [],
  outOfStock: [],
  quoteRows: [
    { code: 'COT-000001', createdAt: '2026-10-16T21:16:00Z', customer: 'Restaurante "El Fogón", SAC', channel: 'web_chat', status: 'submitted', total: null, pendingPrices: 1 },
  ],
  orderRows: [
    { code: 'PED-000001', createdAt: '2026-10-10T15:00:00Z', customer: 'Ana', channel: 'admin', status: 'confirmed', paymentStatus: 'unpaid', total: 450 },
  ],
}

describe('rangos de fechas', () => {
  it('usa el día de Lima, no el de UTC', () => {
    expect(limaToday(NOW)).toBe('2026-10-16')
  })

  it('calcula los rangos predefinidos', () => {
    expect(presetRange('7d', NOW)).toEqual({ from: '2026-10-10', to: '2026-10-16' })
    expect(presetRange('30d', NOW)).toEqual({ from: '2026-09-17', to: '2026-10-16' })
    expect(presetRange('mes', NOW)).toEqual({ from: '2026-10-01', to: '2026-10-16' })
    expect(presetRange('mes-anterior', NOW)).toEqual({ from: '2026-09-01', to: '2026-09-30' })
    expect(presetRange('mes-anterior', new Date('2026-01-10T12:00:00Z'))).toEqual({ from: '2025-12-01', to: '2025-12-31' })
  })

  it('toma el rango de la URL solo si es válido', () => {
    expect(rangeFromParams(new URLSearchParams('desde=2026-10-01&hasta=2026-10-05'), NOW)).toEqual({ from: '2026-10-01', to: '2026-10-05' })
    expect(rangeFromParams(new URLSearchParams('desde=2026-10-05&hasta=2026-10-01'), NOW)).toEqual(presetRange('30d', NOW))
    expect(rangeFromParams(new URLSearchParams('desde=ayer'), NOW)).toEqual(presetRange('30d', NOW))
  })

  it('formatea porcentajes', () => {
    expect(formatPercent(0.25)).toBe('25 %')
    expect(formatPercent(null)).toBe('—')
  })
})

describe('exportación CSV', () => {
  it('escapa comas, comillas y saltos de línea', () => {
    expect(toCsv([['a', 'b,c', 'd"e', null, 12.5], ['x\ny']])).toBe('a,"b,c","d""e",,12.5\r\n"x\ny"')
  })

  it('arma la hoja de cotizaciones con textos en español y sin total si falta precio', () => {
    const rows = reportSheetRows(report, 'cotizaciones')
    expect(rows[0]).toEqual(['Código', 'Fecha', 'Cliente', 'Canal', 'Estado', 'Total (S/)', 'Precios pendientes'])
    expect(rows[1]).toEqual(['COT-000001', '2026-10-16 16:16', 'Restaurante "El Fogón", SAC', 'Chat web', 'Recibida', null, 1])
  })

  it('arma la hoja de pedidos y el resumen', () => {
    expect(reportSheetRows(report, 'pedidos')[1]).toEqual(['PED-000001', '2026-10-10 10:00', 'Ana', 'Equipo', 'Confirmado', 'Sin pago', 450])
    const summary = Object.fromEntries(reportSheetRows(report, 'resumen').slice(1))
    expect(summary['Ticket promedio (S/)']).toBe(450)
    expect(summary['Tasa de conversión (%)']).toBe(25)
    expect(summary['Desde']).toBe('2026-10-01')
  })

  it('nombra el archivo con la hoja y el rango', () => {
    expect(reportFileName(report, 'pedidos')).toBe('woodland-pedidos-2026-10-01_2026-10-16.csv')
  })
})
