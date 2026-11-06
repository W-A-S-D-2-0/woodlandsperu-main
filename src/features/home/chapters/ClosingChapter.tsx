import { ButtonLink } from '../../../components/ui/ButtonLink'
import { Container } from '../../../components/ui/Container'
import { Embers } from '../../../components/ui/Embers'
import { homeContent } from '../../../content/home'
import { brand } from '../../../content/site'
import { openChat } from '../../chat/open-chat'

/**
 * Capítulo 8 · Cierre. Resuelve y se queda: repite el recorrido en una frase y hay una sola
 * acción principal: seguir por el chat.
 */
export function ClosingChapter() {
  const { closing } = homeContent

  return (
    <section className="grain relative isolate flex min-h-[85dvh] items-center overflow-hidden surface-warm py-24 text-beige" aria-labelledby="closing-title">
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
