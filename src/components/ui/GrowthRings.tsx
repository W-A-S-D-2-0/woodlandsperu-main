/** Anillos de crecimiento de la madera: motivo decorativo de la marca. Hereda el color con `currentColor`. */
export function GrowthRings({ className = '', count = 11 }: { className?: string; count?: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 400 400" className={className} fill="none" stroke="currentColor">
      {Array.from({ length: count }, (_, i) => (
        <ellipse
          key={i}
          className="ring-breathe"
          style={{ '--i': i } as React.CSSProperties}
          cx="200"
          cy="200"
          rx={14 + i * 17.5}
          ry={12 + i * 16}
          strokeWidth="1"
          strokeOpacity={0.7 - i * 0.04}
          transform={`rotate(${i * 7} 200 200)`}
        />
      ))}
    </svg>
  )
}
