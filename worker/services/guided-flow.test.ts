import { describe, expect, it } from 'vitest'
import type { CatalogResponse, OrderSubmittedResponse } from '../../shared/api/contracts'
import { runAssistant, createGuidedModel, guidedFlowFirst, type HistoryMessage } from './assistant'
import { parseCustomerData } from './customer-data'
import { looksLikeName, nameFromGreeting } from './guided-flow'

const V1 = '3f2b8c1e-5d4a-4e7b-9a10-2c6d8e9f0a1b'
const V2 = '4f2b8c1e-5d4a-4e7b-9a10-2c6d8e9f0a1b'
const V3 = '5f2b8c1e-5d4a-4e7b-9a10-2c6d8e9f0a1b'

const catalog: CatalogResponse = {
  currency: 'PEN',
  products: [
    { id: 'p1', slug: 'grill', name: 'Super Grill', description: null, category: null, isCustomizable: true, variants: [{ id: V1, sku: 'SG-XL', name: 'XL', dimensionsLabel: '65x46', price: 100, priceTiers: [] }] },
    {
      id: 'p2', slug: 'serving', name: 'Serving Board', description: null, category: null, isCustomizable: false,
      variants: [
        { id: V2, sku: 'SB-S', name: 'Pequeña', dimensionsLabel: null, price: 50, priceTiers: [] },
        { id: V3, sku: 'SB-L', name: 'Grande', dimensionsLabel: null, price: null, priceTiers: [] },
      ],
    },
  ],
}

const order: OrderSubmittedResponse = { orderId: 'o1', code: 'PED-000001', total: 100, currency: 'PEN', confirmed: true } as OrderSubmittedResponse

/** Conversa turno a turno con el modo guiado (sin IA) y devuelve la última salida. */
async function chat(...messages: string[]) {
  const model = createGuidedModel(catalog)
  const history: HistoryMessage[] = []
  let out = await model.generate({ system: '', history: [{ role: 'customer', body: 'hola' }] })
  history.push({ role: 'customer', body: 'hola' }, { role: 'assistant', body: out.text })
  for (const body of messages) {
    history.push({ role: 'customer', body })
    out = await model.generate({ system: '', history })
    history.push({ role: 'assistant', body: out.text })
  }
  return { out, history }
}

/** Al empezar solo se pide el nombre; después, persona o empresa. El resto de los datos se piden al concretar el pedido. */
const START = ['Ana Pérez', 'persona']
const CONTACT = '987 654 321, ana@example.com, Jr. Lima 123, Tarapoto'

describe('pedido paso a paso sin IA', () => {
  it('al empezar pide solamente el nombre', async () => {
    const { out } = await chat('quiero hacer un pedido')
    expect(out.text).toMatch(/A nombre de quién/)
    expect(out.text).not.toMatch(/correo|celular|direcci[oó]n/i)
    expect((await chat('quiero hacer un pedido', 'Ana Pérez')).out.text).toMatch(/persona.*empresa/)
    expect((await chat('quiero hacer un pedido', ...START)).out.text).toMatch(/Responde con el número/)
  })

  it('el celular, el correo y la dirección se piden al concretar el pedido, en un solo mensaje', async () => {
    const { out } = await chat('quiero cotizar', ...START, '1', '1', 'Ana', 'no')
    expect(out.text).toMatch(/necesito tu celular, tu correo y tu dirección de entrega/)
    expect(out.text).toMatch(/en un solo mensaje/)
    const confirm = await chat('quiero cotizar', ...START, '1', '1', 'Ana', 'no', CONTACT)
    expect(confirm.out.text).toContain('Este es tu pedido')
    expect(confirm.out.text).toContain('Entrega en: Jr. Lima 123, Tarapoto')
    expect(confirm.out.text).toContain('987654321')
  })

  it('si faltan datos en ese mensaje, pide solo lo que falta', async () => {
    const upTo = ['quiero cotizar', ...START, '1', '1', 'Ana', 'no']
    expect((await chat(...upTo, '987654321, ana@example.com')).out.text).toMatch(/Me falta tu dirección/)
    expect((await chat(...upTo, '987654321, Jr. Lima 123, Tarapoto')).out.text).toMatch(/Me falta tu correo/)
    expect((await chat(...upTo, 'ana@example.com, Jr. Lima 123, Tarapoto')).out.text).toMatch(/Me falta tu celular/)
    expect((await chat(...upTo, '987654321, ana@example.com', 'Jr. Lima 123, Tarapoto')).out.text).toContain('Este es tu pedido')
  })

  it('si el mensaje no trae ningún dato, lo vuelve a pedir', async () => {
    expect((await chat('quiero cotizar', ...START, '1', '1', 'Ana', 'no', '123')).out.text).toMatch(/No pude leer tus datos/)
  })

  it('lee los datos con etiquetas, en varias líneas y con celular con espacios o +51', () => {
    expect(parseCustomerData('Nombre: Luis Rojas\nCorreo: luis@acme.pe\nCelular: +51 999 888 777\nDirección: Av. Perú 456, Lima')).toEqual({
      name: 'Luis Rojas',
      email: 'luis@acme.pe',
      phone: '+51999888777',
      address: 'Av. Perú 456, Lima',
    })
    expect(parseCustomerData('Soy María Ríos, maria@x.com, 987 654 321, Calle Los Pinos 25 Mz B, San Martín')).toMatchObject({
      name: 'María Ríos',
      phone: '987654321',
      address: 'Calle Los Pinos 25 Mz B, San Martín',
    })
  })

  it('sin nombre en el mensaje, la primera parte de la dirección no se confunde con un nombre', () => {
    expect(parseCustomerData('987654321, luis@acme.pe, Jr. Lima, Tarapoto', { withName: false })).toEqual({
      email: 'luis@acme.pe',
      phone: '987654321',
      address: 'Jr. Lima, Tarapoto',
    })
  })

  it('lleva un pedido completo hasta crear la orden', async () => {
    const { out } = await chat('quiero cotizar', ...START, '1', '1', 'Ana', 'no', CONTACT, 'sí')
    expect(out.call?.name).toBe('create_order')
    const created: unknown[] = []
    const turn = await runAssistant({
      model: { generate: async () => out },
      catalog,
      history: [{ role: 'customer', body: 'sí' }],
      hasQuote: false,
      submitQuote: async () => {
        throw new Error('no debe cotizar')
      },
      submitOrder: async (request) => {
        created.push(request)
        return order
      },
    })
    expect(turn.order?.code).toBe('PED-000001')
    expect(out.call?.args).toMatchObject({ shippingAddress: 'Jr. Lima 123, Tarapoto', phone: '987654321' })
    expect(created[0]).toMatchObject({ customer: { fullName: 'Ana Pérez', email: 'ana@example.com' }, items: [{ variantId: V1, quantity: 1, customization: 'Ana' }] })
  })

  it('un producto sin precio termina como cotización, y el modelo se reconoce por nombre', async () => {
    const { out } = await chat('quiero pedir Serving Board Grande', 'Luis Rojas', 'persona', '5', 'no', 'no', '999 888 777, luis@example.com, Av. Perú 456, Lima', 'si')
    expect(out.call?.name).toBe('create_quote_request')
    expect(out.call?.args).toMatchObject({ phone: '999888777', items: [{ variantId: V3, quantity: 5 }] })
  })

  it('pregunta cada dato que falta y no se pierde con respuestas inválidas', async () => {
    const { out, history } = await chat('quiero cotizar', ...START, '1', 'muchas')
    expect(out.text).toMatch(/Escribe cuántas unidades/)
    expect(out.text).toMatch(/¿Cuántas unidades/)
    expect(history.at(-1)!.body).toContain('Pedido paso a paso')
    const { out: price } = await chat('quiero cotizar', ...START, '1', '¿cuánto cuesta?')
    expect(price.text).toContain('S/ 100.00')
    expect(price.text).toMatch(/¿Cuántas unidades/)
  })

  it('más de 100 unidades lo anota para el equipo, con sus datos', async () => {
    const { out } = await chat('quiero cotizar', ...START, '1', '500', CONTACT)
    expect(out.call?.name).toBe('flag_for_team')
    expect(String(out.call?.args.reason)).toContain('500')
    expect(String(out.call?.args.reason)).toContain('Jr. Lima 123')
  })

  it('se puede cancelar y empezar de nuevo', async () => {
    const { out } = await chat('quiero cotizar', 'cancelar')
    expect(out.text).toMatch(/cancelé/)
    const again = await chat('quiero cotizar', 'cancelar', 'quiero cotizar')
    expect(again.out.text).toMatch(/A nombre de quién/)
  })

  it('guidedFlowFirst inicia el pedido al pedir cotizar y no interviene en otras consultas', async () => {
    expect(guidedFlowFirst([{ role: 'customer', body: 'quiero cotizar' }], catalog)?.text).toMatch(/A nombre de quién/)
    expect(guidedFlowFirst([{ role: 'customer', body: 'cuéntame sobre la teca' }], catalog)).toBeNull()
    const { history } = await chat('quiero cotizar')
    const next = guidedFlowFirst([...history, { role: 'customer', body: 'Ana Pérez' }], catalog)
    expect(next?.text).toMatch(/persona.*empresa/)
  })

  it('una consulta de precios no inicia el pedido', async () => {
    const { out } = await chat('Ver los precios')
    expect(out.text).toContain('S/ 100.00')
    expect(out.text).not.toContain('Pedido paso a paso')
  })

  it('un pedido que llega de la web con el modelo y el grabado ya escritos no los vuelve a preguntar', async () => {
    const { out } = await chat('Quiero pedir Super Grill · XL. Grabado: "Ana" / "Luis" · Posición: Esquina · Letra: Clásica', ...START)
    expect(out.text).toMatch(/¿Cuántas unidades quieres de Super Grill · XL/)
    const done = await chat('Quiero pedir Super Grill · XL. Grabado: "Ana" · Posición: Esquina', ...START, '2', 'no', CONTACT, 'sí')
    expect(done.out.call?.args).toMatchObject({ items: [{ variantId: V1, quantity: 2, customization: 'Ana' }] })
  })

  it('un pedido con logo siempre queda como cotización para que el equipo coordine el archivo', async () => {
    const { out } = await chat('Quiero cotizar 20 tablas con el logo de mi empresa (archivo logo.png)', 'Luis Rojas', 'empresa', 'Acme SAC', '1', 'no', 'no', '987654321, luis@acme.pe, Av. Industrial 99, Lima', 'sí')
    expect(out.call?.name).toBe('create_quote_request')
    expect(JSON.stringify(out.call?.args)).toContain('logo.png')
    expect(out.call?.args).toMatchObject({ customerType: 'business', companyName: 'Acme SAC', fullName: 'Luis Rojas', items: [{ quantity: 20 }] })
  })

  it('el nombre de una medida corta («L») no se confunde con letras de otras palabras', async () => {
    const { out } = await chat('Quiero cotizar 20 tablas con el logo de mi empresa', ...START)
    expect(out.text).toMatch(/Responde con el número/)
  })

  it('si la pieza no está en el catálogo, la anota para el equipo', async () => {
    const { out } = await chat('Quiero cotizar una tabla a medida', ...START, CONTACT)
    expect(out.call?.name).toBe('flag_for_team')
  })
})

describe('el nombre que se da en el saludo', () => {
  it('reconoce nombres y descarta consultas, saludos y datos', () => {
    expect(looksLikeName('Ana')).toBe('Ana')
    expect(looksLikeName('me llamo Ana Pérez')).toBe('Ana Pérez')
    expect(looksLikeName('Soy luis.')).toBe('luis')
    expect(looksLikeName("María José O'Brien")).toBe("María José O'Brien")
    for (const text of ['quiero hacer un pedido', '¿cuánto cuesta?', 'hola', 'precios', 'persona', 'ana@x.com', '987654321', 'gracias', 'Ver los productos', 'no']) {
      expect(looksLikeName(text), text).toBeNull()
    }
  })

  it('el pedido usa el nombre dado en el saludo y salta esa pregunta', () => {
    const greeting = { role: 'assistant' as const, body: '¡Hola! Soy Teca. Para empezar, ¿cómo te llamas?' }
    const history = [greeting, { role: 'customer' as const, body: 'Ana Pérez' }, { role: 'assistant' as const, body: 'Mucho gusto, Ana.' }, { role: 'customer' as const, body: 'quiero hacer un pedido' }]
    expect(nameFromGreeting(history)).toBe('Ana Pérez')
    expect(guidedFlowFirst(history, catalog)?.text).toMatch(/persona.*empresa/)
    // Sin nombre en el saludo, el pedido lo pide.
    expect(guidedFlowFirst([greeting, { role: 'customer', body: 'quiero hacer un pedido' }], catalog)?.text).toMatch(/A nombre de quién/)
  })
})
