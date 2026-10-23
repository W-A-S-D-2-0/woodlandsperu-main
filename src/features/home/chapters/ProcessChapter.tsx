import { useState, type CSSProperties } from 'react'
import type { OrderStatusResponse } from '../../../../shared/api/contracts'
import { useScrollProgress } from '../../../hooks/useScrollProgress'
import { OrderTracker } from '../../orders/OrderTracker'
import { currentStepIndex, trackingSteps } from '../../orders/tracking-logic'

const from = (value: number, speed = 7) => ({ '--from': value, '--speed': speed }) as CSSProperties

/**
 * Capítulo 7 · Cómo sigue tu pedido. Una línea de tiempo vertical que se llena al cruzar la
 * pantalla y, al lado, la consulta real del pedido: el estado que devuelve el sistema se resalta en
 * la línea. Cierra la pregunta "¿y ahora qué?" antes del cierre de la página.
 */
export function ProcessChapter() {
  const ref = useScrollProgress<HTMLElement>('cross')
  const [order, setOrder] = useState<OrderStatusResponse | null>(null)
  const active = order ? currentStepIndex(order.status) : -1

  return (
    <section ref={ref} className="chapter grain bg-linear-to-b from-marfil to-beige py-24 sm:py-32" aria-labelledby="process-title">
      <div className="mx-auto grid w-full max-w-6xl items-start gap-14 px-5 sm:px-8 lg:grid-cols-[1fr_0.9fr] lg:gap-20">
        <div>
          <p className="text-xs font-semibold tracking-[0.22em] text-madera-700 uppercase">Después de pedir</p>
          <h2 id="process-title" className="mt-4 max-w-md text-4xl leading-tight sm:text-5xl">
            Así sigue tu pedido.
          </h2>
          <p className="mt-4 max-w-md text-lg text-carbon-600">Desde que lo recibimos hasta que llega a tu mesa, puedes ver en qué paso va.</p>

          <ol className="relative mt-12 grid gap-9 pl-9">
            <span aria-hidden="true" className="absolute top-2 bottom-2 left-[0.6rem] w-px bg-linea" />
            <span aria-hidden="true" className="fill-line absolute top-2 bottom-2 left-[0.6rem] w-px bg-linear-to-b from-brasa to-madera" />
            {trackingSteps.map((step, index) => {
              const isActive = index === active
              const isDone = active >= 0 && index < active
              return (
                <li key={step.title} className="step-in relative" style={from(0.1 + index * 0.1)} aria-current={isActive ? 'step' : undefined}>
                  <span
                    aria-hidden="true"
                    className={`absolute top-1 -left-9 h-5 w-5 rounded-full border-2 transition-colors duration-500 ${
                      isActive ? 'dot-pulse border-brasa bg-brasa' : isDone ? 'border-madera bg-madera' : 'border-madera bg-marfil'
                    }`}
                  />
                  <p className={`font-display text-2xl ${isActive ? 'text-nogal' : 'text-carbon'}`}>{step.title}</p>
                  <p className="mt-1 text-sm text-carbon-600">{step.body}</p>
                </li>
              )
            })}
          </ol>
        </div>

        <div className="lg:sticky lg:top-28">
          <OrderTracker onResult={setOrder} />
        </div>
      </div>
    </section>
  )
}
