import { useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import type { CustomerDetail, CustomerListItem, ListResponse } from '../../../../shared/api/panel-contracts'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { formatDateTime, formatMoney, orderStatusLabels, orderTone, quoteStatusLabels, quoteTone } from '../panel-logic'
import { useAdminAction, useAdminQuery } from '../use-admin-api'
import { BackLink, Badge, Card, DataTable, EmptyState, Field, inputClass, Notice, PageHeader, primaryButton, QueryView } from '../ui'

export function CustomersPage() {
  useDocumentTitle('Clientes')
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const [draft, setDraft] = useState(search)
  const path = search ? `/customers?search=${encodeURIComponent(search)}` : '/customers'
  const { state, reload } = useAdminQuery<ListResponse<CustomerListItem>>(path)

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <PageHeader title="Clientes" intro="Particulares y empresas que han pedido una cotización o un pedido." />
      <form
        role="search"
        className="flex max-w-lg items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          setParams(draft.trim() ? { q: draft.trim() } : {})
        }}
      >
        <div className="flex-1">
          <Field label="Buscar por nombre, empresa, correo o teléfono">
            <input className={inputClass} type="search" value={draft} maxLength={80} onChange={(e) => setDraft(e.target.value)} />
          </Field>
        </div>
        <button type="submit" className={primaryButton}>
          Buscar
        </button>
      </form>
      <QueryView state={state} onRetry={reload}>
        {({ items }) =>
          items.length === 0 ? (
            <EmptyState>No se encontraron clientes.</EmptyState>
          ) : (
            <DataTable caption="Clientes" head={['Cliente', 'Tipo', 'Contacto', 'Alta']}>
              {items.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <Link to={`/clientes/${c.id}`} className="font-semibold text-nogal hover:underline">
                      {c.companyName ?? c.fullName}
                    </Link>
                    {c.companyName && <p className="text-xs text-carbon-600">{c.fullName}</p>}
                  </td>
                  <td className="px-4 py-3">{c.customerType === 'business' ? 'Empresa' : 'Particular'}</td>
                  <td className="px-4 py-3 text-carbon-600">{[c.email, c.phone].filter(Boolean).join(' · ')}</td>
                  <td className="px-4 py-3 text-carbon-600">{formatDateTime(c.createdAt)}</td>
                </tr>
              ))}
            </DataTable>
          )
        }
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
      <Field label="Nueva observación" hint="Solo la ve el equipo.">
        <textarea className={`${inputClass} py-2`} rows={3} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>
      {error && <Notice>{error}</Notice>}
      <div>
        <button type="submit" className={primaryButton} disabled={pending || !body.trim()}>
          {pending ? 'Guardando…' : 'Agregar nota'}
        </button>
      </div>
    </form>
  )
}

export function CustomerDetailPage() {
  const { id = '' } = useParams()
  const { state, reload } = useAdminQuery<CustomerDetail>(`/customers/${id}`)
  useDocumentTitle(state.status === 'ok' ? state.data.companyName ?? state.data.fullName : 'Cliente')

  return (
    <div className="mx-auto max-w-6xl">
      <BackLink to="/clientes">Clientes</BackLink>
      <QueryView state={state} onRetry={reload}>
        {(c) => (
          <>
            <PageHeader
              title={c.companyName ?? c.fullName}
              intro={`${c.customerType === 'business' ? 'Empresa' : 'Particular'} · alta el ${formatDateTime(c.createdAt)}`}
            />
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <Card title="Datos">
                <dl className="grid gap-1 text-sm">
                  <div>
                    <dt className="inline text-carbon-600">Contacto: </dt>
                    <dd className="inline">{c.fullName}</dd>
                  </div>
                  {c.email && (
                    <div>
                      <dt className="inline text-carbon-600">Correo: </dt>
                      <dd className="inline">{c.email}</dd>
                    </div>
                  )}
                  {c.phone && (
                    <div>
                      <dt className="inline text-carbon-600">Teléfono: </dt>
                      <dd className="inline">{c.phone}</dd>
                    </div>
                  )}
                  {c.documentType && (
                    <div>
                      <dt className="inline text-carbon-600">{c.documentType}: </dt>
                      <dd className="inline">{c.documentNumber}</dd>
                    </div>
                  )}
                </dl>
              </Card>

              <Card title="Observaciones del equipo">
                {c.notes.length === 0 ? (
                  <p className="text-sm text-carbon-600">Sin observaciones.</p>
                ) : (
                  <ul className="grid gap-3">
                    {c.notes.map((n) => (
                      <li key={n.id} className="rounded-lg bg-beige/50 p-3 text-sm">
                        <p className="whitespace-pre-wrap">{n.body}</p>
                        <p className="mt-1 text-xs text-carbon-600">{formatDateTime(n.createdAt)}</p>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4">
                  <NoteForm customerId={c.id} onDone={reload} />
                </div>
              </Card>

              <Card title="Cotizaciones">
                {c.quotes.length === 0 ? (
                  <p className="text-sm text-carbon-600">Sin cotizaciones.</p>
                ) : (
                  <ul className="grid gap-2 text-sm">
                    {c.quotes.map((q) => (
                      <li key={q.id} className="flex flex-wrap items-center justify-between gap-2">
                        <Link to={`/cotizaciones/${q.id}`} className="font-medium text-nogal hover:underline">
                          {q.code}
                        </Link>
                        <span className="flex items-center gap-2">
                          <Badge tone={quoteTone(q.status)}>{quoteStatusLabels[q.status]}</Badge>
                          {formatMoney(q.total)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card title="Pedidos">
                {c.orders.length === 0 ? (
                  <p className="text-sm text-carbon-600">Sin pedidos.</p>
                ) : (
                  <ul className="grid gap-2 text-sm">
                    {c.orders.map((o) => (
                      <li key={o.id} className="flex flex-wrap items-center justify-between gap-2">
                        <Link to={`/pedidos/${o.id}`} className="font-medium text-nogal hover:underline">
                          {o.code}
                        </Link>
                        <span className="flex items-center gap-2">
                          <Badge tone={orderTone(o.status)}>{orderStatusLabels[o.status]}</Badge>
                          {formatMoney(o.total)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </>
        )}
      </QueryView>
    </div>
  )
}
