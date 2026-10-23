import { useState } from 'react'
import { useSearchParams } from 'react-router'
import type { ReportExportResponse, ReportPayload, ReportStockRow, SalesChannel } from '../../../../shared/api/panel-contracts'
import { orderStatuses, quoteStatuses } from '../../../../shared/api/panel-schemas'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { channelLabels, formatDate, formatMoney, orderStatusLabels, plural, quoteStatusLabels } from '../panel-logic'
import {
  formatPercent,
  presetRange,
  rangeFromParams,
  reportFileName,
  reportPresets,
  reportSheetRows,
  reportSheets,
  toCsv,
  type DateRange,
  type ReportSheet,
} from '../report-logic'
import { useAdminAction, useAdminQuery } from '../use-admin-api'
import { Card, DataTable, Field, inputClass, Notice, PageHeader, primaryButton, QueryView, secondaryButton, Stat } from '../ui'

const channelOrder: SalesChannel[] = ['web', 'web_chat', 'whatsapp', 'admin']

/** Descarga un CSV. El BOM hace que tildes y "ñ" se lean bien al abrirlo o importarlo. */
function downloadCsv(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

function CountList({ entries, empty }: { entries: [string, number][]; empty: string }) {
  const visible = entries.filter(([, count]) => count > 0)
  if (visible.length === 0) return <p className="text-sm text-carbon-600">{empty}</p>
  return (
    <ul className="grid gap-2 text-sm">
      {visible.map(([label, count]) => (
        <li key={label} className="flex items-center justify-between gap-4">
          <span>{label}</span>
          <strong className="tabular-nums">{count}</strong>
        </li>
      ))}
    </ul>
  )
}

function StockList({ rows, empty }: { rows: ReportStockRow[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-carbon-600">{empty}</p>
  return (
    <ul className="grid gap-2 text-sm">
      {rows.map((row) => (
        <li key={row.sku} className="flex items-center justify-between gap-4">
          <span className="min-w-0">
            {row.product} · {row.variant} <span className="text-xs text-carbon-600">({row.sku})</span>
          </span>
          <strong className="shrink-0 tabular-nums">
            {row.available}
            {row.minStock !== null && <span className="font-normal text-carbon-600"> / mín. {row.minStock}</span>}
          </strong>
        </li>
      ))}
    </ul>
  )
}

function ExportCard({ report }: { report: ReportPayload }) {
  const download = (sheet: ReportSheet) => downloadCsv(reportFileName(report, sheet), toCsv(reportSheetRows(report, sheet)))
  const { run, pending, error, clearError } = useAdminAction()
  const [sent, setSent] = useState<ReportExportResponse | null>(null)

  async function sendToSheets() {
    clearError()
    setSent(null)
    const result = await run<ReportExportResponse>('POST', `/reports/export?from=${report.range.from}&to=${report.range.to}`)
    if (result) setSent(result)
  }

  return (
    <Card title="Exportar a Google Sheets">
      <p className="max-w-3xl text-sm text-carbon-600">
        {report.canExport ? (
          <>
            «Enviar a Google Sheets» vacía y reescribe las hojas Resumen, Cotizaciones y Pedidos de la hoja de cálculo de Woodland con este
            rango. También puedes descargar cada hoja en CSV.
          </>
        ) : (
          <>
            Descarga cada hoja en CSV y súbela en Google Sheets con <strong className="text-carbon">Archivo › Importar › Subir</strong>. Para
            tenerlas juntas, impórtalas en el mismo archivo con «Insertar hojas nuevas».
          </>
        )}{' '}
        La exportación es de una sola vía: lo que cambies en Sheets no vuelve al panel.
      </p>
      {error && (
        <div className="mt-3">
          <Notice>{error}</Notice>
        </div>
      )}
      {sent && (
        <div className="mt-3">
          <Notice kind="info">
            Reporte enviado.{' '}
            <a className="font-semibold underline" href={sent.spreadsheetUrl} target="_blank" rel="noreferrer">
              Abrir la hoja de cálculo
            </a>
          </Notice>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        {report.canExport && (
          <button type="button" className={primaryButton} disabled={pending} onClick={() => void sendToSheets()}>
            {pending ? 'Enviando…' : 'Enviar a Google Sheets'}
          </button>
        )}
        {reportSheets.map((sheet) => (
          <button key={sheet.key} type="button" className={secondaryButton} onClick={() => download(sheet.key)}>
            Descargar {sheet.label.toLowerCase()}
          </button>
        ))}
      </div>
    </Card>
  )
}

function Report({ report }: { report: ReportPayload }) {
  const { inquiries, quotes, orders, sales } = report
  return (
    <div className="grid gap-8">
      {report.truncated && (
        <Notice>El rango tiene demasiados registros y las cifras pueden quedar cortas. Elige un rango más corto.</Notice>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label="Consultas"
          value={inquiries.conversations}
          hint={`Chat web ${inquiries.byChannel.web_chat} · WhatsApp ${inquiries.byChannel.whatsapp}`}
          to="/conversaciones?estado=todas"
        />
        <Stat label="Con seguimiento del equipo" value={inquiries.handedOff} hint="Consultas que el asistente dejó para revisión" />
        <Stat
          label="Cotizaciones"
          value={quotes.total}
          hint={`${plural(quotes.converted, 'convertida', 'convertidas')} en pedido · ${formatPercent(quotes.conversionRate)}`}
          to="/cotizaciones"
        />
        <Stat label="Pedidos" value={orders.total} hint={plural(sales.count, 'venta confirmada', 'ventas confirmadas')} to="/pedidos" />
        <Stat label="Monto vendido" value={formatMoney(sales.total)} hint="Pedidos confirmados o más avanzados" />
        <Stat label="Ticket promedio" value={formatMoney(sales.averageTicket)} hint="Monto vendido entre ventas confirmadas" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Cotizaciones por estado">
          <CountList
            entries={quoteStatuses.map((s) => [quoteStatusLabels[s], quotes.byStatus[s] ?? 0])}
            empty="Sin cotizaciones en este rango."
          />
        </Card>
        <Card title="Pedidos por estado">
          <CountList entries={orderStatuses.map((s) => [orderStatusLabels[s], orders.byStatus[s] ?? 0])} empty="Sin pedidos en este rango." />
        </Card>
        <Card title="Cotizaciones por canal">
          <CountList
            entries={channelOrder.map((c) => [channelLabels[c] ?? c, quotes.byChannel[c] ?? 0])}
            empty="Sin cotizaciones en este rango."
          />
        </Card>
        <Card title="Pedidos por canal">
          <CountList entries={channelOrder.map((c) => [channelLabels[c] ?? c, orders.byChannel[c] ?? 0])} empty="Sin pedidos en este rango." />
        </Card>
        <Card title="Bajo mínimo">
          <StockList
            rows={report.lowStock}
            empty="Ninguna variante está en su mínimo. Configura el stock mínimo de cada variante en Inventario para recibir alertas."
          />
        </Card>
        <Card title="Sin stock">
          <StockList rows={report.outOfStock} empty="Todas las variantes tienen unidades disponibles." />
        </Card>
      </div>

      {report.topProducts.length === 0 ? (
        <Card title="Lo más vendido">
          <p className="text-sm text-carbon-600">Aún no hay ventas confirmadas en este rango.</p>
        </Card>
      ) : (
        <section className="grid gap-3" aria-labelledby="mas-vendido">
          <h2 id="mas-vendido" className="font-sans text-sm font-semibold tracking-[0.12em] text-madera-700 uppercase">
            Lo más vendido
          </h2>
          <DataTable caption="Lo más vendido" head={['Producto', 'Unidades', 'Monto']}>
            {report.topProducts.map((p) => (
              <tr key={p.description}>
                <td className="px-4 py-3">{p.description}</td>
                <td className="px-4 py-3 tabular-nums">{p.quantity}</td>
                <td className="px-4 py-3 tabular-nums">{formatMoney(p.total)}</td>
              </tr>
            ))}
          </DataTable>
        </section>
      )}

      <ExportCard report={report} />
    </div>
  )
}

function RangePicker({ range, onChange }: { range: DateRange; onChange: (range: DateRange) => void }) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Rangos rápidos">
        {reportPresets.map((preset) => {
          const value = presetRange(preset.key)
          const active = value.from === range.from && value.to === range.to
          return (
            <button
              key={preset.key}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(value)}
              className={`min-h-11 rounded-full border px-4 text-sm font-medium transition-colors ${
                active ? 'border-nogal bg-nogal text-marfil' : 'border-nogal/30 text-nogal hover:bg-nogal/5'
              }`}
            >
              {preset.label}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-44">
          <Field label="Desde">
            <input
              type="date"
              className={inputClass}
              value={range.from}
              max={range.to}
              onChange={(e) => e.target.value && onChange({ from: e.target.value, to: range.to })}
            />
          </Field>
        </div>
        <div className="w-44">
          <Field label="Hasta">
            <input
              type="date"
              className={inputClass}
              value={range.to}
              min={range.from}
              onChange={(e) => e.target.value && onChange({ from: range.from, to: e.target.value })}
            />
          </Field>
        </div>
        <p className="pb-3 text-sm text-carbon-600">
          {formatDate(range.from)} – {formatDate(range.to)}
        </p>
      </div>
    </div>
  )
}

export function ReportsPage() {
  useDocumentTitle('Reportes')
  const [params, setParams] = useSearchParams()
  const range = rangeFromParams(params)
  const { state, reload } = useAdminQuery<ReportPayload>(`/reports?from=${range.from}&to=${range.to}`)

  return (
    <div className="mx-auto grid max-w-6xl gap-8">
      <PageHeader
        title="Reportes"
        intro="Indicadores comerciales por rango de fechas (días de Lima) y exportación a Google Sheets. Inventario muestra el estado actual."
      />
      <RangePicker range={range} onChange={(next) => setParams({ desde: next.from, hasta: next.to }, { replace: true })} />
      <QueryView state={state} onRetry={reload}>
        {(report) => <Report report={report} />}
      </QueryView>
    </div>
  )
}
