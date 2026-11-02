import { useState } from 'react'
import { Link } from 'react-router'
import type { AppointmentItem, ConversationListItem, DashboardResponse, ListResponse, OrderListItem } from '../../../shared/api/panel-contracts'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useStaffSession } from '../auth/auth-context'
import { NavIcon } from './nav-icons'
import { formatMoney, needsPayment, plural } from './panel-logic'
import { firstName, greeting, todayLabel, todayTasks, type TodayTask } from './today-logic'
import { useAdminQuery } from './use-admin-api'
import { primaryButton, primaryButtonLarge, QueryView, secondaryButton, secondaryButtonLarge } from './ui'

const taskTone = {
  alert: { card: 'border-2 border-alerta/40', icon: 'bg-alerta-claro text-alerta', action: primaryButton },
  warn: { card: 'border border-linea', icon: 'bg-aviso-claro text-aviso', action: secondaryButton },
} as const

/** Una tarea: toda la fila se toca y lleva a la pantalla donde se resuelve. */
function TaskRow({ task }: { task: TodayTask }) {
  const tone = taskTone[task.tone]
  return (
    <li>
      <Link
        to={task.to}
        className={`grid gap-4 rounded-2xl bg-white p-5 transition-shadow hover:shadow-md focus-visible:shadow-md sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-5 sm:p-6 ${tone.card}`}
      >
        <span className="flex items-center gap-4 sm:contents">
          <span className={`flex size-14 shrink-0 items-center justify-center rounded-full ${tone.icon}`}>
            <NavIcon slug={task.icon} className="size-7" />
          </span>
          <span className="grid gap-1">
            {task.tone === 'alert' && <span className="text-sm font-bold text-alerta">Urgente</span>}
            <span className="text-xl leading-snug font-bold text-carbon">{task.title}</span>
            <span className="hidden text-base text-carbon-600 sm:block">{task.detail}</span>
          </span>
        </span>
        <span className="text-base text-carbon-600 sm:hidden">{task.detail}</span>
        <span className={`${tone.action} pointer-events-none whitespace-nowrap`}>{task.action}</span>
      </Link>
    </li>
  )
}

function Today({ data }: { data: DashboardResponse }) {
  const count = <T,>(state: { status: string; data?: ListResponse<T> }, keep: (item: T) => boolean = () => true) =>
    state.status === 'ok' && state.data ? state.data.items.filter(keep).length : null
  const { state: waiting } = useAdminQuery<ListResponse<ConversationListItem>>('/conversations?status=needs_human')
  const { state: appointments } = useAdminQuery<ListResponse<AppointmentItem>>('/appointments?status=pending')
  const { state: orders } = useAdminQuery<ListResponse<OrderListItem>>('/orders')

  const { tasks, calm } = todayTasks({
    lowStock: data.lowStock.length,
    quotesPending: data.quotesPending,
    ordersToConfirm: data.ordersByStatus.pending_confirmation ?? 0,
    ordersToCollect: count(orders, needsPayment),
    conversationsWaiting: count(waiting),
    appointmentsPending: count(appointments),
  })
  const inWorkshop = data.ordersByStatus.in_production ?? 0

  return (
    <div className="mt-10 grid gap-12">
      <section aria-labelledby="por-hacer" className="grid gap-4">
        <h2 id="por-hacer" className="text-3xl">
          Por hacer
        </h2>
        {tasks.length === 0 ? (
          <p className="rounded-2xl bg-exito-claro px-6 py-8 text-xl font-bold text-exito">Todo al día. No hay nada pendiente por ahora.</p>
        ) : (
          <ul className="grid gap-3">
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </ul>
        )}
      </section>

      {calm.length > 0 && (
        <section aria-labelledby="en-orden" className="grid gap-4">
          <h2 id="en-orden" className="text-3xl">
            Todo en orden
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {calm.map((label) => (
              <li key={label} className="flex min-h-16 items-center gap-3 rounded-2xl bg-exito-claro px-5 text-lg font-semibold text-exito">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="m8 12.5 2.7 2.7L16 9.8" />
                </svg>
                {label}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="mes" className="grid gap-4 sm:grid-cols-2">
        <h2 id="mes" className="text-3xl sm:col-span-2">
          Cómo va el mes
        </h2>
        <div className="grid content-start gap-1 rounded-2xl bg-nogal p-6 text-beige">
          <p className="text-lg text-arena">Vendido en los últimos 30 días</p>
          <p className="font-display text-5xl text-marfil">{formatMoney(data.confirmedSales30d.total)}</p>
          <p className="text-lg">{plural(data.confirmedSales30d.count, 'pedido confirmado', 'pedidos confirmados')}</p>
        </div>
        <div className="grid content-between gap-4 rounded-2xl border border-linea bg-white p-6">
          <div className="grid gap-1">
            <p className="text-lg text-carbon-600">En el taller ahora</p>
            <p className="font-display text-5xl text-nogal">{plural(inWorkshop, 'pedido')}</p>
          </div>
          <Link to="/reportes" className="text-lg font-bold text-madera-700 hover:underline">
            Ver reportes completos →
          </Link>
        </div>
      </section>
    </div>
  )
}

export function AdminOverviewPage() {
  useDocumentTitle('Hoy · Panel')
  const { staff } = useStaffSession()
  const { state, reload } = useAdminQuery<DashboardResponse>('/dashboard')
  // La fecha se fija al abrir la pantalla: el saludo no cambia mientras se trabaja.
  const [now] = useState(() => new Date())
  const name = firstName(staff.fullName)

  return (
    <div className="mx-auto max-w-5xl">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="grid gap-2">
          <h1 className="text-4xl sm:text-5xl">
            {greeting(now)}
            {name && `, ${name}`}
          </h1>
          <p className="text-xl text-carbon-600">{todayLabel(now)}</p>
        </div>
        <div className="grid w-full gap-3 sm:flex sm:w-auto">
          <Link to="/pedidos/nueva" className={primaryButtonLarge}>
            <span aria-hidden="true">+</span> Nueva venta
          </Link>
          <Link to="/produccion" className={secondaryButtonLarge}>
            Registrar producción
          </Link>
        </div>
      </header>
      <QueryView state={state} onRetry={reload}>
        {(data) => <Today data={data} />}
      </QueryView>
    </div>
  )
}
