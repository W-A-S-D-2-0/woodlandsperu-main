import { useState } from 'react'
import { LogoChapter } from '../corporate/LogoChapter'
import { EngravedWorksStrip } from './EngravedWorksStrip'
import { EngravingChapter } from './EngravingChapter'

type Mode = 'personal' | 'company'

const tabs: readonly { id: Mode; label: string }[] = [
  { id: 'personal', label: 'Para ti' },
  { id: 'company', label: 'Para tu empresa' },
]

/**
 * Capítulo 4 · Personaliza tu tabla. Una sola escena con dos pestañas: grabar un nombre o una frase
 * (personas) o subir un logo (empresas). Ambos paneles quedan montados para no perder lo escrito
 * al cambiar de pestaña; solo se oculta el que no está activo.
 */
export function PersonalizeChapter() {
  const [mode, setMode] = useState<Mode>('personal')

  return (
    <section className="surface-warm grain relative py-20 text-beige sm:py-28" aria-label="Personaliza tu tabla">
      <div className="mx-auto flex w-full max-w-6xl justify-center px-5 sm:px-8">
        <div role="tablist" aria-label="Tipo de personalización" className="inline-flex rounded-full border border-beige/20 bg-nogal-800/70 p-1 backdrop-blur-sm">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`personalize-tab-${tab.id}`}
              aria-selected={mode === tab.id}
              aria-controls={`personalize-panel-${tab.id}`}
              onClick={() => setMode(tab.id)}
              className={`min-h-11 rounded-full px-6 text-sm font-semibold transition-[background-color,color,box-shadow] duration-300 ease-suave ${
                mode === tab.id ? 'bg-brasa text-nogal-800 shadow-[0_8px_24px_-10px_rgb(224_138_60/0.8)]' : 'text-beige hover:text-ambar'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`personalize-panel-${tab.id}`}
          aria-labelledby={`personalize-tab-${tab.id}`}
          hidden={mode !== tab.id}
          className="mt-12 animate-rise sm:mt-16"
        >
          {tab.id === 'personal' ? <EngravingChapter /> : <LogoChapter />}
        </div>
      ))}

      <EngravedWorksStrip />
    </section>
  )
}
