import type { ReactNode } from 'react'
import { Wordmark } from '../../components/ui/Wordmark'

interface AuthNoticeProps {
  title: string
  children?: ReactNode
  actions?: ReactNode
}

/** Pantalla centrada para el login y los estados de acceso al panel. */
export function AuthNotice({ title, children, actions }: AuthNoticeProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-marfil px-5 py-12">
      <section className="w-full max-w-sm">
        <Wordmark to="/" />
        <h1 className="mt-8 text-3xl">{title}</h1>
        {children && <div className="mt-3 text-sm leading-relaxed text-carbon-600">{children}</div>}
        {actions && <div className="mt-8 flex flex-wrap gap-3">{actions}</div>}
      </section>
    </div>
  )
}

export const primaryButtonClass =
  'inline-flex min-h-11 items-center justify-center rounded-full bg-nogal px-6 text-sm font-semibold text-marfil transition-colors hover:bg-nogal-800 disabled:cursor-not-allowed disabled:opacity-60'

export const secondaryButtonClass =
  'inline-flex min-h-11 items-center justify-center rounded-full border border-nogal/30 px-6 text-sm font-semibold text-nogal transition-colors hover:border-nogal hover:bg-nogal/5'
