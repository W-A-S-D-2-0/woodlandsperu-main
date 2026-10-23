import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { openChat } from '../../features/chat/open-chat'

type Variant = 'primary' | 'secondary' | 'ghost' | 'light' | 'ghost-light'

const base =
  'group inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold tracking-wide transition-[background-color,border-color,color,box-shadow] duration-300 ease-suave'

const variants: Record<Variant, string> = {
  primary: 'bg-madera-700 text-marfil hover:bg-nogal hover:shadow-[0_10px_24px_-14px_rgb(43_33_24/0.7)]',
  secondary: 'border border-nogal/30 text-nogal hover:border-nogal hover:bg-nogal/5',
  ghost: 'text-nogal underline-offset-4 hover:underline',
  // Para fondos oscuros (nogal): acento brasa.
  light: 'bg-brasa text-nogal-800 hover:bg-ambar hover:shadow-[0_10px_30px_-10px_rgb(224_138_60/0.7)]',
  'ghost-light': 'border border-marfil/30 text-marfil hover:border-ambar hover:text-ambar',
}

interface ButtonLinkProps {
  /** Destino interno. Con `chat`, en su lugar se abre el chat. */
  to?: string
  /** Abre el chat; si es texto, se envía como primer mensaje. */
  chat?: string | true
  children: ReactNode
  variant?: Variant
  /** Muestra una flecha que avanza ligeramente al pasar el cursor. */
  arrow?: boolean
  className?: string
}

/** Enlace interno con apariencia de botón. Para acciones (submit, onClick) usar un <button>. */
export function ButtonLink({ to, chat, children, variant = 'primary', arrow = false, className = '' }: ButtonLinkProps) {
  const classes = `${base} ${variants[variant]} ${className}`
  const content = (
    <>
      {children}
      {arrow && (
        <span aria-hidden="true" className="transition-transform duration-300 ease-suave group-hover:translate-x-1">
          →
        </span>
      )}
    </>
  )
  if (chat !== undefined) {
    return (
      <button type="button" onClick={() => openChat(chat === true ? undefined : chat)} className={classes}>
        {content}
      </button>
    )
  }
  return (
    <Link to={to ?? '/'} viewTransition className={classes}>
      {content}
    </Link>
  )
}
