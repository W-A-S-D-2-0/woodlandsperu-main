import { ButtonLink } from '../../components/ui/ButtonLink'
import { Container } from '../../components/ui/Container'
import { homeContent } from '../../content/home'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { StoreGridChapter } from '../catalog/StoreGridChapter'
import { useCatalog } from '../catalog/use-catalog'
import { PersonalizeChapter } from '../engraving/PersonalizeChapter'
import { ClosingChapter } from './chapters/ClosingChapter'
import { CorporateGalleryChapter } from './chapters/CorporateGalleryChapter'
import { HeroChapter } from './chapters/HeroChapter'
import { ProcessChapter } from './chapters/ProcessChapter'

/**
 * Inicio centrado en los modelos (pedido del equipo, 2026-11-06): Moshaco, el más vendido, en la portada; luego el
 * catálogo, los corporativos y personalizados y el grabado. Se mantienen el seguimiento del pedido, el compromiso en
 * desplegables y el cierre. El propósito (El Origen) vive en /nosotros.
 */
export function HomePage() {
  useDocumentTitle()
  const catalog = useCatalog()
  const products = catalog.state.kind === 'ok' ? catalog.state.data.products : []
  const moshaco = products.find((product) => product.slug === 'moshaco')
  const { commitment } = homeContent

  return (
    <>
      <HeroChapter product={moshaco} />

      {products.length > 0 && <StoreGridChapter products={products} />}

      <CorporateGalleryChapter />

      {/* Grabado vivo (personas) y logo (empresas), en pestañas. */}
      <PersonalizeChapter />

      {/* Seguimiento del pedido. */}
      <ProcessChapter />

      {/* Compromiso: garantía y mantenimiento publicados por Woodland, en preguntas desplegables. */}
      <section className="bg-marfil py-16 text-carbon sm:py-24" aria-labelledby="commitment-title">
        <Container className="max-w-3xl">
          <p className="text-center text-[11px] font-semibold tracking-[0.28em] text-carbon-600 uppercase">{commitment.eyebrow}</p>
          <h2 id="commitment-title" className="title-script mt-3 text-center text-4xl sm:text-5xl">
            {commitment.title}
          </h2>
          <div className="mt-10 divide-y divide-linea border-y border-linea">
            {commitment.points.map((point) => (
              <details key={point.title} className="group py-5">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold tracking-[0.12em] uppercase">
                  {point.title}
                  <span aria-hidden="true" className="text-xl transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 leading-relaxed text-carbon-600">{point.body}</p>
              </details>
            ))}
          </div>
          <div className="mt-10 text-center">
            <ButtonLink chat="Quiero hacer un pedido" arrow>
              Hacer mi pedido
            </ButtonLink>
          </div>
        </Container>
      </section>

      <ClosingChapter />
    </>
  )
}
