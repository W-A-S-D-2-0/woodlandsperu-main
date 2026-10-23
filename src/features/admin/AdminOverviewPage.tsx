import { Link } from 'react-router'
import type { ConversationListItem, DashboardResponse, ListResponse } from '../../../shared/api/panel-contracts'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { formatDateTime, formatMoney, orderStatusLabels, orderTone, plural, quoteStatusLabels, quoteTone } from './panel-logic'
import { useAdminQuery } from './use-admin-api'
import { Badge, Card, PageHeader, primaryButton, QueryView, secondaryButton, Stat } from './ui'

function Overview({ data }: { data: DashboardResponse }) {
  const { state: waiting } = useAdminQuery<ListResponse<ConversationListItem>>('/conversations?status=needs_human')
  const waitingCount = waiting.status === 'ok' ? waiting.data.items.length : null
  const activeOrders = Object.entries(data.ordersByStatus).filter(([status]) => status !== 'delivered' && status !== 'cancelled')

  return (
    <div className="mt-8 grid gap-8">
      <div className="flex flex-wrap gap-3">
        <Link to="/pedidos/nueva" className={primaryButton}>
          + Nueva venta
        </Link>
        <Link to="/produccion" className={secondaryButton}>
          Registrar producción
        </Link>
        <Link to="/cotizaciones" className={secondaryButton}>
          Ver cotizaciones
        </Link>
      </div>
      <section aria-labelledby="pendientes" className="grid gap-3">
        <h2 id="pendientes" className="font-sans text-sm font-semibold tracking-[0.12em] text-madera-700 uppercase">
          Por atender
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat
            label="Cotizaciones por revisar"
            value={data.quotesPending}
            alert={data.quotesPending > 0}
            to="/cotizaciones"
            hint={data.quotesPending > 0 ? 'Esperan tu respuesta' : 'Todo al día'}
          />
          {/* Mientras carga se reserva el lugar: las tarjetas no saltan al llegar el dato. */}
          <Stat
            label="Conversaciones por revisar"
            value={waitingCount ?? '—'}
            alert={(waitingCount ?? 0) > 0}
            to="/conversaciones?estado=esperan"
            hint={
              waitingCount === null
                ? 'Cargando…'
                : waitingCount > 0
                  ? 'El asistente respondió; hay algo que ve el equipo'
                  : 'El asistente atiende todo'
            }
          />
          <Stat
            label="Productos con stock bajo"
            value={data.lowStock.length}
            alert={data.lowStock.length > 0}
            to="/inventario"
            hint={data.lowStock.length > 0 ? 'Conviene producir' : 'Stock en orden'}
          />
        </div>
      </section>

      <section aria-labelledby="actividad" className="grid gap-3">
        <h2 id="actividad" className="font-sans text-sm font-semibold tracking-[0.12em] text-madera-700 uppercase">
          Actividad
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Stat
            label="Cotizaciones enviadas"
            value={data.quotesSent}
            to="/cotizaciones?status=sent"
            hint="Esperando respuesta del cliente"
          />
          <Stat
            label="Ventas confirmadas · 30 días"
            value={formatMoney(data.confirmedSales30d.total)}
            hint={plural(data.confirmedSales30d.count, 'pedido')}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Pedidos en curso">
          {activeOrders.length === 0 ? (
            <p className="text-sm text-carbon-600">No hay pedidos en curso.</p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {activeOrders.map(([status, total]) => (
                <li key={status} className="flex items-center justify-between gap-4">
                  <Link to={`/pedidos?status=${status}`} className="hover:underline">
                    {orderStatusLabels[status as keyof typeof orderStatusLabels] ?? status}
                  </Link>
                  <strong>{total}</strong>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Reposición necesaria">
          {data.lowStock.length === 0 ? (
            <p className="text-sm text-carbon-600">Ninguna variante está por debajo de su mínimo.</p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {data.lowStock.map((item) => (
                <li key={item.variantId} className="flex items-center justify-between gap-4">
                  <span>
                    {item.product} · {item.variant} <span className="text-carbon-600">({item.sku})</span>
                  </span>
                  <Badge tone="warn">
                    {item.available} / mín. {item.minStock}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Últimas cotizaciones">
          {data.recentQuotes.length === 0 ? (
            <p className="text-sm text-carbon-600">Aún no hay cotizaciones.</p>
          ) : (
            <ul className="grid gap-3 text-sm">
              {data.recentQuotes.map((quote) => (
                <li key={quote.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <Link to={`/cotizaciones/${quote.id}`} className="block truncate font-medium text-nogal hover:underline">
                      {quote.code} · {quote.customer}
                    </Link>
                    <span className="text-xs text-carbon-600">{formatDateTime(quote.createdAt)}</span>
                  </span>
                  <Badge tone={quoteTone(quote.status)}>{quoteStatusLabels[quote.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Últimos pedidos">
          {data.recentOrders.length === 0 ? (
            <p className="text-sm text-carbon-600">Aún no hay pedidos.</p>
          ) : (
            <ul className="grid gap-3 text-sm">
              {data.recentOrders.map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <Link to={`/pedidos/${order.id}`} className="block truncate font-medium text-nogal hover:underline">
                      {order.code} · {order.customer}
                    </Link>
                    <span className="text-xs text-carbon-600">
                      {formatMoney(order.total)} · {formatDateTime(order.createdAt)}
                    </span>
                  </span>
                  <Badge tone={orderTone(order.status)}>{orderStatusLabels[order.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

export function AdminOverviewPage() {
  useDocumentTitle('Resumen · Panel')
  const { state, reload } = useAdminQuery<DashboardResponse>('/dashboard')

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Resumen" intro="Estado comercial de Woodland: lo que espera una acción del equipo." />
      <QueryView state={state} onRetry={reload}>
        {(data) => <Overview data={data} />}
      </QueryView>
    </div>
  )
}
