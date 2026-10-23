import { useEffect, useState } from 'react'
import { formatSizes, parseBody, photoForModel, typedLength, type BodyBlock } from './chat-logic'
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

/** Texto de un mensaje del asistente: precios en tarjetas, líneas de pedido y total destacado. `typing` escribe el texto simple poco a poco. */
export function ChatBody({ body, typing = false, onAsk, onSeeAll }: { body: string; typing?: boolean; onAsk?: (message: string) => void; onSeeAll?: () => void }) {
  const blocks = parseBody(body)
  if (blocks.every((b) => b.kind === 'text')) return typing ? <Typed text={body} /> : <>{body}</>
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
        if (b.kind === 'text') return <p key={i} className="whitespace-pre-wrap">{b.text}</p>
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
            <p className="text-[0.7rem] tracking-[0.08em] text-beige/80 uppercase">Total estimado</p>
            <p className="font-display text-xl text-ambar">{b.amount}</p>
            {b.note && <p className="mt-0.5 text-xs text-beige/90">{b.note}</p>}
          </div>
        )
      })}
    </div>
  )
}
