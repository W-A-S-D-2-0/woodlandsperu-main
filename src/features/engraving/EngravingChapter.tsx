import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { engravingContent, engravingFonts, engravingLimits, engravingPositions, type EngravingFont } from '../../content/engraving'
import { boardScale, boardShapeForSize, boardSize } from '../../content/board-shapes'
import { useCatalog } from '../catalog/use-catalog'
import { openChat, SELECT_MODEL_EVENT, type SelectedModel } from '../chat/open-chat'
import { alignClass, BoardSilhouette, fontClass, textPlacement, textShape } from './EngravingBoard'
import { ModelPicker, sizeLabel } from './ModelPicker'
import {
  defaultEngraving,
  engravingSummary,
  engravingFontSize,
  hasEngravingText,
  normalizeEngraving,
  type EngravingValues,
} from './engraving-logic'

const inputClass =
  'min-h-11 w-full rounded-lg border border-beige/25 bg-nogal/70 px-3 text-base text-marfil placeholder:text-beige/50 focus-visible:border-marfil'

function Choice<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string
  name: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium text-marfil">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-marfil ${
              value === option.value ? 'border-marfil bg-marfil text-nogal' : 'border-beige/30 text-beige hover:border-beige'
            }`}
          >
            <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} className="sr-only" />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function Labeled({ label, hint, children }: { label: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-marfil">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-beige/75">{hint}</p>}
    </div>
  )
}

/** Una línea grabada: capa oscura (ya quemada) y capa de brasa (el frente que avanza). */
function EngravedLine({ text, font, size, runKey, animate, light = false }: { text: string; font: EngravingFont; size: number; runKey: string; animate: boolean; light?: boolean }) {
  const base = `${fontClass[font]} leading-tight whitespace-nowrap`
  return (
    <span key={runKey} className={`relative block ${animate ? 'burn-run' : ''}`} style={{ fontSize: `${size}cqw` }}>
      <span className={`burn block ${light ? 'text-marfil' : 'text-carbon/90 mix-blend-multiply'} ${base}`}>{text}</span>
      <span aria-hidden="true" className={`burn-heat absolute inset-0 block text-brasa [text-shadow:0_0_10px_var(--color-ambar)] ${base}`}>
        {text}
      </span>
    </span>
  )
}

/**
 * Panel "Para ti" del capítulo 4 · El grabado (pico de la página); lo envuelve PersonalizeChapter. Quien visita escribe lo que quiere grabar y lo ve
 * quemarse sobre la tabla. Lo escrito, la posición y la letra viajan a la cotización como
 * personalización de la variante elegida: no hay que volver a escribirlo.
 */
export function EngravingChapter() {
  const { state: catalog } = useCatalog()
  const sectionRef = useRef<HTMLDivElement>(null)
  const [values, setValues] = useState<EngravingValues>(defaultEngraving)
  const [inView, setInView] = useState(false)
  const [productId, setProductId] = useState('')
  const [variantId, setVariantId] = useState('')
  // Lo que ya está grabado en la tabla: se actualiza cuando la persona deja de escribir, así el
  // quemado no se reinicia en cada tecla.
  const [burned, setBurned] = useState<EngravingValues | null>(null)
  const [runKey, setRunKey] = useState(0)
  // Cantidad que se eligió en el chat antes de venir a personalizar; sin ella se pide como siempre.
  const [quantity, setQuantity] = useState<number | null>(null)

  const products = useMemo(() => (catalog.kind === 'ok' ? catalog.data.products : []), [catalog])
  // Sin elección todavía se muestra el primer modelo: la vista previa siempre tiene una tabla real.
  const product = products.find((p) => p.id === productId) ?? products.find((p) => p.variants.length > 0) ?? null
  const variant = product?.variants.find((v) => v.id === variantId) ?? product?.variants[0] ?? null

  // El chat trae el modelo y la cantidad ya elegidos: se reflejan en los selectores de esta sección.
  useEffect(() => {
    const onSelect = (event: Event) => {
      const pick = (event as CustomEvent<SelectedModel>).detail
      const found = products.find((p) => p.name === pick.product)
      if (!found) return
      setProductId(found.id)
      setVariantId(found.variants.find((v) => v.name === pick.variant)?.id ?? found.variants[0]?.id ?? '')
      setQuantity(pick.quantity)
    }
    window.addEventListener(SELECT_MODEL_EVENT, onSelect)
    return () => window.removeEventListener(SELECT_MODEL_EVENT, onSelect)
  }, [products])

  useEffect(() => {
    const element = sectionRef.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold: 0.35 },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const timer = setTimeout(
      () => {
        if (hasEngravingText(values)) {
          setBurned(normalizeEngraving(values))
          setRunKey((n) => n + 1)
        } else {
          setBurned(null)
        }
      },
      hasEngravingText(values) ? 600 : 0,
    )
    return () => clearTimeout(timer)
  }, [values])

  // La silueta y el tamaño de la tabla elegida: la más grande del catálogo se dibuja a lo ancho y las demás en proporción.
  const largest = Math.max(0, ...products.flatMap((p) => p.variants.map((v) => boardSize(v.dimensionsLabel)?.width ?? 0)))
  const shape = boardShapeForSize(product?.name, variant?.dimensionsLabel)
  const scale = boardScale(variant?.dimensionsLabel, largest)
  const writeShape = textShape(shape)

  const set = <K extends keyof EngravingValues>(key: K, value: EngravingValues[K]) => setValues((v) => ({ ...v, [key]: value }))
  const ready = hasEngravingText(values)
  const clean = burned

  function order() {
    if (!ready) return
    // El chat recibe el modelo y el grabado ya escritos: no hay que repetirlos.
    const what = variant && product ? `${product.name} · ${variant.name}` : 'una tabla grabada'
    if (quantity) openChat(`Quiero ${quantity} ${quantity === 1 ? 'unidad' : 'unidades'} de ${what}. ${engravingSummary(values)}`)
    else openChat(`Quiero pedir ${what}. ${engravingSummary(values)}`)
  }

  return (
    <div ref={sectionRef} className="relative text-beige">
      <div className="mx-auto grid w-full max-w-6xl items-start gap-12 px-5 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
        <div className="grid gap-7">
          <div>
            <p className="text-xs font-semibold tracking-[0.22em] text-beige/80 uppercase">{engravingContent.eyebrow}</p>
            <h2 id="engrave-title" className="mt-4 text-4xl leading-tight text-marfil sm:text-5xl">
              {engravingContent.title}
            </h2>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-beige/85">{engravingContent.body}</p>
          </div>

          {products.length > 0 ? (
            <ModelPicker
              products={products}
              productId={product?.id ?? ''}
              variantId={variant?.id ?? ''}
              onChange={(nextProduct, nextVariant) => {
                setProductId(nextProduct)
                setVariantId(nextVariant)
              }}
            />
          ) : (
            <p className="text-xs text-beige/75">{engravingContent.noModel}</p>
          )}

          <Labeled label="¿Qué grabamos?" hint={`Hasta ${engravingLimits.line1} caracteres.`}>
            {(id) => (
              <input
                id={id}
                className={inputClass}
                maxLength={engravingLimits.line1}
                placeholder={engravingContent.placeholder}
                value={values.line1}
                onChange={(e) => set('line1', e.target.value)}
                autoComplete="off"
              />
            )}
          </Labeled>
          <Labeled label="Segunda línea (opcional)" hint={`Hasta ${engravingLimits.line2} caracteres. Una fecha o una frase corta.`}>
            {(id) => (
              <input id={id} className={inputClass} maxLength={engravingLimits.line2} value={values.line2} onChange={(e) => set('line2', e.target.value)} autoComplete="off" />
            )}
          </Labeled>

          <Choice legend="Dónde va el grabado" name="engrave-position" options={engravingPositions} value={values.position} onChange={(v) => set('position', v)} />
          <Choice legend="Letra" name="engrave-font" options={engravingFonts} value={values.font} onChange={(v) => set('font', v)} />

          {product && variant && quantity && (
            <p className="-mt-3 animate-chip-in rounded-xl border border-brasa/50 bg-nogal-800/60 px-4 py-2.5 text-sm text-marfil">
              Tu pedido: {quantity} {quantity === 1 ? 'tabla' : 'tablas'} · {product.name} · {variant.name}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              disabled={!ready}
              onClick={order}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-marfil px-7 text-sm font-semibold text-nogal transition-colors hover:bg-beige disabled:cursor-not-allowed disabled:opacity-50"
            >
              {engravingContent.cta}
            </button>
            {!ready && <p className="text-xs text-beige/75">Escribe lo que quieres grabar para continuar.</p>}
          </div>
        </div>

        {/* La tabla: se queda a la vista mientras se recorren los controles (escritorio). */}
        <div className="sticky top-16 z-20 order-first -mx-5 bg-nogal-800/95 px-5 pt-2 pb-3 backdrop-blur-sm sm:-mx-8 sm:px-8 lg:top-24 lg:order-last lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          <div className="mx-auto w-full max-w-[51dvh] rounded-2xl bg-[radial-gradient(circle_at_50%_40%,color-mix(in_srgb,var(--color-beige)_14%,transparent),transparent_70%)] lg:max-w-none">
            <BoardSilhouette
              key={product?.id ?? 'generica'}
              shape={shape}
              scale={scale}
              className="animate-chip-in"
              label={`Vista previa${product ? ` en la tabla ${product.name}${variant ? ` ${variant.name}` : ''}` : ''}: ${clean ? `${clean.line1}${clean.line2 ? `, ${clean.line2}` : ''}` : 'aún sin texto'}`}
            >
              <div className={`absolute flex flex-col gap-[0.35em] ${alignClass[clean?.position ?? values.position]}`} style={textPlacement(clean?.position ?? values.position, writeShape)}>
                {clean ? (
                  <>
                    <EngravedLine text={clean.line1} font={clean.font} size={engravingFontSize(clean.line1, clean.font, 'line1', writeShape.room)} runKey={`1-${runKey}`} animate light={shape.dark} />
                    {clean.line2 && (
                      <EngravedLine text={clean.line2} font={clean.font} size={engravingFontSize(clean.line2, clean.font, 'line2', writeShape.room)} runKey={`2-${runKey}`} animate light={shape.dark} />
                    )}
                  </>
                ) : (
                  <span
                    className={`block whitespace-nowrap ${shape.dark ? 'text-marfil/55' : 'text-carbon/45'} ${fontClass[values.font]} ${inView ? 'burn-run' : ''}`}
                    style={{ fontSize: `${engravingFontSize(engravingContent.placeholder, values.font, 'line1', writeShape.room)}cqw` }}
                  >
                    {engravingContent.placeholder}
                  </span>
                )}
              </div>
            </BoardSilhouette>
          </div>
          {product && variant && (
            <p key={variant.id} className="mt-2 flex animate-chip-in items-center justify-center gap-2 text-sm text-beige">
              <span className="font-semibold text-marfil">{product.name}</span>
              <span aria-hidden="true">·</span>
              {variant.name}
              {variant.dimensionsLabel && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-ambar">{sizeLabel(variant.dimensionsLabel)}</span>
                </>
              )}
            </p>
          )}
          <p className="mt-3 hidden text-xs text-beige/70 lg:block">{engravingContent.boardNote}</p>
        </div>
      </div>
    </div>
  )
}
