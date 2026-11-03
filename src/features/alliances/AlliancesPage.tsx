import { useState } from 'react'
import { PageIntro } from '../../components/layout/PageIntro'
import { ButtonLink } from '../../components/ui/ButtonLink'
import { Container } from '../../components/ui/Container'
import { CountUp } from '../../components/ui/CountUp'
import { Reveal } from '../../components/ui/Reveal'
import { alliancesContent, type Ally } from '../../content/alliances'
import { homeContent } from '../../content/home'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

/** Área visual que se busca para cada logo (px²) y su altura máxima: un logo ancho y uno cuadrado pesan parecido. */
const LOGO_AREA = 11000
const LOGO_MAX_HEIGHT = 80
const LOGO_FALLBACK_HEIGHT = 60

/** Altura del logo según su proporción ancho/alto: los anchos bajan, los cuadrados suben hasta el tope. */
function logoHeight(ratio: number | null): number {
  if (!ratio || !Number.isFinite(ratio) || ratio <= 0) return LOGO_FALLBACK_HEIGHT
  return Math.min(LOGO_MAX_HEIGHT, Math.round(Math.sqrt(LOGO_AREA / ratio)))
}

/**
 * La marca de cada aliado, suelta sobre la mesa (sin recuadro). Los logos blancos (`tone: 'dark'`) se pasan a oscuro
 * invirtiendo el brillo y conservando el tono, para que se vean sobre el fondo claro. Logos redondos y fotos van en
 * círculo; quien aún no tiene logo ni foto se muestra con su nombre: no se inventa nada.
 */
function Mark({ ally }: { ally: Ally }) {
  const { logo, photo } = ally
  if (logo?.round || (!logo && photo)) {
    const media = logo ?? photo!
    return <img src={media.src} alt={media.alt} loading="lazy" decoding="async" draggable={false} className="size-20 rounded-full object-cover object-[50%_25%] shadow-sm" />
  }
  if (logo) return <ProportionalLogo src={logo.src} alt={logo.alt} className={logo.tone === 'dark' ? 'invert hue-rotate-180' : ''} />
  return <span className="font-display text-3xl whitespace-nowrap text-nogal">{ally.name}</span>
}

/** Logo cuya altura se ajusta a su proporción, para que todos pesen parecido dentro de la placa. */
function ProportionalLogo({ src, alt, className }: { src: string; alt: string; className: string }) {
  const [ratio, setRatio] = useState<number | null>(null)
  const measure = (img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
      const next = img.naturalWidth / img.naturalHeight
      setRatio((current) => (current === next ? current : next))
    }
  }
  return (
    <img
      ref={measure}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onLoad={(event) => measure(event.currentTarget)}
      style={{ height: `${logoHeight(ratio)}px` }}
      draggable={false}
      className={`w-auto max-w-56 object-contain ${className}`}
    />
  )
}

/**
 * Una fila de logos que se desliza sola, sin fin: la lista va dos veces y la animación la corre media vuelta.
 * Se detiene al pasar el cursor; con movimiento reducido, los logos quedan quietos y en varias filas.
 */
function AllyCarousel({ allies, reverse = false }: { allies: readonly Ally[]; reverse?: boolean }) {
  return (
    <div className="marquee-host -mx-5 overflow-hidden py-4 [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)] sm:mx-0">
      <div className={`marquee marquee-slow ${reverse ? 'marquee-reverse' : ''}`}>
        {[0, 1].map((copy) => (
          <ul key={copy} aria-hidden={copy === 1 ? 'true' : undefined} className="flex shrink-0 items-center">
            {allies.map((ally) => (
              <li key={ally.name} className="group flex w-56 shrink-0 flex-col items-center gap-3 px-6 sm:w-64">
                <span className="grid h-24 place-items-center transition-transform duration-500 ease-out group-hover:scale-110">
                  <Mark ally={ally} />
                </span>
                <span className="text-center text-sm font-semibold text-carbon-600 transition-colors group-hover:text-nogal">{ally.name}</span>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  )
}

/** Una cifra del encabezado: sube desde 0 al aparecer. Sale del contenido, no se escribe a mano. */
function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <dt className="sr-only">{label}</dt>
      <dd className="font-display text-4xl text-ambar tabular-nums">
        <CountUp to={value} pad={1} />
      </dd>
      <span aria-hidden="true" className="text-sm text-beige/80">
        {label}
      </span>
    </div>
  )
}

/** Alianzas: las empresas, restaurantes y parrilleros que trabajan con Woodland. Contenido en `content/alliances.ts`. */
export function AlliancesPage() {
  useDocumentTitle('Alianzas')
  const { eyebrow, title, intro, logosNote, groups } = alliancesContent
  const total = groups.reduce((sum, group) => sum + group.allies.length, 0)
  const { closing } = homeContent

  return (
    <>
      <PageIntro eyebrow={eyebrow} title={title}>
        <p>{intro}</p>
        <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
          <Stat value={total} label="aliados" />
          {groups.map((group) => (
            <Stat key={group.title} value={group.allies.length} label={group.title.toLowerCase()} />
          ))}
        </dl>
      </PageIntro>

      <div className="mesa grain py-16 sm:py-24">
        <Container className="grid gap-20">
          {groups.map((group, groupIndex) => (
            <section key={group.title} aria-labelledby={`alianzas-${groupIndex}`} className="min-w-0">
              <Reveal className="relative flex items-baseline justify-between gap-4 border-b border-linea pb-4">
                <h2 id={`alianzas-${groupIndex}`} className="text-2xl sm:text-3xl">
                  {group.title}
                </h2>
                <span className="font-display text-2xl text-madera-700 tabular-nums sm:text-3xl">
                  <CountUp to={group.allies.length} />
                </span>
                <span aria-hidden="true" className="absolute bottom-[-1px] left-0 h-px w-full origin-left bg-madera transition-transform duration-1000 ease-out in-data-[reveal=pending]:scale-x-0" />
              </Reveal>
              <div className="mt-8">
                <AllyCarousel allies={group.allies} reverse={groupIndex % 2 === 1} />
              </div>
            </section>
          ))}
          <Reveal className="mx-auto grid max-w-2xl justify-items-center gap-4 text-center">
            <h2 className="text-3xl sm:text-4xl">{closing.title}</h2>
            <p className="text-lg leading-relaxed text-carbon-600">{closing.body}</p>
            <ButtonLink chat={closing.cta.chat} arrow className="mt-2">
              {closing.cta.label}
            </ButtonLink>
          </Reveal>
          <p className="text-center text-xs text-carbon-600">{logosNote}</p>
        </Container>
      </div>
    </>
  )
}
