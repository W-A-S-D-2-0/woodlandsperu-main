import type { ChatMessage } from '../../../shared/api/chat'
import { endsOperation, isGreetingWord } from '../../content/chat-greeting'
import { guideChip } from './site-guide'
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

/** Una respuesta rápida: `label` es lo que se ve en el botón y `value` lo que se envía como mensaje. */
export type Chip = string | { label: string; value: string; primary?: boolean }

export const APPOINTMENT_CHIP_VALUE = '__agendar_cita__'
export const APPOINTMENT_CHIP = { label: '📅 Agendar cita', value: APPOINTMENT_CHIP_VALUE, primary: true as boolean }
const SEE_PRODUCTS = 'Ver los productos'
const SEE_PRICES = 'Ver los precios'
const ORDER = 'Quiero hacer un pedido'
const CORPORATE = 'Pedido para mi empresa'
const ENGRAVING = '¿Cómo es el grabado?'
const DELIVERY = '¿Cuáles son los plazos de entrega?'

const STRONG_BUY = /\b(quiero (comprar|pedir|una|unas|dos|tres|\d+)|quisiera|me interesa|lo quiero|las quiero|cotiza|cotizar|cotizacion|como (pago|compro)|donde (pago|compro)|yape|plin)\b/
const BUY_SIGNAL = /\b(quiero|pedido|comprar|pedir|precio|precios|cuanto|cuesta|cotiza|plazo|entrega|envio|pagar|yape|plin|me interesa|stock)\b/
const TOPIC_ENGRAVING = /(grabad|grabar|logo|personaliz|nombre|frase)/
const TOPIC_CORPORATE = /\b(empresa|corporativ|ruc|factura|mayor|docena|clientes|colaboradores)/
const TOPIC_CATALOG = /(producto|catalogo|modelo|tabla|medida|tamano|foto)/
const TOPIC_DELIVERY = /\b(plazo|entrega|envio|delivery|demora|llega|provincia)/

/**
 * Botones que se anticipan a lo que el cliente quiere, según cómo avanza la charla (como el autocompletado de un buscador).
 * Cuanto más muestra ganas de comprar, más arriba sube «Agendar cita»; si ya está decidido, es el botón principal.
 * Solo hace falta en conversaciones libres: el pedido paso a paso trae sus propios botones.
 */
export function predictChips(messages: Pick<ChatMessage, 'role' | 'body'>[]): Chip[] {
  const said = messages.filter((m) => m.role === 'customer').map((m) => plain(m.body))
  const lastSaid = said.at(-1) ?? ''
  const interest = said.filter((t) => BUY_SIGNAL.test(t)).length
  const ready = STRONG_BUY.test(lastSaid) || interest >= 2

  const ranked: Chip[] = []
  const push = (chip: Chip) => {
    const value = typeof chip === 'string' ? chip : chip.value
    if (!ranked.some((c) => (typeof c === 'string' ? c : c.value) === value)) ranked.push(chip)
  }

  if (ready) push(APPOINTMENT_CHIP)
  // Lo que se entiende mejor viendo se resuelve en la web: el botón lleva a esa parte de la página.
  if (TOPIC_ENGRAVING.test(lastSaid)) push(guideChip('grabado'))
  if (TOPIC_CORPORATE.test(lastSaid)) push(guideChip('empresa'))
  if (TOPIC_CATALOG.test(lastSaid)) push(guideChip('catalogo'))
  if (TOPIC_CORPORATE.test(lastSaid)) push(CORPORATE)
  if (TOPIC_ENGRAVING.test(lastSaid)) push(ENGRAVING)
  if (TOPIC_DELIVERY.test(lastSaid)) push(DELIVERY)
  if (interest > 0) push(ORDER)
  push(SEE_PRICES)
  push(SEE_PRODUCTS)
  push(ORDER)
  push(CORPORATE)
  push(ENGRAVING)
  push(DELIVERY)

  // Lo que ya se preguntó no se vuelve a ofrecer (salvo salir al catálogo y la cita).
  const fresh = ranked.filter((c) => {
    const value = typeof c === 'string' ? c : c.value
    return value === APPOINTMENT_CHIP_VALUE || value === SEE_PRODUCTS || !said.includes(plain(value))
  })
  const chips = fresh.slice(0, 4)
  return chips.some((c) => typeof c !== 'string' && c.value === APPOINTMENT_CHIP_VALUE) ? chips : [...chips, { ...APPOINTMENT_CHIP, primary: false }]
}

/**
 * Botones de respuesta para la pregunta en curso del pedido paso a paso, o null si la pregunta no los tiene. Así el
 * cliente elige el modelo, la cantidad o «sin grabado» con un toque en vez de escribir.
 */
export function flowChips(body: string): Chip[] | null {
  if (body.includes('Responde con el número o el nombre')) {
    const rows = [...body.matchAll(/^(\d{1,2})\.\s+(.+?)\s+—\s/gm)]
    return rows.length > 0 ? rows.map((r) => ({ label: r[2]!, value: r[1]! })) : null
  }
  if (body.includes('¿Cuántas unidades')) return ['1', '2', '3', '4', '5']
  if (body.includes('¿Quieres grabado')) return [{ label: 'Sin grabado', value: 'no' }]
  // Vista previa del grabado: seguir con el pedido (o tocar otra posición en las imágenes).
  if (body.includes('escribe «continuar»')) return [{ label: 'Continuar', value: 'continuar' }]
  return null
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

/** La imagen de un mensaje de esta conversación (la captura del pago). El token va en un encabezado, no en la dirección. */
export async function chatImage(messageId: number, token: string, fetcher: typeof fetch = fetch): Promise<Blob> {
  const response = await fetcher(`/api/chat/attachments/${messageId}`, { headers: { 'x-chat-token': token } })
  if (!response.ok) throw new Error('No se pudo cargar la imagen.')
  return response.blob()
}

/** Nombre y celular para agendar una cita: null si están bien, o qué falta. */
export function validAppointmentContact(name: string, phone: string): string | null {
  if (name.trim().length < 2) return 'Escribe tu nombre.'
  if (!/^\+?[0-9]{6,15}$/.test(phone.replace(/[\s()-]/g, ''))) return 'Escribe un celular válido (solo números).'
  return null
}

// --- Tarjeta del pedido ---------------------------------------------------------

/** Un modelo de la lista de la pregunta «¿Cuál quieres?» del pedido paso a paso. */
export interface ProductRow {
  n: number
  product: string
  variant: string
  dimensions: string | null
  /** «S/ 100.00» o «precio por confirmar». */
  price: string
}

const PRODUCT_STEP = 'Responde con el número o el nombre'
const MODEL_ROW = /^(\d{1,2})\.\s+(.+?)\s+—\s+(.+)$/gm

/** Los modelos de la pregunta del pedido (para armar la tarjeta), o null si el mensaje no es esa pregunta. */
export function parseProductRows(body: string): ProductRow[] | null {
  if (!body.includes(PRODUCT_STEP)) return null
  const rows = [...body.matchAll(MODEL_ROW)].map((m) => {
    const [product = '', variant = '', ...rest] = m[2]!.split(' · ')
    return { n: Number(m[1]), product, variant, dimensions: rest.join(' · ') || null, price: m[3]!.trim() }
  })
  return rows.length > 0 ? rows : null
}

/** El mensaje de la pregunta sin la lista numerada ni «responde con el número» (eso lo reemplaza la tarjeta). */
export function withoutProductRows(body: string): string {
  return body
    .split('\n')
    .filter((line) => !/^\d{1,2}\.\s+.+—\s+/.test(line) && !line.includes(PRODUCT_STEP))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^(Estos son nuestros modelos:|Estas son las medidas disponibles:)\n+/, 'Elige tu modelo, la cantidad y si quieres grabado:\n\n')
}

/** Cantidades que ofrece la tarjeta: 1 a 20, y de 5 en 5 hasta el tope del pedido por chat. */
export function quantityOptions(max: number): number[] {
  const options = Array.from({ length: Math.min(20, max) }, (_, i) => i + 1)
  for (let n = 25; n <= max; n += 5) options.push(n)
  return options
}

/**
 * Lo que la tarjeta le dice a Teca. Una sola frase con modelo, cantidad y grabado: el pedido paso a paso la entiende y no
 * vuelve a preguntar nada de eso.
 */
export function orderCardMessage(row: Pick<ProductRow, 'product' | 'variant'>, quantity: number, engraving: string | null): string {
  const model = `${row.product} ${row.variant}`.trim()
  const text = engraving?.replace(/[«»"“”\n\r]/g, ' ').replace(/\s+/g, ' ').trim()
  return `Quiero ${quantity} ${quantity === 1 ? 'unidad' : 'unidades'} de ${model}. ${text ? `Grabado: «${text}»` : 'Sin grabado.'}`
}
