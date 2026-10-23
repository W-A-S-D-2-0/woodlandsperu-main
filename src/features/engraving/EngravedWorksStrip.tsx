import { engravedWorks } from '../../content/engraved-works'

/**
 * Franja de trabajos grabados: fotos reales que recorren la pantalla despacio (se detiene al pasar el
 * cursor y, con "reducir movimiento", queda como una cuadrícula). La segunda copia es decorativa.
 */
export function EngravedWorksStrip() {
  return (
    <div className="mt-20 sm:mt-28">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <p className="text-xs font-semibold tracking-[0.22em] text-ambar uppercase">Trabajos grabados</p>
        <h2 className="mt-4 max-w-xl text-3xl leading-tight text-marfil sm:text-4xl">Así queda el grabado sobre la teca.</h2>
      </div>
      <div className="marquee-host mt-10 overflow-hidden" aria-label="Galería de trabajos grabados">
        <div className="marquee" style={{ animationDuration: '90s' }}>
          {[0, 1].map((copy) => (
            <ul key={copy} aria-hidden={copy === 1 ? 'true' : undefined} className="flex shrink-0 gap-4 pr-4">
              {engravedWorks.map((work) => (
                <li key={work.src} className="group relative w-56 shrink-0 overflow-hidden rounded-2xl bg-nogal sm:w-64">
                  <img
                    src={work.src}
                    alt={copy === 0 ? work.alt : ''}
                    width={960}
                    height={1280}
                    loading="lazy"
                    decoding="async"
                    className="aspect-[3/4] w-full object-cover transition-transform duration-[1.2s] ease-suave group-hover:scale-[1.06]"
                  />
                  <p className="absolute inset-x-0 bottom-0 bg-linear-to-t from-nogal-800/90 to-transparent px-4 pt-10 pb-3 text-sm font-semibold text-marfil">{work.label}</p>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </div>
  )
}
