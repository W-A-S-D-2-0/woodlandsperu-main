import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { modelPhotos } from '../../content/model-photos'
import { shortCollectionName, type Collection } from './panel-logic'
import type { QueryState } from './use-admin-api'

/** Piezas visuales compartidas por las pantallas del panel. Solo tokens de marca. */

export const inputClass =
  'min-h-11 w-full rounded-lg border border-linea bg-white px-3 text-sm text-carbon placeholder:text-carbon-600/70 focus-visible:border-nogal'

export const primaryButton =
  'inline-flex min-h-11 items-center justify-center rounded-full bg-nogal px-5 text-sm font-semibold text-marfil transition-colors hover:bg-nogal-800 disabled:cursor-not-allowed disabled:opacity-50'

export const secondaryButton =
  'inline-flex min-h-11 items-center justify-center rounded-full border border-nogal/30 px-5 text-sm font-medium text-nogal transition-colors hover:border-nogal hover:bg-nogal/5 disabled:cursor-not-allowed disabled:opacity-50'

export const dangerButton =
  'inline-flex min-h-11 items-center justify-center rounded-full border border-madera-700 px-5 text-sm font-medium text-madera-700 transition-colors hover:bg-madera-700 hover:text-marfil disabled:cursor-not-allowed disabled:opacity-50'

export function PageHeader({ title, intro, actions }: { title: string; intro?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-3xl sm:text-4xl">{title}</h1>
        <span aria-hidden="true" className="mt-3 block h-0.5 w-10 rounded-full bg-madera" />
        {intro && <p className="mt-2 max-w-2xl text-carbon-600">{intro}</p>}
      </div>
      {actions}
    </header>
  )
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex min-h-11 items-center text-sm font-medium text-madera-700 hover:underline">
      ← {children}
    </Link>
  )
}

export function Card({ title, children, className = '', id }: { title?: string; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`rounded-2xl border border-linea bg-white/70 p-5 ${className}`}>
      {title && <h2 className="font-sans text-sm font-semibold tracking-[0.12em] text-madera-700 uppercase">{title}</h2>}
      <div className={title ? 'mt-3' : ''}>{children}</div>
    </section>
  )
}

const tones = {
  neutral: { chip: 'bg-beige text-carbon', dot: 'bg-carbon-600' },
  good: { chip: 'bg-nogal/10 text-nogal', dot: 'bg-nogal' },
  warn: { chip: 'bg-madera-700 text-marfil', dot: 'bg-marfil' },
  info: { chip: 'bg-madera/15 text-madera-700', dot: 'bg-madera' },
  muted: { chip: 'bg-carbon/5 text-carbon-600', dot: 'bg-carbon-600/50' },
} as const

/** Etiqueta de estado con un punto de color: se entiende de un vistazo, sin depender solo del color. */
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: keyof typeof tones }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone].chip}`}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${tones[tone].dot}`} />
      {children}
    </span>
  )
}

export function Notice({ children, kind = 'error' }: { children: ReactNode; kind?: 'error' | 'info' }) {
  return (
    <p
      role={kind === 'error' ? 'alert' : 'status'}
      className={`rounded-lg border px-4 py-3 text-sm ${
        kind === 'error' ? 'border-madera-700 bg-madera-700/10 text-carbon' : 'border-linea bg-beige/50 text-carbon'
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
  return <p className="rounded-2xl border border-dashed border-linea bg-white/50 px-5 py-8 text-center text-sm text-carbon-600">{children}</p>
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium text-carbon">{label}</span>
      {children}
      {hint && <span className="text-xs text-carbon-600">{hint}</span>}
    </label>
  )
}

/** Tabla con desplazamiento horizontal en pantallas angostas. */
export function DataTable({ caption, head, children }: { caption: string; head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-linea bg-white/70">
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-linea text-xs tracking-[0.1em] text-carbon-600 uppercase">
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-3 font-semibold">
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
      <p className="text-xs tracking-[0.12em] text-carbon-600 uppercase">{label}</p>
      <p className={`mt-2 font-display text-3xl ${alert ? 'text-madera-700' : 'text-nogal'}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-carbon-600">{hint}</p>}
      {to && <p className="mt-3 text-xs font-semibold text-madera-700">Ver →</p>}
    </>
  )
  const base = `block rounded-2xl border p-5 ${alert ? 'border-madera bg-madera/10' : 'border-linea bg-white/70'}`
  return to ? (
    <Link to={to} className={`${base} transition-shadow hover:shadow-md focus-visible:shadow-md`}>
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
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
          className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors ${o.slug === value ? 'border-nogal bg-nogal text-marfil' : 'border-nogal/30 text-nogal hover:border-nogal'}`}
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
