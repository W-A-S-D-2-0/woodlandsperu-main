import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { AppointmentSlotsResponse, ChatResponse } from '../../../shared/api/chat'
import { appointmentLabel, availableDays, hourLabel, slotInstant } from '../../../shared/config/appointments'
import { ApiError, apiFetch } from '../../lib/api'
import { validAppointmentContact } from './chat-logic'

const choice = (active: boolean) =>
  `min-h-10 rounded-full border px-3.5 text-xs font-medium whitespace-nowrap transition-colors ${
    active ? 'border-nogal bg-nogal text-marfil' : 'border-madera/60 bg-white text-nogal hover:border-nogal hover:bg-nogal/5'
  }`

const field =
  'min-h-11 w-full rounded-xl border border-linea bg-white px-3.5 text-sm font-normal tracking-normal text-carbon normal-case transition-shadow focus-visible:border-madera focus-visible:shadow-[0_0_0_3px_rgb(181_112_58/0.18)]'

const label = 'grid gap-1 text-xs font-semibold tracking-[0.08em] text-madera-700 uppercase'

/** Agendar cita: el cliente elige día y hora y deja su nombre y celular; la cita le llega a la administración en el panel. */
export function AppointmentCard({ token, onBooked, onClose }: { token: () => string; onBooked: (res: ChatResponse) => void; onClose: () => void }) {
  const [taken, setTaken] = useState<string[] | null>(null)
  const [date, setDate] = useState<string | null>(null)
  const [hour, setHour] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // El token puede cambiar de identidad en cada render del chat; aquí solo importa su valor al pedir.
  const tokenRef = useRef(token)
  const loadTaken = () => apiFetch<AppointmentSlotsResponse>(`/api/chat/appointments/slots?token=${encodeURIComponent(tokenRef.current())}`)

  useEffect(() => {
    let alive = true
    loadTaken().then(
      (res) => alive && setTaken(res.taken),
      // Sin la lista de horas tomadas se ofrecen todas; el servidor rechaza una hora ya tomada.
      () => alive && setTaken([]),
    )
    return () => {
      alive = false
    }
  }, [])

  const days = useMemo(() => (taken ? availableDays(new Date(), taken) : []), [taken])
  const day = days.find((d) => d.date === date) ?? null
  const startsAt = day && hour !== null ? slotInstant(day.date, hour) : null
  const contactError = validAppointmentContact(name, phone)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!startsAt || contactError || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await apiFetch<ChatResponse>('/api/chat/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token(), name, phone, startsAt: startsAt.toISOString() }),
      })
      onBooked(res)
    } catch (err) {
      setError(err instanceof ApiError && err.status !== 0 ? err.message : 'No pude agendar tu cita. Revisa tu conexión e inténtalo de nuevo.')
      // La hora pudo haberla tomado alguien más: se vuelve a pedir la lista.
      loadTaken().then((res) => setTaken(res.taken), () => undefined)
      setHour(null)
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="absolute inset-0 z-20 grid animate-chip-in content-start gap-4 overflow-y-auto bg-marfil p-4" aria-label="Agendar cita">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg text-nogal">Agendar cita</h3>
          <p className="mt-0.5 text-xs text-carbon-600">Elige cuándo quieres conversar con la administración de Woodland. Te llamarán al celular que dejes.</p>
        </div>
        <button type="button" aria-label="Cerrar" className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xl hover:bg-beige" onClick={onClose}>
          ×
        </button>
      </div>

      {taken === null ? (
        <p className="text-sm text-carbon-600">Buscando horarios…</p>
      ) : days.length === 0 ? (
        <p className="rounded-xl border border-linea bg-white p-3 text-sm">Por ahora no hay horarios disponibles. Escríbenos por el chat y te ayudamos.</p>
      ) : (
        <>
          <fieldset className="grid gap-2">
            <legend className="text-xs font-semibold tracking-[0.08em] text-madera-700 uppercase">Día</legend>
            <div className="flex flex-wrap gap-2">
              {days.map((d) => (
                <button
                  key={d.date}
                  type="button"
                  aria-pressed={d.date === date}
                  className={choice(d.date === date)}
                  onClick={() => {
                    setDate(d.date)
                    setHour(null)
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </fieldset>

          {day && (
            <fieldset className="grid animate-chip-in gap-2">
              <legend className="text-xs font-semibold tracking-[0.08em] text-madera-700 uppercase">Hora</legend>
              <div className="flex flex-wrap gap-2">
                {day.hours.map((h) => (
                  <button key={h} type="button" aria-pressed={h === hour} className={choice(h === hour)} onClick={() => setHour(h)}>
                    {hourLabel(h)}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {startsAt && (
            <div className="grid animate-chip-in gap-3">
              <label className={label}>
                Tu nombre
                <input className={field} autoComplete="name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className={label}>
                Tu celular
                <input className={field} type="tel" inputMode="tel" autoComplete="tel" maxLength={16} placeholder="987654321" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
              <p className="rounded-xl bg-beige/70 px-3 py-2 text-xs">Cita: {appointmentLabel(startsAt)}</p>
              <button
                type="submit"
                disabled={!!contactError || sending}
                className="min-h-11 rounded-full bg-nogal px-5 text-sm font-semibold text-marfil transition-colors hover:bg-madera-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? 'Agendando…' : 'Agendar cita'}
              </button>
              {contactError && (name || phone) && <p className="text-xs text-carbon-600">{contactError}</p>}
            </div>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="rounded-xl border border-madera-700/40 bg-madera-700/10 px-3 py-2 text-xs">
          {error}
        </p>
      )}
    </form>
  )
}
