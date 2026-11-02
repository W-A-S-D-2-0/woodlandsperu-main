import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { modelPhotos } from '../../content/model-photos'
import { shortCollectionName, type Collection, type StatusTone, type StepState } from './panel-logic'
import type { QueryState } from './use-admin-api'

/** Piezas visuales compartidas por las pantallas del panel. Solo tokens de marca. */

export const inputClass =
  'min-h-12 w-full rounded-xl border border-linea bg-white px-4 text-base text-carbon placeholder:text-carbon-600/80 focus-visible:border-nogal'

export const primaryButton =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-nogal px-6 text-base font-bold text-marfil transition-colors hover:bg-nogal-800 disabled:cursor-not-allowed disabled:opacity-50'

export const secondaryButton =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-nogal/40 px-6 text-base font-bold text-nogal transition-colors hover:border-nogal hover:bg-nogal/5 disabled:cursor-not-allowed disabled:opacity-50'

/** Botones grandes para la acción principal de una pantalla. */
export const primaryButtonLarge =
  'inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-nogal px-7 text-lg font-bold text-marfil transition-colors hover:bg-nogal-800 disabled:cursor-not-allowed disabled:opacity-50'
export const secondaryButtonLarge =
  'inline-flex min-h-14 items-center justify-center gap-2 rounded-full border-2 border-nogal/40 px-7 text-lg font-bold text-nogal transition-colors hover:border-nogal hover:bg-nogal/5 disabled:cursor-not-allowed disabled:opacity-50'

export const dangerButton =
  'inline-flex min-h-12 items-center justify-center rounded-full border-2 border-alerta px-6 text-base font-bold text-alerta transition-colors hover:bg-alerta hover:text-marfil disabled:cursor-not-allowed disabled:opacity-50'

export function PageHeader({ title, intro, actions }: { title: string; intro?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-3xl sm:text-4xl">{title}</h1>
        <span aria-hidden="true" className="mt-3 block h-0.5 w-10 rounded-full bg-madera" />
        {intro && <p className="mt-3 max-w-2xl text-lg text-carbon-600">{intro}</p>}
      </div>
      {actions}
    </header>
  )
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex min-h-12 items-center text-base font-bold text-madera-700 hover:underline">
      ← {children}
    </Link>
  )
}

export function Card({ title, children, className = '', id }: { title?: string; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`rounded-2xl border border-linea bg-white p-6 ${className}`}>
      {title && <h2 className="text-2xl">{title}</h2>}
      <div className={title ? 'mt-4' : ''}>{children}</div>
    </section>
  )
}

/** Colores de estado: verde = listo o pagado, ámbar = falta algo, rojo = problema, nogal = en marcha, gris = cerrado. */
const tones: Record<StatusTone, { chip: string; dot: string }> = {
  neutral: { chip: 'bg-beige text-carbon', dot: 'bg-carbon-600' },
  good: { chip: 'bg-exito-claro text-exito', dot: 'bg-exito' },
  warn: { chip: 'bg-aviso-claro text-aviso', dot: 'bg-madera' },
  alert: { chip: 'bg-alerta-claro text-alerta', dot: 'bg-alerta' },
  info: { chip: 'bg-nogal text-marfil', dot: 'bg-ambar' },
  muted: { chip: 'bg-carbon/5 text-carbon-600', dot: 'bg-carbon-600/50' },
}

/** Etiqueta de estado con un punto de color: se entiende de un vistazo, sin depender solo del color. */
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: StatusTone }) {
  return (
    <span className={`inline-flex min-h-8 items-center gap-2 whitespace-nowrap rounded-full px-3 text-sm font-bold ${tones[tone].chip}`}>
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${tones[tone].dot}`} />
      {children}
    </span>
  )
}

export function Notice({ children, kind = 'error' }: { children: ReactNode; kind?: 'error' | 'info' }) {
  return (
    <p
      role={kind === 'error' ? 'alert' : 'status'}
      className={`rounded-xl border px-4 py-3 text-base ${
        kind === 'error' ? 'border-alerta/40 bg-alerta-claro text-carbon' : 'border-linea bg-beige/50 text-carbon'
      }`}
    >
      {children}
    </p>
  )
}

/** Muestra carga, error (con reintento) o el contenido cuando los datos están listos. */
export function QueryView<T>({
  state,
  onRetry,
  children,
}: {
  state: QueryState<T>
  onRetry: () => void
  children: (data: T) => ReactNode
}) {
  if (state.status === 'loading') {
    return (
      <div role="status" aria-label="Cargando" className="mt-6 grid gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-beige/60 motion-reduce:animate-none" />
        ))}
      </div>
    )
  }
  if (state.status === 'error') {
    return (
      <div className="grid justify-items-start gap-3 py-6">
        <Notice>{state.message}</Notice>
        <button type="button" className={secondaryButton} onClick={onRetry}>
          Reintentar
        </button>
      </div>
    )
  }
  return <>{children(state.data)}</>
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-linea bg-white/60 px-5 py-10 text-center text-base text-carbon-600">{children}</p>
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-base">
      <span className="font-semibold text-carbon">{label}</span>
      {children}
      {hint && <span className="text-sm text-carbon-600">{hint}</span>}
    </label>
  )
}

/** Tabla con desplazamiento horizontal en pantallas angostas. */
export function DataTable({ caption, head, children }: { caption: string; head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-linea bg-white">
      <table className="w-full min-w-[36rem] border-collapse text-left text-base">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-linea bg-beige/40 text-sm text-carbon-600">
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-3 font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:transition-colors [&>tr:hover]:bg-beige/30 [&>tr:not(:last-child)]:border-b [&>tr]:border-linea/70">{children}</tbody>
      </table>
    </div>
  )
}

export function Stat({
  label,
  value,
  hint,
  to,
  alert = false,
}: {
  label: string
  value: ReactNode
  hint?: string
  /** Si se indica, la tarjeta lleva a esa pantalla. */
  to?: string
  /** Resalta la tarjeta cuando hay algo que atender. */
  alert?: boolean
}) {
  const body = (
    <>
      <p className="text-base font-semibold text-carbon-600">{label}</p>
      <p className={`mt-1 font-display text-4xl ${alert ? 'text-aviso' : 'text-nogal'}`}>{value}</p>
      {hint && <p className="mt-1 text-sm text-carbon-600">{hint}</p>}
      {to && <p className="mt-3 text-base font-bold text-madera-700">Ver →</p>}
    </>
  )
  const base = `block rounded-2xl border p-6 ${alert ? 'border-madera/60 bg-aviso-claro' : 'border-linea bg-white'}`
  return to ? (
    <Link to={to} className={`${base} transition-shadow hover:shadow-md focus-visible:shadow-md`}>
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  )
}

const stepCols: Record<number, string> = { 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4', 5: 'sm:grid-cols-5' }

/** Línea de pasos (pedido, cotización): en el celular va en columna; en pantallas anchas, en fila con una barra de avance. */
export function StepLine({ steps }: { steps: readonly { label: string; state: StepState }[] }) {
  const n = steps.length
  const reached = steps.reduce((last, s, i) => (s.state === 'pending' ? last : i), -1)
  const edge = 50 / n
  return (
    <div className="relative">
      <div aria-hidden="true" className="absolute top-6 hidden h-1 rounded-full bg-linea sm:block" style={{ left: `${edge}%`, right: `${edge}%` }} />
      <div
        aria-hidden="true"
        className="absolute top-6 hidden h-1 rounded-full bg-exito sm:block"
        style={{ left: `${edge}%`, width: `${n > 1 ? (Math.max(reached, 0) / (n - 1)) * (100 - 2 * edge) : 0}%` }}
      />
      <ol className={`relative grid gap-3 sm:gap-0 ${stepCols[n] ?? ''}`}>
        {steps.map((step, i) => (
          <li key={step.label} className="flex items-center gap-4 sm:flex-col sm:gap-2 sm:text-center" aria-current={step.state === 'current' ? 'step' : undefined}>
            <span
              className={`flex size-13 shrink-0 items-center justify-center rounded-full text-lg font-bold ${
                step.state === 'done'
                  ? 'bg-exito text-marfil'
                  : step.state === 'current'
                    ? 'bg-nogal text-marfil ring-6 ring-beige'
                    : 'border-[3px] border-linea bg-white text-carbon-600'
              }`}
            >
              {step.state === 'done' ? (
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m5 12.5 4.5 4.5L19 7.5" />
                </svg>
              ) : (
                i + 1
              )}
            </span>
            <span className={`text-base ${step.state === 'current' ? 'font-bold text-carbon' : step.state === 'done' ? 'font-semibold text-exito' : 'text-carbon-600'}`}>
              {step.label}
              {step.state === 'done' && <span className="sr-only"> (hecho)</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Recuadro «Siguiente paso»: qué toca hacer y, al lado, el botón o formulario para hacerlo. */
export function NextStep({ label = 'Siguiente paso', title, help, children }: { label?: string; title: string; help: string; children?: ReactNode }) {
  return (
    <div className="grid gap-4 rounded-2xl bg-marfil p-5 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
      <div className="grid gap-1">
        <p className="text-base font-bold text-madera-700">{label}</p>
        <p className="text-2xl font-bold text-carbon">{title}</p>
        <p className="text-lg text-carbon-600">{help}</p>
      </div>
      {children}
    </div>
  )
}

/** Botones para ver una colección a la vez ("Todas" deja ver todo). El valor vacío es "Todas". */
export function CollectionSwitch({ collections, value, onChange }: { collections: readonly Collection[]; value: string; onChange: (slug: string) => void }) {
  if (collections.length < 2) return null
  const options = [{ slug: '', label: 'Todas' }, ...collections.map((c) => ({ slug: c.slug, label: shortCollectionName(c.name) }))]
  return (
    <div role="group" aria-label="Colección" className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.slug}
          type="button"
          aria-pressed={o.slug === value}
          onClick={() => onChange(o.slug)}
          className={`min-h-12 rounded-full border-2 px-5 text-base font-bold transition-colors ${o.slug === value ? 'border-nogal bg-nogal text-marfil' : 'border-linea bg-white text-nogal hover:border-nogal'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Foto oficial del modelo (por su slug). Es decorativa: el nombre ya está al lado. Sin foto, deja un recuadro neutro. */
export function ModelThumb({ slug, className = 'size-16' }: { slug: string; className?: string }) {
  const photo = modelPhotos[slug]
  return photo ? (
    <img src={photo.src} alt="" loading="lazy" decoding="async" className={`${className} shrink-0 rounded-lg border border-linea object-cover`} />
  ) : (
    <span aria-hidden="true" className={`${className} shrink-0 rounded-lg border border-dashed border-linea bg-beige/40`} />
  )
}
