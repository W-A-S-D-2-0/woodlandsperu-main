import { useState, type FormEvent } from 'react'
import { WEB_ORDER_MAX_UNITS } from '../../../shared/api/public-schemas'
import { orderCardMessage, photoForModel, quantityOptions, type ProductRow } from './chat-logic'

const ENGRAVING_MAX = 60
const QUANTITIES = quantityOptions(WEB_ORDER_MAX_UNITS)

/**
 * El pedido en una sola tarjeta dentro del chat: se elige el modelo, la cantidad y, si se quiere, el grabado. Al continuar se
 * manda un solo mensaje; con grabado, Teca muestra enseguida cómo queda la tabla.
 */
export function OrderCard({ rows, onSubmit }: { rows: ProductRow[]; onSubmit: (message: string) => void }) {
  const [chosen, setChosen] = useState<number | null>(rows.length === 1 ? rows[0]!.n : null)
  const [quantity, setQuantity] = useState(1)
  const [engrave, setEngrave] = useState(false)
  const [text, setText] = useState('')
  const row = rows.find((r) => r.n === chosen) ?? null
  const ready = !!row && (!engrave || text.trim().length > 0)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!row || !ready) return
    onSubmit(orderCardMessage(row, quantity, engrave ? text : null))
  }

  return (
    <form onSubmit={submit} className="mt-3 grid gap-3 rounded-2xl border border-linea bg-marfil p-3 whitespace-normal" aria-label="Tu pedido">
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-[0.7rem] font-semibold tracking-[0.08em] text-madera-700 uppercase">Modelo</legend>
        {rows.map((r) => {
          const photo = photoForModel(r.product)
          const active = r.n === chosen
          return (
            <label
              key={r.n}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-1.5 pr-3 transition-colors focus-within:ring-2 focus-within:ring-madera/40 ${
                active ? 'border-nogal bg-white shadow-sm' : 'border-linea bg-white/60 hover:bg-white'
              }`}
            >
              <input type="radio" name="order-model" className="sr-only" checked={active} onChange={() => setChosen(r.n)} />
              {photo && <img src={photo.src} alt="" loading="lazy" className="size-12 shrink-0 rounded-lg object-cover" />}
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block font-medium text-nogal">
                  {r.product} · {r.variant}
                </span>
                {r.dimensions && <span className="block text-xs text-carbon-600">{r.dimensions}</span>}
              </span>
              <span className="shrink-0 text-xs font-semibold whitespace-nowrap text-madera-700">{r.price}</span>
              <span aria-hidden="true" className={`size-4 shrink-0 rounded-full border-2 ${active ? 'border-nogal bg-nogal shadow-[inset_0_0_0_2px_var(--color-marfil)]' : 'border-linea'}`} />
            </label>
          )
        })}
      </fieldset>

      <label className="grid gap-1 text-[0.7rem] font-semibold tracking-[0.08em] text-madera-700 uppercase">
        Cantidad
        <select
          className="min-h-11 w-full rounded-xl border border-linea bg-white px-3 text-sm font-normal tracking-normal text-carbon normal-case focus-visible:border-madera"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
        >
          {QUANTITIES.map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? 'tabla' : 'tablas'}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-2">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-linea bg-white px-3 text-sm text-carbon">
          <input type="checkbox" className="size-5 shrink-0 accent-[var(--color-nogal)]" checked={engrave} onChange={(e) => setEngrave(e.target.checked)} />
          Quiero mi tabla con grabado
        </label>
        {engrave && (
          <label className="grid animate-chip-in gap-1 text-[0.7rem] font-semibold tracking-[0.08em] text-madera-700 uppercase">
            Nombre o frase a grabar
            <input
              className="min-h-11 w-full rounded-xl border border-linea bg-white px-3 text-sm font-normal tracking-normal text-carbon normal-case focus-visible:border-madera"
              maxLength={ENGRAVING_MAX}
              placeholder="Ejemplo: Familia Pérez"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <span className="text-[0.7rem] font-normal tracking-normal text-carbon-600 normal-case">Al continuar verás cómo queda tu tabla.</span>
          </label>
        )}
      </div>

      <button
        type="submit"
        disabled={!ready}
        className="min-h-11 rounded-full bg-nogal px-5 text-sm font-semibold text-marfil transition-colors hover:bg-madera-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {row ? 'Continuar' : 'Elige un modelo'}
      </button>
    </form>
  )
}
