import type { CatalogProduct, CatalogResponse, CatalogVariant } from '../../shared/api/contracts'
import { WEB_ORDER_MAX_UNITS } from '../../shared/api/public-schemas'
import { lineTotal, resolveUnitPrice } from '../../src/features/catalog/pricing'
import { CANCELLED_TEXT, GREETING_ASK } from '../../src/content/chat-greeting'
import type { HistoryMessage, ModelOutput } from './assistant'
import { looksLikeName, parseCustomerData } from './customer-data'

export { looksLikeName }
import { looksLikeEngravingDoubt } from './engraving-help'

/**
 * Flujo de pedido/cotización SIN IA, paso a paso. Es lo que garantiza que el chat nunca falle: si la IA está
 * saturada o sin clave, el cliente igual puede armar su pedido. No guarda estado aparte: el estado se
 * reconstruye repasando la conversación (cada pregunta del flujo lleva una frase fija, ver TAGS), así que
 * funciona igual en la web y en cualquier otro canal.
 */

/** Cierra cada pregunta del flujo: así se reconoce, en el historial, que el flujo sigue en marcha. */
const FOOTER = '(Pedido paso a paso · escribe «cancelar» para salir)'

type Step = 'done' | 'data' | 'name' | 'email' | 'phone' | 'address' | 'type' | 'company' | 'product' | 'qty' | 'engrave' | 'more' | 'confirm' | 'big'

const TAGS: Record<Exclude<Step, 'big' | 'done'>, string> = {
  data: 'tus datos',
  name: '¿A nombre de quién',
  email: 'tu correo',
  phone: 'tu celular',
  address: 'tu dirección',
  type: '¿Es para ti o para una empresa',
  company: '¿Cómo se llama tu empresa',
  product: 'Responde con el número o el nombre',
  qty: '¿Cuántas unidades',
  engrave: '¿Quieres grabado',
  more: '¿Agregas otro producto',
  confirm: '¿Confirmas',
}

/** Lo que se pide al concretar el pedido, después de elegir las tablas. */
const DATA_REQUEST =
  'Ya casi. Para registrar tu pedido necesito estos datos:\n\n• Tu celular\n• Tu correo\n• Tu dirección de entrega (calle, número, distrito y ciudad)\n\nEnvíamelos en un solo mensaje.\n\nEjemplo:\n987654321, ana@correo.com, Jr. Lima 123, Tarapoto'

const CUSTOM = /a medida|medida propia|otra medida|diseno propio|diseno especial|personalizad[ao] aparte|no esta en|ninguno de/
const CUSTOM_LABEL = 'Pieza a medida o diseño propio'


interface Entry {
  product: CatalogProduct
  variant: CatalogVariant
}
interface Line extends Entry {
  qty?: number
  /** undefined = aún no se preguntó; null = sin grabado. */
  engraving?: string | null
}
interface Flow {
  lines: Line[]
  cur: (Partial<Line> & { filter?: string }) | null
  moreDone: boolean
  type?: 'individual' | 'business'
  company?: string
  name?: string
  email?: string
  phone?: string
  address?: string
  confirmed?: boolean
  /** Pedido corporativo con logo: el archivo lo coordina el equipo, así que siempre queda como cotización. */
  logo?: string
  /** Lo que el primer mensaje ya dijo (cantidad, grabado) y se aplica al elegir el modelo. */
  prefill?: { qty?: number; engraving?: string }
  big?: { label: string; qty: number }
}

const money = (value: number) => `S/ ${value.toFixed(2)}`
const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

const YES = /^(s[ií]|sip|claro|ok|okay|dale|listo|confirmo|confirmado|correcto|de acuerdo|va|por supuesto|otro|agrega)\b/
const NO = /^(no|nop|nel|ninguno|ninguna|nada|sin|ya no|solo eso|eso es todo|es todo|gracias)\b/
const yes = (text: string) => YES.test(normalize(text))
const no = (text: string) => NO.test(normalize(text))

const WORDS: Record<string, number> = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, doce: 12, quince: 15, veinte: 20 }

function parseQty(text: string): number | null {
  const n = normalize(text)
  const digits = n.match(/\d{1,6}/)
  if (digits) return Number(digits[0])
  const word = n.split(/\W+/).find((w) => w in WORDS)
  return word ? WORDS[word]! : null
}

// --- Qué pregunta toca ---------------------------------------------------------

function nextStep(f: Flow): Step {
  // Al empezar solo se pide el nombre; el celular, el correo y la dirección se piden al concretar el pedido.
  if (!f.name) return 'name'
  if (!f.type) return 'type'
  if (f.type === 'business' && !f.company) return 'company'
  if (!f.moreDone) {
    const c = f.cur
    if (!c?.variant) return 'product'
    if (c.qty === undefined) return 'qty'
    if (c.engraving === undefined) return 'engrave'
    return 'more'
  }
  if (!f.email && !f.phone && !f.address) return 'data'
  if (!f.email) return 'email'
  if (!f.phone) return 'phone'
  if (!f.address) return 'address'
  if (f.big) return 'big'
  return f.confirmed ? 'done' : 'confirm'
}

function listFor(f: Flow, catalog: CatalogResponse): Entry[] {
  const products = f.cur?.filter ? catalog.products.filter((p) => p.id === f.cur?.filter) : catalog.products
  return products.flatMap((product) => product.variants.map((variant) => ({ product, variant }))).slice(0, 30)
}

function entryLabel({ product, variant }: Entry): string {
  const extra = variant.dimensionsLabel ? ` · ${variant.dimensionsLabel}` : ''
  return `${product.name} · ${variant.name}${extra}`
}

function summary(f: Flow): { text: string; allPriced: boolean; units: number } {
  let total = 0
  let allPriced = true
  let units = 0
  const lines = f.lines.map((l) => {
    const unit = resolveUnitPrice(l.variant, l.qty!)
    const sum = lineTotal(unit, l.qty!)
    units += l.qty!
    if (sum === null || f.logo) allPriced = false
    else total += sum
    const price = sum === null ? 'precio por confirmar' : money(sum)
    return `• ${l.qty} × ${entryLabel(l)} — ${price}${l.engraving ? ` (grabado: «${l.engraving}»)` : ''}`
  })
  const who = [f.name, f.company ? `(${f.company})` : null, f.email, f.phone].filter(Boolean).join(' · ')
  const tail = f.logo
    ? 'Como lleva el logo de tu empresa, lo registro y el equipo coordina el logo contigo y confirma el precio final.'
    : allPriced
    ? `Total a pagar: ${money(total)}\nLo registro como pedido y te paso los datos para pagar por Yape ahora mismo.`
    : 'Hay productos sin precio publicado: lo registro y el equipo confirma el precio final.'
  return { text: `Este es tu pedido:\n\n${lines.join('\n')}\n\n${tail}\n\nA nombre de: ${who}\nEntrega en: ${f.address}`, allPriced, units }
}

function question(step: Step, f: Flow, catalog: CatalogResponse): string {
  switch (step) {
    case 'product': {
      const list = listFor(f, catalog)
      const head = f.cur?.filter ? 'Estas son las medidas disponibles:' : 'Estos son nuestros modelos:'
      const rows = list.map((e, i) => `${i + 1}. ${entryLabel(e)} — ${e.variant.price === null ? 'precio por confirmar' : money(e.variant.price)}`)
      return `${head}\n\n${rows.join('\n')}\n\n¿Cuál quieres? ${TAGS.product}.\nSi buscas otra medida o un diseño propio, escríbelo.`
    }
    case 'qty':
      return `${TAGS.qty} quieres de ${entryLabel(f.cur as Entry)}?\n\nPuedes pedir hasta ${WEB_ORDER_MAX_UNITS} por pedido.`
    case 'engrave':
      return `${TAGS.engrave} en esta tabla?\n\n• Escribe el nombre o la frase que quieres grabar (normalmente va en una esquina)\n• O responde «no» si la prefieres lisa`
    case 'more':
      return `${TAGS.more}?\n\nResponde «sí» o «no».`
    case 'type':
      return `${TAGS.type}?\n\nResponde «persona» o «empresa».`
    case 'company':
      return `${TAGS.company}?`
    case 'data':
      return DATA_REQUEST
    case 'name':
      return `Para empezar: ${TAGS.name} registro el pedido?\n\nEscribe tu nombre completo.`
    case 'email':
      return `Me falta ${TAGS.email}.\n\nEscríbelo para enviarte la confirmación.\nEjemplo: nombre@correo.com`
    case 'phone':
      return `Me falta ${TAGS.phone}.\n\nEs el número con el que te contactamos para la entrega.\nEjemplo: 987654321`
    case 'address':
      return `Me falta ${TAGS.address} de entrega.\n\nIncluye:\n• Calle y número\n• Distrito\n• Ciudad\n\nEjemplo: Jr. Lima 123, Tarapoto`
    case 'confirm':
      return `${summary(f).text}\n\n${TAGS.confirm} el pedido?\nResponde «sí» o «no».`
    case 'big':
    case 'done':
      return ''
  }
}

// --- Qué se entendió de la respuesta -------------------------------------------

/** null = respuesta válida (el flujo ya se actualizó); texto = por qué no se entendió. */
function apply(step: Step, raw: string, f: Flow, catalog: CatalogResponse): string | null {
  const text = raw.trim()
  switch (step) {
    case 'product': {
      const match = matchEntry(text, listFor(f, catalog), !f.cur?.filter)
      if (match.kind === 'none' && CUSTOM.test(normalize(text))) {
        f.big = { label: CUSTOM_LABEL, qty: 0 }
        f.moreDone = true
        f.cur = null
        return null
      }
      if (match.kind === 'none') return 'No encontré ese modelo.'
      if (match.kind === 'filter') f.cur = { filter: match.product.id }
      else f.cur = withPrefill(match.entry, f)
      return null
    }
    case 'qty': {
      const qty = parseQty(text)
      if (qty === null || qty < 1) return `Escribe cuántas unidades quieres (de 1 a ${WEB_ORDER_MAX_UNITS}).`
      if (qty > WEB_ORDER_MAX_UNITS) {
        f.big = { label: entryLabel(f.cur as Entry), qty }
        f.moreDone = true
        return null
      }
      f.cur!.qty = qty
      return null
    }
    case 'engrave': {
      // Una duda («no me gusta», «cómo se ve», «mejor en el centro») no es el texto a grabar: la atiende Teca con imágenes.
      if (looksLikeEngravingDoubt(text)) return 'Antes de seguir con tu pedido, vamos con tu duda del grabado.'
      if (no(text)) f.cur!.engraving = null
      else if (yes(text) && normalize(text).length < 12) return 'Escribe el texto exacto que quieres grabar, o responde «no».'
      else f.cur!.engraving = text.replace(/^["«“]|["»”]$/g, '').slice(0, 200)
      return null
    }
    case 'more': {
      // Con grabado en el producto, una duda («no me gusta», «ninguna me convence») la atiende Teca con imágenes.
      if (f.cur?.engraving && looksLikeEngravingDoubt(text)) return 'Antes de seguir con tu pedido, vamos con tu duda del grabado.'
      if (!yes(text) && !no(text)) return 'Responde «sí» o «no».'
      f.lines.push(f.cur as Line)
      f.cur = yes(text) ? {} : null
      f.moreDone = !yes(text)
      return null
    }
    case 'type': {
      const n = normalize(text)
      if (/empresa|negocio|restaurante|hotel|corporativ|\bclub\b|s\.?a\.?c|\bruc\b|cafeteria|tienda/.test(n)) f.type = 'business'
      else if (/persona|particular|para mi|\byo\b|personal|casa|regalo|individual/.test(n)) f.type = 'individual'
      else return 'Responde «persona» o «empresa».'
      return null
    }
    case 'company':
      if (text.length < 2) return 'Escribe el nombre de tu empresa.'
      f.company = text.slice(0, 200)
      return null
    case 'data': {
      // El nombre ya se pidió al empezar: aquí solo se leen celular, correo y dirección.
      const { email, phone, address } = parseCustomerData(text, { withName: false })
      Object.assign(f, { ...(email ? { email } : {}), ...(phone ? { phone } : {}), ...(address ? { address } : {}) })
      return email || phone || address ? null : 'No pude leer tus datos. Envíame en un solo mensaje tu celular, tu correo y tu dirección de entrega.'
    }
    case 'name': {
      const name = text.replace(/^(me llamo|mi nombre es|soy|nombre:?)\s+/i, '').trim()
      if (name.length < 2 || /@|\d{5,}/.test(name) || !/\p{L}/u.test(name)) return 'Escribe tu nombre, por favor.'
      f.name = name.slice(0, 160)
      return null
    }
    case 'email': {
      const email = text.match(/[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+/)?.[0]
      if (!email) return 'No vi un correo válido (por ejemplo, nombre@correo.com).'
      f.email = email.slice(0, 254)
      return null
    }
    case 'phone': {
      const phone = text.match(/\+?\d[\d\s()-]{5,}\d/)?.[0].replace(/[\s()-]/g, '')
      if (!phone || !/^\+?[0-9]{7,15}$/.test(phone)) return 'No vi un celular válido (por ejemplo, 987654321).'
      f.phone = phone
      return null
    }
    case 'address': {
      const address = text.replace(/^(mi direcci[oó]n es|direcci[oó]n:?|vivo en)\s+/i, '').trim()
      if (address.length < 6 || !/\p{L}/u.test(address)) return 'Escribe tu dirección de entrega completa (calle, número, distrito y ciudad).'
      f.address = address.slice(0, 300)
      return null
    }
    case 'confirm':
      if (f.lines.some((l) => l.engraving) && looksLikeEngravingDoubt(text)) return 'Antes de confirmar, vamos con tu duda del grabado.'
      if (!yes(text)) return no(text) ? 'cancel' : 'Responde «sí» para confirmar o «no» para cancelar.'
      f.confirmed = true
      return null
    case 'big':
    case 'done':
      return null
  }
}

function matchEntry(text: string, list: Entry[], allowFilter: boolean): { kind: 'ok'; entry: Entry } | { kind: 'filter'; product: CatalogProduct } | { kind: 'none' } {
  const byNumber = text.match(/^\s*(?:el |la |n[uú]mero |#)?(\d{1,2})\s*[.)]?\s*$/)
  if (byNumber) {
    const entry = list[Number(byNumber[1]) - 1]
    return entry ? { kind: 'ok', entry } : { kind: 'none' }
  }
  const n = normalize(text)
  const products = [...new Map(list.map((e) => [e.product.id, e.product])).values()].filter((p) => hasWord(n, p.name))
  const pool = products.length === 1 ? list.filter((e) => e.product.id === products[0]!.id) : list
  const named = pool.filter((e) => hasWord(n, e.variant.name))
  if (named.length === 1) return { kind: 'ok', entry: named[0]! }
  if (products.length === 1) {
    if (pool.length === 1) return { kind: 'ok', entry: pool[0]! }
    if (allowFilter) return { kind: 'filter', product: products[0]! }
  }
  return { kind: 'none' }
}

// --- Entrada del flujo ----------------------------------------------------------

const START = /cotiz|comprar|\bcompra\b|pedido|pedir|ordenar|encargar|reservar|necesito|deseo|me interesa|quiero (una?|unas|unos|\d|hacer|mandar|hacerme)/
const NOT_START = /estado|seguimiento|consultar|donde esta|como va/

export const startsFlow = (text: string) => {
  const n = normalize(text)
  return START.test(n) && !NOT_START.test(n)
}

const isFlowQuestion = (body: string) => body.includes(FOOTER)

function withPrefill(entry: Entry, f: Flow): Line & { filter?: string } {
  const { qty, engraving } = f.prefill ?? {}
  f.prefill = undefined
  return { ...entry, ...(qty ? { qty } : {}), ...(engraving ? { engraving } : {}) }
}

/** El nombre que dio el cliente cuando Teca se lo preguntó en el saludo, si lo dio. */
export function nameFromGreeting(history: readonly HistoryMessage[]): string | undefined {
  for (let i = 1; i < history.length; i++) {
    if (history[i - 1]!.role === 'assistant' && history[i - 1]!.body.includes(GREETING_ASK) && history[i]!.role === 'customer') {
      return looksLikeName(history[i]!.body) ?? undefined
    }
  }
  return undefined
}

function newFlow(first: string, catalog: CatalogResponse, name?: string): Flow {
  const flow: Flow = { lines: [], cur: null, moreDone: false, ...(name ? { name } : {}) }
  if (CUSTOM.test(normalize(first))) {
    flow.big = { label: CUSTOM_LABEL, qty: 0 }
    flow.moreDone = true
    return flow
  }
  if (/\blogo\b/.test(normalize(first))) flow.logo = first.trim().slice(0, 300)
  // Lo que el primer mensaje ya dice (modelo, cantidad, grabado) no se vuelve a preguntar.
  const n = normalize(first)
  // La cantidad solo se toma si viene dicha como tal: las medidas del modelo también tienen números.
  const qty = Number((n.match(/(\d{1,3})\s*(?:unidades|unidad|tablas|tabla|piezas|u)\b/) ?? n.match(/\bquiero (\d{1,3})\b/))?.[1])
  const engraving = first.match(/Grabado:\s*(.+?)(?:\s·\s*Posici|$)/)?.[1]?.replace(/["«»“”]/g, '').trim().slice(0, 200)
  flow.prefill = { qty: qty >= 1 && qty <= WEB_ORDER_MAX_UNITS ? qty : undefined, engraving: engraving || undefined }
  const match = matchEntry(first, listFor(flow, catalog), true)
  if (match.kind === 'ok') flow.cur = withPrefill(match.entry, flow)
  else if (match.kind === 'filter') flow.cur = { filter: match.product.id }
  return flow
}

/**
 * Responde dentro del flujo de pedido, o devuelve null si la conversación no está en él. Con `allowStart`
 * también lo inicia cuando el último mensaje es una intención de pedir o cotizar. `info` contesta preguntas
 * sueltas (precios, plazos…) sin perder el paso en curso.
 */
export function guidedFlowReply(history: readonly HistoryMessage[], catalog: CatalogResponse, options: { allowStart: boolean; info: (text: string) => string | null }): ModelOutput | null {
  if (!catalog.products.some((p) => p.variants.length > 0)) return null
  const greetedName = nameFromGreeting(history)
  let flow: Flow | null = null
  let candidate: Flow | null = null
  let lastError: string | null = null
  let cancelled = false
  const last = history.length - 1
  for (const m of history) {
    if (m.role === 'assistant') {
      if (isFlowQuestion(m.body)) {
        if (!flow && candidate) flow = candidate
      } else flow = null
      candidate = null
      continue
    }
    if (m.role !== 'customer') continue
    lastError = null
    cancelled = false
    if (flow) {
      if (/cancel|empez\w* de nuevo|olvid/.test(normalize(m.body))) {
        flow = null
        cancelled = true
        continue
      }
      const step = nextStep(flow)
      const problem = apply(step, m.body, flow, catalog)
      if (problem === 'cancel') {
        flow = null
        cancelled = true
      } else lastError = problem
    } else if (startsFlow(m.body)) {
      candidate = newFlow(m.body, catalog, greetedName)
    }
  }
  if (cancelled) return { text: CANCELLED_TEXT }
  const lastMessage = history[last]
  if (lastMessage?.role !== 'customer') return null
  // El flujo arranca solo si se permite; si ya estaba en marcha, continúa siempre.
  if (!flow) {
    if (!options.allowStart || !candidate) return null
    flow = candidate
  }

  const step = nextStep(flow)
  if (step === 'big') {
    const big = flow.big!
    const lines = [...flow.lines.map((l) => `${l.qty} × ${entryLabel(l)}`), big.qty > 0 ? `${big.qty} × ${big.label}` : big.label].join('; ')
    const who = [flow.name, flow.company, flow.email, flow.phone, flow.address].filter(Boolean).join(' · ')
    return {
      text: big.qty > 0 ? `Los pedidos de más de ${WEB_ORDER_MAX_UNITS} unidades los cotiza directamente el equipo. Ya tengo tu nombre y contacto.` : 'Las piezas a medida las prepara directamente el equipo. Ya tengo tu nombre y contacto.',
      call: { name: 'flag_for_team', args: { reason: `${big.qty > 0 ? 'Pedido grande' : 'Pieza a medida'} por chat: ${lines}. Contacto: ${who}.` } },
    }
  }
  if (step === 'done') {
    const s = summary(flow)
    const args = {
      customerType: flow.type,
      fullName: flow.name,
      companyName: flow.company,
      email: flow.email,
      phone: flow.phone,
      shippingAddress: flow.address,
      message: [`Dirección de entrega: ${flow.address}`, flow.logo ? `Pedido con logo: ${flow.logo}` : null].filter(Boolean).join(' · '),
      items: flow.lines.map((l) => ({ variantId: l.variant.id, quantity: l.qty, customization: l.engraving ?? undefined })),
    }
    return { text: '', call: { name: s.allPriced && !flow.logo && s.units <= WEB_ORDER_MAX_UNITS ? 'create_order' : 'create_quote_request', args } }
  }
  const prompt = `${question(step, flow, catalog)}
${FOOTER}`
  if (lastError) {
    const info = options.info(history[last]!.body)
    return { text: `${info ?? lastError}\n\n${prompt}` }
  }
  return { text: prompt }
}

/** El nombre aparece como palabra completa: «L» no debe coincidir con la «l» de «tablas». */
function hasWord(normalizedText: string, name: string): boolean {
  const escaped = normalize(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(normalizedText)
}
