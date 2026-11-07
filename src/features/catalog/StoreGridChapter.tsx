import { useEffect, useMemo, useRef, useState } from 'react'
import type { CatalogProduct } from '../../../shared/api/contracts'
import { Container } from '../../components/ui/Container'
import { modelPhotos } from '../../content/model-photos'
import { startOrder } from '../chat/open-chat'
import { formatPrice, toOrderModel } from './catalog-format'

/** Precio más bajo publicado entre las medidas de una tabla; null si todas son "A cotizar". */
function fromPrice(prices: (number | null)[]): number | null {
  const known = prices.filter((p): p is number => p !== null)
  return known.length ? Math.min(...known) : null
}

/**
 * Capítulo 5 · Nuestras tablas de teca. El catálogo real en cuadrícula de tienda (estilo de la
 * referencia que envió Brigitte, teakhaus.com): foto, colección, nombre y precio desde. Cada tabla
 * abre en el chat su tarjeta de pedido, con todas sus medidas para elegir. Conserva `catalog-pan-title` porque Teca lleva al cliente
 * hasta esta sección con ese selector.
 */
export function StoreGridChapter({ products }: { products: CatalogProduct[] }) {
  // Una colección a la vez (Parrilla y Cocina, Piqueo y Servir); empieza en la primera.
  const collections = useMemo(() => [...new Map(products.flatMap((p) => (p.category ? [[p.category.slug, p.category.name] as const] : []))).entries()], [products])
  const [chosen, setChosen] = useState('')
  const active = collections.some(([slug]) => slug === chosen) ? chosen : (collections[0]?.[0] ?? '')
  const shown = active ? products.filter((p) => p.category?.slug === active) : products

  // Las tarjetas entran cuando la cuadrícula llega a la pantalla, y otra vez al cambiar de colección.
  const gridRef = useRef<HTMLDivElement>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const grid = gridRef.current
    if (!grid || seen) return
    const observer = new IntersectionObserver(([entry]) => entry?.isIntersecting && setSeen(true), { rootMargin: '0px 0px -15% 0px' })
    observer.observe(grid)
    return () => observer.disconnect()
  }, [seen])

  return (
    <section className="bg-marfil py-16 text-carbon sm:py-24" aria-labelledby="catalog-pan-title">
      <Container>
        <p className="text-center text-xs font-semibold tracking-[0.28em] text-madera-700 uppercase">Catálogo</p>
        <h2 id="catalog-pan-title" className="title-script mt-3 text-center text-4xl sm:text-5xl">
          Nuestras tablas de teca
        </h2>
        <p className="mt-3 text-center text-[11px] font-semibold tracking-[0.28em] text-carbon-600 uppercase">Piezas con origen peruano</p>
        {collections.length > 1 && (
          <div role="group" aria-label="Colección" className="mt-8 flex flex-wrap justify-center gap-2">
            {collections.map(([slug, name]) => (
              <button
                key={slug}
                type="button"
                aria-pressed={slug === active}
                onClick={() => setChosen(slug)}
                className={`min-h-11 border px-5 text-xs font-semibold tracking-[0.16em] uppercase transition-colors ${slug === active ? 'border-carbon bg-carbon text-marfil' : 'border-carbon/30 text-carbon hover:border-carbon'}`}
              >
                {name.replace('Colección ', '')}
              </button>
            ))}
          </div>
        )}
        <div ref={gridRef}>
        <ul key={seen ? active : 'waiting'} className={`mt-12 grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-3 ${seen ? '' : 'opacity-0'}`}>
          {shown.map((product, i) => {
            const photo = modelPhotos[product.slug]
            const from = fromPrice(product.variants.map((v) => v.price))
            const sizes = product.variants.length
            return (
              <li key={product.id} className="group animate-card-in" style={{ animationDelay: `${i * 110}ms` }}>
                <button type="button" onClick={() => startOrder(product.variants.map((variant) => toOrderModel(product, variant)))} className="block w-full text-left">
                  <div className="aspect-square animate-photo-in overflow-hidden bg-beige/50" style={{ animationDelay: `${i * 110 + 80}ms` }}>
                    {photo ? (
                      <div className="relative h-full w-full animate-unzoom" style={{ animationDelay: `${i * 110 + 80}ms` }}>
                        <img src={photo.src} alt={photo.alt} loading="lazy" style={{ objectPosition: photo.focus }} className="h-full w-full object-cover transition-transform duration-700 ease-suave group-hover:scale-105" />
                        {/* Al pasar el cursor (o enfocar con teclado) la foto con comida se funde con la tabla sola. */}
                        {photo.bare && (
                          <img
                            src={photo.bare.src}
                            alt=""
                            loading="lazy"
                            style={{ objectPosition: photo.bare.focus }}
                            className="absolute inset-0 h-full w-full object-cover opacity-0 transition-[opacity,transform] duration-500 ease-suave group-hover:scale-105 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100"
                          />
                        )}
                      </div>
                    ) : (
                      <div className="grid h-full place-items-center text-sm text-carbon-600">Fotografía pendiente</div>
                    )}
                  </div>
                  {product.category && <p className="mt-4 text-[11px] tracking-[0.18em] text-carbon-600 uppercase">{product.category.name}</p>}
                  <h3 className="title-script mt-1 text-3xl text-carbon">{product.name}</h3>
                  <p className="mt-1 text-sm">
                    {sizes > 1 ? 'Desde ' : ''}
                    <span className="font-semibold">{formatPrice(from)}</span>
                    {sizes > 1 && <span className="text-carbon-600"> · {sizes} tamaños</span>}
                  </p>
                  <span className="mt-3 inline-flex min-h-10 items-center border border-carbon px-5 text-xs font-semibold tracking-[0.16em] uppercase transition-colors group-hover:bg-carbon group-hover:text-marfil">
                    Pedir por chat
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        </div>
      </Container>
    </section>
  )
}
