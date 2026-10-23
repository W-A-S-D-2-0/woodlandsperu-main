import { useState, type CSSProperties } from 'react'
import { PageIntro } from '../../components/layout/PageIntro'
import { ButtonLink } from '../../components/ui/ButtonLink'
import { Container } from '../../components/ui/Container'
import { CountUp } from '../../components/ui/CountUp'
import { Reveal } from '../../components/ui/Reveal'
import { alliancesContent, type Ally } from '../../content/alliances'
import { homeContent } from '../../content/home'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

/** Inclinación de cada tabla sobre la mesa (grados): ninguna cae igual, como si las hubieran dejado a mano. */
const TILTS = [-1.4, 0.9, -0.6, 1.2, -1, 0.7]

/** Área visual que se busca para cada logo (px²) y altura máxima dentro de la placa: un logo ancho y uno cuadrado pesan parecido. */
const LOGO_AREA = 9000
const LOGO_MAX_HEIGHT = 72
const LOGO_FALLBACK_HEIGHT = 56

/** Altura del logo según su proporción ancho/alto: los anchos bajan, los cuadrados suben hasta el tope de la placa. */
function logoHeight(ratio: number | null): number {
  if (!ratio || !Number.isFinite(ratio) || ratio <= 0) return LOGO_FALLBACK_HEIGHT
  return Math.min(LOGO_MAX_HEIGHT, Math.round(Math.sqrt(LOGO_AREA / ratio)))
}

/**
 * Cada aliado es una tabla de teca sobre la mesa: un asa arriba, su marca incrustada en una placa y debajo
 * el nombre, el rubro y el enlace, y en la esquina la marca de Woodland grabada a fuego. Los logos conservan su color original; los que son blancos van sobre placa oscura.
 * Quien aún no tiene logo ni foto se muestra con la inicial de su nombre: no se inventa nada.
 */
function Mark({ ally }: { ally: Ally }) {
  const { logo, photo } = ally
  const motion = 'transition-transform duration-500 ease-out group-hover:scale-110'
  if (logo?.round || (!logo && photo)) {
    const media = logo ?? photo!
    return <img src={media.src} alt={media.alt} loading="lazy" decoding="async" className={`size-20 rounded-full border border-linea object-cover object-[50%_25%] ${motion}`} />
  }
  if (logo) return <ProportionalLogo src={logo.src} alt={logo.alt} className={motion} />
  return (
    <span aria-hidden="true" className={`grid size-20 place-items-center rounded-full border border-linea bg-beige font-display text-4xl text-madera-700 ${motion}`}>
      {ally.name.charAt(0)}
    </span>
  )
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
      className={`w-auto max-w-[80%] object-contain ${className}`}
    />
  )
}

function AllyBoard({ ally, index }: { ally: Ally; index: number }) {
  const dark = ally.logo?.tone === 'dark' && !ally.logo.round
  const tilt = TILTS[index % TILTS.length]!
  const link = ally.url ? { href: ally.url, label: 'Visitar sitio' } : ally.profile ? { href: ally.profile.url, label: `Ver ${ally.profile.network}` } : null
  return (
    <Reveal as="li" index={index} className="flex">
      <div className="tabla group relative flex w-full flex-col rounded-[1.75rem] p-4 pt-9" style={{ '--tilt': `${tilt}deg` } as CSSProperties}>
        <img
          src="/images/brand/logo-mark.png"
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="pointer-events-none absolute right-5 bottom-5 size-9 object-contain opacity-35 brightness-0 transition-opacity duration-500 group-hover:opacity-60"
        />
        <span aria-hidden="true" className="absolute top-3 left-1/2 size-3 -translate-x-1/2 rounded-full bg-marfil shadow-inner ring-1 ring-nogal/40" />
        <div className={`grid h-28 place-items-center rounded-xl px-5 shadow-inner ring-1 ring-nogal/15 ${dark ? 'bg-nogal' : 'bg-beige'}`}>
          <Mark ally={ally} />
        </div>
        <div className="flex flex-1 flex-col px-1 pt-4">
          <h3 className="text-xl !text-marfil">{ally.name}</h3>
          <span aria-hidden="true" className="mt-1.5 block h-0.5 w-10 origin-left rounded bg-linear-to-r from-ambar to-brasa transition-all duration-500 ease-out group-hover:w-full" />
          <p className="mt-2 min-h-10 text-sm leading-snug text-marfil/90">{ally.role ?? ''}</p>
          {link ? (
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-auto inline-flex min-h-11 w-fit items-center gap-1.5 self-start rounded-full border border-marfil/50 px-3.5 text-xs font-semibold text-marfil transition-colors duration-300 group-hover:border-marfil group-hover:bg-marfil group-hover:text-nogal"
            >
              <span>
                {link.label}<span className="sr-only"> de {ally.name}</span>
              </span>
              <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-0.5">
                →
              </span>
            </a>
          ) : (
            <span className="mt-auto min-h-11" aria-hidden="true" />
          )}
        </div>
      </div>
    </Reveal>
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
            <section key={group.title} aria-labelledby={`alianzas-${groupIndex}`}>
              <Reveal className="relative flex items-baseline justify-between gap-4 border-b border-linea pb-4">
                <h2 id={`alianzas-${groupIndex}`} className="text-2xl sm:text-3xl">
                  {group.title}
                </h2>
                <span className="font-display text-2xl text-madera-700 tabular-nums sm:text-3xl">
                  <CountUp to={group.allies.length} />
                </span>
                <span aria-hidden="true" className="absolute bottom-[-1px] left-0 h-px w-full origin-left bg-madera transition-transform duration-1000 ease-out in-data-[reveal=pending]:scale-x-0" />
              </Reveal>
              <ul className="mt-10 grid auto-rows-fr gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
                {group.allies.map((ally, index) => (
                  <AllyBoard key={ally.name} ally={ally} index={index} />
                ))}
              </ul>
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
