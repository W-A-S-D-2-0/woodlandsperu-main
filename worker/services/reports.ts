import type { OrderStatus, ReportResponse, ReportStockRow } from '../../shared/api/panel-contracts'
import type { ReportSource } from '../data/panel-data'

/** Lima no tiene horario de verano: siempre UTC−5. */
const LIMA_OFFSET = '-05:00'

/** Estados que cuentan como venta: confirmado o más avanzado, nunca cancelado (igual que el Resumen). */
export const SALE_STATUSES: readonly OrderStatus[] = ['confirmed', 'in_production', 'ready', 'shipped', 'delivered']

const TOP_PRODUCTS = 10

/** Días calendario de Lima → instantes [start, end) para filtrar `created_at`. */
export function reportBounds(from: string, to: string): { start: string; end: string } {
  const next = new Date(`${to}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return { start: `${from}T00:00:00${LIMA_OFFSET}`, end: `${next.toISOString().slice(0, 10)}T00:00:00${LIMA_OFFSET}` }
}

const round2 = (value: number) => Math.round(value * 100) / 100

function countBy<T, K extends string>(rows: readonly T[], key: (row: T) => K): Partial<Record<K, number>> {
  const counts: Partial<Record<K, number>> = {}
  for (const row of rows) counts[key(row)] = (counts[key(row)] ?? 0) + 1
  return counts
}

const stockRow = (level: ReportSource['inventory'][number]): ReportStockRow => ({
  sku: level.sku,
  product: level.product,
  variant: level.variant,
  available: level.available,
  minStock: level.minStock,
})

/** Arma los indicadores a partir de los registros del rango. Sin acceso a datos: se prueba sola. */
export function buildReport(source: ReportSource, range: { from: string; to: string }, now: Date = new Date()): ReportResponse {
  const { conversations, quotes, orders, inventory } = source

  const converted = quotes.filter((q) => q.status === 'converted').length
  const sales = orders.filter((o) => SALE_STATUSES.includes(o.status))
  const salesTotal = round2(sales.reduce((sum, o) => sum + o.total, 0))

  const products = new Map<string, { description: string; quantity: number; total: number }>()
  for (const item of sales.flatMap((o) => o.items)) {
    const entry = products.get(item.description) ?? { description: item.description, quantity: 0, total: 0 }
    entry.quantity += item.quantity
    entry.total = round2(entry.total + (item.lineTotal ?? 0))
    products.set(item.description, entry)
  }

  const byProduct = (a: ReportStockRow, b: ReportStockRow) => a.product.localeCompare(b.product) || a.variant.localeCompare(b.variant)

  return {
    range,
    generatedAt: now.toISOString(),
    truncated: source.truncated,
    inquiries: {
      conversations: conversations.length,
      byChannel: {
        web_chat: conversations.filter((c) => c.channel === 'web_chat').length,
        whatsapp: conversations.filter((c) => c.channel === 'whatsapp').length,
      },
      handedOff: conversations.filter((c) => c.handedOff).length,
    },
    quotes: {
      total: quotes.length,
      byStatus: countBy(quotes, (q) => q.status),
      byChannel: countBy(quotes, (q) => q.channel),
      converted,
      conversionRate: quotes.length > 0 ? converted / quotes.length : null,
    },
    orders: {
      total: orders.length,
      byStatus: countBy(orders, (o) => o.status),
      byChannel: countBy(orders, (o) => o.channel),
    },
    sales: { count: sales.length, total: salesTotal, averageTicket: sales.length > 0 ? round2(salesTotal / sales.length) : null },
    topProducts: [...products.values()]
      .sort((a, b) => b.quantity - a.quantity || b.total - a.total || a.description.localeCompare(b.description))
      .slice(0, TOP_PRODUCTS),
    // Bajo mínimo: con alerta abierta o en su mínimo configurado o por debajo (mismo criterio que la base).
    lowStock: inventory
      .filter((l) => l.lowStock || (l.minStock !== null && l.available <= l.minStock))
      .map(stockRow)
      .sort(byProduct),
    outOfStock: inventory.filter((l) => l.available <= 0).map(stockRow).sort(byProduct),
    quoteRows: quotes.map((q) => ({ ...q, total: q.pendingPrices > 0 ? null : q.total })),
    orderRows: orders.map(({ items: _items, ...order }) => order),
  }
}
