import { useEffect, useMemo, useRef, useState, type FocusEvent } from 'react'
import type { CatalogProduct } from '../../../shared/api/contracts'
import { useScrollProgress } from '../../hooks/useScrollProgress'
import { modelPhotos } from '../../content/model-photos'
import { openChat } from '../chat/open-chat'
import { VariantRow } from './VariantRow'

const cardClass = 'w-[min(82vw,26rem)] shrink-0'

/**
 * Capítulo 5 · Elige tu tabla. La pantalla se queda fija y el scroll vertical desplaza las
 * tarjetas del catálogo hacia un lado (recorrido lateral: "hay opciones"). El catálogo es el real
 * (precios publicados o "A cotizar", disponibilidad sin cantidades). Con "reducir movimiento" la
 * fila se recorre con el desplazamiento horizontal normal.
 */
export function CatalogPanChapter({ products }: { products: CatalogProduct[] }) {
  const sectionRef = useScrollProgress<HTMLElement>('pin')
  const stageRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLUListElement>(null)

  // Una colección a la vez: el botón cambia entre ellas (Parrilla y Cocina, Piqueo y Servir).
  const collections = useMemo(() => [...new Map(products.flatMap((p) => (p.category ? [[p.category.slug, p.category.name] as const] : []))).entries()], [products])
  const [chosen, setChosen] = useState('')
  const active = collections.some(([slug]) => slug === chosen) ? chosen : (collections[0]?.[0] ?? '')
  const shown = useMemo(() => (active ? products.filter((p) => p.category?.slug === active) : products), [products, active])

  // Mide cuánto hay que desplazar la fila y le da a la sección esa altura de recorrido extra.
  useEffect(() => {
    const section = sectionRef.current
    const stage = stageRef.current
    const track = trackRef.current
    if (!section || !stage || !track) return
    const measure = () => {
      const travel = Math.max(0, track.scrollWidth - stage.clientWidth)
      section.style.setProperty('--travel', `${travel}px`)
      section.style.setProperty('--pin-height', `${window.innerHeight + travel}px`)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(track)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [sectionRef, shown])

  // Con teclado: al enfocar una tarjeta que está fuera de pantalla, se avanza el scroll hasta ella.
  function onFocus(event: FocusEvent<HTMLUListElement>) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const section = sectionRef.current
    const stage = stageRef.current
    const card = (event.target as HTMLElement).closest<HTMLElement>('[data-card]')
    if (!section || !stage || !card) return
    const travel = Math.max(0, (trackRef.current?.scrollWidth ?? 0) - stage.clientWidth)
    if (travel === 0) return
    const needed = Math.min(travel, Math.max(0, card.offsetLeft + card.offsetWidth - stage.clientWidth + 32))
    const sectionTop = section.getBoundingClientRect().top + window.scrollY
    window.scrollTo({ top: sectionTop + (needed / travel) * (section.offsetHeight - window.innerHeight), behavior: 'instant' })
  }

  return (
    <section ref={sectionRef} className="chapter pin bg-marfil" aria-labelledby="catalog-pan-title">
      <div ref={stageRef} className="pan-stage pin-stage flex items-center">
        <ul ref={trackRef} onFocusCapture={onFocus} className="pan-track flex w-max items-stretch gap-6 px-5 pr-[18vw] sm:px-8 lg:pl-[max(2rem,calc((100vw-72rem)/2+2rem))]">
          <li data-card className="flex w-[min(82vw,22rem)] shrink-0 flex-col justify-center pr-4">
            <p className="text-xs font-semibold tracking-[0.22em] text-madera-700 uppercase">Catálogo</p>
            <h2 id="catalog-pan-title" className="mt-4 text-4xl leading-tight sm:text-5xl">
              Elige tu tabla.
            </h2>
            <p className="mt-4 text-carbon-600">
              Son las piezas reales de Woodland. Elige una colección y pídelas por el chat: aquí ves cada una con su medida y su precio.
            </p>
            {collections.length > 1 && (
              <div role="group" aria-label="Colección" className="mt-6 flex flex-wrap gap-2">
                {collections.map(([slug, name]) => (
                  <button
                    key={slug}
                    type="button"
                    aria-pressed={slug === active}
                    onClick={() => setChosen(slug)}
                    className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors ${slug === active ? 'border-nogal bg-nogal text-marfil' : 'border-nogal/30 text-nogal hover:border-nogal'}`}
                  >
                    {name.replace('Colección ', '')}
                  </button>
                ))}
              </div>
            )}
            <button type="button" onClick={() => openChat('Ver los productos')} className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-nogal underline underline-offset-4">
              Pregunta por todo el catálogo →
            </button>
          </li>

          {shown.map((product) => (
            <li key={product.id} data-card className={`${cardClass} max-h-[calc(100dvh-7rem)] overflow-y-auto overscroll-contain rounded-2xl border border-linea bg-white/80 p-6`}>
              {modelPhotos[product.slug] && (
                <img
                  src={modelPhotos[product.slug]!.src}
                  alt={modelPhotos[product.slug]!.alt}
                  width={modelPhotos[product.slug]!.width}
                  height={modelPhotos[product.slug]!.height}
                  loading="lazy"
                  decoding="async"
                  className="mb-4 h-40 w-full rounded-xl object-cover"
                />
              )}
              {product.category && <p className="text-xs font-semibold tracking-[0.18em] text-madera-700 uppercase">{product.category.name}</p>}
              <h3 className="mt-2 text-3xl">{product.name}</h3>
              {product.description && <p className="mt-2 line-clamp-3 text-sm text-carbon-600">{product.description}</p>}
              <ul className="mt-3">
                {product.variants.map((variant) => (
                  <VariantRow key={variant.id} product={product} variant={variant} />
                ))}
              </ul>
            </li>
          ))}

          <li data-card className={`${cardClass} flex flex-col justify-center rounded-2xl bg-nogal p-7 text-beige`}>
            <h3 className="text-3xl text-marfil">¿Otra medida o un diseño propio?</h3>
            <p className="mt-3 text-sm text-beige/85">Describe lo que necesitas y te preparamos una propuesta.</p>
            <button type="button" onClick={() => openChat('Quiero hacer un pedido de una tabla a medida')} className="mt-6 inline-flex min-h-11 items-center justify-center self-start rounded-full bg-marfil px-6 text-sm font-semibold text-nogal hover:bg-beige">
              Pedir una pieza a medida
            </button>
          </li>
        </ul>
      </div>
    </section>
  )
}
