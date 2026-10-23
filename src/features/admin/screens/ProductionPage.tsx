import { useMemo, useRef, useState } from 'react'
import type { InventoryLevel, ListResponse } from '../../../../shared/api/panel-contracts'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { filterLevels, groupByProduct, parseProductionQuantity, PRODUCTION_MAX } from '../production-logic'
import { newIdempotencyKey } from '../panel-logic'
import { useAdminAction, useAdminQuery } from '../use-admin-api'
import { Badge, EmptyState, inputClass, Notice, PageHeader, QueryView } from '../ui'

const bigButton =
  'inline-flex min-h-14 items-center justify-center rounded-2xl px-6 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50'

/** Una variante: cuántas hay en el taller y un registro de producción de dos toques (anotar y confirmar). */
function ProductionCard({ level, onDone }: { level: InventoryLevel; onDone: () => void }) {
  const { run, pending, error, clearError } = useAdminAction()
  const [text, setText] = useState('1')
  const [armed, setArmed] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  // Misma clave en los reintentos: si la red falla a medias, no se duplica la producción.
  const key = useRef(newIdempotencyKey())

  const quantity = parseProductionQuantity(text)
  const valid = Number.isFinite(quantity)

  const change = (value: string) => {
    setText(value)
    setArmed(false)
    setDone(null)
    clearError()
  }
  const step = (delta: number) => change(String(Math.min(PRODUCTION_MAX, Math.max(1, (Number.isFinite(quantity) ? quantity : 1) + delta))))

  async function register() {
    if (!valid) return
    if (!armed) return setArmed(true)
    const result = await run('POST', '/inventory/movements', {
      variantId: level.variantId,
      type: 'production_in',
      quantity,
      idempotencyKey: key.current,
    })
    setArmed(false)
    if (result) {
      key.current = newIdempotencyKey()
      setDone(`Registrado: +${quantity}. Ahora hay ${level.onHand + quantity} en el taller.`)
      setText('1')
      onDone()
    }
  }

  return (
    <li className="grid gap-4 rounded-2xl border border-linea bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-2xl text-nogal">{level.variant}</p>
          <p className="text-sm text-carbon-600">
            {level.product}
            {level.dimensionsLabel && ` · ${level.dimensionsLabel}`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs tracking-[0.1em] text-carbon-600 uppercase">En el taller</p>
          <p className="font-display text-4xl text-nogal">{level.onHand}</p>
          {level.lowStock && <Badge tone="warn">Poco stock</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <button type="button" aria-label="Una menos" className={`${bigButton} w-14 border border-nogal/30 text-nogal hover:bg-nogal/5`} onClick={() => step(-1)}>
          −
        </button>
        <input
          aria-label={`Piezas terminadas de ${level.product} ${level.variant}`}
          className={`${inputClass} min-h-14 text-center text-2xl`}
          inputMode="numeric"
          value={text}
          onChange={(e) => change(e.target.value)}
        />
        <button type="button" aria-label="Una más" className={`${bigButton} w-14 border border-nogal/30 text-nogal hover:bg-nogal/5`} onClick={() => step(1)}>
          +
        </button>
      </div>

      <button
        type="button"
        disabled={!valid || pending}
        onClick={() => void register()}
        className={`${bigButton} ${armed ? 'bg-madera-700 text-marfil hover:bg-madera' : 'bg-nogal text-marfil hover:bg-nogal-800'}`}
      >
        {pending ? 'Guardando…' : armed ? `Confirmar: sumar ${quantity}` : 'Registrar producción'}
      </button>

      {!valid && <p className="text-sm font-medium text-madera-700">Escribe un número entero de 1 a {PRODUCTION_MAX}.</p>}
      {armed && (
        <button type="button" className="min-h-11 text-sm font-medium text-carbon-600 underline underline-offset-4" onClick={() => setArmed(false)}>
          Cancelar
        </button>
      )}
      {done && <Notice kind="info">{done}</Notice>}
      {error && <Notice>{error}</Notice>}
    </li>
  )
}

/** Pantalla del taller: registrar tablas terminadas con botones grandes, pensada para el celular. */
export function ProductionPage() {
  useDocumentTitle('Producción')
  const { state, reload } = useAdminQuery<ListResponse<InventoryLevel>>('/inventory')
  const [query, setQuery] = useState('')

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Producción" intro="Anota cada tabla que terminas. Se suma al inventario al instante." />
      <div className="mt-6">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Buscar</span>
          <input className={`${inputClass} min-h-14 text-lg`} type="search" placeholder="Modelo, medida o código" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      <QueryView state={state} onRetry={reload}>
        {({ items }) => <Results items={items} query={query} onDone={reload} />}
      </QueryView>
    </div>
  )
}

function Results({ items, query, onDone }: { items: InventoryLevel[]; query: string; onDone: () => void }) {
  const groups = useMemo(() => groupByProduct(filterLevels(items, query)), [items, query])

  if (items.length === 0) return <div className="mt-6"><EmptyState>Aún no hay productos con inventario.</EmptyState></div>
  if (groups.length === 0) return <div className="mt-6"><EmptyState>No hay resultados para esa búsqueda.</EmptyState></div>

  return (
    <div className="mt-6 grid gap-8">
      {groups.map((group) => (
        <section key={group.product} aria-label={group.product}>
          <h2 className="mb-3 font-sans text-sm font-semibold tracking-[0.12em] text-madera-700 uppercase">{group.product}</h2>
          <ul className="grid gap-4">
            {group.levels.map((level) => (
              <ProductionCard key={level.variantId} level={level} onDone={onDone} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
