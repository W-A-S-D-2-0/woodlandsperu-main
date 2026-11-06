import type { CSSProperties, ReactNode } from 'react'
import { motifDescriptions, type EngravingMotif as Motif } from '../../content/engraving'

/** Cuchillo de chef vertical, con la punta arriba: lomo recto a la derecha y filo curvo a la izquierda. */
const knife = (
  <>
    <path d="M 1.8 -20 C -1.8 -15.5 -3.4 -9 -3.4 1 L 1.8 1 Z" />
    <rect x="-3.8" y="2" width="6.2" height="1.8" rx="0.7" />
    <rect x="-2.7" y="4.8" width="4" height="12.4" rx="2" />
  </>
)

/** Cuchilla de carnicero vertical: hoja rectangular con su agujero arriba. */
const cleaver = (
  <>
    <path fillRule="evenodd" d="M -5 -18 H 3.2 Q 4.2 -18 4.2 -17 V 1 H -5 Z M 0.4 -15.6 A 1.5 1.5 0 1 0 0.41 -15.6 Z" />
    <rect x="-2.2" y="2" width="3.8" height="15.2" rx="1.9" />
  </>
)

const fork = (
  <>
    <rect x="-3.4" y="-17" width="1.3" height="8" rx="0.6" />
    <rect x="-0.65" y="-17" width="1.3" height="8" rx="0.6" />
    <rect x="2.1" y="-17" width="1.3" height="8" rx="0.6" />
    <path d="M -3.6 -10 H 3.6 V -8.4 C 3.6 -5.6 1.8 -4.4 1.2 -3.4 L 1 0 H -1 L -1.2 -3.4 C -1.8 -4.4 -3.6 -5.6 -3.6 -8.4 Z" />
    <rect x="-1.6" y="-0.5" width="3.2" height="17.5" rx="1.6" />
  </>
)

/** Espátula de parrilla, con dos ranuras en la pala. */
const spatula = (
  <>
    <path fillRule="evenodd" d="M -5 -17 H 5 V -7.5 H -5 Z M -2.7 -15 H -1.4 V -9.5 H -2.7 Z M 1.4 -15 H 2.7 V -9.5 H 1.4 Z" />
    <rect x="-0.9" y="-8" width="1.8" height="7" />
    <rect x="-1.8" y="-1.5" width="3.6" height="18.5" rx="1.8" />
  </>
)

const chefHat = (
  <>
    <circle cx="-8" cy="-5" r="7" />
    <circle cx="0" cy="-9" r="8.5" />
    <circle cx="8" cy="-5" r="7" />
    <rect x="-9" y="-5" width="18" height="10" />
    <rect x="-9.5" y="7" width="19" height="6" rx="1.4" />
  </>
)

const drawings: Record<Exclude<Motif, 'none'>, { body: ReactNode }> = {
  knives: {
    body: (
      <>
        <g transform="rotate(32 0 -1)">{cleaver}</g>
        <g transform="rotate(-32 0 -1)">{knife}</g>
      </>
    ),
  },
  utensils: {
    body: (
      <>
        <g transform="rotate(-30)">{fork}</g>
        <g transform="rotate(30)">{spatula}</g>
      </>
    ),
  },
  'chef-hat': { body: chefHat },
}

/** El dibujo dicho en palabras, para la descripción de la vista previa ("" si no lleva). */
export const motifLabel = (motif: Motif) => (motif === 'none' ? '' : motifDescriptions[motif])

/**
 * Dibujo pequeño que acompaña al texto grabado. Toma el color del texto (currentColor), así se ve igual de quemado
 * en madera clara u oscura. Propuesta de diseño: el equipo confirma el grabado antes de producir.
 */
export function EngravingMotif({ motif, className = '', style }: { motif: Motif; className?: string; style?: CSSProperties }) {
  if (motif === 'none') return null
  return (
    <svg viewBox="-24 -20 48 40" fill="currentColor" aria-hidden="true" className={`block w-auto ${className}`} style={style}>
      {drawings[motif].body}
    </svg>
  )
}
