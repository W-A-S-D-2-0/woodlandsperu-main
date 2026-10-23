import { describe, expect, it, vi } from 'vitest'
import type { ChatMessage, ChatResponse, ChatStatus } from '../../shared/api/chat'
import type { ApiErrorBody, CatalogResponse, QuoteSubmittedResponse, StaffIdentity } from '../../shared/api/contracts'
import type { ConversationDetail } from '../../shared/api/panel-contracts'
import { createApp } from '../app'
import type { StaffAuthProvider } from '../auth/staff-auth'
import { ChatDataError, type ChatData, type ConversationInfo, type RecordInput } from '../data/chat-data'
import type { PanelData } from '../data/panel-data'
import type { PublicData } from '../data/public-data'
import { createGeminiModel, parseGeminiResponse, toGeminiContents } from '../integrations/gemini'
import { parseWebhook, verifySignature } from '../integrations/whatsapp'
import { createAssistantModel } from '../services/chat'
import { buildSystemPrompt, createGuidedModel, quickInfoReply, parseOrderCall, parseQuoteCall, wantsHuman, type AssistantModel, type ModelOutput } from '../services/assistant'

const VARIANT = '3f2b8c1e-5d4a-4e7b-9a10-2c6d8e9f0a1b'
const TOKEN = 'a'.repeat(32)

const catalog: CatalogResponse = {
  currency: 'PEN',
  products: [
    {
      id: 'p1',
      slug: 'super-grill',
      name: 'Super Grill',
      description: null,
      category: null,
      isCustomizable: true,
      variants: [{ id: VARIANT, sku: 'SG-XL', name: 'XL', dimensionsLabel: '65*46*4', price: 100, priceTiers: [{ minQuantity: 10, unitPrice: 90 }] }],
    },
  ],
}

const quote: QuoteSubmittedResponse = {
  quoteId: '9f2b8c1e-5d4a-4e7b-9a10-2c6d8e9f0a1b',
  code: 'COT-000007',
  status: 'submitted',
  requiresReview: true,
  subtotal: 200,
  total: 200,
  currency: 'PEN',
  items: [],
}

/** Conversaciones en memoria: reproduce lo esencial de las funciones SQL. */
function fakeChat() {
  let nextId = 1
  const messages: (ChatMessage & { conversationId: string; externalId?: string })[] = []
  const conversations = new Map<string, ConversationInfo & { ref: string; handoffReason?: string }>()
  const byRef = new Map<string, string>()
  const orderState = { status: 'confirmed', paymentStatus: 'unpaid', stock: true }
  const chat: ChatData = {
    record: vi.fn(async (input: RecordInput) => {
      const key = `${input.channel}:${input.ref}`
      if (input.externalId) {
        const dup = messages.find((m) => m.externalId === input.externalId)
        if (dup) return { conversationId: dup.conversationId, messageId: dup.id, status: conversations.get(dup.conversationId)!.status, duplicate: true }
      }
      let id = byRef.get(key)
      if (!id) {
        id = `conv-${conversations.size + 1}`
        byRef.set(key, id)
        conversations.set(id, { id, channel: input.channel, status: 'open', quoteId: null, contactPhone: input.contactPhone ?? null, ref: input.ref })
      }
      messages.push({ id: nextId++, role: input.role, body: input.body, createdAt: '2026-10-17T10:00:00Z', conversationId: id, externalId: input.externalId })
      return { conversationId: id, messageId: nextId - 1, status: conversations.get(id)!.status, duplicate: false }
    }),
    history: vi.fn(async (id: string) =>
      messages.filter((m) => m.conversationId === id && m.role !== 'system').map((m) => ({ role: m.role as 'customer' | 'assistant' | 'staff', body: m.body })),
    ),
    info: vi.fn(async (id: string) => conversations.get(id) ?? null),
    handoff: vi.fn(async (id: string, reason: string) => {
      const c = conversations.get(id)!
      if (c.status === 'open' || c.status === 'closed') {
        c.status = 'needs_human'
        c.handoffReason = reason
      }
    }),
    linkQuote: vi.fn(async (id: string, quoteId: string) => {
      conversations.get(id)!.quoteId = quoteId
    }),
    findPaymentTarget: vi.fn(async (channel, ref) => {
      const id = byRef.get(`${channel}:${ref}`)
      const code = messages.findLast((m) => m.conversationId === id && m.role === 'assistant' && m.body.includes('Subir captura de pago'))?.body.match(/PED-\d{6,}/)?.[0]
      return id && code ? { conversationId: id, orderId: 'o-1', code, total: 200, status: orderState.status, paymentStatus: orderState.paymentStatus } : null
    }),
    recordPayment: vi.fn(async () => {
      orderState.paymentStatus = 'paid'
      orderState.status = orderState.stock ? 'in_production' : 'pending_confirmation'
      return { code: 'PED-000012', status: orderState.status, paymentStatus: 'paid', alreadyPaid: false }
    }),
    messagesAfter: vi.fn(async (channel, ref, after) => {
      const id = byRef.get(`${channel}:${ref}`)
      if (!id) return null
      return { status: conversations.get(id)!.status as ChatStatus, messages: messages.filter((m) => m.conversationId === id && m.id > after) }
    }),
  }
  return { chat, messages, conversations, orderState }
}

const order = { orderId: 'o-1', code: 'PED-000012', status: 'confirmed', confirmed: true, total: 200, currency: 'PEN' as const }

const publicData = (): PublicData => ({
  listCatalog: vi.fn(async () => catalog),
  submitQuote: vi.fn(async () => quote),
  getOrderStatus: vi.fn(async () => null),
  submitOrder: vi.fn(async () => order),
})

const scripted = (...outputs: ModelOutput[]): ((env: Env, c: CatalogResponse) => AssistantModel) => {
  const queue = [...outputs]
  return () => ({ generate: vi.fn(async () => queue.shift() ?? { text: 'ok' }) })
}

function send(app: ReturnType<typeof createApp>, message: string, token = TOKEN, env: Partial<Env> = {}) {
  return app.request(
    '/api/chat/messages',
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, message }) },
    { APP_ENV: 'development', ...env } as Env,
  )
}

describe('asistente: reglas que no dependen del modelo', () => {
  it('detecta cuando el cliente pide una persona o reclama (se anota para el equipo)', () => {
    for (const text of ['Quiero hablar con una persona', 'pásame con un asesor', 'tengo un reclamo', 'quiero un humano']) expect(wantsHuman(text)).toBe(true)
    for (const text of ['Cuánto cuesta la tabla XL', 'hola', 'precio por persona']) expect(wantsHuman(text)).toBe(false)
  })

  it('una cotización pedida por el asistente pasa por las mismas reglas del formulario público', () => {
    const ok = parseQuoteCall({ fullName: 'Ana', email: 'ana@example.com', items: [{ variantId: VARIANT, quantity: 3, customization: 'Ana' }] }, catalog)
    expect(ok.ok).toBe(true)
    // Tope de 100 unidades, producto desconocido y falta de contacto se rechazan.
    expect(parseQuoteCall({ fullName: 'Ana', email: 'ana@example.com', items: [{ variantId: VARIANT, quantity: 101 }] }, catalog).ok).toBe(false)
    expect(parseQuoteCall({ fullName: 'Ana', email: 'ana@example.com', items: [{ variantId: '4f2b8c1e-5d4a-4e7b-9a10-2c6d8e9f0a1b', quantity: 1 }] }, catalog).ok).toBe(false)
    expect(parseQuoteCall({ fullName: 'Ana', items: [{ variantId: VARIANT, quantity: 1 }] }, catalog).ok).toBe(false)
  })

  it('parseOrderCall solo acepta productos del catálogo y hasta 100 unidades en total', () => {
    const base = { fullName: 'Ana', email: 'ana@example.com' }
    expect(parseOrderCall({ ...base, items: [{ variantId: VARIANT, quantity: 100 }] }, catalog).ok).toBe(true)
    expect(parseOrderCall({ ...base, items: [{ variantId: VARIANT, quantity: 60 }, { variantId: VARIANT, quantity: 41 }] }, catalog).ok).toBe(false)
    expect(parseOrderCall({ ...base, items: [{ description: 'Tabla a medida', quantity: 1 }] }, catalog).ok).toBe(false)
    expect(parseOrderCall({ fullName: 'Ana', items: [{ variantId: VARIANT, quantity: 1 }] }, catalog).ok).toBe(false)
  })

  it('el modo guiado responde precios y plazos sin inventar y anota lo que no entiende', async () => {
    const model = createGuidedModel(catalog)
    const ask = (body: string, extra: string[] = []) =>
      model.generate({ system: '', history: [...extra.map((b) => ({ role: 'customer' as const, body: b })), { role: 'customer', body }] })
    expect((await ask('hola')).text).toContain('Woodland')
    const price = await ask('¿Cuánto cuesta?', ['hola'])
    expect(price.text).toContain('S/ 100.00')
    const plazo = await ask('¿Cuál es el plazo de entrega?', ['hola'])
    expect(plazo.text).toContain('Unos 2 días')
    expect(plazo.text).toContain('por confirmar')
    const quoteIntent = await ask('quiero cotizar 20 tablas', ['hola'])
    expect(quoteIntent.call).toBeUndefined()
    expect(quoteIntent.text).toContain('Pedido paso a paso')
    // «Precios» enseña los importes; «productos» enseña los modelos con sus medidas y sin importes.
    expect((await ask('Ver los precios', ['hola'])).text).toContain('S/ 100.00')
    for (const q of ['Ver los productos de Woodland', 'quiero ver el catálogo', 'muéstrame los modelos']) {
      const text = (await ask(q, ['hola'])).text
      expect(text).toContain('65*46*4')
      expect(text).not.toContain('S/ 100.00')
    }
    expect((await ask('catálogo', ['hola'])).text).not.toContain('grabar')
    expect(quickInfoReply('Ver los precios', catalog)).toContain('S/ 100.00')
    expect(quickInfoReply('quiero comprar 3 tablas', catalog)).toBeNull()
    expect(quickInfoReply('hola, quiero 20 tablas y cuánto cuestan', catalog)).toBeNull()
    const unknown = await ask('asdfgh', ['hola'])
    expect(unknown.call?.name).toBe('flag_for_team')
    // El asistente nunca promete que una persona escriba en el chat.
    for (const output of [quoteIntent, unknown, await ask('quiero poner mi logo', ['hola']), await ask('somos un restaurante', ['hola'])]) {
      expect(output.text).not.toMatch(/te paso con|persona del equipo/i)
    }
  })
})

describe('Gemini', () => {
  it('une turnos seguidos y empieza siempre con el cliente', () => {
    const contents = toGeminiContents([
      { role: 'assistant', body: 'Hola' },
      { role: 'customer', body: 'a' },
      { role: 'customer', body: 'b' },
      { role: 'staff', body: 'Soy del equipo' },
    ])
    expect(contents).toEqual([
      { role: 'user', parts: [{ text: 'a' }, { text: 'b' }] },
      { role: 'model', parts: [{ text: 'Soy del equipo' }] },
    ])
  })

  it('reintenta una vez cuando Google está saturado (503) y no más', async () => {
    const ok = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Hola' }] } }] }), { status: 200 })
    const busy = () => new Response('{}', { status: 503 })
    const model = (...responses: (() => Response)[]) => {
      const queue = [...responses]
      const fetchImpl = vi.fn(async () => queue.shift()!()) as unknown as typeof fetch
      return { fetchImpl, model: createGeminiModel({ apiKey: 'k', fetchImpl, retryDelayMs: 0 }) }
    }
    const input = { system: 's', history: [{ role: 'customer' as const, body: 'hola' }] }

    const recovers = model(busy, ok)
    expect(await recovers.model.generate(input)).toEqual({ text: 'Hola' })
    expect(recovers.fetchImpl).toHaveBeenCalledTimes(2)

    const fails = model(busy, busy)
    await expect(fails.model.generate(input)).rejects.toThrow('gemini: 503')
    expect(fails.fetchImpl).toHaveBeenCalledTimes(2)

    const badKey = model(() => new Response('{}', { status: 403 }))
    await expect(badKey.model.generate(input)).rejects.toThrow('gemini: 403')
    expect(badKey.fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('lee texto y llamadas a herramientas; ignora herramientas desconocidas', () => {
    expect(parseGeminiResponse({ candidates: [{ content: { parts: [{ text: 'Hola' }] } }] })).toEqual({ text: 'Hola' })
    expect(parseGeminiResponse({ candidates: [{ content: { parts: [{ functionCall: { name: 'flag_for_team', args: { reason: 'x' } } }] } }] }).call).toEqual({
      name: 'flag_for_team',
      args: { reason: 'x' },
    })
    expect(parseGeminiResponse({ candidates: [{ content: { parts: [{ functionCall: { name: 'borrar_todo', args: {} } }] } }] }).call).toBeUndefined()
    expect(parseGeminiResponse({})).toEqual({ text: '' })
  })
})

describe('POST /api/chat/messages', () => {
  it('registra el mensaje, responde el asistente y devuelve ambos', async () => {
    const { chat } = fakeChat()
    const app = createApp({ chatData: () => chat, publicData: publicData, assistantModel: scripted({ text: 'El Super Grill XL cuesta S/ 100.' }) })
    const res = await send(app, 'Hola, precio del XL')
    expect(res.status).toBe(200)
    const body = (await res.json()) as ChatResponse
    expect(body.status).toBe('open')
    expect(body.messages.map((m) => m.role)).toEqual(['customer', 'assistant'])
    expect(body.messages[1]?.body).toContain('S/ 100')
  })

  it('el cliente que pide una persona queda anotado para el equipo, pero el asistente le responde igual', async () => {
    const { chat, conversations } = fakeChat()
    const model = vi.fn(scripted({ text: 'Yo te ayudo: ¿qué modelo te interesa?' }, { text: 'El XL cuesta S/ 100.' }))
    const app = createApp({ chatData: () => chat, publicData: publicData, assistantModel: model })
    const first = (await (await send(app, 'Quiero hablar con una persona')).json()) as ChatResponse
    expect(first.status).toBe('needs_human')
    expect([...conversations.values()][0]?.handoffReason).toMatch(/persona/)
    expect(first.messages.map((m) => m.role)).toEqual(['customer', 'assistant'])
    expect(first.messages[1]?.body).toContain('Yo te ayudo')

    // Sigue respondiendo en la misma conversación, aunque esté marcada para el equipo.
    const second = (await (await send(app, '¿Cuánto cuesta el XL?')).json()) as ChatResponse
    expect(second.messages.map((m) => m.role)).toEqual(['customer', 'assistant'])
    expect(second.messages[1]?.body).toContain('S/ 100')
    expect(second.status).toBe('needs_human')
  })

  it('cuando el asistente anota algo para el equipo, responde y lo dice con honestidad', async () => {
    const { chat, conversations } = fakeChat()
    const app = createApp({
      chatData: () => chat,
      publicData: publicData,
      assistantModel: scripted({ text: 'Los pedidos de 300 tablas se cotizan aparte.', call: { name: 'flag_for_team', args: { reason: 'Pedido de 300 unidades' } } }),
    })
    const body = (await (await send(app, 'Quiero 300 tablas')).json()) as ChatResponse
    expect(body.status).toBe('needs_human')
    expect(body.messages.at(-1)?.body).toContain('Los pedidos de 300 tablas')
    expect(body.messages.at(-1)?.body).toContain('anotada para que el equipo')
    expect([...conversations.values()][0]?.handoffReason).toBe('Pedido de 300 unidades')
  })

  it('el asistente lee un historial largo de la conversación para recordar lo dicho', async () => {
    const { chat } = fakeChat()
    const app = createApp({ chatData: () => chat, publicData: publicData, assistantModel: scripted({ text: 'ok' }) })
    await send(app, 'Soy Ana, quiero 3 tablas XL')
    expect(chat.history).toHaveBeenCalledWith(expect.any(String), 40)
  })

  it('el prompt dice que el asistente atiende solo y que lo pendiente se anota para el equipo', () => {
    const prompt = buildSystemPrompt(catalog)
    expect(prompt).toContain('flag_for_team')
    expect(prompt).not.toContain('request_human')
    expect(prompt).toMatch(/NUNCA digas que "te paso con una persona"/)
    expect(prompt).toContain('El camino de una compra')
  })

  it('el asistente registra una cotización, la vincula a la conversación y no inventa el total', async () => {
    const { chat, conversations } = fakeChat()
    const pub = publicData()
    const app = createApp({
      chatData: () => chat,
      publicData: () => pub,
      assistantModel: scripted({
        text: '',
        call: { name: 'create_quote_request', args: { fullName: 'Ana', email: 'ana@example.com', items: [{ variantId: VARIANT, quantity: 2 }] } },
      }),
    })
    const body = (await (await send(app, 'Sí, regístrala')).json()) as ChatResponse
    expect(pub.submitQuote).toHaveBeenCalledWith(expect.objectContaining({ items: [expect.objectContaining({ variantId: VARIANT, quantity: 2 })] }), 'web_chat')
    expect(body.messages.at(-1)?.body).toContain('COT-000007')
    expect([...conversations.values()][0]?.quoteId).toBe(quote.quoteId)
  })

  it('una segunda cotización en la misma conversación se anota para el equipo', async () => {
    const { chat } = fakeChat()
    const call = { name: 'create_quote_request' as const, args: { fullName: 'Ana', email: 'ana@example.com', items: [{ variantId: VARIANT, quantity: 2 }] } }
    const pub = publicData()
    const app = createApp({ chatData: () => chat, publicData: () => pub, assistantModel: scripted({ text: '', call }, { text: '', call }) })
    await send(app, 'cotiza')
    const second = (await (await send(app, 'otra más')).json()) as ChatResponse
    expect(second.status).toBe('needs_human')
    expect(pub.submitQuote).toHaveBeenCalledTimes(1)
  })

  const orderCall = (quantity = 2, extra: Record<string, unknown> = {}) => ({
    name: 'create_order' as const,
    args: { fullName: 'Ana', email: 'ana@example.com', items: [{ variantId: VARIANT, quantity }], ...extra },
  })

  it('un pedido confirmado en el chat se crea solo (la base lo confirma y reserva el stock) y trae cómo pagar', async () => {
    const { chat, conversations } = fakeChat()
    const pub = publicData()
    const app = createApp({ chatData: () => chat, publicData: () => pub, assistantModel: scripted({ text: '', call: orderCall(2) }) })
    const body = (await (await send(app, 'Sí, confirmo el pedido')).json()) as ChatResponse
    expect(pub.submitOrder).toHaveBeenCalledWith(expect.objectContaining({ items: [expect.objectContaining({ variantId: VARIANT, quantity: 2 })] }), 'web_chat')
    expect(pub.submitQuote).not.toHaveBeenCalled()
    const reply = body.messages.at(-1)?.body ?? ''
    expect(reply).toContain('PED-000012')
    expect(reply).toContain('S/ 200.00')
    expect(reply).toContain('paga ahora S/ 200.00 por Yape al 965 402 725')
    expect(reply).toContain('Subir captura de pago')
    // Nunca se habla de stock.
    expect(reply).not.toMatch(/stock|agotad|disponib|reserv/i)
    // El pago es automático: el pedido no deja la conversación esperando a una persona.
    expect(body.status).toBe('open')
    expect([...conversations.values()][0]?.handoffReason).toBeUndefined()
  })

  it('no se crea un segundo pedido en la misma conversación', async () => {
    const { chat } = fakeChat()
    const pub = publicData()
    const app = createApp({ chatData: () => chat, publicData: () => pub, assistantModel: scripted({ text: '', call: orderCall() }, { text: '', call: orderCall(5) }) })
    await send(app, 'Sí, confirmo')
    const second = (await (await send(app, 'agrega 5 más')).json()) as ChatResponse
    expect(pub.submitOrder).toHaveBeenCalledTimes(1)
    expect(second.messages.at(-1)?.body).toMatch(/Ya creé un pedido/)
  })

  it('si el pedido automático no es posible (sin precio, sin base…) se registra como cotización', async () => {
    const { chat } = fakeChat()
    const pub = publicData()
    pub.submitOrder = vi.fn(async () => {
      throw new Error('sin precio publicado')
    })
    const app = createApp({ chatData: () => chat, publicData: () => pub, assistantModel: scripted({ text: '', call: orderCall(2) }) })
    const body = (await (await send(app, 'Sí, confirmo')).json()) as ChatResponse
    expect(pub.submitQuote).toHaveBeenCalledTimes(1)
    expect(body.messages.at(-1)?.body).toContain('COT-000007')
    expect(body.messages.at(-1)?.body).toMatch(/registré tu pedido COT-/)
  })

  it('un pedido de más de 100 unidades no se crea solo: va como cotización', async () => {
    const { chat } = fakeChat()
    const pub = publicData()
    const app = createApp({ chatData: () => chat, publicData: () => pub, assistantModel: scripted({ text: '', call: orderCall(60, { items: [{ variantId: VARIANT, quantity: 60 }, { variantId: VARIANT, quantity: 50 }] }) }) })
    await send(app, 'Sí, confirmo')
    expect(pub.submitOrder).not.toHaveBeenCalled()
  })

  it('si falla el modelo, el cliente no se queda sin respuesta: se disculpa y se anota', async () => {
    const { chat } = fakeChat()
    const broken = () => ({
      generate: async () => {
        throw new Error('caído')
      },
    })
    const app = createApp({ chatData: () => chat, publicData: publicData, assistantModel: broken })
    const body = (await (await send(app, 'hola')).json()) as ChatResponse
    expect(body.status).toBe('needs_human')
    expect(body.messages.at(-1)?.body).toMatch(/anotada para el equipo/)
    expect(body.messages.at(-1)?.body).not.toMatch(/te paso con/i)
  })

  it('valida el token y el mensaje, y responde 503 sin base de datos', async () => {
    const { chat } = fakeChat()
    const app = createApp({ chatData: () => chat, publicData: publicData, assistantModel: scripted() })
    expect((await send(app, 'hola', 'corto')).status).toBe(422)
    expect((await send(app, '   ')).status).toBe(422)
    expect((await send(app, 'x'.repeat(1001))).status).toBe(422)
    const down = createApp({ chatData: () => null, publicData: publicData })
    expect((await send(down, 'hola')).status).toBe(503)
  })

  it('traduce el límite de mensajes de la base a 429', async () => {
    const { chat } = fakeChat()
    chat.record = vi.fn(async () => {
      throw new ChatDataError('rate_limited', 'Demasiados mensajes en poco tiempo.')
    })
    const app = createApp({ chatData: () => chat, publicData: publicData })
    const res = await send(app, 'hola')
    expect(res.status).toBe(429)
    expect(((await res.json()) as ApiErrorBody).error.code).toBe('rate_limited')
  })

  it('limita por la IP real del visitante cuando la API está detrás del hosting (X-Forwarded-For)', async () => {
    const { chat } = fakeChat()
    const app = createApp({ chatData: () => chat, publicData: publicData, assistantModel: scripted({ text: 'ok' }) })
    const limiter = { limit: vi.fn(async () => ({ success: true })) }
    const env = { APP_ENV: 'development', CHAT_RATE_LIMITER: limiter as unknown as RateLimit } as Env
    const post = (headers: Record<string, string>) =>
      app.request('/api/chat/messages', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ token: TOKEN, message: 'hola' }) }, env)
    await post({ 'X-Forwarded-For': '190.1.2.3, 76.76.21.21', 'CF-Connecting-IP': '76.76.21.21' })
    expect(limiter.limit).toHaveBeenLastCalledWith({ key: '190.1.2.3' })
    await post({ 'CF-Connecting-IP': '200.4.5.6' })
    expect(limiter.limit).toHaveBeenLastCalledWith({ key: '200.4.5.6' })
    await post({})
    expect(limiter.limit).toHaveBeenLastCalledWith({ key: 'unknown' })
  })

  it('respeta el límite por IP del chat', async () => {
    const { chat } = fakeChat()
    const app = createApp({ chatData: () => chat, publicData: publicData })
    const limiter = { limit: vi.fn(async () => ({ success: false })) }
    const res = await send(app, 'hola', TOKEN, { CHAT_RATE_LIMITER: limiter as unknown as RateLimit })
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('30')
  })
})

describe('GET /api/chat/messages', () => {
  it('entrega las respuestas nuevas (también mensajes antiguos del equipo) y no mezcla conversaciones', async () => {
    const { chat, messages } = fakeChat()
    const app = createApp({ chatData: () => chat, publicData: publicData, assistantModel: scripted({ text: 'Hola' }) })
    const first = (await (await send(app, 'hola')).json()) as ChatResponse
    // Mensaje de una persona del equipo guardado antes de que el panel dejara de responder.
    messages.push({ id: 99, role: 'staff', body: 'Soy Brigitte', createdAt: '2026-10-17T10:05:00Z', conversationId: 'conv-1' })
    const env = { APP_ENV: 'development' } as Env
    const lastId = first.messages.at(-1)!.id
    const poll = (token: string, after: number) => app.request(`/api/chat/messages?token=${token}&after=${after}`, {}, env)
    const fresh = (await (await poll(TOKEN, lastId)).json()) as ChatResponse
    expect(fresh.messages.map((m) => m.body)).toEqual(['Soy Brigitte'])
    const other = (await (await poll('b'.repeat(32), 0)).json()) as ChatResponse
    expect(other.messages).toEqual([])
    expect((await poll('x', 0)).status).toBe(422)
  })
})

// --- WhatsApp ------------------------------------------------------------------

const SECRET = 'app-secret-de-prueba'
const sign = async (body: string) => {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return `sha256=${[...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('')}`
}

const waEvent = (messages: object[]) => ({
  entry: [{ changes: [{ value: { contacts: [{ wa_id: '51999888777', profile: { name: 'Luis' } }], messages } }] }],
})
const waText = (id: string, body: string) => ({ id, from: '51999888777', type: 'text', text: { body } })

const waEnv = {
  APP_ENV: 'development',
  WHATSAPP_APP_SECRET: SECRET,
  WHATSAPP_VERIFY_TOKEN: 'verifica',
  WHATSAPP_ACCESS_TOKEN: 'token',
  WHATSAPP_PHONE_NUMBER_ID: '123',
} as unknown as Env

async function webhook(app: ReturnType<typeof createApp>, payload: unknown, env = waEnv, signature?: string) {
  const raw = JSON.stringify(payload)
  return app.request(
    '/api/whatsapp/webhook',
    { method: 'POST', headers: { 'content-type': 'application/json', 'X-Hub-Signature-256': signature ?? (await sign(raw)) }, body: raw },
    env,
  )
}

describe('WhatsApp', () => {
  it('verifica la firma y lee solo los mensajes entrantes', async () => {
    const raw = '{"a":1}'
    expect(await verifySignature(SECRET, raw, await sign(raw))).toBe(true)
    expect(await verifySignature(SECRET, raw, await sign('{"a":2}'))).toBe(false)
    expect(await verifySignature(SECRET, raw, undefined)).toBe(false)
    expect(await verifySignature(SECRET, raw, 'sha256=zz')).toBe(false)
    expect(parseWebhook(waEvent([waText('w1', ' Hola '), { id: 'w2', from: '51999888777', type: 'image' }, { type: 'text' }]))).toEqual([
      { id: 'w1', from: '51999888777', name: 'Luis', type: 'text', text: 'Hola' },
      { id: 'w2', from: '51999888777', name: 'Luis', type: 'image', text: null },
    ])
    expect(parseWebhook({ entry: [{ changes: [{ value: { statuses: [{ id: 'x' }] } }] }] })).toEqual([])
  })

  it('el desafío de Meta solo se contesta con el token correcto', async () => {
    const app = createApp({})
    const ask = (token: string, env = waEnv) => app.request(`/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=12345`, {}, env)
    expect(await (await ask('verifica')).text()).toBe('12345')
    expect((await ask('otro')).status).toBe(403)
    expect((await ask('verifica', { APP_ENV: 'development' } as Env)).status).toBe(503)
  })

  it('rechaza eventos sin firma válida y sigue inactivo sin secretos', async () => {
    const { chat } = fakeChat()
    const app = createApp({ chatData: () => chat, publicData: publicData })
    expect((await webhook(app, waEvent([waText('w1', 'hola')]), waEnv, 'sha256=' + '0'.repeat(64))).status).toBe(401)
    expect(chat.record).not.toHaveBeenCalled()
    expect((await webhook(app, waEvent([]), { APP_ENV: 'development' } as Env)).status).toBe(503)
  })

  it('atiende el mensaje, responde por WhatsApp y no duplica un reintento', async () => {
    const { chat, messages } = fakeChat()
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 })) as unknown as typeof fetch
    const app = createApp({ chatData: () => chat, publicData: publicData, assistantModel: scripted({ text: '¡Hola Luis!' }), fetchImpl })
    expect((await webhook(app, waEvent([waText('wamid.1', 'Hola')]))).status).toBe(200)
    expect(messages.map((m) => m.role)).toEqual(['customer', 'assistant'])
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = (fetchImpl as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]!
    expect(url).toContain('/123/messages')
    expect(JSON.parse(init.body as string)).toMatchObject({ to: '51999888777', text: { body: '¡Hola Luis!' } })

    // Meta reintenta el mismo evento: no se procesa de nuevo.
    expect((await webhook(app, waEvent([waText('wamid.1', 'Hola')]))).status).toBe(200)
    expect(messages).toHaveLength(2)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('un archivo se registra, se anota para el equipo y se avisa al cliente', async () => {
    const { chat, conversations } = fakeChat()
    const fetchImpl = vi.fn(async () => new Response('{}')) as unknown as typeof fetch
    const app = createApp({ chatData: () => chat, publicData: publicData, assistantModel: scripted(), fetchImpl })
    await webhook(app, waEvent([{ id: 'wamid.img', from: '51999888777', type: 'image' }]))
    expect([...conversations.values()][0]?.status).toBe('needs_human')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('si WhatsApp rechaza el envío, el mensaje queda registrado igual', async () => {
    const { chat, messages } = fakeChat()
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 400 })) as unknown as typeof fetch
    const app = createApp({ chatData: () => chat, publicData: publicData, assistantModel: scripted({ text: 'Hola' }), fetchImpl })
    expect((await webhook(app, waEvent([waText('wamid.2', 'Hola')]))).status).toBe(200)
    expect(messages.map((m) => m.role)).toEqual(['customer', 'assistant'])
  })
})

// --- Panel: conversaciones -----------------------------------------------------

const staff: Record<string, StaffIdentity> = {
  'token.admin': { userId: 'u-admin', role: 'admin', fullName: 'Admin' },
  'token.taller': { userId: 'u-taller', role: 'workshop', fullName: 'Taller' },
}
const auth: StaffAuthProvider = {
  verifyAccessToken: async (t) => (t in staff ? `user-${t}` : null),
  findActiveStaff: async (t) => staff[t] ?? null,
}

const CONV_ID = '5f2b8c1e-5d4a-4e7b-9a10-2c6d8e9f0a1b'
const detail = (channel: 'web_chat' | 'whatsapp'): ConversationDetail => ({
  id: CONV_ID,
  channel,
  status: 'needs_human',
  contactName: 'Luis',
  contactPhone: '51999888777',
  handoffReason: 'Pidió una persona',
  handoffRequestedAt: null,
  lastMessageAt: '2026-10-17T10:00:00Z',
  quoteId: null,
  customer: null,
  quote: null,
  messages: [],
})

function panel(conversation: ConversationDetail | null) {
  const data = {
    listConversations: vi.fn(async () => ({ items: [] })),
    getConversation: vi.fn(async () => conversation),
    setConversationStatus: vi.fn(async () => {}),
  } as unknown as PanelData
  return data
}

function admin(method: string, path: string, data: PanelData, opts: { token?: string; body?: unknown; env?: Partial<Env>; fetchImpl?: typeof fetch } = {}) {
  const app = createApp({ staffAuth: () => auth, panelData: () => data, fetchImpl: opts.fetchImpl })
  return app.request(
    `/api/admin${path}`,
    {
      method,
      headers: { Authorization: `Bearer ${opts.token ?? 'token.admin'}`, 'content-type': 'application/json' },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    },
    { APP_ENV: 'development', ...opts.env } as Env,
  )
}

describe('panel · conversaciones (solo supervisión)', () => {
  it('solo administración ve las conversaciones y las marca como revisadas o cerradas', async () => {
    const data = panel(detail('web_chat'))
    for (const [method, path] of [['GET', '/conversations'], ['GET', `/conversations/${CONV_ID}`], ['POST', `/conversations/${CONV_ID}/status`]] as const) {
      expect((await admin(method, path, data, { token: 'token.taller', body: method === 'GET' ? undefined : { status: 'open' } })).status).toBe(403)
    }
    expect((await admin('GET', '/conversations?status=needs_human', data)).status).toBe(200)
    expect((await admin('GET', '/conversations?status=raro', data)).status).toBe(422)
    expect((await admin('GET', `/conversations/${CONV_ID}`, data)).status).toBe(200)
    expect((await admin('POST', `/conversations/${CONV_ID}/status`, data, { body: { status: 'with_human' } })).status).toBe(422)
    expect((await admin('POST', `/conversations/${CONV_ID}/status`, data, { body: { status: 'open' } })).status).toBe(200)
    expect((await admin('POST', `/conversations/${CONV_ID}/status`, data, { body: { status: 'closed' } })).status).toBe(200)
  })

  it('el equipo ya no responde ni toma conversaciones desde el panel: lo atiende el asistente', async () => {
    const data = panel(detail('web_chat'))
    for (const path of ['reply', 'take']) {
      const res = await admin('POST', `/conversations/${CONV_ID}/${path}`, data, { body: { body: 'Hola, soy Brigitte' } })
      expect(res.status).toBe(404)
    }
  })
})

describe('POST /api/chat/payment-proof', () => {
  const png = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 1, 2, 3])], 'yape.png', { type: 'image/png' })
  const upload = (app: ReturnType<typeof createApp>, file: File | string, token = TOKEN) => {
    const form = new FormData()
    form.set('token', token)
    form.set('file', file)
    return app.request('/api/chat/payment-proof', { method: 'POST', body: form }, { APP_ENV: 'development' } as Env)
  }
  const orderCall = { name: 'create_order' as const, args: { fullName: 'Ana', email: 'ana@example.com', items: [{ variantId: VARIANT, quantity: 2 }] } }
  const withOrder = async () => {
    const fake = fakeChat()
    const app = createApp({ chatData: () => fake.chat, publicData: () => publicData(), assistantModel: scripted({ text: '', call: orderCall }) })
    await send(app, 'Sí, confirmo el pedido')
    return { ...fake, app }
  }

  it('sin un pedido esperando pago lo dice y no registra nada', async () => {
    const fake = fakeChat()
    const app = createApp({ chatData: () => fake.chat, publicData: () => publicData(), assistantModel: scripted() })
    const res = await upload(app, png())
    const body = (await res.json()) as ChatResponse
    expect(res.status).toBe(200)
    expect(body.messages.at(-1)?.body).toMatch(/Todavía no tengo un pedido/)
    expect(fake.chat.recordPayment).not.toHaveBeenCalled()
  })

  it('con el pedido creado, la captura lo deja pagado y en producción y se lo confirma al cliente', async () => {
    const { app, chat } = await withOrder()
    const res = await upload(app, png())
    const body = (await res.json()) as ChatResponse
    expect(res.status).toBe(200)
    expect(chat.recordPayment).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'o-1', image: expect.objectContaining({ contentType: 'image/png', ext: 'png' }) }))
    const reply = body.messages.at(-1)?.body ?? ''
    expect(reply).toMatch(/recibimos tu pago de S\/ 200\.00/)
    expect(reply).toContain('PED-000012')
    expect(reply).toMatch(/en producción/)
    expect(body.status).toBe('open')
  })

  it('una segunda captura no vuelve a registrar el pago', async () => {
    const { app, chat } = await withOrder()
    await upload(app, png())
    const body = (await (await upload(app, png())).json()) as ChatResponse
    expect(chat.recordPayment).toHaveBeenCalledTimes(1)
    expect(body.messages.at(-1)?.body).toMatch(/ya figura como pagado/)
  })

  it('si el pedido no se pudo confirmar solo (sin stock), el pago queda y el equipo recibe el aviso', async () => {
    const { app, orderState } = await withOrder()
    orderState.stock = false
    const body = (await (await upload(app, png())).json()) as ChatResponse
    expect(body.messages.at(-1)?.body).toMatch(/recibimos tu pago/)
    expect(body.messages.at(-1)?.body).not.toMatch(/en producción/)
    expect(body.status).toBe('needs_human')
  })

  it('solo acepta imágenes reales (se revisan los bytes, no el nombre)', async () => {
    const { app, chat } = await withOrder()
    const fake = new File([new TextEncoder().encode('esto no es una imagen, aunque se llame yape.png')], 'yape.png', { type: 'image/png' })
    const res = await upload(app, fake)
    expect(res.status).toBe(400)
    expect(((await res.json()) as ApiErrorBody).error.message).toMatch(/imagen/)
    expect(chat.recordPayment).not.toHaveBeenCalled()
  })

  it('exige la imagen y una sesión de chat válida', async () => {
    const { app } = await withOrder()
    expect((await upload(app, 'sin archivo')).status).toBe(400)
    expect((await upload(app, png(), 'corto')).status).toBe(400)
  })
})

describe('saludo de Teca: pide el nombre', () => {
  const sendGreeted = (app: ReturnType<typeof createApp>, message: string) =>
    app.request('/api/chat/messages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: TOKEN, message, greeted: true }) }, { APP_ENV: 'development' } as Env)

  it('el primer mensaje de Teca es pedir el nombre, y queda guardado como primero de la conversación', async () => {
    const { chat, messages } = fakeChat()
    const app = createApp({ chatData: () => chat, publicData: () => publicData(), assistantModel: createAssistantModel })
    await sendGreeted(app, 'Ana Pérez')
    expect(messages[0]).toMatchObject({ role: 'assistant' })
    expect(messages[0]!.body).toContain('¿cómo te llamas?')
    expect(messages[1]).toMatchObject({ role: 'customer', body: 'Ana Pérez' })
  })

  it('responde con el nombre y no repite el saludo en la respuesta (el chat ya lo mostró)', async () => {
    const { chat } = fakeChat()
    const app = createApp({ chatData: () => chat, publicData: () => publicData(), assistantModel: createAssistantModel })
    const body = (await (await sendGreeted(app, 'me llamo ana pérez')).json()) as ChatResponse
    expect(body.messages.map((m) => m.role)).toEqual(['customer', 'assistant'])
    expect(body.messages[1]!.body).toMatch(/Mucho gusto, Ana\./)
  })

  it('el saludo se guarda una sola vez, aunque el cliente siga escribiendo', async () => {
    const { chat, messages } = fakeChat()
    const app = createApp({ chatData: () => chat, publicData: () => publicData(), assistantModel: createAssistantModel })
    await sendGreeted(app, 'Ana')
    await sendGreeted(app, 'quiero ver los precios')
    expect(messages.filter((m) => m.body.includes('¿cómo te llamas?'))).toHaveLength(1)
  })

  it('con el nombre ya dado, el pedido no lo vuelve a preguntar', async () => {
    const { chat } = fakeChat()
    const app = createApp({ chatData: () => chat, publicData: () => publicData(), assistantModel: createAssistantModel })
    await sendGreeted(app, 'Ana Pérez')
    const body = (await (await sendGreeted(app, 'quiero hacer un pedido')).json()) as ChatResponse
    const reply = body.messages.at(-1)!.body
    expect(reply).not.toMatch(/A nombre de quién/)
    expect(reply).toMatch(/persona.*empresa/)
  })

  it('si el cliente no da su nombre sino una consulta, se atiende la consulta y el pedido lo pedirá después', async () => {
    const { chat } = fakeChat()
    const app = createApp({ chatData: () => chat, publicData: () => publicData(), assistantModel: createAssistantModel })
    const first = (await (await sendGreeted(app, '¿cuáles son los precios?')).json()) as ChatResponse
    expect(first.messages.at(-1)!.body).toContain('S/ 100.00')
    const flow = (await (await sendGreeted(app, 'quiero hacer un pedido')).json()) as ChatResponse
    expect(flow.messages.at(-1)!.body).toMatch(/A nombre de quién/)
  })
})
