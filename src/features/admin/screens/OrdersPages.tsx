import { useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import type { ListResponse, OrderDetail, OrderListItem } from '../../../../shared/api/panel-contracts'
import { orderStatuses } from '../../../../shared/api/panel-schemas'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { useStaffSession } from '../../auth/auth-context'
import {
  channelLabels,
  formatDateTime,
  formatMoney,
  fulfillmentLabels,
  orderActions,
  orderStatusLabels,
  orderTone,
  paymentTone,
  paymentStatusLabels,
} from '../panel-logic'
import { useAdminAction, useAdminQuery } from '../use-admin-api'
import {
  BackLink,
  Badge,
  Card,
  DataTable,
  dangerButton,
  EmptyState,
  Field,
  inputClass,
  Notice,
  PageHeader,
  primaryButton,
  QueryView,
  secondaryButton,
} from '../ui'

export function OrdersPage() {
  useDocumentTitle('Pedidos')
  const { staff } = useStaffSession()
  const [params, setParams] = useSearchParams()
  const status = orderStatuses.find((s) => s === params.get('status'))
  const { state, reload } = useAdminQuery<ListResponse<OrderListItem>>(status ? `/orders?status=${status}` : '/orders')

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <PageHeader
        title="Pedidos"
        intro="Seguimiento de cada pedido, desde la confirmación hasta la entrega."
        actions={
          staff.role === 'admin' ? (
            <Link to="/pedidos/nueva" className={primaryButton}>
              + Nueva venta
            </Link>
          ) : undefined
        }
      />
      <div className="max-w-xs">
        <Field label="Estado">
          <select className={inputClass} value={status ?? ''} onChange={(e) => setParams(e.target.value ? { status: e.target.value } : {})}>
            <option value="">Todos</option>
            {orderStatuses.map((s) => (
              <option key={s} value={s}>
                {orderStatusLabels[s]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <QueryView state={state} onRetry={reload}>
        {({ items }) =>
          items.length === 0 ? (
            <EmptyState>No hay pedidos con este filtro.</EmptyState>
          ) : (
            <DataTable caption="Pedidos" head={['Código', 'Cliente', 'Estado', 'Pago', 'Total', 'Creado']}>
              {items.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3">
                    <Link to={`/pedidos/${o.id}`} className="whitespace-nowrap font-semibold text-nogal hover:underline">
                      {o.code}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{o.customer?.companyName ?? o.customer?.fullName ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge tone={orderTone(o.status)}>{orderStatusLabels[o.status]}</Badge>
                  </td>
                  <td className="px-4 py-3"><Badge tone={paymentTone(o.paymentStatus)}>{paymentStatusLabels[o.paymentStatus]}</Badge></td>
                  <td className="px-4 py-3">{formatMoney(o.total)}</td>
                  <td className="px-4 py-3 text-carbon-600">{formatDateTime(o.createdAt)}</td>
                </tr>
              ))}
            </DataTable>
          )
        }
      </QueryView>
    </div>
  )
}

function OrderActions({ order, reload }: { order: OrderDetail; reload: () => void }) {
  const { run, pending, error } = useAdminAction()
  const [confirmed, setConfirmed] = useState(order.customerConfirmedAt !== null)
  const [reason, setReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const actions = orderActions(order.status)

  if (actions.length === 0) return null

  const exec = async (path: string, body: unknown) => {
    if (await run('POST', `/orders/${order.id}${path}`, body)) reload()
  }

  async function cancel(event: FormEvent) {
    event.preventDefault()
    if (!reason.trim()) return setFormError('Indica el motivo de la cancelación.')
    setFormError(null)
    await exec('/cancel', { reason: reason.trim() })
  }

  return (
    <Card title="Acciones">
      <div className="grid gap-4">
        {actions.some((a) => a.kind === 'confirm') && (
          <div className="grid gap-3">
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" className="h-5 w-5 accent-nogal" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              El cliente confirmó el pedido
            </label>
            <div>
              <button
                type="button"
                className={primaryButton}
                disabled={pending || !confirmed}
                onClick={() => void exec('/confirm', { customerConfirmed: confirmed })}
              >
                Confirmar y reservar stock
              </button>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          {actions.map((a) => {
            if (a.kind === 'status') {
              return (
                <button key={a.status} type="button" className={primaryButton} disabled={pending} onClick={() => void exec('/status', { status: a.status })}>
                  {a.label}
                </button>
              )
            }
            if (a.kind === 'dispatch') {
              return (
                <button
                  key={a.finalStatus}
                  type="button"
                  className={a.finalStatus === 'shipped' ? primaryButton : secondaryButton}
                  disabled={pending}
                  onClick={() => void exec('/dispatch', { finalStatus: a.finalStatus })}
                >
                  {a.label}
                </button>
              )
            }
            if (a.kind === 'cancel') {
              return (
                <button key="cancel" type="button" className={dangerButton} disabled={pending} onClick={() => setCancelling(!cancelling)} aria-expanded={cancelling}>
                  Cancelar pedido
                </button>
              )
            }
            return null
          })}
        </div>
        {order.status === 'ready' && (
          <p className="text-xs text-carbon-600">Despachar descuenta el stock reservado del inventario.</p>
        )}
        {cancelling && (
          <form onSubmit={(e) => void cancel(e)} className="grid gap-3" noValidate>
            <Field label="Motivo de la cancelación" hint="Se libera el stock reservado que aún no salió.">
              <input className={inputClass} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <div>
              <button type="submit" className={dangerButton} disabled={pending}>
                Confirmar cancelación
              </button>
            </div>
          </form>
        )}
        {(formError ?? error) && <Notice>{formError ?? error}</Notice>}
      </div>
    </Card>
  )
}

function OrderNotes({ order, reload }: { order: OrderDetail; reload: () => void }) {
  const { run, pending, error } = useAdminAction()
  const [notes, setNotes] = useState(order.internalNotes ?? '')
  const [address, setAddress] = useState(order.shippingAddress ?? '')

  async function save(event: FormEvent) {
    event.preventDefault()
    const result = await run('PATCH', `/orders/${order.id}`, { internalNotes: notes.trim(), shippingAddress: address.trim() })
    if (result) reload()
  }

  return (
    <Card title="Entrega y notas internas">
      <form onSubmit={(e) => void save(e)} className="grid gap-4">
        <Field label="Dirección de entrega">
          <input className={inputClass} maxLength={500} value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Field label="Notas internas" hint="Solo las ve el equipo.">
          <textarea className={`${inputClass} py-2`} rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {error && <Notice>{error}</Notice>}
        <div>
          <button type="submit" className={secondaryButton} disabled={pending}>
            {pending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Card>
  )
}

export function OrderDetailPage() {
  const { id = '' } = useParams()
  const { staff } = useStaffSession()
  const { state, reload } = useAdminQuery<OrderDetail>(`/orders/${id}`)
  useDocumentTitle(state.status === 'ok' ? state.data.code : 'Pedido')

  return (
    <div className="mx-auto max-w-6xl">
      <BackLink to="/pedidos">Pedidos</BackLink>
      <QueryView state={state} onRetry={reload}>
        {(order) => (
          <>
            <PageHeader title={order.code} intro={`Creado el ${formatDateTime(order.createdAt)} · ${channelLabels[order.channel] ?? order.channel}`} />
            <div className="mt-6 grid gap-6">
              <div className="grid gap-6 lg:grid-cols-3">
                <Card title="Estado">
                  <p className="flex flex-wrap gap-2">
                    <Badge tone={orderTone(order.status)}>{orderStatusLabels[order.status]}</Badge>
                    <Badge tone={paymentTone(order.paymentStatus)}>{paymentStatusLabels[order.paymentStatus]}</Badge>
                  </p>
                  <p className="mt-3 text-xs text-carbon-600">
                    Confirmado por el cliente: {order.customerConfirmedAt ? formatDateTime(order.customerConfirmedAt) : 'no'}
                  </p>
                  {order.cancelReason && <p className="mt-2 text-xs text-carbon-600">Motivo de cancelación: {order.cancelReason}</p>}
                  {order.deliveryEstimateNote && <p className="mt-2 text-xs text-carbon-600">Plazo estimado: {order.deliveryEstimateNote}</p>}
                  {order.quoteId && staff.role === 'admin' && (
                    <Link to={`/cotizaciones/${order.quoteId}`} className="mt-3 inline-block text-sm font-medium text-madera-700 hover:underline">
                      Ver cotización →
                    </Link>
                  )}
                </Card>
                <Card title="Cliente" className="lg:col-span-2">
                  {order.customer ? (
                    <p className="text-sm">
                      <Link to={`/clientes/${order.customer.id}`} className="font-semibold text-nogal hover:underline">
                        {order.customer.companyName ?? order.customer.fullName}
                      </Link>
                      <br />
                      <span className="text-carbon-600">{[order.customer.email, order.customer.phone].filter(Boolean).join(' · ')}</span>
                    </p>
                  ) : (
                    <p className="text-sm text-carbon-600">Los datos del cliente solo los ve administración.</p>
                  )}
                </Card>
              </div>

              <DataTable caption="Productos del pedido" head={['Producto', 'Cant.', 'Origen', 'Precio unitario', 'Total']}>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{item.description}</p>
                      {item.customDimensions && <p className="text-xs text-carbon-600">Medidas: {item.customDimensions}</p>}
                      {item.customization && <p className="text-xs text-carbon-600">Personalización: {item.customization}</p>}
                    </td>
                    <td className="px-4 py-3">{item.quantity}</td>
                    <td className="px-4 py-3">{fulfillmentLabels[item.fulfillmentType]}</td>
                    <td className="px-4 py-3">{formatMoney(item.unitPrice)}</td>
                    <td className="px-4 py-3">{formatMoney(item.lineTotal)}</td>
                  </tr>
                ))}
              </DataTable>
              <p className="text-right text-sm">
                Subtotal {formatMoney(order.subtotal)}
                {order.discountTotal > 0 && <> · Descuento {formatMoney(order.discountTotal)}</>}
                {order.shippingTotal > 0 && <> · Envío {formatMoney(order.shippingTotal)}</>} ·{' '}
                <strong className="text-base">Total {formatMoney(order.total)}</strong>
              </p>

              {staff.role === 'admin' && (
                <>
                  <OrderActions order={order} reload={reload} />
                  <OrderNotes key={`${order.internalNotes}-${order.shippingAddress}`} order={order} reload={reload} />
                </>
              )}
            </div>
          </>
        )}
      </QueryView>
    </div>
  )
}
