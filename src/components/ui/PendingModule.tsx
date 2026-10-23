import type { ReactNode } from 'react'

interface PendingModuleProps {
  title: string
  phase: string
  description: string
  /** Lista de capacidades previstas, para que el equipo y la empresa sepan qué llegará. */
  planned?: readonly string[]
  children?: ReactNode
}

/**
 * Estado explícito de "módulo en construcción". Evita pantallas que aparenten
 * funcionalidades completas: no muestra datos, tablas vacías ni botones sin acción.
 */
export function PendingModule({ title, phase, description, planned = [], children }: PendingModuleProps) {
  return (
    <section className="rounded-2xl border border-dashed border-linea bg-white/60 p-6 sm:p-8">
      <p className="text-xs font-semibold tracking-[0.18em] text-madera-700 uppercase">En construcción · {phase}</p>
      <h2 className="mt-3 text-2xl sm:text-3xl">{title}</h2>
      <p className="mt-3 max-w-2xl text-carbon-600">{description}</p>
      {planned.length > 0 && (
        <ul className="mt-6 grid gap-2 text-sm text-carbon sm:grid-cols-2">
          {planned.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-madera" />
              {item}
            </li>
          ))}
        </ul>
      )}
      {children}
    </section>
  )
}
