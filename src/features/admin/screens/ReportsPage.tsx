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
import { Card, Field, inputClass, Notice, PageHeader, primaryButton, QueryView, secondaryButton, Stat } from '../ui'

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
  if (visible.length === 0) return <p className="text-lg text-carbon-600">{empty}</p>
  return (
    <ul className="grid gap-2 text-lg">
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
  if (rows.length === 0) return <p className="text-lg text-carbon-600">{empty}</p>
  return (
    <ul className="grid gap-2 text-lg">
      {rows.map((row) => (
        <li key={row.sku} className="flex items-center justify-between gap-4">
          <span className="min-w-0">
            {row.product} {row.variant}
          </span>
          <strong className="shrink-0 tabular-nums">
            {row.available}
            {row.minStock !== null && <span className="font-normal text-carbon-600"> (aviso en {row.minStock})</span>}
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
    <Card title="Llevar a Excel o Google Sheets">
      <p className="max-w-3xl text-lg text-carbon-600">
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

      <section aria-label="Resumen" className="grid gap-2 rounded-2xl bg-nogal p-6 text-beige sm:p-8">
        <p className="text-xl text-arena">En estos días vendiste</p>
        <p className="font-display text-4xl break-words text-marfil sm:text-6xl">{formatMoney(sales.total)}</p>
        <p className="text-xl">
          en {plural(sales.count, 'pedido confirmado', 'pedidos confirmados')}
          {sales.averageTicket !== null && <> · cada venta fue de {formatMoney(sales.averageTicket)} en promedio</>}.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Personas que escribieron" value={inquiries.conversations} hint={`${inquiries.handedOff} necesitaron al equipo`} to="/conversaciones?estado=todas" />
        <Stat label="Cotizaciones" value={quotes.total} hint={`${plural(quotes.converted, 'se volvió pedido', 'se volvieron pedido')} (${formatPercent(quotes.conversionRate)})`} to="/cotizaciones?ver=todas" />
        <Stat label="Pedidos" value={orders.total} hint={plural(sales.count, 'confirmado', 'confirmados')} to="/pedidos" />
      </div>

      <section aria-labelledby="mas-vendido" className="grid gap-4 rounded-2xl border border-linea bg-white p-6">
        <h2 id="mas-vendido" className="text-3xl">
          Lo más vendido
        </h2>
        {report.topProducts.length === 0 ? (
          <p className="text-lg text-carbon-600">Aún no hay ventas confirmadas en estos días.</p>
        ) : (
          <ol className="grid gap-2">
            {report.topProducts.map((p, i) => (
              <li key={p.description} className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-marfil px-4 py-3">
                <span className="font-display text-2xl text-madera-700">{i + 1}</span>
                <span className="grid">
                  <span className="text-lg font-bold">{p.description}</span>
                  <span className="text-base text-carbon-600">{plural(p.quantity, 'tabla')}</span>
                </span>
                <span className="text-lg font-bold">{formatMoney(p.total)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <details className="rounded-2xl border border-linea bg-white p-6">
        <summary className="cursor-pointer text-xl font-bold text-nogal">Ver más detalles (por estado, por canal y stock)</summary>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card title="Cotizaciones por estado">
            <CountList entries={quoteStatuses.map((s) => [quoteStatusLabels[s], quotes.byStatus[s] ?? 0])} empty="Sin cotizaciones en estos días." />
          </Card>
          <Card title="Pedidos por estado">
            <CountList entries={orderStatuses.map((s) => [orderStatusLabels[s], orders.byStatus[s] ?? 0])} empty="Sin pedidos en estos días." />
          </Card>
          <Card title="Cotizaciones por canal">
            <CountList entries={channelOrder.map((c) => [channelLabels[c] ?? c, quotes.byChannel[c] ?? 0])} empty="Sin cotizaciones en estos días." />
          </Card>
          <Card title="Pedidos por canal">
            <CountList entries={channelOrder.map((c) => [channelLabels[c] ?? c, orders.byChannel[c] ?? 0])} empty="Sin pedidos en estos días." />
          </Card>
          <Card title="Bajo el mínimo (hoy)">
            <StockList rows={report.lowStock} empty="Ninguna tabla está en su mínimo." />
          </Card>
          <Card title="Sin stock (hoy)">
            <StockList rows={report.outOfStock} empty="Todas las tablas tienen unidades libres." />
          </Card>
        </div>
      </details>

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
              className={`min-h-12 rounded-full border-2 px-5 text-base font-bold transition-colors ${
                active ? 'border-nogal bg-nogal text-marfil' : 'border-linea bg-white text-nogal hover:border-nogal'
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
        <p className="pb-3 text-lg font-semibold text-carbon">
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
        intro="Elige los días que quieres ver."
      />
      <RangePicker range={range} onChange={(next) => setParams({ desde: next.from, hasta: next.to }, { replace: true })} />
      <QueryView state={state} onRetry={reload}>
        {(report) => <Report report={report} />}
      </QueryView>
    </div>
  )
}
