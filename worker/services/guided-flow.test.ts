import { describe, expect, it } from 'vitest'
import type { CatalogResponse, OrderSubmittedResponse } from '../../shared/api/contracts'
import { runAssistant, createGuidedModel, greetingNameReply, guidedFlowFirst, type HistoryMessage } from './assistant'
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

/** El pedido va directo a elegir la tabla; el nombre y el contacto se piden juntos al final, en un solo mensaje. */
const CONTACT = '987 654 321, ana@example.com, Jr. Lima 123, Tarapoto'
const WITH_NAME = `Ana Pérez, ${CONTACT}`
const YAPE = 'Yape / Plin'
/** Hasta pedir los datos: modelo 1, una unidad, grabado «Ana» y seguir tras ver la vista previa. */
const UP_TO_DATA = ['quiero cotizar', '1', '1', 'Ana', 'continuar']

describe('pedido paso a paso sin IA', () => {
  it('al empezar muestra los modelos: no pregunta el nombre ni si es persona o empresa', async () => {
    const { out } = await chat('quiero hacer un pedido')
    expect(out.text).toMatch(/Responde con el número/)
    expect(out.text).not.toMatch(/A nombre de quién|persona.*empresa|correo|celular/i)
  })

  it('el nombre, el celular, el correo y la dirección se piden juntos al concretar el pedido', async () => {
    const { out } = await chat(...UP_TO_DATA.slice(0, 3), 'no')
    expect(out.text).toMatch(/necesito estos datos:[\s\S]*Tu nombre completo[\s\S]*Tu celular[\s\S]*Tu correo[\s\S]*Tu dirección de entrega/)
    expect(out.text).toMatch(/en un solo mensaje/)
    const confirm = await chat(...UP_TO_DATA, WITH_NAME)
    expect(confirm.out.text).toContain('Este es tu pedido')
    expect(confirm.out.text).toContain('A nombre de: Ana Pérez')
    expect(confirm.out.text).toContain('Entrega en: Jr. Lima 123, Tarapoto')
    expect(confirm.out.text).toContain('987654321')
  })

  it('al resumen le sigue la forma de pago: elegirla confirma el pedido', async () => {
    const { out } = await chat(...UP_TO_DATA, WITH_NAME)
    expect(out.text).toContain('Total a pagar: S/ 100.00')
    expect(out.text).toContain('¿Cómo quieres pagar?')
    expect(out.text).toMatch(/Yape \/ Plin/)
    expect(out.text).toMatch(/agregar otra tabla/)
    expect((await chat(...UP_TO_DATA, WITH_NAME, YAPE)).out.call?.name).toBe('create_order')
  })

  it('al escribir el texto del grabado, Teca muestra cómo queda la tabla antes de seguir con el pedido', async () => {
    const { out } = await chat('quiero cotizar', '1', '1', 'La vida es dura')
    expect(out.text).toContain('Así quedaría «La vida es dura» en la esquina inferior derecha')
    expect(out.text).toMatch(/\[\[vista\|/)
    expect(out.text).toContain('Super Grill')
    // La vista previa va sola: los datos se piden después, no junto a las imágenes.
    expect(out.text).not.toMatch(/necesito estos datos/)
    expect(out.text).toContain('«continuar»')
    expect((await chat('quiero cotizar', '1', '1', 'La vida es dura', 'continuar')).out.text).toMatch(/necesito estos datos/)
    // Sin grabado no hay vista previa.
    expect((await chat('quiero cotizar', '1', '1', 'no')).out.text).not.toMatch(/\[\[vista\|/)
  })

  it('la posición que toca en la vista previa queda anotada en el pedido', async () => {
    const chosen = await chat('quiero cotizar', '1', '1', 'Ana', 'Prefiero la posición Centro')
    expect(chosen.out.text).toContain('dejamos «Ana» en el centro')
    expect(chosen.out.text).toMatch(/necesito estos datos/)
    const summary = await chat('quiero cotizar', '1', '1', 'Ana', 'Prefiero la posición Centro', WITH_NAME)
    expect(summary.out.text).toContain('(grabado: «Ana» · centro)')
    const done = await chat('quiero cotizar', '1', '1', 'Ana', 'Prefiero la posición Centro', WITH_NAME, YAPE)
    expect(done.out.call?.args).toMatchObject({ items: [{ customization: 'Ana · centro' }] })
  })

  it('el depósito aún no está disponible: avisa y vuelve a ofrecer el resumen sin crear el pedido', async () => {
    const { out } = await chat(...UP_TO_DATA, WITH_NAME, 'Depósito')
    expect(out.call).toBeUndefined()
    expect(out.text).toMatch(/depósito no está disponible/)
    expect(out.text).toContain('Este es tu pedido')
  })

  it('«agregar otra tabla» vuelve a los modelos y el resumen junta todo', async () => {
    const more = await chat(...UP_TO_DATA, WITH_NAME, 'Agregar otra tabla')
    expect(more.out.text).toMatch(/Responde con el número/)
    const both = await chat(...UP_TO_DATA, WITH_NAME, 'Agregar otra tabla', '1', '2', 'no')
    expect(both.out.text).toContain('1 × Super Grill · XL')
    expect(both.out.text).toContain('2 × Super Grill · XL')
    expect(both.out.text).toContain('Total a pagar: S/ 300.00')
    // Los datos ya estaban: no se piden otra vez.
    expect(both.out.text).not.toMatch(/necesito estos datos/)
  })

  it('si faltan datos en ese mensaje, pide solo lo que falta', async () => {
    expect((await chat(...UP_TO_DATA, 'Ana Pérez, 987654321, ana@example.com')).out.text).toMatch(/Me falta tu dirección/)
    expect((await chat(...UP_TO_DATA, 'Ana Pérez, 987654321, Jr. Lima 123, Tarapoto')).out.text).toMatch(/Me falta tu correo/)
    expect((await chat(...UP_TO_DATA, 'Ana Pérez, ana@example.com, Jr. Lima 123, Tarapoto')).out.text).toMatch(/Me falta tu celular/)
    expect((await chat(...UP_TO_DATA, '987654321, ana@example.com, Jr. Lima 123, Tarapoto')).out.text).toMatch(/A nombre de quién/)
    expect((await chat(...UP_TO_DATA, 'Ana Pérez, 987654321, ana@example.com', 'Jr. Lima 123, Tarapoto')).out.text).toContain('Este es tu pedido')
  })

  it('si el mensaje no trae ningún dato, lo vuelve a pedir', async () => {
    expect((await chat(...UP_TO_DATA, '123')).out.text).toMatch(/No pude leer tus datos/)
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

  it('lleva un pedido completo hasta crear la orden y, si eligió Yape/Plin, le da los datos de pago de una vez', async () => {
    const { out } = await chat(...UP_TO_DATA, WITH_NAME, YAPE)
    expect(out.call?.name).toBe('create_order')
    const created: unknown[] = []
    const run = (choice: string) =>
      runAssistant({
        model: { generate: async () => out },
        catalog,
        history: [{ role: 'customer', body: choice }],
        hasQuote: false,
        submitQuote: async () => {
          throw new Error('no debe cotizar')
        },
        submitOrder: async (request) => {
          created.push(request)
          return order
        },
      })
    const turn = await run(YAPE)
    expect(turn.order?.code).toBe('PED-000001')
    expect(turn.reply).toContain('Subir captura de pago')
    expect(turn.reply).toContain('• Mensaje del pago: PED-000001')
    expect(turn.reply).not.toContain('¿Cómo quieres pagar?')
    // Mensaje corto: el aviso de plazos y de seguimiento no se repite junto a los datos de pago.
    expect(turn.reply).not.toContain('Consulta tu pedido')
    expect(out.call?.args).toMatchObject({ shippingAddress: 'Jr. Lima 123, Tarapoto', phone: '987654321', customerType: 'individual' })
    expect(created[0]).toMatchObject({ customer: { fullName: 'Ana Pérez', email: 'ana@example.com' }, items: [{ variantId: V1, quantity: 1, customization: 'Ana' }] })
    // Confirmar con «sí» sigue funcionando: entonces se pregunta cómo pagar.
    expect((await run('sí')).reply).toContain('¿Cómo quieres pagar?')
  })

  it('un producto sin precio termina como cotización, y el modelo se reconoce por nombre', async () => {
    const { out } = await chat('quiero pedir Serving Board Grande', '5', 'no', 'Luis Rojas, 999 888 777, luis@example.com, Av. Perú 456, Lima', 'si')
    expect(out.call?.name).toBe('create_quote_request')
    expect(out.call?.args).toMatchObject({ phone: '999888777', items: [{ variantId: V3, quantity: 5 }] })
  })

  it('pregunta cada dato que falta y no se pierde con respuestas inválidas', async () => {
    const { out, history } = await chat('quiero cotizar', '1', 'muchas')
    expect(out.text).toMatch(/Escribe cuántas unidades/)
    expect(out.text).toMatch(/¿Cuántas unidades/)
    expect(history.at(-1)!.body).toContain('Pedido paso a paso')
    const { out: price } = await chat('quiero cotizar', '1', '¿cuánto cuesta?')
    expect(price.text).toContain('S/ 100.00')
    expect(price.text).toMatch(/¿Cuántas unidades/)
  })

  it('más de 100 unidades lo anota para el equipo, con sus datos', async () => {
    const { out } = await chat('quiero cotizar', '1', '500', WITH_NAME)
    expect(out.call?.name).toBe('flag_for_team')
    expect(String(out.call?.args.reason)).toContain('500')
    expect(String(out.call?.args.reason)).toContain('Jr. Lima 123')
  })

  it('se puede cancelar y empezar de nuevo', async () => {
    const { out } = await chat('quiero cotizar', 'cancelar')
    expect(out.text).toMatch(/cancelé/)
    const again = await chat('quiero cotizar', 'cancelar', 'quiero cotizar')
    expect(again.out.text).toMatch(/Responde con el número/)
  })

  it('guidedFlowFirst inicia el pedido al pedir cotizar y no interviene en otras consultas', async () => {
    expect(guidedFlowFirst([{ role: 'customer', body: 'quiero cotizar' }], catalog)?.text).toMatch(/Responde con el número/)
    expect(guidedFlowFirst([{ role: 'customer', body: 'cuéntame sobre la teca' }], catalog)).toBeNull()
    const { history } = await chat('quiero cotizar')
    const next = guidedFlowFirst([...history, { role: 'customer', body: '1' }], catalog)
    expect(next?.text).toMatch(/¿Cuántas unidades/)
  })

  it('una consulta de precios no inicia el pedido', async () => {
    const { out } = await chat('Ver los precios')
    expect(out.text).toContain('S/ 100.00')
    expect(out.text).not.toContain('Pedido paso a paso')
  })

  it('un pedido que llega de la web con el modelo y el grabado ya escritos no los vuelve a preguntar', async () => {
    const { out } = await chat('Quiero pedir Super Grill · XL. Grabado: "Ana" / "Luis" · Posición: Esquina · Letra: Clásica')
    expect(out.text).toMatch(/¿Cuántas unidades quieres de Super Grill · XL/)
    const done = await chat('Quiero pedir Super Grill · XL. Grabado: "Ana" · Posición: Esquina', '2', WITH_NAME, YAPE)
    expect(done.out.call?.args).toMatchObject({ items: [{ variantId: V1, quantity: 2, customization: 'Ana' }] })
  })

  it('un pedido con logo siempre queda como cotización para que el equipo coordine el archivo', async () => {
    const { out } = await chat('Quiero cotizar 20 tablas con el logo de mi empresa (archivo logo.png)', 'Acme SAC', '1', 'no', 'Luis Rojas, 987654321, luis@acme.pe, Av. Industrial 99, Lima', 'sí')
    expect(out.call?.name).toBe('create_quote_request')
    expect(JSON.stringify(out.call?.args)).toContain('logo.png')
    expect(out.call?.args).toMatchObject({ customerType: 'business', companyName: 'Acme SAC', fullName: 'Luis Rojas', items: [{ quantity: 20 }] })
  })

  it('una empresa se reconoce desde el primer mensaje y solo se le pide el nombre de su empresa', async () => {
    const { out } = await chat('Pedido para mi empresa')
    expect(out.text).toMatch(/Cómo se llama tu empresa/)
    expect((await chat('Pedido para mi empresa', 'Acme SAC')).out.text).toMatch(/Responde con el número/)
  })

  it('el nombre de una medida corta («L») no se confunde con letras de otras palabras', async () => {
    const { out } = await chat('Quiero cotizar 20 tablas con el logo de mi empresa', 'Acme SAC')
    expect(out.text).toMatch(/Responde con el número/)
  })

  it('si la pieza no está en el catálogo, la anota para el equipo', async () => {
    const { out } = await chat('Quiero cotizar una tabla a medida', WITH_NAME)
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

  it('el pedido usa el nombre dado en el saludo: al final no se lo vuelve a pedir', () => {
    const greeting = { role: 'assistant' as const, body: '¡Hola! Soy Teca. Para empezar, ¿cómo te llamas?' }
    const history: HistoryMessage[] = [greeting, { role: 'customer', body: 'Ana Pérez' }, { role: 'assistant', body: 'Mucho gusto, Ana.' }]
    expect(nameFromGreeting(history)).toBe('Ana Pérez')
    let out = guidedFlowFirst([...history, { role: 'customer', body: 'quiero hacer un pedido' }], catalog)!
    expect(out.text).toMatch(/Responde con el número/)
    history.push({ role: 'customer', body: 'quiero hacer un pedido' })
    for (const answer of ['1', '1', 'no']) {
      history.push({ role: 'assistant', body: out.text }, { role: 'customer', body: answer })
      out = guidedFlowFirst(history, catalog)!
    }
    expect(out.text).toMatch(/necesito estos datos/)
    expect(out.text).not.toMatch(/Tu nombre completo/)
    history.push({ role: 'assistant', body: out.text }, { role: 'customer', body: CONTACT })
    expect(guidedFlowFirst(history, catalog)!.text).toContain('A nombre de: Ana Pérez')
    // Sin nombre en el saludo, el nombre se pide junto con los datos.
    expect(guidedFlowFirst([greeting, { role: 'customer', body: 'quiero hacer un pedido' }], catalog)?.text).toMatch(/Responde con el número/)
  })
})

describe('saludo junto con el nombre', () => {
  it('«Hola, me llamo Hugo» se entiende como el nombre Hugo', () => {
    expect(looksLikeName('Hola, me llamo Hugo.')).toBe('Hugo')
    expect(looksLikeName('hola soy María José')).toBe('María José')
    expect(looksLikeName('Buenas tardes, mi nombre es Luis Rojas')).toBe('Luis Rojas')
    expect(looksLikeName('¡Hola! Hugo')).toBe('Hugo')
    expect(looksLikeName('Hola buenas, soy Hugo')).toBe('Hugo')
  })

  it('un saludo solo, o con una consulta, no es un nombre', () => {
    for (const text of ['Hola', 'hola!', 'Buenas tardes', 'hola, quiero ver los precios', 'hola ¿cuánto cuesta?']) {
      expect(looksLikeName(text), text).toBeNull()
    }
  })

  it('Teca devuelve el saludo y usa el nombre', () => {
    const greeting = { role: 'assistant' as const, body: '¡Hola! Soy Teca. Para empezar, ¿cómo te llamas?' }
    expect(greetingNameReply([greeting, { role: 'customer', body: 'Hola, me llamo Hugo.' }])).toBe('¡Hola, Hugo! Mucho gusto. ¿Qué te interesa: precios, plazos, grabado o hacer un pedido?')
    expect(greetingNameReply([greeting, { role: 'customer', body: 'Ana' }])).toBe('Mucho gusto, Ana. ¿Qué te interesa: precios, plazos, grabado o hacer un pedido?')
    expect(greetingNameReply([greeting, { role: 'customer', body: 'Hola' }])).toBe('¡Hola! Mucho gusto. Para empezar, ¿cómo te llamas?')
    expect(greetingNameReply([greeting, { role: 'customer', body: 'Gracias' }])).toBeNull()
  })

  it('el pedido que sigue usa ese nombre sin volver a preguntarlo', () => {
    const history = [
      { role: 'assistant' as const, body: '¡Hola! Soy Teca. Para empezar, ¿cómo te llamas?' },
      { role: 'customer' as const, body: 'Hola, me llamo Hugo.' },
      { role: 'assistant' as const, body: '¡Hola, Hugo! Mucho gusto.' },
      { role: 'customer' as const, body: 'quiero hacer un pedido' },
    ]
    expect(nameFromGreeting(history)).toBe('Hugo')
    expect(guidedFlowFirst(history, catalog)?.text).toMatch(/Responde con el número/)
  })
})
