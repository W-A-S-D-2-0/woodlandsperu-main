import type { CatalogProduct } from '../../../../shared/api/contracts'
import { startOrder } from '../../../features/chat/open-chat'
import { homeContent } from '../../../content/home'
import { modelPhotos } from '../../../content/model-photos'
import { toOrderModel } from '../../catalog/catalog-format'

/** Va a la cuadrícula del catálogo (la misma que usa Teca). */
function goToCatalog() {
  document.querySelector('[aria-labelledby="catalog-pan-title"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/**
 * Portada · «Sostenibilidad hecha lujo» sobre la foto de Moshaco, la tabla más vendida de Woodland (catálogo
 * «The Woodland Experience». Medidas y precios vienen del catálogo real (API); si aún no cargan, solo se
 * muestra el texto y el botón al catálogo.
 */
export function HeroChapter({ product }: { product?: CatalogProduct }) {
  const photo = modelPhotos.moshaco!
  const { hero } = homeContent
  const [first = '', ...rest] = hero.title.split(' ')

  return (
    <section className="relative isolate flex min-h-[calc(100dvh-4rem)] items-end overflow-hidden bg-carbon text-marfil" aria-labelledby="hero-title">
      <img
        src={photo.src}
        alt={photo.alt}
        width={photo.width}
        height={photo.height}
        fetchPriority="high"
        className="absolute inset-0 -z-20 h-full w-full animate-unzoom object-cover object-[40%_60%]"
      />
      {/* Sombra para que el texto se lea sobre la foto, sin tapar la tabla. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(34_32_28/0.82)_0%,rgb(34_32_28/0.45)_45%,transparent_75%),linear-gradient(0deg,rgb(34_32_28/0.7)_0%,transparent_45%)]" />

      <div className="mx-auto w-full max-w-6xl px-5 pt-24 pb-14 sm:px-8 sm:pb-20">
        <p className="animate-rise text-xs font-semibold tracking-[0.28em] text-ambar uppercase">{hero.eyebrow}</p>
        <h1 id="hero-title" className="title-script mt-4 animate-settle text-5xl leading-[0.98] text-marfil [animation-delay:60ms] sm:text-7xl">
          <span className="block">{first}</span>
          <span className="block text-ambar">{rest.join(' ')}</span>
        </h1>
        <p className="mt-5 max-w-lg animate-rise text-base leading-relaxed text-marfil/85 [animation-delay:140ms] sm:text-lg">{hero.body}</p>

        {/* Moshaco, la más vendida: la tabla de la foto. */}
        <p className="mt-8 animate-rise text-xs font-semibold tracking-[0.22em] text-marfil/80 uppercase [animation-delay:200ms]">
          En la foto · el más vendido: <span className="title-script text-2xl text-marfil">Moshaco, Seductor Don Juan</span>
        </p>

        <div className="mt-8 flex animate-rise flex-col gap-3 [animation-delay:320ms] sm:flex-row">
          {product && (
            <button
              type="button"
              onClick={() => startOrder(product.variants.map((variant) => toOrderModel(product, variant)))}
              className="inline-flex min-h-12 items-center justify-center bg-marfil px-7 text-xs font-semibold tracking-[0.18em] text-carbon uppercase transition-colors hover:bg-beige"
            >
              Pedir mi Moshaco
            </button>
          )}
          <button
            type="button"
            onClick={goToCatalog}
            className="inline-flex min-h-12 items-center justify-center border border-marfil/60 px-7 text-xs font-semibold tracking-[0.18em] text-marfil uppercase transition-colors hover:bg-marfil hover:text-carbon"
          >
            Ver todos los modelos
          </button>
        </div>
      </div>
    </section>
  )
}
