import type { Chip } from './chat-logic'

/** Respuestas rápidas: se acomodan en varias filas para verse completas y se levantan al pasar por encima. */
export function ChatChips({ options, onPick }: { options: Chip[]; onPick: (value: string) => void }) {
  return (
    <div
      role="group"
      aria-label="Respuestas rápidas"
      className="flex flex-wrap gap-2 bg-marfil px-4 pt-2.5 pb-3"
    >
      {options.map((option, i) => {
        const { label, value, primary } = typeof option === 'string' ? { label: option, value: option, primary: false } : { primary: false, ...option }
        return (
          <button
            key={`${label}-${i}`}
            type="button"
            style={{ animationDelay: `${i * 70}ms` }}
            className={`min-h-9 animate-chip-in rounded-full border px-3.5 text-xs font-medium transition-all ${primary ? 'border-nogal bg-nogal text-marfil shadow-sm' : 'border-madera/60 bg-white text-nogal'} duration-200 select-none hover:-translate-y-1 hover:border-nogal hover:bg-nogal hover:text-marfil hover:shadow-md active:translate-y-0`}
            onClick={() => onPick(value)}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
