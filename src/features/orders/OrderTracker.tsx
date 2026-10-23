import { useId, useState, type FormEvent } from 'react'
import type { OrderStatusResponse } from '../../../shared/api/contracts'
import { ApiError, apiFetch } from '../../lib/api'
import { trackingHeadline, validateTracking, type TrackingFormErrors } from './tracking-logic'

const inputClass =
  'min-h-11 w-full rounded-lg border border-linea bg-white px-3 text-base text-carbon placeholder:text-carbon-600/70 focus-visible:border-nogal'

/**
 * Consulta pública del estado de un pedido con su código y el correo o teléfono del pedido.
 * La API responde lo mismo si el pedido no existe o si el contacto no coincide.
 * `onResult` avisa el estado para resaltarlo en la línea de tiempo.
 */
export function OrderTracker({ onResult }: { onResult: (order: OrderStatusResponse | null) => void }) {
  const codeId = useId()
  const contactId = useId()
  const [code, setCode] = useState('')
  const [contact, setContact] = useState('')
  const [errors, setErrors] = useState<TrackingFormErrors>({})
  const [message, setMessage] = useState<string | null>(null)
  const [order, setOrder] = useState<OrderStatusResponse | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setMessage(null)
    const result = validateTracking(code, contact)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    setPending(true)
    try {
      const found = await apiFetch<OrderStatusResponse>('/api/orders/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.body),
      })
      setOrder(found)
      onResult(found)
    } catch (error) {
      setOrder(null)
      onResult(null)
      setMessage(
        error instanceof ApiError && error.status !== 0 && error.status < 500
          ? error.message
          : 'No pudimos consultar tu pedido. Revisa tu conexión e inténtalo de nuevo.',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="rounded-2xl border border-linea bg-white/80 p-6 sm:p-7">
      <h3 className="text-2xl">Consulta tu pedido</h3>
      <p className="mt-2 text-sm text-carbon-600">Escribe tu código y el correo o teléfono con el que hiciste el pedido.</p>

      <form onSubmit={(e) => void submit(e)} className="mt-5 grid gap-4" noValidate>
        <div className="grid gap-1.5 text-sm">
          <label htmlFor={codeId} className="font-medium">
            Código del pedido
          </label>
          <input id={codeId} className={inputClass} placeholder="PED-000123" autoComplete="off" aria-invalid={!!errors.code} value={code} onChange={(e) => setCode(e.target.value)} />
          {errors.code && <p className="text-xs font-medium text-madera-700">{errors.code}</p>}
        </div>
        <div className="grid gap-1.5 text-sm">
          <label htmlFor={contactId} className="font-medium">
            Correo o teléfono
          </label>
          <input id={contactId} className={inputClass} autoComplete="off" aria-invalid={!!errors.contact} value={contact} onChange={(e) => setContact(e.target.value)} />
          {errors.contact && <p className="text-xs font-medium text-madera-700">{errors.contact}</p>}
        </div>
        {message && (
          <p role="alert" className="rounded-lg border border-madera-700 bg-madera-700/10 px-4 py-3 text-sm">
            {message}
          </p>
        )}
        <div>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-nogal px-6 text-sm font-semibold text-marfil transition-colors hover:bg-nogal-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? 'Consultando…' : 'Ver estado'}
          </button>
        </div>
      </form>

      {order && (
        <div role="status" className="mt-6 border-t border-linea pt-5">
          <p className="text-xs font-semibold tracking-[0.18em] text-madera-700 uppercase">{order.code}</p>
          <p className="mt-1 font-display text-2xl text-nogal">{trackingHeadline(order)}</p>
          {order.deliveryEstimateNote && <p className="mt-2 text-sm text-carbon-600">Plazo estimado: {order.deliveryEstimateNote}</p>}
          <ul className="mt-3 grid gap-1 text-sm text-carbon">
            {order.items.map((item, index) => (
              <li key={index}>
                {item.quantity} × {item.description}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
