import { Container } from '../../../components/ui/Container'
import { openChat } from '../../chat/open-chat'

interface GalleryPhoto {
  src: string
  alt: string
  width: number
  height: number
  /** Clases de la celda en la cuadrícula de escritorio. */
  cell: string
}

/** Fotos de la sección «Corporativos, personalizados, o diseña el tuyo!» de «The Woodland Experience» (Woodland, 2026-11-06). */
const photos: GalleryPhoto[] = [
  { src: '/images/experience/corp-caja-regalo.webp', alt: 'Caja de regalo de teca con nombre grabado, con taza, tarjeta y frutas deshidratadas', width: 471, height: 836, cell: 'lg:row-span-2' },
  { src: '/images/experience/corp-cocteles.webp', alt: 'Bandeja de teca con logo grabado y dos copas de cóctel frente a la ciudad de noche', width: 550, height: 458, cell: 'lg:col-span-2' },
  { src: '/images/experience/corp-velas.webp', alt: 'Cajas de teca con velas aromáticas y un nombre grabado', width: 540, height: 960, cell: 'lg:row-span-2' },
  { src: '/images/experience/corp-sal-navidad.webp', alt: 'Salero doble de teca con lazo rojo, entregado como regalo de Navidad en una oficina', width: 471, height: 836, cell: 'lg:row-span-2' },
  { src: '/images/experience/corp-taza.webp', alt: 'Base de teca para taza y cuchara con el logo de una universidad grabado', width: 461, height: 547, cell: '' },
  { src: '/images/experience/corp-escritorio.webp', alt: 'Organizador de escritorio de teca con porta celular, porta lápices y un nombre grabado', width: 656, height: 600, cell: '' },
]

/**
 * Corporativos y personalizados: regalos para empresas con su logo, piezas con nombre o un diseño propio.
 * Todo se pide por el chat; el precio corporativo lo arma el equipo según volumen y personalización.
 */
export function CorporateGalleryChapter() {
  return (
    <section className="bg-marfil py-16 text-carbon sm:py-24" aria-labelledby="corporate-title">
      <Container>
        <p className="text-center text-xs font-semibold tracking-[0.28em] text-madera-700 uppercase">Empresas y regalos</p>
        <h2 id="corporate-title" className="title-script mx-auto mt-3 max-w-3xl text-center text-3xl sm:text-5xl">
          Corporativos, personalizados, o diseña el tuyo!
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-carbon-600">
          Precios corporativos preferenciales según volumen, personalización y requerimientos del proyecto. Solicita una propuesta para tu empresa.
        </p>

        <ul className="mt-12 grid auto-rows-[minmax(11rem,1fr)] grid-cols-2 gap-3 sm:gap-4 lg:auto-rows-[16rem] lg:grid-cols-5">
          {photos.map((photo, i) => (
            <li key={photo.src} className={`group animate-card-in overflow-hidden bg-beige/50 ${photo.cell}`} style={{ animationDelay: `${i * 90}ms` }}>
              <img
                src={photo.src}
                alt={photo.alt}
                width={photo.width}
                height={photo.height}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-700 ease-suave group-hover:scale-105"
              />
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => openChat('Quiero una propuesta corporativa para mi empresa')}
            className="inline-flex min-h-12 items-center justify-center bg-carbon px-7 text-xs font-semibold tracking-[0.18em] text-marfil uppercase transition-colors hover:bg-nogal"
          >
            Pedir propuesta corporativa
          </button>
          <button
            type="button"
            onClick={() => openChat('Quiero diseñar mi propia tabla')}
            className="inline-flex min-h-12 items-center justify-center border border-carbon px-7 text-xs font-semibold tracking-[0.18em] text-carbon uppercase transition-colors hover:bg-carbon hover:text-marfil"
          >
            Diseñar la mía
          </button>
        </div>
      </Container>
    </section>
  )
}
