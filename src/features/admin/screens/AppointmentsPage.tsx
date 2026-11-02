import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import type { AppointmentItem, AppointmentStatus, ListResponse } from '../../../../shared/api/panel-contracts'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { plural, whatsappLink } from '../panel-logic'
import { appointmentHour, groupAppointmentsByDay, isOverdue } from '../people-logic'
import { useAdminAction, useAdminQuery } from '../use-admin-api'
import { Badge, EmptyState, Notice, PageHeader, primaryButton, QueryView, secondaryButton } from '../ui'

const filters: { key: AppointmentStatus; label: string; hint: string }[] = [
  { key: 'pending', label: 'Por atender', hint: 'Clientes que pidieron que los llames. Elegieron el día y la hora en el chat.' },
  { key: 'done', label: 'Atendidas', hint: 'Citas que ya atendiste.' },
  { key: 'cancelled', label: 'Canceladas', hint: 'Citas que se cancelaron.' },
]

const statusLabels: Record<AppointmentStatus, string> = { pending: 'Por atender', done: 'Atendida', cancelled: 'Cancelada' }
const statusTones = { pending: 'warn', done: 'good', cancelled: 'muted' } as const

function AppointmentCard({ item, now, onChanged }: { item: AppointmentItem; now: Date; onChanged: () => void }) {
  const { run, pending, error } = useAdminAction()
  const [cancelling, setCancelling] = useState(false)
  const overdue = isOverdue(item, now)
  const wa = whatsappLink(item.contactPhone)
  const set = async (status: AppointmentStatus) => {
    if (await run('POST', `/appointments/${item.id}/status`, { status })) onChanged()
  }

  return (
    <li className={`grid gap-4 rounded-2xl bg-white p-5 sm:p-6 ${overdue ? 'border-2 border-madera/50' : 'border border-linea'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <p className="font-display text-3xl text-nogal">{appointmentHour(item.startsAt)}</p>
          <p className="text-xl font-bold text-carbon">{item.customerName}</p>
          <p className="text-lg text-carbon-600">Celular: {item.contactPhone}</p>
        </div>
        <div className="grid justify-items-end gap-2">
          <Badge tone={statusTones[item.status]}>{statusLabels[item.status]}</Badge>
          {overdue && <span className="text-base font-bold text-aviso">Ya pasó la hora</span>}
        </div>
      </div>

      {item.status === 'pending' ? (
        <div className="flex flex-wrap items-center gap-3">
          <a href={`tel:${item.contactPhone}`} className={primaryButton}>
            Llamar
          </a>
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className={secondaryButton}>
              WhatsApp
            </a>
          )}
          <button type="button" className={secondaryButton} disabled={pending} onClick={() => void set('done')}>
            Ya la atendí
          </button>
          {item.conversationId && (
            <Link to={`/conversaciones?estado=todas&c=${item.conversationId}`} className="inline-flex min-h-12 items-center text-base font-bold text-madera-700 hover:underline">
              Ver el chat
            </Link>
          )}
          {/* Cancelar queda al final, en rojo y con confirmación. */}
          <span className="ml-auto">
            {cancelling ? (
              <span className="flex flex-wrap items-center gap-2">
                <button type="button" className="inline-flex min-h-12 items-center rounded-full bg-alerta px-5 text-base font-bold text-marfil" disabled={pending} onClick={() => void set('cancelled')}>
                  Sí, cancelar
                </button>
                <button type="button" className="inline-flex min-h-12 items-center px-3 text-base font-bold text-carbon-600 hover:underline" onClick={() => setCancelling(false)}>
                  No
                </button>
              </span>
            ) : (
              <button type="button" className="inline-flex min-h-12 items-center px-3 text-base font-bold text-alerta hover:underline" onClick={() => setCancelling(true)}>
                Cancelar cita
              </button>
            )}
          </span>
        </div>
      ) : (
        <div>
          <button type="button" className={secondaryButton} disabled={pending} onClick={() => void set('pending')}>
            Volver a «Por atender»
          </button>
        </div>
      )}
      {error && <Notice>{error}</Notice>}
    </li>
  )
}

export function AppointmentsPage() {
  useDocumentTitle('Citas')
  const [params, setParams] = useSearchParams()
  const filter = filters.find((f) => f.key === params.get('estado')) ?? filters[0]!
  const { state, reload } = useAdminQuery<ListResponse<AppointmentItem>>(`/appointments?status=${filter.key}`)
  // La hora se fija al cargar la pantalla; «Ya pasó la hora» se recalcula al recargar.
  const [now] = useState(() => new Date())

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Citas" />
      <div role="group" aria-label="Ver citas" className="mt-6 flex flex-wrap gap-2">
        {filters.map((f) => {
          const on = f.key === filter.key
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={on}
              onClick={() => setParams({ estado: f.key }, { replace: true })}
              className={`min-h-12 rounded-full border-2 px-5 text-base font-bold transition-colors ${
                on ? 'border-nogal bg-nogal text-marfil' : 'border-linea bg-white text-nogal hover:border-nogal'
              }`}
            >
              {f.label}
            </button>
          )
        })}
      </div>
      <div className="mt-6">
        <QueryView state={state} onRetry={reload}>
          {({ items }) => (
            <div className="grid gap-6">
              <p className="text-lg text-carbon-600">
                <strong className="text-carbon">{plural(items.length, 'cita')}.</strong> {filter.hint}
              </p>
              {items.length === 0 ? (
                <EmptyState>{filter.key === 'pending' ? 'No hay citas por atender. ¡Todo al día!' : 'No hay citas aquí.'}</EmptyState>
              ) : (
                groupAppointmentsByDay(items, now).map((group) => (
                  <section key={group.date} aria-labelledby={`dia-${group.date}`} className="grid gap-3">
                    <h2 id={`dia-${group.date}`} className="text-3xl">
                      {group.title}
                    </h2>
                    <ul className="grid gap-3">
                      {group.items.map((item) => (
                        <AppointmentCard key={item.id} item={item} now={now} onChanged={reload} />
                      ))}
                    </ul>
                  </section>
                ))
              )}
            </div>
          )}
        </QueryView>
      </div>
    </div>
  )
}
