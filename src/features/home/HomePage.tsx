import type { ReactNode } from 'react'
import { ButtonLink } from '../../components/ui/ButtonLink'
import { Container } from '../../components/ui/Container'
import { PhotoSlot } from '../../components/ui/PhotoSlot'
import { Reveal } from '../../components/ui/Reveal'
import { homeContent, landingImages, type LandingImage } from '../../content/home'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { CatalogPanChapter } from '../catalog/CatalogPanChapter'
import { useCatalog } from '../catalog/use-catalog'
import { PersonalizeChapter } from '../engraving/PersonalizeChapter'
import { ClosingChapter } from './chapters/ClosingChapter'
import { GrainChapter } from './chapters/GrainChapter'
import { HeroChapter } from './chapters/HeroChapter'
import { ProcessChapter } from './chapters/ProcessChapter'
import { SeedChapter } from './chapters/SeedChapter'

const eyebrowClass = 'text-xs font-semibold tracking-[0.22em] uppercase'

function Eyebrow({ children, tone = 'dark' }: { children: ReactNode; tone?: 'dark' | 'light' }) {
  return <p className={`${eyebrowClass} ${tone === 'dark' ? 'text-madera-700' : 'text-beige/80'}`}>{children}</p>
}

/** Tarjeta con foto a sangre y texto sobre un degradado. Sin foto, muestra el espacio rotulado. */
function ImageCard({
  image,
  label,
  title,
  body,
  className = '',
}: {
  image: LandingImage | null
  label: string
  title: string
  body: string
  className?: string
}) {
  if (!image) return <PhotoSlot label={label} className={className} />
  return (
    <article className={`group relative isolate flex min-h-72 min-w-0 items-end overflow-hidden rounded-2xl bg-carbon ${className}`}>
      <img
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 -z-10 h-full w-full object-cover transition-transform duration-[1.4s] ease-suave group-hover:scale-[1.04]"
        style={image.focus ? { objectPosition: image.focus } : undefined}
      />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-t from-carbon/85 via-carbon/25 to-transparent" />
      <div className="p-6 sm:p-7">
        <h3 className="text-2xl text-marfil sm:text-3xl">{title}</h3>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-beige/90">{body}</p>
      </div>
    </article>
  )
}

const commitmentIcons = [
  // Infinito: garantía de por vida.
  <path key="i" d="M7 12c0-2.2 1.6-3.5 3.3-3.5 3.2 0 4.2 7 7.4 7 1.7 0 3.3-1.3 3.3-3.5S19.4 8.5 17.7 8.5c-3.2 0-4.2 7-7.4 7C8.6 15.5 7 14.2 7 12Z" />,
  // Flechas circulares: mantenimiento.
  <path key="m" d="M19 8a7.5 7.5 0 0 0-13.3 1M5 16a7.5 7.5 0 0 0 13.3-1M19 4v4h-4M5 20v-4h4" />,
  // Hoja: acabado natural.
  <path key="h" d="M5 19c0-8 5-13 14-14 0 9-5 14-12 14H5Zm0 0 8-8" />,
]

export function HomePage() {
  useDocumentTitle()
  const catalog = useCatalog()
  const hasCatalog = catalog.state.kind === 'ok' && catalog.state.data.products.length > 0
  // Sin catálogo (error o vacío) se muestran las colecciones; mientras carga no se muestra nada para no saltar.
  const catalogUnavailable = catalog.state.kind === 'error' || (catalog.state.kind === 'ok' && !hasCatalog)
  const { highlights, lines, commitment } = homeContent

  return (
    <>
      {/* Capítulo 1 · portada con planos de profundidad. */}
      <HeroChapter />

      {/* Franja de atributos publicados por Woodland. */}
      <section aria-label="Lo que nos distingue" className="marquee-host overflow-hidden bg-nogal py-5 text-beige">
        <div className="marquee">
          {[0, 1].map((copy) => (
            <ul key={copy} aria-hidden={copy === 1 ? 'true' : undefined} className="flex shrink-0 items-center">
              {highlights.map((item) => (
                <li key={item} className="flex items-center gap-8 px-4 font-display text-lg whitespace-nowrap sm:text-xl">
                  {item}
                  <span aria-hidden="true" className="text-sm text-madera">
                    ✦
                  </span>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </section>

      {/* Capítulo 2 · la semilla (contenido fijo) y capítulo 3 · la veta (cortina). */}
      <SeedChapter />
      <GrainChapter />

      {/* Capítulo 4 · personalizar: grabado vivo (personas) y logo (empresas), en pestañas. */}
      <PersonalizeChapter />

      {/* Capítulo 5 · catálogo real en recorrido lateral. Mientras no haya catálogo publicado, se muestran las colecciones. */}
      {hasCatalog && <CatalogPanChapter products={catalog.state.kind === 'ok' ? catalog.state.data.products : []} />}
      {catalogUnavailable && (
        <section className="grain bg-beige/50 py-20 sm:py-28">
          <Container>
            <Reveal className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <Eyebrow>{lines.eyebrow}</Eyebrow>
                <h2 className="mt-4 max-w-xl text-4xl sm:text-5xl">{lines.title}</h2>
              </div>
              <ButtonLink chat="Ver los productos" variant="ghost" arrow className="px-0 whitespace-nowrap">
                Ver productos
              </ButtonLink>
            </Reveal>

            <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:h-[36rem] lg:grid-cols-3 lg:grid-rows-2">
              {lines.items.map((item, index) => {
                const layout = ['lg:row-span-2', '', '', 'lg:col-span-2'][index]
                return (
                  <Reveal key={item.title} index={index} className={`flex ${layout}`}>
                    <ImageCard
                      image={landingImages[item.key]}
                      label={item.title}
                      title={item.title}
                      body={item.body}
                      className="aspect-[4/3] w-full lg:aspect-auto"
                    />
                  </Reveal>
                )
              })}
            </div>
          </Container>
        </section>
      )}

      {/* Capítulo 6 · proceso y seguimiento. */}
      <ProcessChapter />

      {/* Compromiso: garantía y mantenimiento publicados por Woodland. */}
      <section className="grain bg-beige py-20 sm:py-28">
        <Container>
          <Reveal className="max-w-2xl">
            <Eyebrow>{commitment.eyebrow}</Eyebrow>
            <h2 className="mt-4 text-4xl sm:text-5xl">{commitment.title}</h2>
            <p className="mt-6 text-lg leading-relaxed text-carbon-600">{commitment.body}</p>
          </Reveal>
          <ul className="mt-14 grid gap-10 sm:grid-cols-3 sm:gap-8">
            {commitment.points.map((point, index) => (
              <Reveal as="li" key={point.title} index={index} className="lift rounded-2xl border border-linea bg-marfil p-7">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-nogal text-ambar">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-7 w-7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {commitmentIcons[index]}
                  </svg>
                </span>
                <h3 className="mt-5 text-2xl">{point.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-carbon-600">{point.body}</p>
              </Reveal>
            ))}
          </ul>
        </Container>
      </section>

      {/* Capítulo 8 · cierre. */}
      <ClosingChapter />
    </>
  )
}
