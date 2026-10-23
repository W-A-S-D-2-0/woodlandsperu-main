import type { CSSProperties } from 'react'
import { boardShapeFor, type BoardShape } from '../../content/board-shapes'
import type { EngravingFont, EngravingPosition } from '../../content/engraving'
import { landingImages } from '../../content/home'
import { engravingFontSize } from './engraving-logic'
import { positionLabel } from './preview-marker'

export const positionClass: Record<EngravingPosition, string> = {
  'bottom-right': 'right-[8%] bottom-[10%] items-end text-right',
  'bottom-left': 'bottom-[10%] left-[8%] items-start text-left',
  'top-left': 'top-[10%] left-[8%] items-start text-left',
  'top-right': 'top-[10%] right-[8%] items-end text-right',
  center: 'inset-0 items-center justify-center text-center',
}

export const fontClass: Record<EngravingFont, string> = {
  classic: 'font-display font-medium',
  italic: 'font-display font-medium italic',
  modern: 'font-sans font-semibold tracking-[0.12em] uppercase',
}

const alignClass: Record<EngravingPosition, string> = {
  'bottom-right': 'items-end text-right',
  'bottom-left': 'items-start text-left',
  'top-left': 'items-start text-left',
  'top-right': 'items-end text-right',
  center: 'inset-0 items-center justify-center text-center',
}

/** Dónde queda el texto según la silueta: la separación al borde horizontal es `inset`; la vertical crece con lo alargada que es la tabla. */
export function textPlacement(position: EngravingPosition, shape: Pick<BoardShape, 'ratio' | 'inset'>): CSSProperties {
  if (position === 'center') return {}
  const horizontal = shape.inset
  const vertical = Math.min(26, Math.round(shape.inset * Math.max(shape.ratio, 1) * 10) / 10)
  return {
    [position.startsWith('top') ? 'top' : 'bottom']: `${vertical}%`,
    [position.endsWith('left') ? 'left' : 'right']: `${horizontal}%`,
  }
}

function EngravedText({ line1, line2, font, position, shape }: { line1: string; line2: string; font: EngravingFont; position: EngravingPosition; shape: BoardShape }) {
  const text = `block leading-tight whitespace-nowrap text-carbon/90 mix-blend-multiply ${fontClass[font]}`
  return (
    <div className={`absolute flex flex-col gap-[0.35em] ${alignClass[position]}`} style={textPlacement(position, shape)}>
      <span className={text} style={{ fontSize: `${engravingFontSize(line1, font, 'line1', shape.room)}cqw` }}>
        {line1}
      </span>
      {line2 && (
        <span className={text} style={{ fontSize: `${engravingFontSize(line2, font, 'line2', shape.room)}cqw` }}>
          {line2}
        </span>
      )}
    </div>
  )
}

const wood = (): CSSProperties => {
  const image = landingImages.engraveBoard
  return image ? { backgroundImage: `url(${image.src})`, backgroundSize: 'cover' } : {}
}

/**
 * La tabla con el texto ya grabado en una posición, con la silueta del modelo (redonda, con mango, alargada…).
 * Imagen fija: la usan el chat y la página que se comparte con ventas. Sin modelo conocido se dibuja la tabla genérica.
 */
export function EngravingBoard({ line1, line2 = '', font, position, model, className = '' }: { line1: string; line2?: string; font: EngravingFont; position: EngravingPosition; model?: string; className?: string }) {
  const shape = boardShapeFor(model)
  const label = `Vista previa${model ? ` en la tabla ${model}` : ''}: ${line1}${line2 ? `, ${line2}` : ''} en ${positionLabel(position).toLowerCase()}`
  // La silueta se acomoda dentro de un marco 3:2: las alargadas llenan el ancho, las altas llenan el alto.
  const width = shape.ratio >= 1.5 ? '100%' : `${(shape.ratio / 1.5) * 100}%`
  const frame = 'flex aspect-[3/2] w-full items-center justify-center'

  if (shape.kind === 'paddle') {
    return (
      <div role="img" aria-label={label} className={`${frame} ${className}`}>
        <div className="relative" style={{ width, aspectRatio: shape.ratio }}>
          <div className="board absolute top-0 left-0 h-full w-[62%] rounded-[28%] shadow-md" style={wood()}>
            <EngravedText line1={line1} line2={line2} font={font} position={position} shape={{ ...shape, ratio: 1 }} />
          </div>
          <div className="board absolute top-[36%] right-0 h-[28%] w-[46%] rounded-r-full shadow-md" style={wood()}>
            <span aria-hidden="true" className="absolute top-1/2 right-[9%] size-[24%] -translate-y-1/2 rounded-full bg-carbon/45 shadow-inner" />
          </div>
        </div>
      </div>
    )
  }

  const radius = shape.kind === 'round' ? '9999px' : shape.kind === 'rounded-sides' ? '22% / 42%' : '0.6rem'
  return (
    <div role="img" aria-label={label} className={`${frame} ${className}`}>
      <div className="board relative overflow-hidden shadow-md" style={{ width, aspectRatio: shape.ratio, borderRadius: radius, ...wood() }}>
        {shape.groove && <span aria-hidden="true" className="absolute inset-[6%] rounded-[0.5rem] border border-carbon/25 shadow-[inset_0_2px_6px_rgb(0_0_0/0.25)]" />}
        <EngravedText line1={line1} line2={line2} font={font} position={position} shape={shape} />
      </div>
    </div>
  )
}
