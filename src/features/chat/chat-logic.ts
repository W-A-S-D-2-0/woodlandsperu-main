import type { ChatMessage } from '../../../shared/api/chat'
import { endsOperation, isGreetingWord } from '../../content/chat-greeting'
import { modelPhotos, type ModelPhoto } from '../../content/model-photos'
import { parseMarkerLine, type PreviewMarker, type WhatsappMarker } from '../engraving/preview-marker'

/** Lógica del widget de chat. Sin React: se prueba sola. */

const STORAGE_KEY = 'woodland-chat-token'

/** Token aleatorio de la sesión de chat (32 caracteres URL-safe). */
export function createChatToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Recupera el token guardado o crea uno. Si el navegador bloquea el almacenamiento, vale solo para esta visita. */
export function loadChatToken(storage: Pick<Storage, 'getItem' | 'setItem'> | null): string {
  try {
    const saved = storage?.getItem(STORAGE_KEY)
    if (saved && /^[A-Za-z0-9_-]{24,100}$/.test(saved)) return saved
  } catch {
    // Almacenamiento bloqueado: se sigue con un token nuevo.
  }
  const token = createChatToken()
  try {
    storage?.setItem(STORAGE_KEY, token)
  } catch {
    // Sin persistencia: la conversación no se recupera al recargar.
  }
  return token
}

/** Une mensajes nuevos a los existentes sin duplicar ids y en orden. */
export function mergeMessages(current: readonly ChatMessage[], incoming: readonly ChatMessage[]): ChatMessage[] {
  const byId = new Map(current.map((m) => [m.id, m]))
  for (const message of incoming) byId.set(message.id, message)
  return [...byId.values()].sort((a, b) => a.id - b.id)
}

/** Último id guardado en el servidor. Los mensajes que no se guardan (agresión) llevan un id con decimales y no cuentan. */
export function lastMessageId(messages: readonly ChatMessage[]): number {
  return messages.reduce((max, m) => (Number.isInteger(m.id) ? Math.max(max, m.id) : max), 0)
}

/**
 * El mensaje agresivo del cliente y la respuesta de Teca, que el servidor no guarda. Se muestran al final de lo guardado con ids
 * decimales (después del último guardado y antes del siguiente real); cada par suma un paso para mantener el orden.
 */
export function transientMessages(messages: readonly ChatMessage[], customerText: string, reply: string): ChatMessage[] {
  const base = lastMessageId(messages)
  const shown = messages.filter((m) => !Number.isInteger(m.id)).length
  const createdAt = new Date().toISOString()
  return [
    { id: base + (shown + 1) / 1000, role: 'customer', body: customerText, createdAt },
    { id: base + (shown + 2) / 1000, role: 'assistant', body: reply, createdAt },
  ]
}

/** Mensajes agresivos seguidos al final de la conversación (los que no se guardaron): el servidor decide con esto si pide repetir o corta. */
export function trailingWarnings(messages: readonly ChatMessage[]): number {
  let count = 0
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!
    if (Number.isInteger(m.id)) {
      if (m.role === 'customer') break
      continue
    }
    if (m.role === 'customer') count++
  }
  return count
}

/** Texto bajo el chat según el estado de la conversación. */
export function statusNotice(status: string): string | null {
  // El asistente atiende siempre; si algo requiere a la empresa, solo queda anotado para el equipo.
  if (status === 'needs_human' || status === 'with_human') return 'Dejamos tu consulta anotada para el equipo de Woodland. Mientras tanto, el asistente sigue aquí para ayudarte.'
  return null
}

/** Bloques en que se divide el texto de una respuesta para mostrarla con formato. */
export type BodyBlock =
  | { kind: 'text'; text: string }
  | { kind: 'price'; name: string; price: string }
  | { kind: 'product'; name: string; collection: string | null; sizes: string; description: string | null }
  | { kind: 'line'; label: string; amount: string | null }
  | { kind: 'total'; amount: string; note: string; label?: string }
  | PreviewMarker
  | WhatsappMarker

const PRICE_ROW = /^•\s*(.+?):\s*desde\s+(S\/\s?[\d.,]+)\s*$/
/** Línea de un pedido: «• 2 × Moshaco · Large — S/ 867.80», con «(grabado: …)» al final si lo lleva, o «precio por confirmar». */
const ORDER_ROW = /^•\s*(\d+\s*×\s*.+?)\s+—\s+(S\/\s?[\d.,]+|precio por confirmar)(\s+\(grabado:.*\))?\s*$/
const PRODUCT_ROW = /^•\s*(.+?)(?:\s+\((.+?)\))?\s+—\s+(.+)$/
const TOTAL_ROW = /^Total (estimado|a pagar):\s*(S\/\s?[\d.,]+)\s*$/

/** Reconoce las listas de precios, las líneas de un pedido y el total; el resto queda como texto. Nunca altera las cifras. */
export function parseBody(body: string): BodyBlock[] {
  const blocks: BodyBlock[] = []
  const text: string[] = []
  const flush = () => {
    if (text.length > 0) blocks.push({ kind: 'text', text: text.join('\n') })
    text.length = 0
  }
  const lines = body.split('\n')
  lines.forEach((raw, i) => {
    const line = raw.trim()
    const marker = parseMarkerLine(line)
    if (marker) {
      flush()
      blocks.push(marker)
      return
    }
    const price = PRICE_ROW.exec(line)
    const row = ORDER_ROW.exec(line)
    const total = TOTAL_ROW.exec(line)
    const product = row ? null : PRODUCT_ROW.exec(line)
    if (price) {
      flush()
      blocks.push({ kind: 'price', name: price[1]!, price: price[2]! })
    } else if (product) {
      flush()
      blocks.push({ kind: 'product', name: product[1]!, collection: product[2] ?? null, sizes: product[3]!, description: null })
    } else if (row) {
      flush()
      blocks.push({ kind: 'line', label: `${row[1]!}${row[3] ?? ''}`, amount: row[2]! })
    } else if (total) {
      flush()
      const next = lines[i + 1]?.trim() ?? ''
      blocks.push({ kind: 'total', amount: total[2]!, note: next && !PRICE_ROW.test(next) && !TOTAL_ROW.test(next) ? next : '', ...(total[1] === 'a pagar' ? { label: 'Total a pagar' } : {}) })
    } else if (/^\s{2,}\S/.test(raw) && text.length === 0 && blocks.at(-1)?.kind === 'product') {
      // La frase que acompaña a un modelo (línea con sangría) va dentro de su tarjeta.
      const card = blocks.at(-1) as Extract<BodyBlock, { kind: 'product' }>
      blocks[blocks.length - 1] = { ...card, description: line }
    } else if (i > 0 && TOTAL_ROW.test(lines[i - 1]!.trim()) && line) {
      // La nota que acompaña al total ya va dentro de su recuadro.
    } else {
      text.push(raw)
    }
  })
  flush()
  return blocks.filter((b) => b.kind !== 'text' || b.text.trim() !== '')
}

const plain = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

/** Foto oficial del modelo que se nombra («Ñañito», «Bosques Amazónicos»...), o undefined si no hay. */
export function photoForModel(name: string): ModelPhoto | undefined {
  const wanted = plain(name)
  return Object.values(modelPhotos).find((photo) => plain(photo.name) === wanted)
}

/** La frase con que el servidor cierra cada pregunta del pedido paso a paso. En la web no se muestra: se reemplaza por el botón «Cancelar». */
const FLOW_FOOTER = /\n*\(Pedido paso a paso · escribe «cancelar» para salir\)\s*$/

/** Separa el texto de una respuesta de la frase final del pedido paso a paso (`inFlow` indica que la tenía). */
export function splitFlowFooter(body: string): { text: string; inFlow: boolean } {
  return FLOW_FOOTER.test(body) ? { text: body.replace(FLOW_FOOTER, '').trimEnd(), inFlow: true } : { text: body, inFlow: false }
}

/**
 * ¿Lo que escribe el cliente abre una conversación nueva? Sí cuando la anterior ya terminó (canceló, registró su cotización o
 * pagó) y toca un botón o saluda con «Hola». Cualquier otra cosa sigue en la misma conversación: por ejemplo, un pedido sin pagar.
 */
export function startsNewConversation(last: Pick<ChatMessage, 'role' | 'body'> | undefined, message: string, fromButton: boolean): boolean {
  return !!last && last.role !== 'customer' && endsOperation(last.body) && (fromButton || isGreetingWord(message))
}

/** Hora local (HH:MM) de un mensaje; vacío si la fecha no es válida. */
export function messageTime(createdAt: string): string {
  const date = new Date(createdAt)
  if (!createdAt || Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** Cuántos caracteres se muestran en el instante `elapsedMs` de la escritura; termina en `maxMs` aunque el texto sea largo. */
export function typedLength(total: number, elapsedMs: number, maxMs = 1400, msPerChar = 14): number {
  const duration = Math.min(maxMs, total * msPerChar)
  if (duration <= 0 || elapsedMs >= duration) return total
  return Math.floor((elapsedMs / duration) * total)
}

/** «Large 65*46*4 · Small 35*25*2» → «Large 65 × 46 × 4 cm · Small 35 × 25 × 2 cm». Lo que no sea una medida se deja tal cual. */
export function formatSizes(sizes: string): string {
  return sizes.replace(/(\d+(?:[.,]\d+)?(?:\*\d+(?:[.,]\d+)?)+)/g, (measure) => `${measure.split('*').join(' × ')} cm`)
}

/** Una línea de texto; `label` es el rótulo antes de los dos puntos («Entrega en», «Ejemplo»), que se destaca. */
export interface RichLine {
  label: string | null
  text: string
}

/** Texto de un mensaje ordenado para mostrarlo: párrafos, listas con viñetas y listas numeradas. */
export type RichBlock =
  | { kind: 'p'; lines: RichLine[] }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: { n: string; text: string }[] }

const BULLET = /^\s*[•·\-–*]\s+(.+)$/
const NUMBERED = /^\s*(\d{1,3})[.)]\s+(.+)$/
const LABELED = /^([A-ZÁÉÍÓÚÑ][^:\n]{1,28}):(?:\s+(.*))?$/

/** Ordena el texto de un mensaje: las líneas en blanco separan párrafos y las líneas con «•», «-» o «1.» forman listas. */
export function parseRich(body: string): RichBlock[] {
  const blocks: RichBlock[] = []
  for (const raw of body.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim()
    if (!line) {
      blocks.push({ kind: 'p', lines: [] }) // separador: corta el párrafo o la lista en curso
      continue
    }
    const last = blocks.at(-1)
    const bullet = BULLET.exec(line)
    const numbered = bullet ? null : NUMBERED.exec(line)
    if (bullet) {
      if (last?.kind === 'ul') last.items.push(bullet[1]!)
      else blocks.push({ kind: 'ul', items: [bullet[1]!] })
    } else if (numbered) {
      const item = { n: numbered[1]!, text: numbered[2]! }
      if (last?.kind === 'ol') last.items.push(item)
      else blocks.push({ kind: 'ol', items: [item] })
    } else {
      const labeled = LABELED.exec(line)
      // «Entrega en: …» lleva rótulo; una frase que solo termina en dos puntos («Ya casi…:») es texto, salvo un rótulo corto como «Ejemplo:».
      const isLabel = labeled && ((labeled[2] ?? '') !== '' || labeled[1]!.length <= 12)
      const entry: RichLine = isLabel ? { label: labeled[1]!, text: labeled[2] ?? '' } : { label: null, text: line }
      if (last?.kind === 'p') last.lines.push(entry)
      else blocks.push({ kind: 'p', lines: [entry] })
    }
  }
  return blocks.filter((b) => b.kind !== 'p' || b.lines.length > 0)
}

/** ¿El texto es una sola frase corrida (sin listas, rótulos ni párrafos)? Solo ese se escribe letra a letra. */
export function isPlainText(blocks: readonly RichBlock[]): boolean {
  const only = blocks[0]
  return blocks.length === 0 || (blocks.length === 1 && only!.kind === 'p' && only!.lines.every((l) => !l.label))
}
