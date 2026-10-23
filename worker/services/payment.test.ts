import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { CatalogResponse, QuoteSubmittedResponse } from '../../shared/api/contracts'
import { paymentChatText, paymentLines, yapePlin } from '../../src/content/payment'
import { buildSystemPrompt, createGuidedModel, runAssistant } from './assistant'

const VARIANT = '3f2b8c1e-5d4a-4e7b-9a10-2c6d8e9f0a1b'

const catalog: CatalogResponse = {
  currency: 'PEN',
  products: [
    {
      id: 'p1', slug: 'super-grill', name: 'Super Grill', description: null, category: null, isCustomizable: true,
      variants: [{ id: VARIANT, sku: 'SG-XL', name: 'XL', dimensionsLabel: '65*46*4', price: 100, priceTiers: [] }],
    },
  ],
}

const quote: QuoteSubmittedResponse = {
  quoteId: '9f2b8c1e-5d4a-4e7b-9a10-2c6d8e9f0a1b', code: 'COT-000007', status: 'submitted', requiresReview: true,
  subtotal: 200, total: 200, currency: 'PEN', items: [],
}

const original = { ...yapePlin }
// Cada prueba parte de «sin número» y fija lo que necesita; al terminar se restaura lo real.
beforeEach(() => Object.assign(yapePlin, { number: null, holder: null }))
afterEach(() => Object.assign(yapePlin, original))
const configure = () => Object.assign(yapePlin, { number: '987 654 321', holder: 'Woodland Perú' })

const ask = (text: string) => createGuidedModel(catalog).generate({ system: '', history: [{ role: 'customer', body: 'hola' }, { role: 'customer', body: text }] })

describe('pago por Yape / Plin', () => {
  it('sin número cargado no muestra ningún dato de pago', () => {
    expect(paymentLines('COT-1')).toBeNull()
    expect(paymentChatText('COT-1')).toBeNull()
  })

  it('con número arma las instrucciones con el código y sin prometer que el pago se confirmó', () => {
    configure()
    const text = paymentChatText('COT-000007')!
    expect(text).toContain('987 654 321')
    expect(text).toContain('Woodland Perú')
    expect(text).toContain('COT-000007')
    expect(text).toMatch(/monto final/)
    expect(text).not.toMatch(/pago (recibido|confirmado)/i)
  })

  it('el modo guiado (sin API de IA) responde cómo pagar', async () => {
    expect((await ask('¿Cómo puedo pagar? ¿aceptan Yape?')).text).toMatch(/comparte los datos de pago cuando confirme/)
    expect((await ask('¿Cómo puedo pagar?')).text).not.toMatch(/\d{3} \d{3} \d{3}/)
    configure()
    const reply = (await ask('¿Cómo puedo pagar? ¿aceptan Yape?')).text
    expect(reply).toContain('987 654 321')
    expect(reply).toMatch(/Yape o Plin/)
  })

  it('al registrar una cotización por chat, la respuesta trae cómo pagar (si hay número)', async () => {
    const turn = async () =>
      runAssistant({
        model: { generate: async () => ({ text: '', call: { name: 'create_quote_request', args: { fullName: 'Ana', email: 'ana@example.com', items: [{ variantId: VARIANT, quantity: 2 }] } } }) },
        catalog,
        history: [{ role: 'customer', body: 'sí' }],
        hasQuote: false,
        submitQuote: async () => quote,
      })
    const without = await turn()
    expect(without.reply).toContain('COT-000007')
    expect(without.reply).not.toContain('Para pagar')
    configure()
    const withPay = await turn()
    expect(withPay.reply).toContain('COT-000007')
    expect(withPay.reply).toContain('Para pagar: Yape o Plin al número 987 654 321')
  })

  it('el prompt del modelo solo conoce el número cuando está cargado', () => {
    expect(buildSystemPrompt(catalog)).toContain('Aún no hay un número de Yape/Plin')
    expect(buildSystemPrompt(catalog)).not.toContain('987 654 321')
    configure()
    const prompt = buildSystemPrompt(catalog)
    expect(prompt).toContain('987 654 321')
    expect(prompt).toContain('Nunca digas que el pago se confirmó')
  })
})

describe('datos reales cargados', () => {
  it('el número y el titular del administrador están configurados', () => {
    expect(original.number).toBe('965 402 725')
    expect(original.holder).toBe('Alex Cárdenas Inchaústegui')
  })
})
