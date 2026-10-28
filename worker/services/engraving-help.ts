import type { CatalogResponse } from '../../shared/api/contracts'
import { defaultEngravingPosition, engravingFonts, engravingLimits, engravingPositions, type EngravingFont, type EngravingPosition } from '../../src/content/engraving'
import { brigitte } from '../../src/content/site'
import { buildPreviewMarker, buildWhatsappMarker, parseMarkerLine, positionLabel, previewQuery } from '../../src/features/engraving/preview-marker'
import type { HistoryMessage } from './assistant'
import { looksLikeName, parseCustomerData } from './customer-data'

/**
 * Dudas de personalización (nombre en otra posición, «no me gusta», «cómo se vería»): Teca muestra la tabla con el
 * texto grabado en distintas posiciones y, si ninguna convence, ofrece el WhatsApp de Brigitte con un mensaje ya
 * escrito. Todo por reglas, sin IA: es instantáneo y nunca inventa. Las imágenes las dibuja el chat a partir de las
 * marcas [[vista|…]] (ver preview-marker.ts).
 */

/** Pregunta fija: sirve para reconocer, en el historial, que el siguiente mensaje del cliente es el texto a grabar. */
export const ASK_TEXT = '¿Qué nombre o frase quieres grabar?'

/** Posiciones que se recomiendan, de la más habitual a la menos (casi todos los pedidos van en una esquina). */
const RECOMMENDED: readonly EngravingPosition[] = ['bottom-right', 'bottom-left', 'top-right', 'top-left', 'center']

const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/** Posición que el cliente pide con sus palabras («arriba a la derecha», «en el centro»), o null. */
export function requestedPosition(text: string): EngravingPosition | null {
  // «La veo muy abajo» es una queja, no un pedido de ponerla abajo.
  const n = normalize(text).replace(TOO_FAR, ' ')
  if (/\b(centro|medio)\b/.test(n)) return 'center'
  const top = /arriba|superior/.test(n)
  const bottom = /abajo|inferior/.test(n)
  const left = /izquierd/.test(n)
  if (top && left) return 'top-left'
  if (top) return 'top-right'
  if (bottom && left) return 'bottom-left'
  if (bottom) return 'bottom-right'
  return null
}

/** «muy abajo», «demasiado arriba»: el cliente se queja de dónde quedó. */
const TOO_FAR = /\b(muy|demasiado|tan) (abajo|arriba|inferior|superior)\b/g
const TOO_LOW = /\b(muy|demasiado|tan) (abajo|inferior)\b/
const TOO_HIGH = /\b(muy|demasiado|tan) (arriba|superior)\b/
const STRONG = /nombre|apellido|grab|texto|frase|personaliz|inicial|estampa/
const PREVIEW_ASK = /como (se ve|se veria|quedar|luce|va a quedar)|vista previa|muestr|ensen|imagen|foto|ver (mi|como|la)/
const POSITION_ASK = /posici|ubicacion|esquina|donde (va|ponen|quedar|lo ponen|se pone)|otra (posicion|ubicacion|opcion)|otras (posiciones|ubicaciones|opciones)/
const DOUBT = /no me (gusta|convence|agrada)|sigo sin|no estoy (segur|convenc)|ninguna (me|de las|opcion|posicion|sirve|queda)|prefiero otra|\b(muy|demasiado|tan) (abajo|arriba)\b/
const WANTS_BRIGITTE = /brigitte|asesor|whatsapp|hablar con (alguien|una persona|ventas)/
const CHOSE = /^prefiero la posicion/

const lastOf = <T>(items: readonly T[], test: (item: T) => boolean): T | undefined => items.findLast(test)

interface Known {
  line1: string
  line2: string
  position: EngravingPosition | null
  font: EngravingFont
}

const stripQuotes = (text: string) => text.replace(/^["«“'\s]+|["»”'\s]+$/g, '').trim()

function fromSummary(body: string): Known | null {
  const match = body.match(/Grabado:\s*(.+?)(?:\s·\s*Posici|$)/)
  if (!match) return null
  const lines = [...match[1]!.matchAll(/["«“]([^"»”]+)["»”]/g)].map((m) => m[1]!.trim())
  if (!lines[0]) return null
  const positionName = body.match(/Posici[oó]n:\s*(.+?)(?:\s·|$)/)?.[1]?.trim()
  const fontName = body.match(/Letra:\s*(\S+)/)?.[1]?.trim()
  return {
    line1: lines[0].slice(0, engravingLimits.line1),
    line2: (lines[1] ?? '').slice(0, engravingLimits.line2),
    position: engravingPositions.find((p) => p.label === positionName)?.value ?? null,
    font: engravingFonts.find((f) => f.label === fontName)?.value ?? 'classic',
  }
}

const ENGRAVE_QUESTION = '¿Quieres grabado'

/** El texto a grabar, de lo que el cliente ya dijo en la conversación (o en este mensaje); null si aún no lo dijo. */
function knownEngraving(history: readonly HistoryMessage[], current: string): Known | null {
  const quoted = current.match(/["“«]([^"”»]{1,24})["”»]/)?.[1]?.trim()
  const fromHistory = (() => {
    for (let i = history.length - 1; i >= 0; i--) {
      const m = history[i]!
      if (m.role !== 'customer') continue
      const summary = fromSummary(m.body)
      if (summary) return summary
      // «Quiero personalizar la Ya Vuelta con el nombre «Marta»»: el texto ya viene dicho entre comillas.
      const said = m.body.match(/["“«]([^"”»]{1,24})["”»]/)?.[1]?.trim()
      if (said && STRONG.test(normalize(m.body))) return { line1: said, line2: '', position: null, font: 'classic' as EngravingFont }
      const asked = history[i - 1]
      if (asked?.role === 'assistant' && (asked.body.includes(ENGRAVE_QUESTION) || asked.body.includes(ASK_TEXT))) {
        const answer = stripQuotes(m.body)
        const n = normalize(answer)
        if (answer.length > 0 && answer.length <= engravingLimits.line1 && !/^(no|ninguno|sin grabado)$/.test(n) && !POSITION_ASK.test(n) && !DOUBT.test(n)) {
          return { line1: answer, line2: '', position: null, font: 'classic' as EngravingFont }
        }
      }
    }
    return null
  })()
  if (quoted) return { ...(fromHistory ?? { line2: '', position: null, font: 'classic' as EngravingFont }), line1: quoted }
  return fromHistory
}

/** Posiciones que Teca ya mostró en esta conversación, de la más antigua a la más reciente (cada vista es una lista). */
function shownBefore(history: readonly HistoryMessage[]): EngravingPosition[][] {
  const rounds: EngravingPosition[][] = []
  for (const m of history) {
    if (m.role !== 'assistant') continue
    for (const line of m.body.split('\n')) {
      const marker = parseMarkerLine(line)
      if (marker?.kind === 'preview') rounds.push(marker.positions)
    }
  }
  return rounds
}

function recommend(exclude: readonly EngravingPosition[], count: number, avoid: ReadonlySet<EngravingPosition>, prefer: readonly EngravingPosition[] = []): EngravingPosition[] {
  const pool = RECOMMENDED.filter((p) => !exclude.includes(p))
  const ordered = [...pool.filter((p) => prefer.includes(p)).sort((a, b) => prefer.indexOf(a) - prefer.indexOf(b)), ...pool.filter((p) => !prefer.includes(p))]
  return [...ordered.filter((p) => !avoid.has(p)), ...ordered.filter((p) => avoid.has(p))].slice(0, count)
}

/** Nombre que dio el cliente al comenzar su pedido, si lo hizo. */
export function customerName(history: readonly HistoryMessage[]): string | undefined {
  for (let i = 1; i < history.length; i++) {
    if (history[i - 1]!.role !== 'assistant' || history[i]!.role !== 'customer') continue
    const asked = history[i - 1]!.body
    const answer = history[i]!.body
    if (asked.includes('¿A nombre de quién')) return looksLikeName(answer) ?? undefined
    // Si el nombre se pidió junto con los demás datos, es el primer dato del mensaje.
    if (asked.includes('• Tu nombre completo')) return parseCustomerData(answer).name
  }
  return undefined
}

/** El modelo del catálogo que se nombró en la conversación (el más reciente), si hay uno. */
function modelFrom(history: readonly HistoryMessage[], catalog: CatalogResponse): string | undefined {
  for (let i = history.length - 1; i >= 0; i--) {
    const body = normalize(history[i]!.body)
    const found = catalog.products.find((p) => new RegExp(`(^|[^a-z0-9])${normalize(p.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`).test(body))
    if (found) return found.name
  }
  return undefined
}

/** «el centro», «la esquina inferior derecha»: para decirlo en una frase. */
const phrase = (position: EngravingPosition) => (position === 'center' ? 'el centro' : `la ${positionLabel(position).toLowerCase()}`)

function whatsappMessage(p: { name?: string; model?: string; text: string; current: EngravingPosition; suggested: readonly EngravingPosition[] }): string {
  const lower = phrase
  const hello = p.name ? `Hola ${brigitte.name}, soy ${p.name}.` : `Hola ${brigitte.name}.`
  const made = `Hice una personalización de mi tabla${p.model ? ` ${p.model}` : ''} con «${p.text}» en ${lower(p.current)}.`
  const tip = p.suggested.length > 0 ? ` Teca me recomendó ${p.suggested.slice(0, 2).map(lower).join(' o ')}.` : ''
  return `${hello} ${made}${tip} ¿Me apoyas para saber si se puede hacer o qué me recomiendas?`
}

/** ¿Este mensaje es una duda de personalización que Teca debe atender con imágenes? */
function wantsHelp(history: readonly HistoryMessage[], text: string): boolean {
  const lastAssistant = lastOf(history, (m) => m.role === 'assistant')
  if (lastAssistant?.body.includes(ASK_TEXT)) return true
  const n = normalize(text)
  const known = knownEngraving(history, text) !== null || shownBefore(history).length > 0
  if (CHOSE.test(n)) return known
  const context = STRONG.test(n) || known || !!lastAssistant?.body.includes(ENGRAVE_QUESTION)
  if (WANTS_BRIGITTE.test(n)) return context
  const inEngraveStep = !!lastAssistant?.body.includes(ENGRAVE_QUESTION)
  if (DOUBT.test(n)) return known || inEngraveStep
  // «Quiero personalizar la Ya Vuelta con el nombre «Marta»»: nombre entre comillas y ganas de personalizar.
  if (/["“«][^"”»]{1,24}["”»]/.test(text) && /personaliz|grab|nombre|estamp|pon(er|gan)/.test(n)) return true
  return context && (requestedPosition(n) !== null || PREVIEW_ASK.test(n) || POSITION_ASK.test(n))
}

/**
 * Respuesta de Teca a una duda de personalización, o null si el mensaje es otra cosa. `text` es el mensaje del
 * cliente (por defecto, el último del historial). Devuelve texto con marcas [[vista|…]] y [[whatsapp|…]].
 */
export function engravingHelpReply(history: readonly HistoryMessage[], catalog: CatalogResponse, text?: string): string | null {
  const current = text ?? lastOf(history, (m) => m.role === 'customer')?.body ?? ''
  if (!wantsHelp(history, current)) return null
  const n = normalize(current)

  const known = knownEngraving(history, current)
  if (!known) return `Con gusto te muestro cómo quedaría en la tabla. ${ASK_TEXT} Escríbelo (hasta ${engravingLimits.line1} caracteres) y te lo muestro en varias posiciones.`

  const rounds = shownBefore(history)
  const shown = new Set(rounds.flat())
  const asked = requestedPosition(n)
  const remembered = lastOf([...history], (m) => m.role === 'customer' && requestedPosition(m.body) !== null && m.body !== current)
  const position = asked ?? (remembered ? requestedPosition(remembered.body) : null) ?? rounds.at(-1)?.[0] ?? known.position ?? defaultEngravingPosition
  const text1 = known.line1
  const model = modelFrom(history, catalog)
  const name = customerName(history)
  const common = { line1: text1, line2: known.line2, font: known.font, model }
  const whatsapp = (suggested: readonly EngravingPosition[], from: EngravingPosition = position) =>
    buildWhatsappMarker(whatsappMessage({ name, model, text: text1, current: from, suggested }), previewQuery({ ...common, positions: [from, ...suggested].slice(0, 5) }))

  // Eligió una de las posiciones: se confirma y se dice cómo dejarlo anotado en el pedido.
  if (CHOSE.test(n)) {
    return `Perfecto, dejamos «${text1}» en ${phrase(asked ?? position)}. Cuando hagas tu pedido, en la pregunta del grabado escribe: ${text1} · ${positionLabel(asked ?? position).toLowerCase()}. Para empezar, escribe «quiero hacer un pedido».`
  }

  // Ya vio recomendaciones y sigue sin convencerse (o pide hablar con alguien): pasa a Brigitte.
  // Una queja de ubicación («muy abajo») da una pista concreta: se prueba otra ronda antes de pasar a una persona.
  const locationHint = (TOO_LOW.test(n) || TOO_HIGH.test(n)) && rounds.length < 2
  if (WANTS_BRIGITTE.test(n) || (DOUBT.test(n) && rounds.length > 0 && asked === null && !locationHint)) {
    // El mensaje parte de lo que el cliente pidió al principio y lista lo que Teca le mostró.
    const original = rounds[0]?.[0] ?? position
    const lastShown = [...new Set(rounds.flat())].filter((p) => p !== original)
    return `Entiendo, a veces conviene verlo con una persona. ${brigitte.name}, de nuestro equipo de ventas, te ayuda a definir tu diseño por WhatsApp. Te dejo el botón con tu mensaje ya escrito: solo tócalo y envíalo.\n${whatsapp(lastShown, original)}`
  }

  let lead: string
  let positions: EngravingPosition[]
  if (asked !== null) {
    positions = [asked, ...recommend([asked], 2, shown)]
    lead = `Así se vería «${text1}» en ${phrase(asked)}. Si quieres comparar, mira también estas otras posiciones:`
  } else if (DOUBT.test(n)) {
    // Si dice que quedó muy abajo (o muy arriba), se le muestra primero lo contrario.
    const prefer: EngravingPosition[] = TOO_LOW.test(n) ? ['top-right', 'top-left', 'center'] : TOO_HIGH.test(n) ? ['bottom-right', 'bottom-left', 'center'] : []
    positions = recommend([position], 3, prefer.length > 0 ? new Set() : shown, prefer)
    lead = `Entiendo. Estas son otras posiciones donde queda muy bien «${text1}»:`
  } else {
    positions = [position, ...recommend([position], 2, shown)]
    lead = `Así quedaría «${text1}» en ${phrase(position)}. Mira también estas otras posiciones:`
  }
  const suggested = positions.filter((p) => p !== position)
  const close = `Toca «Quiero esta posición» en la que más te guste. Si ninguna te convence, escríbele a ${brigitte.name} (ventas): te ayuda a definirlo.`
  return `${lead}\n${buildPreviewMarker({ ...common, positions })}\n${close}\n${whatsapp(suggested)}`
}

/** El texto del cliente en el paso del grabado parece una duda o una orden de posición, no el texto a grabar. */
export const looksLikeEngravingDoubt = (text: string): boolean => {
  const n = normalize(text)
  return DOUBT.test(n) || PREVIEW_ASK.test(n) || /otra (posicion|ubicacion)|otras (posiciones|ubicaciones)|\b(mejor|quiero|prefiero|ponlo|ponme|pongan|cambia\w*)\b.*\b(centro|medio|arriba|abajo|esquina|derecha|izquierda)\b/.test(n)
}
