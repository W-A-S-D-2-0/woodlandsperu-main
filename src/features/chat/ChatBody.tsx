import { useEffect, useState } from 'react'
import { brigitte } from '../../content/site'
import { EngravingBoard } from '../engraving/EngravingBoard'
import { positionLabel, whatsappUrl, type PreviewMarker, type WhatsappMarker } from '../engraving/preview-marker'
import { formatSizes, isPlainText, parseBody, parseRich, photoForModel, splitFlowFooter, typedLength, type BodyBlock } from './chat-logic'
import { useDragScroll } from './useDragScroll'

/** Texto que se escribe solo, letra a letra, en poco más de un segundo. El lector de pantalla recibe el texto completo desde el inicio. */
function Typed({ text }: { text: string }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const start = performance.now()
    let frame = 0
    const tick = () => {
      const n = typedLength(text.length, performance.now() - start)
      setShown(n)
      if (n < text.length) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [text])
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{text.slice(0, shown)}</span>
    </>
  )
}

/** Texto del asistente con orden: párrafos separados, rótulos en negrita y listas con viñetas o numeradas. */
function RichText({ text, typing = false }: { text: string; typing?: boolean }) {
  const blocks = parseRich(text)
  if (isPlainText(blocks)) return typing ? <Typed text={text} /> : <>{text}</>
  return (
    <div className="grid gap-2.5 whitespace-normal">
      {blocks.map((b, i) => {
        if (b.kind === 'ul')
          return (
            <ul key={i} className="grid gap-1.5">
              {b.items.map((item, j) => (
                <li key={j} className="flex gap-2.5">
                  <span aria-hidden="true" className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-madera-700" />
                  <span className="min-w-0">{item}</span>
                </li>
              ))}
            </ul>
          )
        if (b.kind === 'ol')
          return (
            <ol key={i} className="grid gap-1.5">
              {b.items.map((item) => (
                <li key={item.n} className="flex gap-2.5">
                  <span aria-hidden="true" className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-nogal text-[0.65rem] font-semibold text-marfil">
                    {item.n}
                  </span>
                  <span className="min-w-0">{item.text}</span>
                </li>
              ))}
            </ol>
          )
        return (
          <p key={i} className="grid gap-0.5">
            {b.lines.map((line, j) => (
              <span key={j}>
                {line.label && <strong className="font-semibold text-nogal">{line.label}{line.text ? ': ' : ':'}</strong>}
                {line.text}
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}

type ProductBlock = Extract<BodyBlock, { kind: 'product' }>

/** Los modelos como tarjetas que se deslizan de lado: foto, colección, frase, medidas y un botón para pedirlo. */
function ProductCarousel({ items, onAsk, onSeeAll }: { items: ProductBlock[]; onAsk?: (message: string) => void; onSeeAll?: () => void }) {
  const { ref, handlers } = useDragScroll<HTMLDivElement>()
  return (
    <div className="grid gap-1.5">
    <div
      ref={ref}
      role="group"
      aria-label="Modelos de Woodland"
      {...handlers}
      className="-mx-1 flex cursor-grab snap-x snap-mandatory gap-2.5 overflow-x-auto px-1 pb-1.5 [scrollbar-width:none] active:cursor-grabbing [&::-webkit-scrollbar]:hidden"
    >
      {items.map((item) => {
        const photo = photoForModel(item.name)
        return (
          <article key={item.name} className="flex w-[13.5rem] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-linea bg-marfil select-none">
            {photo ? <img src={photo.src} alt={photo.alt} loading="lazy" draggable={false} className="h-28 w-full object-cover" /> : <div className="h-28 bg-beige" />}
            <div className="flex flex-1 flex-col gap-1.5 p-3">
              <div>
                <h3 className="font-display text-base leading-tight text-nogal">{item.name}</h3>
                {item.collection && <p className="mt-0.5 text-[0.65rem] font-semibold tracking-[0.08em] text-madera-700 uppercase">{item.collection}</p>}
              </div>
              {item.description && <p className="text-xs text-carbon-600">{item.description}</p>}
              <p className="text-xs text-carbon">
                <span className="font-semibold">Medidas:</span> {formatSizes(item.sizes)}
              </p>
              {onAsk && (
                <button type="button" className="mt-auto rounded-full bg-nogal px-3 py-1.5 text-xs font-semibold text-marfil transition-colors hover:bg-madera-700" onClick={() => onAsk(`Quiero hacer un pedido de ${item.name}`)}>
                  Pedir este modelo
                </button>
              )}
            </div>
          </article>
        )
      })}
    </div>
    {onSeeAll && (
      <button type="button" className="justify-self-start rounded-full border border-madera/60 px-3.5 py-1.5 text-xs font-semibold text-nogal transition-colors hover:bg-nogal hover:text-marfil" onClick={onSeeAll}>
        Ver todo en la web ↓
      </button>
    )}
    </div>
  )
}

/** La tabla con el nombre en cada posición recomendada, en un carrusel: se elige la que gusta con un toque. */
function PreviewCarousel({ marker, onAsk }: { marker: PreviewMarker; onAsk?: (message: string) => void }) {
  const { ref, handlers } = useDragScroll<HTMLDivElement>()
  // Una sola posición: es la tabla que el cliente ya diseñó en «Para ti». Se muestra grande y sin elegir otra.
  if (marker.positions.length === 1) {
    const position = marker.positions[0]!
    return (
      <figure className="animate-chip-in overflow-hidden rounded-xl border border-linea bg-marfil p-2">
        <EngravingBoard line1={marker.line1} line2={marker.line2} font={marker.font} position={position} model={marker.model} />
        <figcaption className="flex items-center gap-1.5 px-1 pt-2 text-xs font-semibold text-nogal">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-madera" />
          Tu tabla{marker.model ? ` ${marker.model}` : ''} · {positionLabel(position)}
        </figcaption>
      </figure>
    )
  }
  return (
    <div
      ref={ref}
      role="group"
      aria-label="Vistas previas del grabado"
      {...handlers}
      className="-mx-1 flex cursor-grab snap-x snap-mandatory gap-2.5 overflow-x-auto px-1 pb-1.5 [scrollbar-width:none] active:cursor-grabbing [&::-webkit-scrollbar]:hidden"
    >
      {marker.positions.map((position) => (
        <article key={position} className="flex w-[14rem] shrink-0 snap-start flex-col gap-2 overflow-hidden rounded-xl border border-linea bg-marfil p-2 select-none">
          <EngravingBoard line1={marker.line1} line2={marker.line2} font={marker.font} position={position} model={marker.model} />
          <p className="px-1 text-xs font-semibold text-nogal">{positionLabel(position)}</p>
          {onAsk && (
            <button type="button" className="rounded-full bg-nogal px-3 py-1.5 text-xs font-semibold text-marfil transition-colors hover:bg-madera-700" onClick={() => onAsk(`Prefiero la posición ${positionLabel(position)}`)}>
              Quiero esta posición
            </button>
          )}
        </article>
      ))}
    </div>
  )
}

/** Abre el WhatsApp de Brigitte con el mensaje ya escrito. */
function WhatsappButton({ marker }: { marker: WhatsappMarker }) {
  return (
    <a
      href={whatsappUrl(brigitte.whatsapp, marker)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-10 items-center justify-center gap-2 justify-self-start rounded-full bg-selva px-4 py-2 text-xs font-semibold text-marfil shadow-sm transition-colors hover:bg-nogal"
    >
      Escribirle a {brigitte.name} por WhatsApp
    </a>
  )
}

/**
 * Un mensaje del asistente. Si es una pregunta del pedido paso a paso, la frase «escribe cancelar» no se muestra:
 * en su lugar va el botón «Cancelar» (`onCancel`, solo en el último mensaje, que es el que está esperando respuesta).
 */
export function ChatBody({ body, typing = false, onAsk, onSeeAll, onCancel, onSchedule }: { body: string; typing?: boolean; onAsk?: (message: string) => void; onSeeAll?: () => void; onCancel?: () => void; onSchedule?: () => void }) {
  const { text, inFlow } = splitFlowFooter(body)
  return (
    <>
      <ChatContent body={text} typing={typing} onAsk={onAsk} onSeeAll={onSeeAll} onSchedule={onSchedule} />
      {inFlow && onCancel && (
        <button
          type="button"
          className="mt-2 inline-flex min-h-9 items-center rounded-full border border-madera-700/60 px-4 text-xs font-semibold text-madera-700 transition-colors hover:bg-madera-700 hover:text-marfil"
          onClick={onCancel}
        >
          Cancelar
        </button>
      )}
    </>
  )
}

/** Texto de un mensaje del asistente: precios en tarjetas, líneas de pedido y total destacado. `typing` escribe el texto simple poco a poco. */
function ChatContent({ body, typing = false, onAsk, onSeeAll, onSchedule }: { body: string; typing?: boolean; onAsk?: (message: string) => void; onSeeAll?: () => void; onSchedule?: () => void }) {
  const blocks = parseBody(body)
  if (blocks.every((b) => b.kind === 'text')) return <RichText text={body} typing={typing} />
  return (
    <div className="grid gap-1.5">
      {blocks.map((b, i) => {
        if (b.kind === 'product') {
          // Los modelos seguidos forman un solo carrusel: se dibuja al llegar el primero.
          if (blocks[i - 1]?.kind === 'product') return null
          const items: ProductBlock[] = []
          for (let j = i; blocks[j]?.kind === 'product'; j++) items.push(blocks[j] as ProductBlock)
          return <ProductCarousel key={i} items={items} onAsk={onAsk} onSeeAll={onSeeAll} />
        }
        if (b.kind === 'preview') return <PreviewCarousel key={i} marker={b} onAsk={onAsk} />
        if (b.kind === 'whatsapp')
          return (
            <div key={i} className="flex flex-wrap gap-2">
              <WhatsappButton marker={b} />
              {onSchedule && (
                <button
                  type="button"
                  className="inline-flex min-h-10 items-center justify-center rounded-full border border-nogal/40 px-4 py-2 text-xs font-semibold text-nogal transition-colors hover:bg-nogal hover:text-marfil"
                  onClick={onSchedule}
                >
                  Agendar cita
                </button>
              )}
            </div>
          )
        if (b.kind === 'text') return <RichText key={i} text={b.text} />
        if (b.kind === 'price') {
          const photo = photoForModel(b.name)
          return (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-linea bg-marfil p-1.5 pr-3">
              {photo && <img src={photo.src} alt={photo.alt} loading="lazy" className="size-14 shrink-0 rounded-lg object-cover" />}
              <div className="min-w-0 flex-1 leading-tight">
                <p className="font-medium text-nogal">{b.name}</p>
                <p className="mt-0.5 text-xs text-carbon-600">
                  desde <strong className="font-display text-base whitespace-nowrap text-madera-700">{b.price}</strong>
                </p>
              </div>
            </div>
          )
        }
        if (b.kind === 'line')
          return (
            <div key={i} className="flex items-baseline justify-between gap-3 border-b border-dashed border-linea pb-1">
              <span>{b.label}</span>
              <span className="font-semibold whitespace-nowrap text-nogal">{b.amount}</span>
            </div>
          )
        return (
          <div key={i} className="rounded-xl bg-nogal px-3.5 py-2.5 text-marfil">
            <p className="text-[0.7rem] tracking-[0.08em] text-beige/80 uppercase">{b.label ?? 'Total estimado'}</p>
            <p className="font-display text-xl text-ambar">{b.amount}</p>
            {b.note && <p className="mt-0.5 text-xs text-beige/90">{b.note}</p>}
          </div>
        )
      })}
    </div>
  )
}
