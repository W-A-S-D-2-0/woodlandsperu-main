import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import type { ListResponse, QuoteDetail, QuoteDetailItem, QuoteListItem } from '../../../../shared/api/panel-contracts'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import {
  channelLabels,
  formatDate,
  formatDateTime,
  formatMoney,
  matchesQuoteFilter,
  parseDecimal,
  parseQuoteFilter,
  pendingPriceCount,
  quoteActions,
  quoteFilters,
  quoteNextStep,
  quoteStatusLabels,
  quoteSteps,
  quoteTone,
  whatsappLink,
  type QuoteFilter,
} from '../panel-logic'
import { useAdminAction, useAdminQuery } from '../use-admin-api'
import {
  BackLink,
  Badge,
  Card,
  dangerButton,
  EmptyState,
  Field,
  inputClass,
  NextStep,
  Notice,
  PageHeader,
  primaryButtonLarge,
  QueryView,
  secondaryButton,
  StepLine,
} from '../ui'

const missingLabel = (n: number) => (n === 1 ? 'Falta 1 precio' : `Faltan ${n} precios`)

const customerName = (quote: Pick<QuoteListItem, 'customer'>) => quote.customer?.companyName ?? quote.customer?.fullName ?? null

function QuoteCard({ quote }: { quote: QuoteListItem }) {
  return (
    <li>
      <Link
        to={`/cotizaciones/${quote.id}`}
        className="grid gap-3 rounded-2xl border border-linea bg-white p-5 transition-shadow hover:border-madera/60 hover:shadow-md focus-visible:shadow-md sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-6 sm:px-6"
      >
        <span className="grid min-w-0 gap-0.5">
          <span className="truncate text-xl font-bold text-carbon">{customerName(quote) ?? quote.code}</span>
          <span className="text-base text-carbon-600">
            {quote.code} · {formatDateTime(quote.createdAt)}
          </span>
        </span>
        <span className="flex flex-wrap gap-2 sm:justify-end">
          <Badge tone={quoteTone(quote.status)}>{quoteStatusLabels[quote.status]}</Badge>
          {quote.pendingPrices > 0 && <Badge tone="warn">{missingLabel(quote.pendingPrices)}</Badge>}
        </span>
        <span className="text-xl font-bold text-carbon sm:min-w-32 sm:text-right">
          {quote.pendingPrices > 0 ? <span className="text-lg font-semibold text-carbon-600">Por definir</span> : formatMoney(quote.total)}
        </span>
      </Link>
    </li>
  )
}

function QuoteList({ items, filter }: { items: QuoteListItem[]; filter: QuoteFilter }) {
  const [, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const active = quoteFilters.find((f) => f.id === filter) ?? quoteFilters[0]
  const term = search.trim().toLowerCase()
  const visible = items.filter(
    (q) => matchesQuoteFilter(q.status, active?.id ?? 'todas') && (!term || `${q.code} ${customerName(q) ?? ''}`.toLowerCase().includes(term)),
  )

  return (
    <div className="grid gap-5">
      <div role="group" aria-label="Ver cotizaciones" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {quoteFilters.map((f) => {
          const on = f.id === active?.id
          const count = items.filter((q) => matchesQuoteFilter(q.status, f.id)).length
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={on}
              onClick={() => setParams(f.id === 'todas' ? {} : { ver: f.id })}
              className={`inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full border-2 px-5 text-base font-bold transition-colors ${
                on ? 'border-nogal bg-nogal text-marfil' : 'border-linea bg-white text-nogal hover:border-nogal'
              }`}
            >
              {f.label}
              <span className={`min-w-7 rounded-full px-2 text-sm ${on ? 'bg-marfil text-nogal' : 'bg-beige text-nogal'}`}>{count}</span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-xl text-lg text-carbon-600">{active?.hint}</p>
        <label className="w-full sm:w-80">
          <span className="sr-only">Buscar cotización</span>
          <input type="search" className={inputClass} placeholder="Buscar por cliente o código" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
      </div>

      {visible.length === 0 ? (
        <EmptyState>{term ? 'Ninguna cotización coincide con la búsqueda.' : 'No hay cotizaciones aquí. ¡Todo al día!'}</EmptyState>
      ) : (
        <ul className="grid gap-3">
          {visible.map((q) => (
            <QuoteCard key={q.id} quote={q} />
          ))}
        </ul>
      )}
    </div>
  )
}

export function QuotesPage() {
  useDocumentTitle('Cotizaciones')
  const [params] = useSearchParams()
  const filter = parseQuoteFilter(params.get('ver'))
  const { state, reload } = useAdminQuery<ListResponse<QuoteListItem>>('/quotes')

  return (
    <div className="mx-auto grid max-w-5xl gap-8">
      <PageHeader title="Cotizaciones" />
      <QueryView state={state} onRetry={reload}>
        {({ items }) => <QuoteList items={items} filter={filter} />}
      </QueryView>
    </div>
  )
}

/** Un producto cotizado. Si falta su precio, se marca en ámbar y se escribe ahí mismo. */
function QuoteItem({ item, editable, onSaved }: { item: QuoteDetailItem; editable: boolean; onSaved: () => void }) {
  const { run, pending, error } = useAdminAction()
  const [price, setPrice] = useState(item.unitPrice?.toString() ?? '')
  const [formError, setFormError] = useState<string | null>(null)
  const missing = item.unitPrice === null

  async function save(event: FormEvent) {
    event.preventDefault()
    const value = parseDecimal(price)
    if (value === null || Number.isNaN(value)) return setFormError('Escribe un precio válido, por ejemplo 250 o 249.90.')
    setFormError(null)
    if (await run('PUT', `/quotes/items/${item.id}/price`, { unitPrice: value })) onSaved()
  }

  return (
    <li className={`grid gap-3 rounded-2xl p-4 ${missing && editable ? 'border-2 border-madera/50 bg-aviso-claro' : 'border border-linea'}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-xl font-bold">
          {item.quantity} × {item.description}
        </p>
        <p className="text-lg font-bold">{missing ? <span className="text-aviso">Falta precio</span> : formatMoney(item.lineTotal)}</p>
      </div>
      {item.customDimensions && <p className="text-base text-carbon-600">Medidas: {item.customDimensions}</p>}
      {item.customization && (
        <p className="justify-self-start rounded-xl bg-beige px-3 py-1.5 text-base font-semibold text-nogal">Grabado: {item.customization}</p>
      )}
      {editable ? (
        <form onSubmit={(e) => void save(e)} className="flex flex-wrap items-end gap-3" noValidate>
          <label className="grid gap-1 text-base font-semibold">
            Precio por unidad (S/)
            <input
              className={`${inputClass} w-40`}
              inputMode="decimal"
              value={price}
              placeholder="0.00"
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
          <button type="submit" className={secondaryButton} disabled={pending}>
            {pending ? 'Guardando…' : missing ? 'Guardar precio' : 'Cambiar precio'}
          </button>
        </form>
      ) : (
        <p className="text-base text-carbon-600">{formatMoney(item.unitPrice)} cada una</p>
      )}
      {(formError ?? error) && <p className="text-base font-semibold text-alerta">{formError ?? error}</p>}
    </li>
  )
}

function SendQuoteForm({ quote, onDone }: { quote: QuoteDetail; onDone: () => void }) {
  const { run, pending, error } = useAdminAction()
  const [discount, setDiscount] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const value = parseDecimal(discount)
    if (Number.isNaN(value)) return setFormError('El descuento no es válido.')
    setFormError(null)
    const result = await run('POST', `/quotes/${quote.id}/send`, {
      discountTotal: value ?? 0,
      validUntil: validUntil || undefined,
      deliveryEstimateNote: note.trim() || undefined,
    })
    if (result) onDone()
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="grid w-full gap-4 sm:grid-cols-2" noValidate>
      <Field label="Descuento (S/)" hint="Opcional.">
        <input className={inputClass} inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
      </Field>
      <Field label="Válida hasta" hint="Si lo dejas vacío, vale el plazo de siempre.">
        <input className={inputClass} type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Plazo de entrega estimado" hint="Por ejemplo: «10 a 15 días». Siempre es un estimado.">
          <input className={inputClass} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
      {(formError ?? error) && (
        <div className="sm:col-span-2">
          <Notice>{formError ?? error}</Notice>
        </div>
      )}
      <div className="sm:col-span-2">
        <button type="submit" className={primaryButtonLarge} disabled={pending}>
          {pending ? 'Guardando…' : 'Marcar como enviada'}
        </button>
      </div>
    </form>
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
    <form onSubmit={(e) => void submit(e)} className="grid w-full gap-4">
      <label className="flex min-h-12 items-center gap-3 text-lg">
        <input type="checkbox" className="size-6 accent-nogal" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        El cliente confirmó el pedido (así se apartan las tablas)
      </label>
      <Field label="Dirección de entrega">
        <input className={inputClass} maxLength={500} value={address} onChange={(e) => setAddress(e.target.value)} />
      </Field>
      {error && <Notice>{error}</Notice>}
      <div>
        <button type="submit" className={primaryButtonLarge} disabled={pending}>
          {pending ? 'Creando…' : 'Crear pedido'}
        </button>
      </div>
    </form>
  )
}

function AcceptButton({ quote, onDone }: { quote: QuoteDetail; onDone: () => void }) {
  const { run, pending, error } = useAdminAction()
  return (
    <div className="grid gap-3">
      <button type="button" className={primaryButtonLarge} disabled={pending} onClick={() => void run('POST', `/quotes/${quote.id}/accept`).then((r) => r && onDone())}>
        {pending ? 'Guardando…' : 'El cliente aceptó'}
      </button>
      {error && <Notice>{error}</Notice>}
    </div>
  )
}

/** Pasos de la cotización con la acción del momento dentro del recuadro «Siguiente paso». */
function QuoteProgress({ quote, reload }: { quote: QuoteDetail; reload: () => void }) {
  const missing = pendingPriceCount(quote.items)
  const actions = quoteActions(quote.status)
  const next = quoteNextStep(quote.status, missing)
  const closed = quote.status === 'rejected' || quote.status === 'expired' || quote.status === 'cancelled'
  const showSendForm = actions.includes('price_and_send') && missing === 0
  const showConvert = actions.includes('convert')

  return (
    <section aria-label="Avance de la cotización" className="grid gap-6 rounded-2xl border border-linea bg-white p-5 sm:p-7">
      {!closed && <StepLine steps={quoteSteps(quote.status, missing)} />}
      <NextStep label={closed || quote.status === 'converted' ? 'Estado' : 'Siguiente paso'} title={next.title} help={next.help}>
        {actions.includes('price_and_send') && missing > 0 && (
          <a href="#productos" className={primaryButtonLarge}>
            Ir a los precios ↓
          </a>
        )}
        {actions.includes('accept') && <AcceptButton quote={quote} onDone={reload} />}
        {quote.convertedOrderId && (
          <Link to={`/pedidos/${quote.convertedOrderId}`} className={primaryButtonLarge}>
            Ver el pedido
          </Link>
        )}
        {(showSendForm || showConvert) && (
          <div className="w-full border-t border-linea pt-5">
            {showSendForm ? <SendQuoteForm quote={quote} onDone={reload} /> : <ConvertForm quote={quote} />}
          </div>
        )}
      </NextStep>
    </section>
  )
}

function QuoteCustomer({ quote }: { quote: QuoteDetail }) {
  const customer = quote.customer
  const wa = whatsappLink(customer?.phone)
  return (
    <Card title="Cliente">
      {customer ? (
        <div className="grid gap-2 text-lg">
          <Link to={`/clientes/${customer.id}`} className="text-xl font-bold text-nogal hover:underline">
            {customer.companyName ?? customer.fullName}
          </Link>
          {customer.companyName && <p className="text-carbon-600">Contacto: {customer.fullName}</p>}
          {customer.phone && <p className="text-carbon-600">Celular: {customer.phone}</p>}
          {customer.email && <p className="break-all text-carbon-600">{customer.email}</p>}
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className={`${secondaryButton} mt-2`}>
              Escribir por WhatsApp
            </a>
          )}
        </div>
      ) : (
        <p className="text-lg text-carbon-600">Sin datos del cliente.</p>
      )}
      {quote.customerMessage && (
        <figure className="mt-4 grid gap-1 rounded-xl bg-beige/60 p-4">
          <figcaption className="text-base font-semibold text-carbon-600">Lo que escribió el cliente</figcaption>
          <blockquote className="text-lg">“{quote.customerMessage}”</blockquote>
        </figure>
      )}
    </Card>
  )
}

/** Archivar va aparte y abajo, con confirmación. */
function ArchiveQuote({ quote, onDone }: { quote: QuoteDetail; onDone: () => void }) {
  const { run, pending, error } = useAdminAction()
  const [asking, setAsking] = useState(false)

  return (
    <section aria-labelledby="archivar" className="grid gap-4 rounded-2xl border-2 border-dashed border-alerta/30 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 id="archivar" className="font-sans text-xl font-bold text-alerta">
            ¿Es una prueba o el cliente la descartó?
          </h2>
          <p className="text-lg text-carbon-600">Archivarla la quita de la lista. No se borra, pero ya no se puede reabrir.</p>
        </div>
        {asking ? (
          <div className="flex flex-wrap gap-3">
            <button type="button" className={dangerButton} disabled={pending} onClick={() => void run('POST', `/quotes/${quote.id}/cancel`).then((r) => r && onDone())}>
              {pending ? 'Archivando…' : 'Sí, archivar'}
            </button>
            <button type="button" className={secondaryButton} disabled={pending} onClick={() => setAsking(false)}>
              No
            </button>
          </div>
        ) : (
          <button type="button" className={dangerButton} onClick={() => setAsking(true)}>
            Archivar cotización
          </button>
        )}
      </div>
      {error && <Notice>{error}</Notice>}
    </section>
  )
}

function QuoteView({ quote, reload }: { quote: QuoteDetail; reload: () => void }) {
  const actions = quoteActions(quote.status)
  const editable = actions.includes('price_and_send')
  const missing = pendingPriceCount(quote.items)

  return (
    <div className="mt-2 grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-4xl">{customerName(quote) ?? quote.code}</h1>
          <p className="text-lg text-carbon-600">
            Cotización {quote.code} · {channelLabels[quote.channel] ?? quote.channel} · {formatDateTime(quote.createdAt)}
          </p>
        </div>
        <div className="grid justify-items-start gap-1 sm:justify-items-end">
          <Badge tone={quoteTone(quote.status)}>{quoteStatusLabels[quote.status]}</Badge>
          <p className="font-display text-4xl text-nogal">{missing > 0 ? 'Por definir' : formatMoney(quote.total)}</p>
        </div>
      </header>

      <QuoteProgress quote={quote} reload={reload} />

      <div className="grid items-start gap-6 lg:grid-cols-[3fr_2fr]">
        <Card title="Qué pidió" id="productos" className="scroll-mt-6">
          <ul className="grid gap-3">
            {quote.items.map((item) => (
              <QuoteItem key={`${item.id}-${item.unitPrice}`} item={item} editable={editable} onSaved={reload} />
            ))}
          </ul>
          <dl className="mt-5 grid gap-1 border-t border-linea pt-4 text-lg">
            {missing > 0 ? (
              <div className="flex justify-between text-carbon-600">
                <dt>Total</dt>
                <dd>Por definir ({missingLabel(missing).toLowerCase()})</dd>
              </div>
            ) : (
              <>
                {quote.discountTotal > 0 && (
                  <>
                    <div className="flex justify-between text-carbon-600">
                      <dt>Subtotal</dt>
                      <dd>{formatMoney(quote.subtotal)}</dd>
                    </div>
                    <div className="flex justify-between text-carbon-600">
                      <dt>Descuento</dt>
                      <dd>− {formatMoney(quote.discountTotal)}</dd>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-xl font-bold">
                  <dt>Total</dt>
                  <dd>{formatMoney(quote.total)}</dd>
                </div>
              </>
            )}
          </dl>
        </Card>
        <div className="grid gap-6">
          <QuoteCustomer quote={quote} />
          <Card title="Detalles">
            <dl className="grid gap-2 text-lg">
              <div>
                <dt className="inline font-semibold">Válida hasta: </dt>
                <dd className="inline text-carbon-600">{quote.validUntil ? formatDate(quote.validUntil) : 'aún sin enviar'}</dd>
              </div>
              {quote.deliveryEstimateNote && (
                <div>
                  <dt className="inline font-semibold">Plazo estimado: </dt>
                  <dd className="inline text-carbon-600">{quote.deliveryEstimateNote}</dd>
                </div>
              )}
              {quote.reviewReason && (
                <div>
                  <dt className="inline font-semibold">Por qué pasó a revisión: </dt>
                  <dd className="inline text-carbon-600">{quote.reviewReason}</dd>
                </div>
              )}
            </dl>
          </Card>
        </div>
      </div>

      {actions.includes('archive') && <ArchiveQuote quote={quote} onDone={reload} />}
    </div>
  )
}

export function QuoteDetailPage() {
  const { id = '' } = useParams()
  const { state, reload } = useAdminQuery<QuoteDetail>(`/quotes/${id}`)
  useDocumentTitle(state.status === 'ok' ? state.data.code : 'Cotización')

  return (
    <div className="mx-auto max-w-5xl">
      <BackLink to="/cotizaciones">Volver a cotizaciones</BackLink>
      <QueryView state={state} onRetry={reload}>
        {(quote) => <QuoteView quote={quote} reload={reload} />}
      </QueryView>
    </div>
  )
}
