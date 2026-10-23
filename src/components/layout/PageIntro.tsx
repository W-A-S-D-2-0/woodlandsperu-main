import type { ReactNode } from 'react'
import { Container } from '../ui/Container'
import { Embers } from '../ui/Embers'
import { GrowthRings } from '../ui/GrowthRings'

interface PageIntroProps {
  eyebrow: string
  title: string
  children?: ReactNode
}

/** Encabezado estándar de las páginas públicas internas: superficie cálida, anillos y brasas, igual que la portada. */
export function PageIntro({ eyebrow, title, children }: PageIntroProps) {
  return (
    <section className="surface-warm grain relative isolate overflow-hidden py-16 text-beige sm:py-24">
      <GrowthRings className="spin-slow pointer-events-none absolute -top-40 -right-40 -z-10 h-[34rem] w-[34rem] max-w-none text-madera/60 sm:h-[44rem] sm:w-[44rem]" />
      <Embers />
      <Container className="relative">
        <p className="animate-rise text-xs font-semibold tracking-[0.22em] text-ambar uppercase">{eyebrow}</p>
        <h1 className="mt-4 max-w-3xl animate-settle text-4xl leading-tight font-medium text-marfil [animation-delay:60ms] sm:text-6xl">{title}</h1>
        {children && <div className="mt-6 max-w-2xl animate-rise text-lg leading-relaxed text-beige/85 [animation-delay:180ms]">{children}</div>}
        <span aria-hidden="true" className="mt-8 block h-px w-24 bg-linear-to-r from-brasa to-transparent" />
      </Container>
    </section>
  )
}
