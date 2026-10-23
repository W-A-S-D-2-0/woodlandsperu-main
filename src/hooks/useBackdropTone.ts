import { useEffect, useState, type RefObject } from 'react'

export type BackdropTone = 'light' | 'dark'

let probe: CanvasRenderingContext2D | null | undefined

/** Convierte cualquier color CSS (rgb, oklab, color-mix…) en [r, g, b, a] usando un canvas de 1×1 px. */
function toRgba(color: string): [number, number, number, number] | null {
  if (probe === undefined) probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  if (!probe) return null
  probe.clearRect(0, 0, 1, 1)
  probe.fillStyle = '#000'
  probe.fillStyle = color
  probe.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data
  return r === undefined || g === undefined || b === undefined || a === undefined ? null : [r, g, b, a / 255]
}

/** Luminosidad relativa aproximada (0 a 1) de un color CSS; null si es (casi) transparente o no se entiende. */
export function luminanceOf(color: string): number | null {
  const rgba = toRgba(color)
  if (!rgba || rgba[3] < 0.5) return null
  return (0.2126 * rgba[0] + 0.7152 * rgba[1] + 0.0722 * rgba[2]) / 255
}

/** Tono del fondo que hay justo debajo de `ref`: sube por los ancestros del punto central hasta hallar un color opaco. */
function toneUnder(element: HTMLElement): BackdropTone {
  const rect = element.getBoundingClientRect()
  const stack = document.elementsFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
  for (const candidate of stack) {
    if (element.contains(candidate) || candidate.closest('[data-backdrop-ignore]')) continue
    const luminance = luminanceOf(getComputedStyle(candidate).backgroundColor)
    if (luminance !== null) return luminance < 0.4 ? 'dark' : 'light'
  }
  return 'light'
}

/**
 * Indica si el elemento flotante `ref` está sobre un fondo claro u oscuro, para cambiar su color y
 * que se vea siempre. Se recalcula al hacer scroll y al cambiar el tamaño, sin re-renderizar si no cambia.
 */
export function useBackdropTone(ref: RefObject<HTMLElement | null>): BackdropTone {
  const [tone, setTone] = useState<BackdropTone>('light')

  useEffect(() => {
    const element = ref.current
    if (!element) return
    let frame = 0
    const update = () => {
      frame = 0
      setTone(toneUnder(element))
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
    }
  }, [ref])

  return tone
}
