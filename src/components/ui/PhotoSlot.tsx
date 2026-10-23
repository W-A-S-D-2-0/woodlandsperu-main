import { useId } from 'react'
import type { LandingImage } from '../../content/home'

interface PhotoSlotProps {
  /** Qué fotografía real debe ir aquí (sirve de guía para la sesión de fotos). */
  label: string
  /** Fotografía real aprobada por Woodland. Mientras sea null se muestra el espacio rotulado. */
  image?: LandingImage | null
  /** Imagen principal de la página: se carga con prioridad y entra con una cortina. */
  priority?: boolean
  className?: string
}

/**
 * Fotografía de Woodland o, si todavía no existe, un espacio reservado rotulado.
 * Nunca se rellena con fotos de stock ni imágenes generadas.
 */
export function PhotoSlot({ label, image, priority = false, className = '' }: PhotoSlotProps) {
  const patternId = useId()
  const entrance = priority ? 'animate-curtain [animation-delay:150ms]' : ''

  if (image) {
    return (
      <figure className={`group relative overflow-hidden rounded-2xl bg-beige ${entrance} ${className}`}>
        <img
          src={image.src}
          srcSet={image.srcSet}
          sizes={image.sizes ?? '(min-width: 1024px) 50vw, 100vw'}
          alt={image.alt}
          width={image.width}
          height={image.height}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          className={`h-full w-full object-cover transition-transform duration-[1.4s] ease-suave group-hover:scale-[1.03] ${
            priority ? 'animate-unzoom [animation-delay:150ms]' : ''
          }`}
        />
      </figure>
    )
  }

  return (
    <figure
      className={`relative flex items-end overflow-hidden rounded-2xl border border-linea bg-beige ${entrance} ${className}`}
      aria-label={`Espacio para fotografía: ${label}`}
    >
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full text-madera/25" preserveAspectRatio="none">
        <defs>
          <pattern id={patternId} width="120" height="24" patternUnits="userSpaceOnUse">
            <path d="M0 12 C30 4, 60 20, 120 12" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
      <figcaption className="relative m-4 rounded-full bg-marfil/90 px-3 py-1 text-xs font-medium text-carbon-600">
        Fotografía pendiente · {label}
      </figcaption>
    </figure>
  )
}
