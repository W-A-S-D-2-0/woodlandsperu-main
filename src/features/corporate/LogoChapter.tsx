import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { homeContent, landingImages } from '../../content/home'
import { usePointerDepth } from '../../hooks/useScrollProgress'
import { openChat } from '../chat/open-chat'
import { defaultCorporate, validateLogoFile, type CorporateValues } from './logo-logic'

const inputClass =
  'min-h-11 w-full rounded-lg border border-beige/25 bg-nogal/70 px-3 text-base text-marfil placeholder:text-beige/50 focus-visible:border-marfil'

function Labeled({ label, hint, children }: { label: string; hint?: string; children: (id: string) => React.ReactNode }) {
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

/**
 * Panel "Para tu empresa" del capítulo 4; lo envuelve PersonalizeChapter. La persona sube su logo y lo ve grabado sobre la tabla; la tabla
 * se inclina y brilla siguiendo el puntero (solo con ratón y sin "reducir movimiento"). El archivo
 * NO se envía todavía (requiere almacenamiento aprobado): solo viaja su nombre y lo que se escribió.
 */
export function LogoChapter() {
  const sectionRef = useRef<HTMLDivElement>(null)
  usePointerDepth(sectionRef)
  const [values, setValues] = useState<CorporateValues>(defaultCorporate)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [scale, setScale] = useState(45)
  const [error, setError] = useState<string | null>(null)
  const boardImage = landingImages.engraveBoard
  const { audiences } = homeContent
  const [, restaurants, companies] = audiences.items

  // Libera la URL temporal del logo al cambiarlo o al salir.
  useEffect(() => () => {
    if (logoUrl) URL.revokeObjectURL(logoUrl)
  }, [logoUrl])

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const problem = validateLogoFile(file)
    setError(problem)
    if (problem) return
    setLogoUrl(URL.createObjectURL(file))
    setValues((v) => ({ ...v, logoName: file.name }))
  }

  function order() {
    const quantity = Number.isFinite(values.quantity) && values.quantity >= 1 ? Math.trunc(values.quantity) : 10
    const details = [values.logoName ? `archivo del logo: ${values.logoName}` : null, values.size.trim() && `medida: ${values.size.trim()}`, values.when.trim() && `para: ${values.when.trim()}`].filter(Boolean)
    openChat(`Quiero hacer un pedido de ${quantity} tablas con el logo de mi empresa${details.length ? ` (${details.join('; ')})` : ''}`)
  }

  return (
    <div ref={sectionRef} className="chapter text-beige">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        {/* La tabla con el logo grabado: se inclina y brilla con el puntero. */}
        <div className="sticky top-16 z-20 -mx-5 bg-nogal-800/95 px-5 pt-2 pb-3 backdrop-blur-sm sm:-mx-8 sm:px-8 lg:static lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none [perspective:1100px]">
          <div
            role="img"
            aria-label={logoUrl ? `Vista previa de la tabla con tu logo (${values.logoName})` : 'Vista previa de la tabla, aún sin logo'}
            className="board tilt relative mx-auto aspect-[3/2] max-h-[34dvh] w-full overflow-hidden rounded-2xl lg:max-h-none"
            style={boardImage ? { backgroundImage: `url(${boardImage.src})`, backgroundSize: 'cover' } : undefined}
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt=""
                className="absolute top-1/2 left-1/2 max-h-[70%] -translate-x-1/2 -translate-y-1/2 object-contain opacity-75 mix-blend-multiply [filter:grayscale(1)_contrast(1.8)]"
                style={{ width: `${scale}%` }}
              />
            ) : (
              <p className="absolute inset-0 grid place-items-center px-6 text-center font-display text-[clamp(1rem,5cqw,1.75rem)] text-carbon/45">
                Sube tu logo y míralo grabado
              </p>
            )}
            <span aria-hidden="true" className="sheen pointer-events-none absolute inset-0" />
          </div>
          <p className="mt-3 hidden text-xs text-beige/70 lg:block">
            Vista de referencia. El grabado final lo confirma nuestro equipo con tu archivo original, que te pediremos al confirmar tu pedido.
          </p>
        </div>

        <div className="grid gap-6">
          <div>
            <p className="text-xs font-semibold tracking-[0.22em] text-beige/80 uppercase">Para empresas</p>
            <h2 id="logo-title" className="mt-4 text-4xl leading-tight text-marfil sm:text-5xl">
              Tablas con el logo de tu empresa.
            </h2>
            <ul className="mt-5 grid gap-3 text-beige/85">
              {[restaurants, companies].map((item) => (
                <li key={item?.title}>
                  <strong className="font-semibold text-marfil">{item?.title}.</strong> {item?.body}
                </li>
              ))}
            </ul>
          </div>

          <Labeled label="Tu logo" hint="PNG, JPG, SVG o WebP, hasta 5 MB. Se ve solo en tu pantalla.">
            {(id) => (
              <input
                id={id}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={onFile}
                className={`${inputClass} py-2 file:mr-4 file:min-h-8 file:rounded-full file:border-0 file:bg-marfil file:px-4 file:text-sm file:font-semibold file:text-nogal`}
              />
            )}
          </Labeled>
          {error && (
            <p role="alert" className="text-sm font-medium text-marfil">
              {error}
            </p>
          )}
          {logoUrl && (
            <Labeled label="Tamaño del logo en la vista previa">
              {(id) => <input id={id} type="range" min={20} max={70} value={scale} onChange={(e) => setScale(Number(e.target.value))} className="min-h-11 w-full accent-marfil" />}
            </Labeled>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Labeled label="Unidades">
              {(id) => (
                <input
                  id={id}
                  type="number"
                  min={1}
                  
                  inputMode="numeric"
                  className={inputClass}
                  value={values.quantity}
                  onChange={(e) => setValues((v) => ({ ...v, quantity: e.target.valueAsNumber }))}
                />
              )}
            </Labeled>
            <Labeled label="Medida aproximada (opcional)">
              {(id) => <input id={id} className={inputClass} maxLength={120} value={values.size} onChange={(e) => setValues((v) => ({ ...v, size: e.target.value }))} />}
            </Labeled>
          </div>
          <Labeled label="¿Para cuándo lo necesitas? (opcional)" hint="El plazo real te lo confirma el equipo.">
            {(id) => <input id={id} className={inputClass} maxLength={120} value={values.when} onChange={(e) => setValues((v) => ({ ...v, when: e.target.value }))} />}
          </Labeled>

          <div>
            <button
              type="button"
              onClick={order}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-marfil px-7 text-sm font-semibold text-nogal transition-colors hover:bg-beige"
            >
              Hacer el pedido por el chat
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
