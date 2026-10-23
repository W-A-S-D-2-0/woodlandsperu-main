import type { CSSProperties } from 'react'
import { homeContent, landingImages } from '../../../content/home'
import { useScrollProgress } from '../../../hooks/useScrollProgress'

const from = (value: number, speed = 6) => ({ '--from': value, '--speed': speed }) as CSSProperties

/**
 * Capítulo 3 · La veta. Una cortina avanza de izquierda a derecha y convierte la tabla en proceso
 * (artesano en el taller) en las tablas terminadas. Composición dividida (texto a un lado, imagen al otro) y fondo claro,
 * más silencioso que el capítulo del grabado que viene después.
 */
export function GrainChapter() {
  const { grain } = homeContent
  const veta = landingImages.workshop
  const tabla = landingImages.boards
  const ref = useScrollProgress<HTMLElement>('pin')

  return (
    <section ref={ref} className="chapter pin grain bg-linear-to-b from-marfil to-beige" style={{ '--pin-height': '190vh' } as CSSProperties} aria-labelledby="grain-title">
      <div className="pin-stage flex items-center px-5 pt-16 sm:px-8 lg:pt-0">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-6 sm:gap-10 lg:grid-cols-[1fr_1fr] lg:gap-20">
          <div>
            <p className="text-xs font-semibold tracking-[0.22em] text-madera-700 uppercase">{grain.eyebrow}</p>
            <h2 id="grain-title" className="mt-3 text-3xl leading-tight sm:mt-4 sm:text-5xl">
              {grain.title}
            </h2>
            <p className="mt-3 max-w-md text-base leading-relaxed text-carbon-600 sm:mt-5 sm:text-lg">{grain.body}</p>
            <ul className="mt-5 grid gap-3 sm:mt-8 sm:gap-5">
              {grain.points.map((point, index) => (
                <li key={point.title} className="step-in border-l-2 border-madera pl-4" style={from(0.04 + index * 0.14)}>
                  <p className="font-display text-xl text-nogal">{point.title}</p>
                  <p className="mt-1 text-sm text-carbon-600">{point.body}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* Imagen: la tabla en proceso de fondo y las tablas terminadas que se descubren encima. */}
          <div className="wipe-frame frame-drift relative mx-auto aspect-[4/3] w-full max-w-md lg:aspect-square">
            <span aria-hidden="true" className="frame-outline pointer-events-none absolute inset-0 rounded-2xl border border-madera/60" />
            <div className="absolute inset-0 overflow-hidden rounded-2xl">
              {veta ? (
              <img src={veta.src} alt={veta.alt} width={veta.width} height={veta.height} loading="lazy" decoding="async" className="zoom-settle absolute inset-0 h-full w-full rounded-2xl object-cover object-[50%_72%]" />
            ) : (
              <div className="absolute inset-0 rounded-2xl border border-linea bg-beige" role="img" aria-label="Espacio para fotografía: tabla en proceso" />
            )}
            {tabla ? (
              <img src={tabla.src} alt={tabla.alt} width={tabla.width} height={tabla.height} loading="lazy" decoding="async" className="wipe zoom-settle absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="wipe absolute inset-0 rounded-2xl border border-linea bg-beige" role="img" aria-label="Espacio para fotografía: tabla terminada" />
            )}
            </div>
            <span aria-hidden="true" className="wipe-edge absolute inset-y-0 w-0.5 bg-brasa shadow-[0_0_18px_4px_rgb(224_138_60/0.55)]" />
            <p className="step-out absolute right-4 bottom-4 rounded-full bg-marfil/95 px-3 py-1 text-xs font-semibold text-nogal" style={from(0.4, 8)}>
              {grain.before}
            </p>
            <p className="step-in absolute bottom-4 left-4 rounded-full bg-nogal px-3 py-1 text-xs font-semibold text-marfil" style={from(0.62, 8)}>
              {grain.after}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
