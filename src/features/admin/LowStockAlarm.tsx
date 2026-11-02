import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import type { InventoryLevel, ListResponse } from '../../../shared/api/panel-contracts'
import {
  ALARM_POLL_MS,
  levelName,
  lowStockItems,
  nextAnnounced,
  readAnnounced,
  readSoundEnabled,
  spokenMessage,
  toAnnounce,
  writeAnnounced,
  writeSoundEnabled,
} from './low-stock-alarm'
import { useAdminQuery } from './use-admin-api'

const storage = () => {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** Sirena corta de dos tonos (Web Audio: sin archivos de sonido). Devuelve cuando termina. */
function siren(ctx: AudioContext): Promise<void> {
  const start = ctx.currentTime + 0.05
  const beep = 0.22
  const rounds = 3
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(0.35, start + 0.03)
  gain.gain.setValueAtTime(0.35, start + rounds * 2 * beep - 0.05)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + rounds * 2 * beep)
  gain.connect(ctx.destination)
  const osc = ctx.createOscillator()
  osc.type = 'square'
  for (let i = 0; i < rounds * 2; i++) osc.frequency.setValueAtTime(i % 2 === 0 ? 880 : 660, start + i * beep)
  osc.connect(gain)
  osc.start(start)
  osc.stop(start + rounds * 2 * beep)
  return new Promise((resolve) => {
    osc.onended = () => resolve()
  })
}

function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) return
  window.speechSynthesis.cancel()
  const voice = new SpeechSynthesisUtterance(text)
  voice.lang = 'es-PE'
  voice.rate = 0.95
  window.speechSynthesis.speak(voice)
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}

/**
 * Vigilante automático del stock bajo. Consulta el inventario cada 30 segundos en todo el panel; cuando una variante
 * llega a su mínimo, muestra el aviso arriba y suena la alarma diciendo cuál producto es. Cada variante suena una sola
 * vez mientras siga baja (se recuerda aunque se recargue la página); «Repetir alarma» la vuelve a sonar.
 */
export function LowStockAlarm({ inventoryPath }: { inventoryPath: string }) {
  const { state, reload } = useAdminQuery<ListResponse<InventoryLevel>>('/inventory')
  const [soundOn, setSoundOn] = useState(() => readSoundEnabled(storage()))
  // El navegador bloquea el sonido hasta que la persona toca la página: se avisa para activarlo.
  const [blocked, setBlocked] = useState(false)
  // El aviso se oculta solo para las variantes que había al cerrarlo: si baja otra, vuelve a aparecer.
  const [dismissed, setDismissed] = useState<string | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const soundRef = useRef(soundOn)

  useEffect(() => {
    const id = window.setInterval(reload, ALARM_POLL_MS)
    return () => window.clearInterval(id)
  }, [reload])

  const low = state.status === 'ok' ? lowStockItems(state.data.items) : []
  const lowIds = low.map((l) => l.variantId).join(',')

  const ring = useCallback(async (items: InventoryLevel[]) => {
    if (items.length === 0) return
    try {
      const Audio = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Audio) return
      const ctx = (ctxRef.current ??= new Audio())
      await ctx.resume()
      if (ctx.state !== 'running') {
        setBlocked(true)
        return
      }
      setBlocked(false)
      await siren(ctx)
      speak(spokenMessage(items))
    } catch {
      setBlocked(true)
    }
  }, [])

  // Cada vez que cambia el inventario: lo que bajó por primera vez suena y se recuerda.
  useEffect(() => {
    if (state.status !== 'ok') return
    const current = lowStockItems(state.data.items)
    const announced = readAnnounced(storage())
    const fresh = toAnnounce(current, announced)
    writeAnnounced(storage(), nextAnnounced(current))
    // El sonido se decide al detectar; cambiar el interruptor no debe disparar la alarma.
    if (fresh.length > 0 && soundRef.current) void ring(fresh)
  }, [state, ring])

  const toggleSound = () => {
    const next = !soundOn
    setSoundOn(next)
    soundRef.current = next
    writeSoundEnabled(storage(), next)
    if (!next) window.speechSynthesis?.cancel()
  }

  return (
    <>
      <button
        type="button"
        onClick={toggleSound}
        aria-pressed={soundOn}
        aria-label={`Alarma de stock ${soundOn ? 'con sonido' : 'en silencio'}`}
        className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center gap-2 rounded-full border-2 border-nogal/30 px-3 text-base font-semibold text-nogal transition-colors hover:border-nogal hover:bg-nogal/5 sm:px-4"
      >
        <BellIcon />
        <span aria-hidden="true" className="hidden sm:inline">Alarma {soundOn ? 'con sonido' : 'en silencio'}</span>
      </button>

      {low.length > 0 && dismissed !== lowIds && (
        <div role="alert" className="fixed top-3 right-3 left-3 z-50 mx-auto flex max-w-3xl flex-wrap items-center gap-3 rounded-xl border border-alerta/50 bg-marfil px-5 py-4 text-base text-carbon shadow-xl lg:left-[18rem]">
          <span className="text-alerta">
            <BellIcon />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-nogal">Stock bajo: {low.length === 1 ? '1 producto necesita producción' : `${low.length} productos necesitan producción`}</p>
            <p className="text-carbon-600">
              {low
                .slice(0, 4)
                .map((l) => `${levelName(l)} (${l.available} / mín. ${l.minStock ?? '—'})`)
                .join(' · ')}
              {low.length > 4 && ` · y ${low.length - 4} más`}
            </p>
            {blocked && soundOn && <p className="mt-1 text-sm text-alerta">El navegador bloqueó el sonido. Toca «Activar sonido» para que suene la alarma.</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void ring(low)} className="min-h-12 rounded-full bg-nogal px-5 text-base font-bold text-marfil transition-colors hover:bg-nogal-800">
              {blocked ? 'Activar sonido' : 'Repetir alarma'}
            </button>
            <Link to={inventoryPath} className="inline-flex min-h-12 items-center rounded-full border-2 border-nogal/30 px-5 text-base font-bold text-nogal hover:border-nogal">
              Ver
            </Link>
            <button type="button" onClick={() => setDismissed(lowIds)} aria-label="Ocultar aviso" className="inline-flex size-12 items-center justify-center rounded-full text-2xl text-carbon-600 hover:bg-beige">
              ×
            </button>
          </div>
        </div>
      )}
    </>
  )
}
