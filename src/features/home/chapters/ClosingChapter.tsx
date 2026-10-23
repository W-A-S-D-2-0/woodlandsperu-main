import type { CSSProperties } from 'react'
import { ButtonLink } from '../../../components/ui/ButtonLink'
import { Container } from '../../../components/ui/Container'
import { Embers } from '../../../components/ui/Embers'
import { homeContent } from '../../../content/home'
import { brand } from '../../../content/site'
import { openChat } from '../../chat/open-chat'

/** Anillos de crecimiento completos: el motivo del capítulo de la semilla, ahora cerrado. */
function ClosedRings() {
  return (
    <svg aria-hidden="true" viewBox="0 0 400 400" className="spin-slow absolute top-1/2 left-1/2 h-[min(150vmin,72rem)] w-[min(150vmin,72rem)] -translate-x-1/2 -translate-y-1/2 text-madera" fill="none" stroke="currentColor">
      {Array.from({ length: 11 }, (_, i) => (
        <ellipse key={i} className="ring-breathe" style={{ '--i': i } as CSSProperties} cx="200" cy="200" rx={14 + i * 17.5} ry={12 + i * 16} strokeWidth="1" strokeOpacity={0.7 - i * 0.04} transform={`rotate(${i * 7} 200 200)`} />
      ))}
    </svg>
  )
}

/**
 * Capítulo 8 · Cierre. Resuelve y se queda: repite el recorrido en una frase, los anillos
 * quedan completos y hay una sola acción principal: seguir por el chat.
 */
export function ClosingChapter() {
  const { closing } = homeContent

  return (
    <section className="grain relative isolate flex min-h-[85dvh] items-center overflow-hidden surface-warm py-24 text-beige" aria-labelledby="closing-title">
      <ClosedRings />
      <Embers />
      <Container className="relative z-10 grid justify-items-center gap-6 text-center">
        <p className="text-xs font-semibold tracking-[0.22em] text-beige/80 uppercase">{brand.tagline}</p>
        <h2 id="closing-title" className="max-w-3xl text-5xl leading-[1.02] text-marfil sm:text-7xl">
          De la semilla
          <span className="text-shimmer block">a tu mesa.</span>
        </h2>
        <p className="max-w-xl text-lg leading-relaxed text-beige/85">{closing.body}</p>

        <div className="mt-2 flex flex-col items-center gap-4 sm:flex-row">
          <ButtonLink chat="Quiero hacer un pedido" variant="light" arrow>
            Hacer mi pedido
          </ButtonLink>
          <ButtonLink chat={closing.cta.chat} variant="ghost-light">
            {closing.cta.label}
          </ButtonLink>
        </div>
        <button type="button" onClick={() => openChat('Ver los productos')} className="text-sm text-beige/80 underline-offset-4 hover:text-marfil hover:underline">
          o mira los productos en el chat
        </button>
      </Container>
    </section>
  )
}
