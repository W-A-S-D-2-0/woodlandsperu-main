import { PageIntro } from '../../components/layout/PageIntro'
import { Container } from '../../components/ui/Container'
import { Embers } from '../../components/ui/Embers'
import { Reveal } from '../../components/ui/Reveal'
import { homeContent, landingImages, type LandingImage } from '../../content/home'
import { brand } from '../../content/site'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { ClosingChapter } from './chapters/ClosingChapter'

/** Foto con marco cobre desplazado detrás y elevación al pasar el cursor. Sin foto no ocupa espacio. */
function FramedPhoto({ image, className = '' }: { image: LandingImage | null; className?: string }) {
  if (!image) return null
  return (
    <div className={`group relative ${className}`}>
      <span aria-hidden="true" className="absolute inset-0 translate-x-3 translate-y-3 rounded-2xl border border-madera/60 transition-transform duration-700 ease-suave group-hover:translate-x-5 group-hover:translate-y-5" />
      <img
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        loading="lazy"
        decoding="async"
        className="relative aspect-[4/3] w-full rounded-2xl object-cover shadow-[0_30px_50px_-30px_rgb(43_33_24/0.6)]"
      />
    </div>
  )
}

/**
 * Nosotros. Solo usa lo que Woodland publicó (ver `content/home.ts`): origen en 2019, siembra propia en
 * San Martín, oficio artesanal, atributos y compromiso. No hay sección de equipo porque aún no hay
 * textos ni fotos de personas aprobados.
 */
export function AboutPage() {
  useDocumentTitle('Nosotros')
  const { origin, seed, grain, highlights, commitment } = homeContent

  return (
    <>
      <PageIntro eyebrow="Nosotros" title={brand.tagline}>
        {brand.description}
      </PageIntro>

      {/* Origen: el año grande y la plantación. */}
      <section className="grain bg-marfil py-20 sm:py-28" aria-labelledby="about-origin">
        <Container className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <Reveal>
            <p className="text-xs font-semibold tracking-[0.22em] text-madera-700 uppercase">{origin.eyebrow}</p>
            <p className="mt-3 font-display text-8xl leading-none font-medium text-madera sm:text-9xl">{origin.year}</p>
            <p className="mt-4 max-w-sm text-lg text-carbon-600">{origin.yearLabel}</p>
            <h2 id="about-origin" className="mt-10 text-3xl sm:text-4xl">
              {seed.lines[0]}
            </h2>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-carbon-600">{seed.lines[1]}</p>
          </Reveal>
          <Reveal index={1}>
            <FramedPhoto image={landingImages.plantation} />
          </Reveal>
        </Container>
      </section>

      {/* Atributos publicados por la empresa. */}
      <section className="surface-warm grain relative isolate overflow-hidden py-20 text-beige sm:py-28" aria-labelledby="about-highlights">
        <Embers />
        <Container className="relative">
          <p className="text-xs font-semibold tracking-[0.22em] text-ambar uppercase">Lo que nos distingue</p>
          <h2 id="about-highlights" className="mt-4 max-w-xl text-3xl text-marfil sm:text-5xl">
            Madera con origen, hecha a mano.
          </h2>
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {highlights.map((item, index) => (
              <Reveal as="li" key={item} index={index % 3} className="lift flex items-center gap-4 rounded-2xl border border-beige/15 bg-nogal-800/60 p-5">
                <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brasa font-display text-lg font-semibold text-nogal-800">
                  {index + 1}
                </span>
                <span className="font-display text-xl text-marfil">{item}</span>
              </Reveal>
            ))}
          </ul>
        </Container>
      </section>

      {/* El oficio: dos fotos y los puntos del acabado. */}
      <section className="grain bg-linear-to-b from-marfil to-beige py-20 sm:py-28" aria-labelledby="about-craft">
        <Container className="grid items-center gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <Reveal>
            <p className="text-xs font-semibold tracking-[0.22em] text-madera-700 uppercase">{grain.eyebrow}</p>
            <h2 id="about-craft" className="mt-4 text-3xl sm:text-5xl">
              {grain.title}
            </h2>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-carbon-600">{grain.body}</p>
            <ul className="mt-8 grid gap-5">
              {grain.points.map((point) => (
                <li key={point.title} className="border-l-2 border-madera pl-4">
                  <p className="font-display text-xl text-nogal">{point.title}</p>
                  <p className="mt-1 text-sm text-carbon-600">{point.body}</p>
                </li>
              ))}
            </ul>
          </Reveal>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-1">
            <Reveal>
              <FramedPhoto image={landingImages.workshop} />
            </Reveal>
            <Reveal index={1}>
              <FramedPhoto image={landingImages.boards} />
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Compromiso: garantía y mantenimiento publicados por Woodland. */}
      <section className="grain bg-beige py-20 sm:py-28" aria-labelledby="about-commitment">
        <Container>
          <Reveal className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.22em] text-madera-700 uppercase">{commitment.eyebrow}</p>
            <h2 id="about-commitment" className="mt-4 text-4xl sm:text-5xl">
              {commitment.title}
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-carbon-600">{commitment.body}</p>
          </Reveal>
          <ul className="mt-12 grid gap-6 sm:grid-cols-3">
            {commitment.points.map((point, index) => (
              <Reveal as="li" key={point.title} index={index} className="lift rounded-2xl border border-linea bg-marfil p-7">
                <h3 className="text-2xl">{point.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-carbon-600">{point.body}</p>
              </Reveal>
            ))}
          </ul>
        </Container>
      </section>

      <ClosingChapter />
    </>
  )
}
