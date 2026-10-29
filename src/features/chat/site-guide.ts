/** Destinos de la web a los que Teca puede llevar al cliente en vez de resolverlo todo por chat. Sin React: se prueba sola. */

export type GuideId = 'catalogo' | 'grabado' | 'empresa' | 'nosotros' | 'alianzas'

export interface Guide {
  /** Texto del botón en el chat. */
  label: string
  /** Ruta de la página. */
  path: string
  /** Sección a la que se baja dentro de la página (si no hay, se queda arriba). */
  selector: string | null
  /** Pestaña de «Personaliza tu tabla» que se abre al llegar. */
  tab: 'personal' | 'company' | null
  /** Lo que Teca dice mientras te lleva. */
  going: string
  /** Lo que dice al llegar. */
  arrived: string
}

export const GUIDES: Readonly<Record<GuideId, Guide>> = {
  catalogo: {
    label: '🔎 Ver el catálogo',
    path: '/',
    selector: '[aria-labelledby="catalog-pan-title"]',
    tab: null,
    going: 'Te llevo al catálogo…',
    arrived: 'Aquí están los modelos. Toca el que te guste y vuelvo para ayudarte con el pedido.',
  },
  grabado: {
    label: '✏️ Probar mi grabado',
    path: '/',
    selector: '[aria-label="Personaliza tu tabla"]',
    tab: 'personal',
    going: 'Te llevo a probar tu grabado…',
    arrived: 'Escribe tu nombre o frase y mira cómo queda en la tabla.',
  },
  empresa: {
    label: '🏢 Ver opciones para empresas',
    path: '/',
    selector: '[aria-label="Personaliza tu tabla"]',
    tab: 'company',
    going: 'Te llevo a la sección para empresas…',
    arrived: 'Sube tu logo para ver cómo quedaría. Si quieres cotizar, me llamas.',
  },
  nosotros: {
    label: '🌳 Conocer Woodland',
    path: '/nosotros',
    selector: null,
    tab: null,
    going: 'Te llevo a conocer Woodland…',
    arrived: 'Aquí está nuestra historia. Cualquier duda, me llamas.',
  },
  alianzas: {
    label: '🤝 Ver alianzas',
    path: '/alianzas',
    selector: null,
    tab: null,
    going: 'Te llevo a las alianzas…',
    arrived: 'Aquí están las alianzas. Si te interesa una, me cuentas.',
  },
}

const PREFIX = '__ir:'

/** Valor del botón que lleva a un destino (no se envía como mensaje: lo recoge el widget). */
export function guideValue(id: GuideId): string {
  return `${PREFIX}${id}__`
}

/** Destino de un valor de botón, o null si no es de los que llevan a la web. */
export function parseGuideValue(value: string): GuideId | null {
  if (!value.startsWith(PREFIX) || !value.endsWith('__')) return null
  const id = value.slice(PREFIX.length, -2)
  return id in GUIDES ? (id as GuideId) : null
}

/** Botón que lleva a un destino. */
export function guideChip(id: GuideId): { label: string; value: string } {
  return { label: GUIDES[id].label, value: guideValue(id) }
}

/** Altura (px) a la que queda la sección bajo el encabezado fijo. */
const HEADER_OFFSET = 64

/**
 * Desplaza la página hasta `target` con un deslizamiento suave propio. Recalcula el destino en cada cuadro: si la página
 * cambia de alto mientras baja (imágenes, secciones fijadas), llega igual. Devuelve una función que lo cancela.
 */
export function glideTo(target: HTMLElement, duration = 1100, onDone?: () => void): () => void {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const from = window.scrollY
  const started = performance.now()
  let frame = 0
  let moved = false
  const destination = () => Math.max(0, target.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET)
  const step = (now: number) => {
    moved = true
    const t = reduce ? 1 : Math.min(1, (now - started) / duration)
    const eased = 1 - Math.pow(1 - t, 3)
    window.scrollTo({ top: from + (destination() - from) * eased, behavior: 'instant' })
    if (t < 1) frame = requestAnimationFrame(step)
    else onDone?.()
  }
  frame = requestAnimationFrame(step)
  // Si el navegador no pinta cuadros (pestaña en segundo plano), se salta directo al destino.
  const fallback = window.setTimeout(() => {
    if (moved) return
    cancelAnimationFrame(frame)
    window.scrollTo({ top: destination(), behavior: 'instant' })
    onDone?.()
  }, 400)
  return () => {
    cancelAnimationFrame(frame)
    window.clearTimeout(fallback)
  }
}
