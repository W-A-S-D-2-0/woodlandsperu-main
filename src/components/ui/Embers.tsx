import type { CSSProperties } from 'react'

/** Brasas: posición horizontal (x), tamaño (s), duración (d), retraso y deriva lateral. */
const EMBERS = [
  { x: '8%', s: '6px', d: '11s', delay: '0s', drift: '30px' },
  { x: '22%', s: '4px', d: '8s', delay: '2s', drift: '-24px' },
  { x: '38%', s: '7px', d: '13s', delay: '5s', drift: '18px' },
  { x: '55%', s: '5px', d: '10s', delay: '1s', drift: '-30px' },
  { x: '68%', s: '4px', d: '9s', delay: '4s', drift: '26px' },
  { x: '80%', s: '6px', d: '12s', delay: '3s', drift: '-18px' },
  { x: '92%', s: '5px', d: '9.5s', delay: '6s', drift: '-22px' },
] as const

/**
 * Puntos de luz naranja que suben despacio sobre un fondo oscuro. Decorativo: no recibe clics y se
 * oculta con "reducir movimiento". El contenedor padre debe ser `relative`.
 */
export function Embers({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {EMBERS.map((ember) => (
        <span
          key={ember.x}
          className="ember"
          style={{ '--x': ember.x, '--s': ember.s, '--d': ember.d, '--delay': ember.delay, '--drift': ember.drift } as CSSProperties}
        />
      ))}
    </div>
  )
}
