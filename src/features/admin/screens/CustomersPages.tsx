import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import type { CustomerDetail, CustomerListItem, ListResponse } from '../../../../shared/api/panel-contracts'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { formatDateTime, formatMoney, orderStatusLabels, orderTone, plural, quoteStatusLabels, quoteTone, whatsappLink } from '../panel-logic'
import { customerSummary, customerTypeLabels } from '../people-logic'
import { useAdminAction, useAdminQuery } from '../use-admin-api'
import { BackLink, Badge, Card, EmptyState, Field, inputClass, Notice, PageHeader, primaryButton, QueryView, secondaryButton } from '../ui'

const monthYear = new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric', timeZone: 'America/Lima' })

function CustomerCard({ customer }: { customer: CustomerListItem }) {
  return (
    <li>
      <Link
        to={`/clientes/${customer.id}`}
        className="grid gap-2 rounded-2xl border border-linea bg-white p-5 transition-shadow hover:border-madera/60 hover:shadow-md focus-visible:shadow-md sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6 sm:px-6"
      >
        <span className="grid min-w-0 gap-0.5">
          <span className="truncate text-xl font-bold text-carbon">{customer.companyName ?? customer.fullName}</span>
          {customer.companyName && <span className="text-base text-carbon-600">Contacto: {customer.fullName}</span>}
          <span className="truncate text-base text-carbon-600">{[customer.phone, customer.email].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</span>
        </span>
        <span className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Badge tone={customer.customerType === 'business' ? 'info' : 'neutral'}>{customerTypeLabels[customer.customerType]}</Badge>
          <span className="text-sm text-carbon-600">desde {monthYear.format(new Date(customer.createdAt))}</span>
        </span>
      </Link>
    </li>
  )
}

export function CustomersPage() {
  useDocumentTitle('Clientes')
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const [draft, setDraft] = useState(search)
  const path = search ? `/customers?search=${encodeURIComponent(search)}` : '/customers'
  const { state, reload } = useAdminQuery<ListResponse<CustomerListItem>>(path)

  return (
    <div className="mx-auto grid max-w-5xl gap-8">
      <PageHeader title="Clientes" />
      <form
        role="search"
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          setParams(draft.trim() ? { q: draft.trim() } : {})
        }}
      >
        <div className="min-w-0 flex-1 basis-72">
          <Field label="Buscar por nombre, empresa, correo o celular">
            <input className={inputClass} type="search" value={draft} maxLength={80} onChange={(e) => setDraft(e.target.value)} />
          </Field>
        </div>
        <button type="submit" className={primaryButton}>
          Buscar
        </button>
        {search && (
          <button
            type="button"
            className={secondaryButton}
            onClick={() => {
              setDraft('')
              setParams({})
            }}
          >
            Ver todos
          </button>
        )}
      </form>
      <QueryView state={state} onRetry={reload}>
        {({ items }) => (
          <div className="grid gap-4">
            <p className="text-lg text-carbon-600">
              <strong className="text-carbon">{plural(items.length, 'cliente')}</strong>
              {search ? ` con «${search}».` : ', del más reciente al más antiguo.'}
            </p>
            {items.length === 0 ? (
              <EmptyState>No se encontraron clientes.</EmptyState>
            ) : (
              <ul className="grid gap-3">
                {items.map((c) => (
                  <CustomerCard key={c.id} customer={c} />
                ))}
              </ul>
            )}
          </div>
        )}
      </QueryView>
    </div>
  )
}

function NoteForm({ customerId, onDone }: { customerId: string; onDone: () => void }) {
  const { run, pending, error } = useAdminAction()
  const [body, setBody] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!body.trim()) return
    if (await run('POST', `/customers/${customerId}/notes`, { body: body.trim() })) {
      setBody('')
      onDone()
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="grid gap-3">
      <Field label="Agregar una nota" hint="Solo la ve el equipo, nunca el cliente.">
        <textarea className={`${inputClass} py-3`} rows={3} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>
      {error && <Notice>{error}</Notice>}
      <div>
        <button type="submit" className={primaryButton} disabled={pending || !body.trim()}>
          {pending ? 'Guardando…' : 'Guardar nota'}
        </button>
      </div>
    </form>
  )
}

/** Fila que se toca completa para abrir un pedido o una cotización del cliente. */
function HistoryRow({ to, code, date, badge, total }: { to: string; code: string; date: string; badge: ReactNode; total: string }) {
  return (
    <li>
      <Link to={to} className="grid gap-2 rounded-xl border border-linea p-4 transition-colors hover:border-madera/60 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-4">
        <span className="grid">
          <span className="text-lg font-bold text-carbon">{code}</span>
          <span className="text-base text-carbon-600">{formatDateTime(date)}</span>
        </span>
        {badge}
        <span className="text-lg font-bold text-carbon sm:min-w-28 sm:text-right">{total}</span>
      </Link>
    </li>
  )
}

function CustomerView({ c, reload }: { c: CustomerDetail; reload: () => void }) {
  const summary = customerSummary(c)
  const wa = whatsappLink(c.phone)

  return (
    <div className="mt-2 grid gap-6">
      <header className="grid gap-4">
        <div className="grid gap-1">
          <h1 className="text-4xl">{c.companyName ?? c.fullName}</h1>
          <p className="text-lg text-carbon-600">
            {customerTypeLabels[c.customerType]} · cliente desde {monthYear.format(new Date(c.createdAt))}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {c.phone && (
            <a href={`tel:${c.phone}`} className={primaryButton}>
              Llamar
            </a>
          )}
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className={secondaryButton}>
              Escribir por WhatsApp
            </a>
          )}
          {c.email && (
            <a href={`mailto:${c.email}`} className={secondaryButton}>
              Enviar correo
            </a>
          )}
        </div>
      </header>

      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-nogal p-5 text-beige">
          <dt className="text-lg text-arena">Ha comprado</dt>
          <dd className="font-display text-4xl text-marfil">{formatMoney(summary.spent)}</dd>
        </div>
        <div className="rounded-2xl border border-linea bg-white p-5">
          <dt className="text-lg text-carbon-600">Pedidos</dt>
          <dd className="font-display text-4xl text-nogal">{summary.orders}</dd>
        </div>
        <div className="rounded-2xl border border-linea bg-white p-5">
          <dt className="text-lg text-carbon-600">Cotizaciones</dt>
          <dd className="font-display text-4xl text-nogal">{summary.quotes}</dd>
        </div>
      </dl>

      <div className="grid items-start gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="grid gap-6">
          <Card title="Pedidos">
            {c.orders.length === 0 ? (
              <p className="text-lg text-carbon-600">Todavía no tiene pedidos.</p>
            ) : (
              <ul className="grid gap-2">
                {c.orders.map((o) => (
                  <HistoryRow key={o.id} to={`/pedidos/${o.id}`} code={o.code} date={o.createdAt} badge={<Badge tone={orderTone(o.status)}>{orderStatusLabels[o.status]}</Badge>} total={formatMoney(o.total)} />
                ))}
              </ul>
            )}
          </Card>
          <Card title="Cotizaciones">
            {c.quotes.length === 0 ? (
              <p className="text-lg text-carbon-600">Todavía no tiene cotizaciones.</p>
            ) : (
              <ul className="grid gap-2">
                {c.quotes.map((q) => (
                  <HistoryRow
                    key={q.id}
                    to={`/cotizaciones/${q.id}`}
                    code={q.code}
                    date={q.createdAt}
                    badge={<Badge tone={quoteTone(q.status)}>{quoteStatusLabels[q.status]}</Badge>}
                    total={q.total > 0 ? formatMoney(q.total) : 'Por definir'}
                  />
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="grid gap-6">
          <Card title="Datos">
            <dl className="grid gap-2 text-lg">
              {c.companyName && (
                <div>
                  <dt className="inline font-semibold">Contacto: </dt>
                  <dd className="inline text-carbon-600">{c.fullName}</dd>
                </div>
              )}
              <div>
                <dt className="inline font-semibold">Celular: </dt>
                <dd className="inline text-carbon-600">{c.phone ?? '—'}</dd>
              </div>
              <div>
                <dt className="inline font-semibold">Correo: </dt>
                <dd className="inline break-all text-carbon-600">{c.email ?? '—'}</dd>
              </div>
              {c.documentType && (
                <div>
                  <dt className="inline font-semibold">{c.documentType}: </dt>
                  <dd className="inline text-carbon-600">{c.documentNumber}</dd>
                </div>
              )}
            </dl>
          </Card>

          <Card title="Notas del equipo">
            {c.notes.length > 0 && (
              <ul className="mb-5 grid gap-3">
                {c.notes.map((n) => (
                  <li key={n.id} className="rounded-xl bg-beige/60 p-4">
                    <p className="whitespace-pre-wrap text-lg">{n.body}</p>
                    <p className="mt-1 text-sm text-carbon-600">{formatDateTime(n.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
            <NoteForm customerId={c.id} onDone={reload} />
          </Card>
        </div>
      </div>
    </div>
  )
}

export function CustomerDetailPage() {
  const { id = '' } = useParams()
  const { state, reload } = useAdminQuery<CustomerDetail>(`/customers/${id}`)
  useDocumentTitle(state.status === 'ok' ? state.data.companyName ?? state.data.fullName : 'Cliente')

  return (
    <div className="mx-auto max-w-5xl">
      <BackLink to="/clientes">Volver a clientes</BackLink>
      <QueryView state={state} onRetry={reload}>
        {(c) => <CustomerView c={c} reload={reload} />}
      </QueryView>
    </div>
  )
}
