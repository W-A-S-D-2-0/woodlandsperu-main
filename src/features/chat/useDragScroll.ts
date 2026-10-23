import { useRef, type PointerEvent } from 'react'

const DRAG_THRESHOLD_PX = 5

/** Desplazamiento horizontal arrastrando con el mouse. En pantalla táctil el navegador ya desplaza solo. */
export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const drag = useRef({ active: false, moved: false, startX: 0, startScroll: 0 })

  return {
    ref,
    handlers: {
      onPointerDown: (event: PointerEvent<T>) => {
        if (event.pointerType === 'touch') return
        drag.current = { active: true, moved: false, startX: event.clientX, startScroll: ref.current?.scrollLeft ?? 0 }
      },
      onPointerMove: (event: PointerEvent<T>) => {
        const d = drag.current
        const el = ref.current
        if (!d.active || !el) return
        const dx = event.clientX - d.startX
        if (!d.moved && Math.abs(dx) > DRAG_THRESHOLD_PX) {
          d.moved = true
          el.setPointerCapture(event.pointerId)
        }
        if (d.moved) el.scrollLeft = d.startScroll - dx
      },
      onPointerUp: () => {
        drag.current.active = false
      },
      onPointerCancel: () => {
        drag.current.active = false
      },
      // Si hubo arrastre, el clic que sigue al soltar no debe activar nada.
      onClickCapture: (event: { stopPropagation: () => void; preventDefault: () => void }) => {
        if (drag.current.moved) {
          event.stopPropagation()
          event.preventDefault()
          drag.current.moved = false
        }
      },
    },
  }
}
