import { useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from 'react'

let sharedObserver: IntersectionObserver | null = null

/** Un solo IntersectionObserver para todos los elementos con aparición al hacer scroll. */
function getObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') return null
  sharedObserver ??= new IntersectionObserver(
    (entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        ;(entry.target as HTMLElement).dataset.reveal = 'visible'
        observer.unobserve(entry.target)
      }
    },
    // El margen superior enorme hace que todo lo que quedó por encima (saltos de scroll,
    // anclas, tecla Fin) cuente como visible; solo se anima lo que entra desde abajo.
    { rootMargin: '100000px 0px -8% 0px', threshold: 0 },
  )
  return sharedObserver
}

interface RevealProps {
  children: ReactNode
  /** Posición dentro de un grupo: escalona la aparición (90 ms por paso). */
  index?: number
  as?: ElementType
  className?: string
}

/**
 * Aparece con un fundido y un desplazamiento corto al entrar en pantalla.
 * Sin JavaScript o con "reducir movimiento" el contenido se muestra directamente.
 */
export function Reveal({ children, index = 0, as: Tag = 'div', className }: RevealProps) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const element = ref.current
    const observer = getObserver()
    if (!element || !observer) return
    if (element.getBoundingClientRect().top < window.innerHeight * 0.92) return // ya visible al cargar: sin animación
    element.dataset.reveal = 'pending'
    observer.observe(element)
    return () => observer.unobserve(element)
  }, [])

  return (
    <Tag ref={ref} data-reveal="" className={className} style={{ '--reveal-index': index } as CSSProperties}>
      {children}
    </Tag>
  )
}
