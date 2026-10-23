import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import type { ListResponse, QuoteDetail, QuoteDetailItem, QuoteListItem } from '../../../../shared/api/panel-contracts'
import { quoteStatuses } from '../../../../shared/api/panel-schemas'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import {
  channelLabels,
  formatDate,
  formatDateTime,
  formatMoney,
  parseDecimal,
  pendingPriceCount,
  plural,
  quoteActions,
  quoteStatusLabels,
  quoteTone,
} from '../panel-logic'
import { useAdminAction, useAdminQuery } from '../use-admin-api'
import {
  BackLink,
  Badge,
  Card,
  DataTable,
  EmptyState,
  dangerButton,
  Field,
  inputClass,
  Notice,
  PageHeader,
  primaryButton,
  QueryView,
  secondaryButton,
} from '../ui'

export function QuotesPage() {
  useDocumentTitle('Cotizaciones')
  const [params, setParams] = useSearchParams()
  const status = quoteStatuses.find((s) => s === params.get('status'))
  const { state, reload } = useAdminQuery<ListResponse<QuoteListItem>>(status ? `/quotes?status=${status}` : '/quotes')

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <PageHeader
        title="Cotizaciones"
        intro="Solicitudes de clientes. Los importes los calcula el servidor; aquí se revisan, se fija el precio de lo personalizado y se envían."
      />
      <div className="max-w-xs">
        <Field label="Estado">
          <select
            className={inputClass}
            value={status ?? ''}
            onChange={(e) => setParams(e.target.value ? { status: e.target.value } : {})}
          >
            <option value="">Todas</option>
            {quoteStatuses.map((s) => (
              <option key={s} value={s}>
                {quoteStatusLabels[s]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <QueryView state={state} onRetry={reload}>
        {({ items: all }) => {
          // Las archivadas (canceladas) solo se ven al filtrar por ese estado: así la lista queda limpia.
          const items = status ? all : all.filter((q) => q.status !== 'cancelled')
          return items.length === 0 ? (
            <EmptyState>No hay cotizaciones con este filtro.</EmptyState>
          ) : (
            <DataTable caption="Cotizaciones" head={['Código', 'Cliente', 'Estado', 'Total', 'Recibida']}>
              {items.map((q) => (
                <tr key={q.id}>
                  <td className="px-4 py-3">
                    <Link to={`/cotizaciones/${q.id}`} className="whitespace-nowrap font-semibold text-nogal hover:underline">
                      {q.code}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{q.customer?.companyName ?? q.customer?.fullName ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge tone={quoteTone(q.status)}>
                      {quoteStatusLabels[q.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {q.pendingPrices > 0 ? (
                      <>
                        <span className="text-carbon-600">Por definir</span>
                        <span className="block text-xs text-carbon-600">{plural(q.pendingPrices, 'precio pendiente', 'precios pendientes')}</span>
                      </>
                    ) : (
                      formatMoney(q.total)
                    )}
                  </td>
                  <td className="px-4 py-3 text-carbon-600">{formatDateTime(q.createdAt)}</td>
                </tr>
              ))}
            </DataTable>
          )
        }}
      </QueryView>
    </div>
  )
}

function ItemPriceRow({ item, editable, onSaved }: { item: QuoteDetailItem; editable: boolean; onSaved: () => void }) {
  const { run, pending, error } = useAdminAction()
  const [price, setPrice] = useState(item.unitPrice?.toString() ?? '')
  const [formError, setFormError] = useState<string | null>(null)

  async function save(event: FormEvent) {
    event.preventDefault()
    const value = parseDecimal(price)
    if (value === null || Number.isNaN(value)) return setFormError('Precio no válido (máximo 2 decimales).')
    setFormError(null)
    if (await run('PUT', `/quotes/items/${item.id}/price`, { unitPrice: value })) onSaved()
  }

  return (
    <tr>
      <td className="px-4 py-3">
        <p className="font-medium">{item.description}</p>
        {item.customDimensions && <p className="text-xs text-carbon-600">Medidas: {item.customDimensions}</p>}
        {item.customization && <p className="text-xs text-carbon-600">Personalización: {item.customization}</p>}
        {(formError ?? error) && <p className="mt-1 text-xs text-madera-700">{formError ?? error}</p>}
      </td>
      <td className="px-4 py-3">{item.quantity}</td>
      <td className="px-4 py-3">
        {editable ? (
          <form onSubmit={(e) => void save(e)} className="flex items-center gap-2" noValidate>
            <input
              aria-label={`Precio unitario de ${item.description}`}
              className={`${inputClass} w-28`}
              inputMode="decimal"
              value={price}
              placeholder="S/"
              onChange={(e) => setPrice(e.target.value)}
            />
            <button type="submit" className={secondaryButton} disabled={pending}>
              Fijar
            </button>
          </form>
        ) : (
          formatMoney(item.unitPrice)
        )}
      </td>
      <td className="px-4 py-3">{formatMoney(item.lineTotal)}</td>
    </tr>
  )
}

function SendQuoteForm({ quote, onDone }: { quote: QuoteDetail; onDone: () => void }) {
  const { run, pending, error } = useAdminAction()
  const [discount, setDiscount] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const missing = pendingPriceCount(quote.items)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const value = parseDecimal(discount)
    if (Number.isNaN(value)) return setFormError('Descuento no válido.')
    setFormError(null)
    const result = await run('POST', `/quotes/${quote.id}/send`, {
      discountTotal: value ?? 0,
      validUntil: validUntil || undefined,
      deliveryEstimateNote: note.trim() || undefined,
    })
    if (result) onDone()
  }

  return (
    <Card title="Enviar al cliente">
      {missing > 0 && <Notice kind="info">Antes de enviar, define {missing === 1 ? 'el precio que falta' : `los ${missing} precios que faltan`} en la tabla de productos.</Notice>}
      <form onSubmit={(e) => void submit(e)} className="mt-3 grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Descuento (S/)" hint="Opcional. No puede superar el subtotal.">
          <input className={inputClass} inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </Field>
        <Field label="Válida hasta" hint="Vacío = vigencia configurada por la empresa.">
          <input className={inputClass} type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Plazo estimado" hint="Siempre estimado y sujeto a confirmación.">
            <input className={inputClass} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-3 sm:col-span-2">
          {(formError ?? error) && <Notice>{formError ?? error}</Notice>}
          <div>
            <button type="submit" className={primaryButton} disabled={pending || missing > 0}>
              {pending ? 'Enviando…' : 'Marcar como enviada'}
            </button>
          </div>
        </div>
      </form>
    </Card>
  )
}

function ConvertForm({ quote }: { quote: QuoteDetail }) {
  const navigate = useNavigate()
  const { run, pending, error } = useAdminAction()
  const [confirmed, setConfirmed] = useState(false)
  const [address, setAddress] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    const result = await run<{ orderId: string }>('POST', `/quotes/${quote.id}/convert`, {
      customerConfirmed: confirmed,
      shippingAddress: address.trim() || undefined,
    })
    if (result) void navigate(`/pedidos/${result.orderId}`)
  }

  return (
    <Card title="Convertir en pedido">
      <form onSubmit={(e) => void submit(e)} className="grid gap-4">
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" className="h-5 w-5 accent-nogal" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          El cliente confirmó el pedido (necesario para reservar el stock)
        </label>
        <Field label="Dirección de entrega">
          <input className={inputClass} maxLength={500} value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        {error && <Notice>{error}</Notice>}
        <div>
          <button type="submit" className={primaryButton} disabled={pending}>
            {pending ? 'Creando…' : 'Crear pedido'}
          </button>
        </div>
      </form>
    </Card>
  )
}

function ArchiveQuote({ quote, onDone }: { quote: QuoteDetail; onDone: () => void }) {
  const { run, pending, error } = useAdminAction()
  const [asking, setAsking] = useState(false)

  return (
    <Card title="Archivar cotización">
      <p className="text-sm text-carbon-600">
        Para solicitudes de prueba o que el cliente descartó. Sale de la lista (se ve filtrando por “Cancelada”); no se borra ni se puede reabrir.
      </p>
      {error && <div className="mt-3"><Notice>{error}</Notice></div>}
      <div className="mt-3 flex flex-wrap gap-3">
        {asking ? (
          <>
            <button type="button" className={dangerButton} disabled={pending} onClick={() => void run('POST', `/quotes/${quote.id}/cancel`).then((r) => r && onDone())}>
              {pending ? 'Archivando…' : `Sí, archivar ${quote.code}`}
            </button>
            <button type="button" className={secondaryButton} disabled={pending} onClick={() => setAsking(false)}>
              No
            </button>
          </>
        ) : (
          <button type="button" className={secondaryButton} onClick={() => setAsking(true)}>
            Archivar
          </button>
        )}
      </div>
    </Card>
  )
}

function QuoteView({ quote, reload }: { quote: QuoteDetail; reload: () => void }) {
  const actions = quoteActions(quote.status)
  const accept = useAdminAction()
  const editable = actions.includes('price_and_send')
  const missing = pendingPriceCount(quote.items)

  return (
    <div className="mt-6 grid gap-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Cliente" className="lg:col-span-2">
          {quote.customer ? (
            <p className="text-sm">
              <Link to={`/clientes/${quote.customer.id}`} className="font-semibold text-nogal hover:underline">
                {quote.customer.companyName ?? quote.customer.fullName}
              </Link>
              {quote.customer.companyName && <span> · {quote.customer.fullName}</span>}
              <br />
              <span className="text-carbon-600">{[quote.customer.email, quote.customer.phone].filter(Boolean).join(' · ')}</span>
            </p>
          ) : (
            <p className="text-sm text-carbon-600">Sin datos de cliente.</p>
          )}
          {quote.customerMessage && <p className="mt-3 rounded-lg bg-beige/50 p-3 text-sm">“{quote.customerMessage}”</p>}
        </Card>
        <Card title="Estado">
          <p className="flex flex-wrap items-center gap-2">
            <Badge tone={quoteTone(quote.status)}>{quoteStatusLabels[quote.status]}</Badge>
            <span className="text-xs text-carbon-600">{channelLabels[quote.channel] ?? quote.channel}</span>
          </p>
          {quote.reviewReason && <p className="mt-3 text-xs text-carbon-600">Revisión: {quote.reviewReason}</p>}
          <p className="mt-3 text-xs text-carbon-600">
            Vigencia: {formatDate(quote.validUntil)}
            {quote.deliveryEstimateNote && <> · {quote.deliveryEstimateNote}</>}
          </p>
          {quote.convertedOrderId && (
            <Link to={`/pedidos/${quote.convertedOrderId}`} className="mt-3 inline-block text-sm font-medium text-madera-700 hover:underline">
              Ver pedido →
            </Link>
          )}
        </Card>
      </div>

      <DataTable caption="Productos cotizados" head={['Producto', 'Cant.', 'Precio unitario', 'Total']}>
        {quote.items.map((item) => (
          <ItemPriceRow key={`${item.id}-${item.unitPrice}`} item={item} editable={editable} onSaved={reload} />
        ))}
      </DataTable>
      {missing > 0 ? (
        <p className="text-right text-sm text-carbon-600">
          Total por definir: {plural(missing, 'precio pendiente', 'precios pendientes')}
          {quote.subtotal > 0 && <> · Subtotal parcial {formatMoney(quote.subtotal)}</>}
        </p>
      ) : (
        <p className="text-right text-sm">
          Subtotal {formatMoney(quote.subtotal)}
          {quote.discountTotal > 0 && <> · Descuento {formatMoney(quote.discountTotal)}</>} ·{' '}
          <strong className="text-base">Total {formatMoney(quote.total)}</strong>
        </p>
      )}

      {editable && <SendQuoteForm quote={quote} onDone={reload} />}
      {actions.includes('accept') && (
        <Card title="Respuesta del cliente">
          <p className="text-sm text-carbon-600">Cuando el cliente acepte la propuesta, regístralo aquí.</p>
          {accept.error && <div className="mt-3"><Notice>{accept.error}</Notice></div>}
          <button
            type="button"
            className={`${primaryButton} mt-3`}
            disabled={accept.pending}
            onClick={() => void accept.run('POST', `/quotes/${quote.id}/accept`).then((r) => r && reload())}
          >
            {accept.pending ? 'Registrando…' : 'El cliente aceptó'}
          </button>
        </Card>
      )}
      {actions.includes('convert') && <ConvertForm quote={quote} />}
      {actions.includes('archive') && <ArchiveQuote quote={quote} onDone={reload} />}
    </div>
  )
}

export function QuoteDetailPage() {
  const { id = '' } = useParams()
  const { state, reload } = useAdminQuery<QuoteDetail>(`/quotes/${id}`)
  useDocumentTitle(state.status === 'ok' ? state.data.code : 'Cotización')

  return (
    <div className="mx-auto max-w-6xl">
      <BackLink to="/cotizaciones">Cotizaciones</BackLink>
      <QueryView state={state} onRetry={reload}>
        {(quote) => (
          <>
            <PageHeader title={quote.code} intro={`Recibida el ${formatDateTime(quote.createdAt)}`} />
            <QuoteView quote={quote} reload={reload} />
          </>
        )}
      </QueryView>
    </div>
  )
}
