import type { Chip } from './chat-logic'
import { useDragScroll } from './useDragScroll'

/** Respuestas rápidas en una sola fila: se arrastran con el mouse (o el dedo) y se levantan al pasar por encima. */
export function ChatChips({ options, onPick }: { options: Chip[]; onPick: (value: string) => void }) {
  const { ref, handlers } = useDragScroll<HTMLDivElement>()
  return (
    <div
      ref={ref}
      role="group"
      aria-label="Respuestas rápidas"
      {...handlers}
      className="flex cursor-grab gap-2 overflow-x-auto bg-marfil px-4 pt-2.5 pb-3 [scrollbar-width:none] active:cursor-grabbing [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,transparent,#000_1rem,#000_calc(100%-1.5rem),transparent)]"
    >
      {options.map((option, i) => {
        const { label, value } = typeof option === 'string' ? { label: option, value: option } : option
        return (
          <button
            key={`${label}-${i}`}
            type="button"
            style={{ animationDelay: `${i * 70}ms` }}
            className="min-h-9 shrink-0 animate-chip-in rounded-full border border-madera/60 bg-white px-3.5 text-xs font-medium whitespace-nowrap text-nogal transition-all duration-200 select-none hover:-translate-y-1 hover:border-nogal hover:bg-nogal hover:text-marfil hover:shadow-md active:translate-y-0"
            onClick={() => onPick(value)}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
