import type { CSSProperties } from 'react'
import { ButtonLink } from '../../../components/ui/ButtonLink'
import { homeContent, landingImages } from '../../../content/home'
import { useScrollProgress } from '../../../hooks/useScrollProgress'

const RINGS = 11

/** Variable CSS por elemento: a partir de qué progreso del capítulo aparece. */
const from = (value: number, speed = 8) => ({ '--from': value, '--speed': speed }) as CSSProperties

/**
 * Capítulo 2 · La semilla. La pantalla se queda fija mientras el scroll hace crecer los anillos de
 * la madera y arma el texto línea por línea. Texto centrado y fondo oscuro para bajar el ritmo
 * después de la portada. Con "reducir movimiento" todo se muestra completo y sin fijar.
 */
export function SeedChapter() {
  const { origin, seed } = homeContent
  const plantation = landingImages.plantation
  const ref = useScrollProgress<HTMLElement>('pin')

  return (
    <section ref={ref} className="chapter pin bg-nogal text-beige" style={{ '--pin-height': '210vh' } as CSSProperties} aria-labelledby="seed-title">
      <div className="pin-stage grain flex items-center justify-center px-5 sm:px-8">
        {/* La plantación real aparece detrás del texto a medida que avanza el recorrido. */}
        {plantation && (
          <img
            src={plantation.src}
            alt={plantation.alt}
            width={plantation.width}
            height={plantation.height}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ opacity: '0.3' }}
          />
        )}
        {/* Velo oscuro para que el texto se lea sobre la foto. */}
        <div aria-hidden="true" className="absolute inset-0 bg-linear-to-b from-nogal/75 via-nogal/60 to-nogal/85" />
        {/* Anillos de crecimiento: uno nuevo cada vez que avanza el recorrido. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 400 400"
          className="absolute top-1/2 left-1/2 h-[min(150vmin,72rem)] w-[min(150vmin,72rem)] -translate-x-1/2 -translate-y-1/2 text-madera"
          fill="none"
          stroke="currentColor"
        >
          {Array.from({ length: RINGS }, (_, i) => (
            <ellipse
              key={i}
              className="ring"
              style={{ '--i': i } as CSSProperties}
              cx="200"
              cy="200"
              rx={14 + i * 17.5}
              ry={12 + i * 16}
              strokeWidth="1"
              strokeOpacity={0.55 - i * 0.03}
              transform={`rotate(${i * 7} 200 200)`}
            />
          ))}
        </svg>

        <div className="relative z-10 mx-auto grid max-w-3xl justify-items-center gap-5 text-center">
          <p className="step-in text-xs font-semibold tracking-[0.22em] text-beige/80 uppercase" style={from(-0.3)}>
            {origin.eyebrow}
          </p>
          <p className="step-in font-display text-[6.5rem] leading-none font-medium text-madera sm:text-[10rem]" style={from(-0.3)}>
            {origin.year}
          </p>
          <p className="step-in max-w-sm text-base text-beige/85 sm:text-lg" style={from(-0.2)}>
            {origin.yearLabel}
          </p>
          <div className="mt-2 grid gap-3">
            <h2 id="seed-title" className="step-in text-3xl leading-tight text-marfil sm:text-5xl" style={from(0.08)}>
              {seed.lines[0]}
            </h2>
            <p className="step-in mx-auto max-w-xl text-base leading-relaxed text-beige/85 sm:text-lg" style={from(0.24)}>
              {seed.lines[1]}
            </p>
            <p className="step-in font-display text-2xl text-madera sm:text-3xl" style={from(0.42)}>
              {origin.title}
            </p>
          </div>
          <div className="step-in mt-2" style={from(0.6)}>
            <ButtonLink to={origin.cta.to} variant="ghost-light" arrow>
              {origin.cta.label}
            </ButtonLink>
          </div>
        </div>

      </div>
    </section>
  )
}
