import type { CSSProperties } from 'react'
import { ButtonLink } from '../../../components/ui/ButtonLink'
import { Container } from '../../../components/ui/Container'
import { Embers } from '../../../components/ui/Embers'
import { PhotoSlot } from '../../../components/ui/PhotoSlot'
import { HeroMedia } from './HeroMedia'
import { homeContent, landingImages } from '../../../content/home'
import { usePointerDepth, useScrollProgress } from '../../../hooks/useScrollProgress'

/** Variables CSS de una capa: cuánto se mueve con el scroll (dy) y con el puntero (dx, pdy). */
const layer = (vars: Record<string, string>) => vars as CSSProperties

/** Anillos de crecimiento de la madera: la "firma" visual de la marca, de fondo y muy sutil. */
function Rings({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 400 400" className={className} fill="none" stroke="currentColor">
      {Array.from({ length: 11 }, (_, i) => (
        <ellipse
          key={i}
          cx="200"
          cy="200"
          rx={26 + i * 17}
          ry={22 + i * 15}
          strokeWidth="1"
          strokeOpacity={0.9 - i * 0.07}
          transform={`rotate(${i * 7} 200 200)`}
        />
      ))}
    </svg>
  )
}

/**
 * Capítulo 1 · Portada. Cuatro planos con profundidad: anillos de fondo, titular, foto principal y
 * foto de primer plano. Se mueven distinto con el scroll y con el puntero; el titular queda entre
 * planos (la foto principal tapa solo el final de sus líneas cortas).
 */
export function HeroChapter() {
  const { hero } = homeContent
  const ref = useScrollProgress<HTMLElement>('leave')
  usePointerDepth(ref)
  const [first = '', ...rest] = hero.title.split(' ')

  return (
    <section ref={ref} className="chapter surface-warm grain relative overflow-hidden pt-8 pb-20 sm:pt-12 sm:pb-28 lg:pb-32">
      {/* Plano 1 · fondo: anillos que se mueven más lento que todo lo demás. */}
      <div className="depth pointer-events-none absolute -top-24 -right-40 text-madera/40" style={layer({ '--dy': '70px', '--dx': '-8px', '--pdy': '-6px' })}>
        <Rings className="h-[46rem] w-[46rem] max-w-none" />
      </div>
      {/* Plano 4 · atmósfera: luz cálida al pie, sin tapar contenido. */}
      <Embers />

      <Container className="relative grid items-center gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-0">
        {/* Plano 2 · titular. */}
        <div className="relative z-10 lg:pr-4">
          <div className="animate-rise">
            <p className="text-xs font-semibold tracking-[0.22em] text-ambar uppercase">{hero.eyebrow}</p>
          </div>
          <h1 className="mt-5 animate-settle text-5xl leading-[0.98] font-medium tracking-tight [animation-delay:60ms] sm:text-6xl lg:text-7xl text-marfil">
            <span className="block">{first}</span>
            <span className="text-shimmer block">{rest.join(' ')}</span>
          </h1>
          <p className="mt-7 max-w-md animate-rise text-lg leading-relaxed text-beige/80 [animation-delay:180ms]">{hero.body}</p>
          <div className="mt-9 flex animate-rise flex-col gap-3 [animation-delay:300ms] sm:flex-row">
            <ButtonLink chat="Quiero hacer un pedido" variant="light" arrow>
              Hacer mi pedido
            </ButtonLink>
            <ButtonLink chat={hero.primaryCta.chat} variant="ghost-light">
              {hero.primaryCta.label}
            </ButtonLink>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md pb-20 lg:-ml-20 lg:max-w-none lg:pt-24 lg:pb-24 lg:pl-0">
          {/* Plano 3 · sujeto: foto principal. */}
          <div className="depth relative z-20 lg:max-w-[23rem] lg:ml-auto" style={layer({ '--dy': '-40px', '--dx': '14px', '--pdy': '10px' })}>
            <HeroMedia fallback={landingImages.hero} />
          </div>
          {/* Plano 5 · primer plano: foto pequeña que cruza por delante y se mueve más rápido. */}
          <div className="depth absolute bottom-0 left-0 z-30 w-[46%] animate-rise [animation-delay:650ms] lg:left-0" style={layer({ '--dy': '-120px', '--dx': '-26px', '--pdy': '18px' })}>
            <PhotoSlot
              label="kit de bienvenida en tabla de teca"
              image={landingImages.heroDetail}
              className="aspect-square shadow-[0_24px_40px_-20px_rgb(34_34_31/0.5)] ring-8 ring-nogal-800"
            />
          </div>
          <p
            className="depth absolute top-6 right-0 z-40 animate-rise rounded-full bg-marfil/95 px-4 py-2 text-xs font-semibold text-nogal shadow-sm [animation-delay:800ms] sm:-right-2 lg:top-28"
            style={layer({ '--dy': '-70px', '--dx': '20px' })}
          >
            <span aria-hidden="true" className="mr-2 inline-block h-1.5 w-1.5 -translate-y-px rounded-full bg-madera" />
            {hero.badge}
          </p>
        </div>
      </Container>
    </section>
  )
}
