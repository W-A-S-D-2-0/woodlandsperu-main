import { useMemo, useRef, useState } from 'react'
import type { InventoryLevel, ListResponse } from '../../../../shared/api/panel-contracts'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { filterLevels, formatDimensions, groupByProduct, parseProductionQuantity, PRODUCTION_MAX, stockStatus } from '../production-logic'
import { newIdempotencyKey } from '../panel-logic'
import { useAdminAction, useAdminQuery } from '../use-admin-api'
import { Badge, EmptyState, inputClass, ModelThumb, Notice, PageHeader, QueryView } from '../ui'

const bigButton =
  'inline-flex min-h-14 items-center justify-center rounded-2xl px-6 text-lg font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50'

/** Una tabla: cuántas hay en el taller y un registro de producción de dos toques (anotar y confirmar). */
function ProductionCard({ level, onDone }: { level: InventoryLevel; onDone: () => void }) {
  const { run, pending, error, clearError } = useAdminAction()
  const [text, setText] = useState('1')
  const [armed, setArmed] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  // Misma clave en los reintentos: si la red falla a medias, no se duplica la producción.
  const key = useRef(newIdempotencyKey())

  const quantity = parseProductionQuantity(text)
  const valid = Number.isFinite(quantity)
  const status = stockStatus(level)

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
      setDone(`Listo: se sumaron ${quantity}. Ahora hay ${level.onHand + quantity} en el taller.`)
      setText('1')
      onDone()
    }
  }

  return (
    <li className="grid gap-4 rounded-2xl border border-linea bg-white p-5">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
        <ModelThumb slug={level.productSlug} className="size-20" />
        <div className="min-w-0">
          <p className="font-display text-2xl leading-tight text-nogal">
            {level.product} {level.variant}
          </p>
          {level.dimensionsLabel && <p className="text-base text-carbon-600">{formatDimensions(level.dimensionsLabel)}</p>}
          {status.state !== 'ok' && (
            <p className="mt-1">
              <Badge tone={status.tone}>{status.label}</Badge>
            </p>
          )}
        </div>
        {/* En el celular va en su propia fila: el número grande no aprieta el nombre. */}
        <div className="col-span-2 flex items-baseline justify-between rounded-xl bg-marfil px-4 py-2 sm:col-span-1 sm:block sm:bg-transparent sm:p-0 sm:text-right">
          <p className="text-base font-semibold text-carbon-600">En el taller</p>
          <p className="font-display text-4xl text-nogal">{level.onHand}</p>
        </div>
      </div>

      <p className="text-lg font-semibold text-carbon">¿Cuántas terminaste?</p>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <button type="button" aria-label="Una menos" className={`${bigButton} w-14 border-2 border-nogal/30 text-2xl text-nogal hover:bg-nogal/5`} onClick={() => step(-1)}>
          −
        </button>
        <input
          aria-label={`Tablas terminadas de ${level.product} ${level.variant}`}
          className={`${inputClass} min-h-14 text-center text-2xl font-bold`}
          inputMode="numeric"
          value={text}
          onChange={(e) => change(e.target.value)}
        />
        <button type="button" aria-label="Una más" className={`${bigButton} w-14 border-2 border-nogal/30 text-2xl text-nogal hover:bg-nogal/5`} onClick={() => step(1)}>
          +
        </button>
      </div>
      <div className="flex gap-2" role="group" aria-label="Cantidades rápidas">
        {[5, 10, 20].map((n) => (
          <button key={n} type="button" aria-pressed={quantity === n} className="min-h-12 flex-1 rounded-xl border-2 border-linea text-lg font-bold text-nogal hover:border-nogal" onClick={() => change(String(n))}>
            {n}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={!valid || pending}
        onClick={() => void register()}
        className={`${bigButton} ${armed ? 'bg-exito text-marfil hover:bg-exito/90' : 'bg-nogal text-marfil hover:bg-nogal-800'}`}
      >
        {pending ? 'Guardando…' : armed ? `Sí, sumar ${quantity} al taller` : 'Anotar'}
      </button>

      {!valid && <p className="text-base font-semibold text-alerta">Escribe un número entero de 1 a {PRODUCTION_MAX}.</p>}
      {armed && (
        <button type="button" className="min-h-12 text-base font-bold text-carbon-600 underline underline-offset-4" onClick={() => setArmed(false)}>
          No, me equivoqué
        </button>
      )}
      {done && (
        <p role="status" className="rounded-xl bg-exito-claro px-4 py-3 text-lg font-bold text-exito">
          {done}
        </p>
      )}
      {error && <Notice>{error}</Notice>}
    </li>
  )
}

/** Pantalla del taller: anotar tablas terminadas con botones grandes, pensada para el celular. */
export function ProductionPage() {
  useDocumentTitle('Producción')
  const { state, reload } = useAdminQuery<ListResponse<InventoryLevel>>('/inventory')
  const [query, setQuery] = useState('')

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Producción" intro="Anota las tablas que terminas. Se suman al stock al instante." />
      <div className="mt-6">
        <label className="grid gap-2 text-base">
          <span className="font-semibold">Buscar una tabla</span>
          <input className={`${inputClass} min-h-14 text-lg`} type="search" placeholder="Por ejemplo: Moshaco" value={query} onChange={(e) => setQuery(e.target.value)} />
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

  if (items.length === 0) return <div className="mt-6"><EmptyState>Aún no hay tablas en el stock.</EmptyState></div>
  if (groups.length === 0) return <div className="mt-6"><EmptyState>No hay resultados para esa búsqueda.</EmptyState></div>

  return (
    <div className="mt-6 grid gap-8">
      {groups.map((group) => (
        <section key={group.product} aria-label={group.product}>
          <h2 className="mb-3 text-2xl">{group.product}</h2>
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
