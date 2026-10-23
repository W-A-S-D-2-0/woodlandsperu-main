import type { ReportResponse } from '../../../shared/api/panel-contracts'
import { channelLabels, orderStatusLabels, paymentStatusLabels, quoteStatusLabels } from './panel-logic'

/** Rangos y exportación de reportes. Sin React: se prueban solos. Los importes vienen del servidor. */

export interface DateRange {
  from: string
  to: string
}

/** Fecha de hoy en Lima (AAAA-MM-DD), que es como se cuentan los días del negocio. */
export function limaToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(now)
}

function shiftDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export const reportPresets = [
  { key: '7d', label: 'Últimos 7 días' },
  { key: '30d', label: 'Últimos 30 días' },
  { key: 'mes', label: 'Este mes' },
  { key: 'mes-anterior', label: 'Mes anterior' },
] as const

export type ReportPreset = (typeof reportPresets)[number]['key']

export function presetRange(preset: ReportPreset, now: Date = new Date()): DateRange {
  const today = limaToday(now)
  const monthStart = `${today.slice(0, 8)}01`
  switch (preset) {
    case '7d':
      return { from: shiftDays(today, -6), to: today }
    case '30d':
      return { from: shiftDays(today, -29), to: today }
    case 'mes':
      return { from: monthStart, to: today }
    case 'mes-anterior': {
      const lastDay = shiftDays(monthStart, -1)
      return { from: `${lastDay.slice(0, 8)}01`, to: lastDay }
    }
  }
}

/** Rango de la URL si es válido; si no, los últimos 30 días. */
export function rangeFromParams(params: URLSearchParams, now: Date = new Date()): DateRange {
  const from = params.get('desde') ?? ''
  const to = params.get('hasta') ?? ''
  const valid = /^\d{4}-\d{2}-\d{2}$/
  return valid.test(from) && valid.test(to) && from <= to ? { from, to } : presetRange('30d', now)
}

/** Porcentaje legible ("25 %"), o "—" si no aplica. */
export function formatPercent(ratio: number | null): string {
  return ratio === null ? '—' : `${Math.round(ratio * 100)} %`
}

// --- CSV para Google Sheets --------------------------------------------------

type Cell = string | number | null

function csvCell(value: Cell): string {
  if (value === null) return ''
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** CSV con coma y punto decimal: Google Sheets lo importa tal cual (Archivo › Importar). */
export function toCsv(rows: readonly (readonly Cell[])[]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
}

/** Fecha y hora de Lima en un formato que Sheets reconoce como fecha (AAAA-MM-DD HH:MM). */
function sheetDateTime(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
}

export type ReportSheet = 'resumen' | 'cotizaciones' | 'pedidos'

export const reportSheets: { key: ReportSheet; label: string }[] = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'cotizaciones', label: 'Cotizaciones' },
  { key: 'pedidos', label: 'Pedidos' },
]

export function reportSheetRows(report: ReportResponse, sheet: ReportSheet): Cell[][] {
  if (sheet === 'cotizaciones') {
    return [
      ['Código', 'Fecha', 'Cliente', 'Canal', 'Estado', 'Total (S/)', 'Precios pendientes'],
      ...report.quoteRows.map((q) => [
        q.code, sheetDateTime(q.createdAt), q.customer, channelLabels[q.channel] ?? q.channel, quoteStatusLabels[q.status], q.total, q.pendingPrices,
      ]),
    ]
  }
  if (sheet === 'pedidos') {
    return [
      ['Código', 'Fecha', 'Cliente', 'Canal', 'Estado', 'Pago', 'Total (S/)'],
      ...report.orderRows.map((o) => [
        o.code, sheetDateTime(o.createdAt), o.customer, channelLabels[o.channel] ?? o.channel, orderStatusLabels[o.status], paymentStatusLabels[o.paymentStatus], o.total,
      ]),
    ]
  }
  return [
    ['Indicador', 'Valor'],
    ['Desde', report.range.from],
    ['Hasta', report.range.to],
    ['Consultas (conversaciones)', report.inquiries.conversations],
    ['Consultas con seguimiento del equipo', report.inquiries.handedOff],
    ['Cotizaciones', report.quotes.total],
    ['Cotizaciones convertidas en pedido', report.quotes.converted],
    ['Tasa de conversión (%)', report.quotes.conversionRate === null ? null : Math.round(report.quotes.conversionRate * 100)],
    ['Pedidos', report.orders.total],
    ['Ventas confirmadas', report.sales.count],
    ['Monto vendido (S/)', report.sales.total],
    ['Ticket promedio (S/)', report.sales.averageTicket],
    ['Variantes bajo mínimo', report.lowStock.length],
    ['Variantes sin stock', report.outOfStock.length],
    ['Generado', sheetDateTime(report.generatedAt)],
  ]
}

export function reportFileName(report: ReportResponse, sheet: ReportSheet): string {
  return `woodland-${sheet}-${report.range.from}_${report.range.to}.csv`
}
