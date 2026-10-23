import { Link } from 'react-router'
import { brand } from '../../content/site'

interface WordmarkProps {
  to?: string
  tone?: 'dark' | 'light'
  suffix?: string
}

/** Logotipo: ícono de anillos (PNG entregado por el equipo) y nombre en texto. Reemplazar por el vector oficial cuando exista. */
export function Wordmark({ to = '/', tone = 'dark', suffix }: WordmarkProps) {
  const color = tone === 'dark' ? 'text-nogal' : 'text-marfil'
  return (
    <Link to={to} className={`inline-flex items-center gap-2.5 ${color}`} aria-label={`${brand.name}, ir al inicio`}>
      <img src="/images/brand/logo-mark.png" alt="" width={230} height={215} className="h-8 w-auto" />
      <span className="flex items-baseline gap-2">
        <span className="font-display text-xl font-semibold tracking-tight">Woodland</span>
        <span className="text-[0.7rem] font-semibold tracking-[0.3em] uppercase opacity-80">{suffix ?? 'Perú'}</span>
      </span>
    </Link>
  )
}
