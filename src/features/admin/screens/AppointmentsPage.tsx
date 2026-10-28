import { useSearchParams } from 'react-router'
import type { AppointmentItem, AppointmentStatus, ListResponse } from '../../../../shared/api/panel-contracts'
import { appointmentLabel } from '../../../../shared/config/appointments'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { useAdminAction, useAdminQuery } from '../use-admin-api'
import { Badge, EmptyState, Notice, PageHeader, primaryButton, QueryView, secondaryButton } from '../ui'

const filters: { key: AppointmentStatus; label: string }[] = [
  { key: 'pending', label: 'Pendientes' },
  { key: 'done', label: 'Atendidas' },
  { key: 'cancelled', label: 'Canceladas' },
]

const statusLabels: Record<AppointmentStatus, string> = { pending: 'Pendiente', done: 'Atendida', cancelled: 'Cancelada' }
const statusTones = { pending: 'warn', done: 'good', cancelled: 'muted' } as const

function Row({ item, onChanged }: { item: AppointmentItem; onChanged: () => void }) {
  const { run, pending, error } = useAdminAction()
  const set = async (status: AppointmentStatus) => {
    if (await run('POST', `/appointments/${item.id}/status`, { status })) onChanged()
  }
  return (
    <li className="grid gap-3 rounded-2xl border border-linea bg-white/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-nogal first-letter:uppercase">{appointmentLabel(new Date(item.startsAt))}</p>
          <p className="mt-1 text-sm">
            {item.customerName} ·{' '}
            <a href={`tel:${item.contactPhone}`} className="font-medium text-madera-700 hover:underline">
              {item.contactPhone}
            </a>
          </p>
        </div>
        <Badge tone={statusTones[item.status]}>{statusLabels[item.status]}</Badge>
      </div>
      <div className="flex flex-wrap gap-3">
        {item.status === 'pending' ? (
          <>
            <button type="button" className={primaryButton} disabled={pending} onClick={() => void set('done')}>
              Marcar como atendida
            </button>
            <button type="button" className={secondaryButton} disabled={pending} onClick={() => void set('cancelled')}>
              Cancelar cita
            </button>
          </>
        ) : (
          <button type="button" className={secondaryButton} disabled={pending} onClick={() => void set('pending')}>
            Volver a pendiente
          </button>
        )}
      </div>
      {error && <Notice>{error}</Notice>}
    </li>
  )
}

export function AppointmentsPage() {
  useDocumentTitle('Citas')
  const [params, setParams] = useSearchParams()
  const filter = filters.find((f) => f.key === params.get('estado')) ?? filters[0]!
  const { state, reload } = useAdminQuery<ListResponse<AppointmentItem>>(`/appointments?status=${filter.key}`)

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Citas" intro="Los clientes que quieren hablar con la administración eligen un día y una hora en el chat. Aquí ves cuándo y a qué celular llamar." />
      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Estado de la cita">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={f.key === filter.key}
            onClick={() => setParams({ estado: f.key }, { replace: true })}
            className={`min-h-11 rounded-full border px-4 text-sm font-medium transition-colors ${
              f.key === filter.key ? 'border-nogal bg-nogal text-marfil' : 'border-nogal/30 text-nogal hover:bg-nogal/5'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="mt-6">
        <QueryView state={state} onRetry={reload}>
          {({ items }) =>
            items.length === 0 ? (
              <EmptyState>No hay citas {filter.key === 'pending' ? 'pendientes' : filter.key === 'done' ? 'atendidas' : 'canceladas'}.</EmptyState>
            ) : (
              <ul className="grid gap-3">
                {items.map((item) => (
                  <Row key={item.id} item={item} onChanged={reload} />
                ))}
              </ul>
            )
          }
        </QueryView>
      </div>
    </div>
  )
}
