import { useEffect, useRef, type RefObject } from 'react'

/** Progreso 0..1 de un elemento según cuánto se desplazó. */
export type ScrollMode =
  /** Sección alta con contenido fijo (sticky): 0 al llegar a su inicio, 1 cuando termina el recorrido fijo. */
  | 'pin'
  /** Sección que sale de pantalla: 0 arriba del todo, 1 cuando su borde inferior sale por arriba. */
  | 'leave'
  /** Sección que cruza la pantalla: 0 cuando su borde superior asoma por abajo, 1 cuando su borde inferior sale por arriba. */
  | 'cross'

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** Calcula el progreso (puro, para pruebas). `top`/`height` vienen de getBoundingClientRect. */
export function scrollProgress(mode: ScrollMode, top: number, height: number, viewport: number): number {
  if (mode === 'cross') return clamp01((viewport - top) / (viewport + height))
  const range = mode === 'pin' ? height - viewport : height
  return range <= 0 ? 1 : clamp01(-top / range)
}

/**
 * Publica el progreso de scroll como la variable CSS `--p` del elemento, sin re-renderizar React.
 * Con "reducir movimiento" no escucha nada: el CSS deja `--p` en 1 y el contenido queda completo.
 */
export function useScrollProgress<T extends HTMLElement>(mode: ScrollMode): RefObject<T | null> {
  const ref = useRef<T>(null)

  useEffect(() => {
    const element = ref.current
    if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let frame = 0
    const update = () => {
      frame = 0
      const rect = element.getBoundingClientRect()
      element.style.setProperty('--p', scrollProgress(mode, rect.top, rect.height, window.innerHeight).toFixed(4))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (frame) cancelAnimationFrame(frame)
      element.style.removeProperty('--p')
    }
  }, [mode])

  return ref
}

/**
 * Publica la posición del puntero como `--mx` y `--my` (de -1 a 1) para dar profundidad al mover
 * el ratón. Solo con puntero fino (no en pantallas táctiles) y sin "reducir movimiento".
 */
export function usePointerDepth<T extends HTMLElement>(ref: RefObject<T | null>) {
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const query = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)')
    if (!query.matches) return

    let frame = 0
    let x = 0
    let y = 0
    const apply = () => {
      frame = 0
      element.style.setProperty('--mx', x.toFixed(3))
      element.style.setProperty('--my', y.toFixed(3))
    }
    const onMove = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect()
      x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      y = ((event.clientY - rect.top) / rect.height) * 2 - 1
      if (!frame) frame = requestAnimationFrame(apply)
    }

    element.addEventListener('pointermove', onMove)
    return () => {
      element.removeEventListener('pointermove', onMove)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [ref])
}
