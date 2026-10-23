import { useEffect, useRef, useState } from 'react'

const DURATION_MS = 900

/** Número que sube de 0 hasta `to` al entrar en pantalla. Con «reducir movimiento» o sin observer muestra el valor final. */
export function CountUp({ to, pad = 2 }: { to: number; pad?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [value, setValue] = useState(to)

  useEffect(() => {
    const element = ref.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const run = () => {
      const start = performance.now()
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / DURATION_MS)
        setValue(Math.round((1 - (1 - t) ** 3) * to))
        if (t < 1) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        observer.disconnect()
        setValue(0)
        run()
      },
      { threshold: 0.6 },
    )
    observer.observe(element)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [to])

  return (
    <span ref={ref} aria-label={String(to)}>
      <span aria-hidden="true">{String(value).padStart(pad, '0')}</span>
    </span>
  )
}
