import { describe, expect, it, vi } from 'vitest'
import type {
  ApiErrorBody,
  CatalogResponse,
  OrderStatusResponse,
  QuoteSubmittedResponse,
} from '../../shared/api/contracts'
import { quoteRequestSchema } from '../../shared/api/public-schemas'
import { createApp } from '../app'
import { PublicDataError, type PublicData, type PublicDataFactory } from '../data/public-data'
import { buildCatalog, toQuoteRpcPayload } from '../data/supabase-public'

const VARIANT_ID = '3f2b8c1e-5d4a-4e7b-9a10-2c6d8e9f0a1b'
const REQUEST_ID = '8a1d2c3e-4b5f-4a6b-8c7d-9e0f1a2b3c4d'

const quoteBody = {
  requestId: REQUEST_ID,
  customer: { type: 'individual', fullName: 'Ana Pérez', email: 'ana@example.com' },
  items: [{ variantId: VARIANT_ID, quantity: 2 }],
}

const quoteResponse: QuoteSubmittedResponse = {
  quoteId: 'q-1',
  code: 'COT-000001',
  status: 'submitted',
  requiresReview: true,
  subtotal: 0,
  total: 0,
  currency: 'PEN',
  items: [],
}

const orderResponse: OrderStatusResponse = {
  code: 'PED-000001',
  status: 'confirmed',
  paymentStatus: 'unpaid',
  total: 100,
  currency: 'PEN',
  deliveryEstimateNote: null,
  createdAt: '2026-10-17T10:00:00Z',
  items: [{ description: 'Super Grill · XL', quantity: 1 }],
}

function fakeData(overrides: Partial<PublicData> = {}) {
  const data: PublicData = {
    listCatalog: vi.fn(async (): Promise<CatalogResponse> => ({ currency: 'PEN', products: [] })),
    submitQuote: vi.fn(async () => quoteResponse),
    getOrderStatus: vi.fn(async () => orderResponse),
    submitOrder: vi.fn(async () => ({ orderId: 'o1', code: 'PED-000001', status: 'confirmed', confirmed: true, total: 100, currency: 'PEN' as const })),
    ...overrides,
  }
  return data
}

function post(path: string, body: unknown, data: PublicData | null, env: Partial<Env> = {}) {
  const factory: PublicDataFactory = () => data
  const app = createApp({ publicData: factory })
  return app.request(
    path,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) },
    { APP_ENV: 'development', ...env } as Env,
  )
}

const errorOf = async (res: Response) => ((await res.json()) as ApiErrorBody).error

describe('GET /api/catalog', () => {
  it('devuelve el catálogo con caché corta', async () => {
    const app = createApp({ publicData: () => fakeData() })
    const res = await app.request('/api/catalog', {}, { APP_ENV: 'development' } as Env)
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toContain('s-maxage=60')
    expect(((await res.json()) as CatalogResponse).currency).toBe('PEN')
  })

  it('responde 503 si la base no está configurada', async () => {
    const app = createApp({ publicData: () => null })
    const res = await app.request('/api/catalog', {}, { APP_ENV: 'development' } as Env)
    expect(res.status).toBe(503)
    expect((await errorOf(res)).code).toBe('data_not_configured')
  })

  it('responde 500 genérico si la base falla', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const app = createApp({ publicData: () => fakeData({ listCatalog: async () => { throw new Error('boom') } }) })
    const res = await app.request('/api/catalog', {}, { APP_ENV: 'development' } as Env)
    expect(res.status).toBe(500)
    expect((await errorOf(res)).code).toBe('internal_error')
    spy.mockRestore()
  })
})

describe('POST /api/quotes', () => {
  it('crea la cotización con una solicitud válida', async () => {
    const data = fakeData()
    const res = await post('/api/quotes', quoteBody, data)
    expect(res.status).toBe(201)
    expect(((await res.json()) as QuoteSubmittedResponse).code).toBe('COT-000001')
    expect(data.submitQuote).toHaveBeenCalledOnce()
  })

  it('normaliza el teléfono y descarta campos desconocidos (precios del cliente)', async () => {
    const data = fakeData()
    const body = {
      ...quoteBody,
      customer: { type: 'individual', fullName: 'Ana', phone: '+51 987-654 321' },
      items: [{ variantId: VARIANT_ID, quantity: 1, unitPrice: 1 }],
    }
    await post('/api/quotes', body, data)
    const sent = vi.mocked(data.submitQuote).mock.calls[0][0]
    expect(sent.customer.phone).toBe('+51987654321')
    expect(sent.items[0]).not.toHaveProperty('unitPrice')
  })

  it('rechaza JSON mal formado con 400', async () => {
    const res = await post('/api/quotes', '{no es json', fakeData())
    expect(res.status).toBe(400)
    expect((await errorOf(res)).code).toBe('invalid_json')
  })

  it.each([
    ['sin contacto', { ...quoteBody, customer: { type: 'individual', fullName: 'Ana' } }],
    ['empresa sin razón social', { ...quoteBody, customer: { type: 'business', fullName: 'Ana', email: 'a@b.co' } }],
    ['documento incompleto', { ...quoteBody, customer: { ...quoteBody.customer, documentType: 'DNI' } }],
    ['correo inválido', { ...quoteBody, customer: { ...quoteBody.customer, email: 'ana' } }],
    ['sin productos', { ...quoteBody, items: [] }],
    ['cantidad cero', { ...quoteBody, items: [{ variantId: VARIANT_ID, quantity: 0 }] }],
    ['sobre el tope web de 100 unidades', { ...quoteBody, items: [{ variantId: VARIANT_ID, quantity: 101 }] }],
    ['a medida sin descripción', { ...quoteBody, items: [{ quantity: 1 }] }],
    ['requestId inválido', { ...quoteBody, requestId: 'abc' }],
  ])('rechaza con 422: %s', async (_name, body) => {
    const data = fakeData()
    const res = await post('/api/quotes', body, data)
    expect(res.status).toBe(422)
    expect((await errorOf(res)).code).toBe('invalid_request')
    expect(data.submitQuote).not.toHaveBeenCalled()
  })

  it('acepta una empresa con documento completo y un producto a medida', () => {
    const parsed = quoteRequestSchema.safeParse({
      requestId: REQUEST_ID,
      customer: {
        type: 'business',
        fullName: 'Luis',
        companyName: 'Acme SAC',
        documentType: 'RUC',
        documentNumber: '20123456789',
        phone: '987654321',
      },
      items: [{ description: 'Tabla 120x60 grabada', quantity: 3, customization: 'Logo' }],
    })
    expect(parsed.success).toBe(true)
  })

  it('traduce los errores de negocio de la base a 422', async () => {
    const data = fakeData({
      submitQuote: async () => {
        throw new PublicDataError('invalid_request', 'El producto 1 no existe o no está disponible.')
      },
    })
    const res = await post('/api/quotes', quoteBody, data)
    expect(res.status).toBe(422)
    expect((await errorOf(res)).message).toBe('El producto 1 no existe o no está disponible.')
  })

  it('rechaza cuerpos demasiado grandes con 413', async () => {
    const big = { ...quoteBody, message: 'x'.repeat(70 * 1024) }
    const res = await post('/api/quotes', big, fakeData())
    expect(res.status).toBe(413)
  })

  it('responde 429 cuando se excede el límite y no toca la base', async () => {
    const data = fakeData()
    const limiter = { limit: vi.fn(async () => ({ success: false })) }
    const res = await post('/api/quotes', quoteBody, data, { PUBLIC_RATE_LIMITER: limiter as unknown as RateLimit })
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('60')
    expect(data.submitQuote).not.toHaveBeenCalled()
  })

  it('responde 503 si la base no está configurada', async () => {
    const res = await post('/api/quotes', quoteBody, null)
    expect(res.status).toBe(503)
  })
})

describe('POST /api/orders/status', () => {
  it('devuelve el estado con código y contacto válidos', async () => {
    const data = fakeData()
    const res = await post('/api/orders/status', { code: 'ped-000001', contact: 'ana@example.com' }, data)
    expect(res.status).toBe(200)
    expect(((await res.json()) as OrderStatusResponse).status).toBe('confirmed')
    expect(data.getOrderStatus).toHaveBeenCalledWith({ code: 'PED-000001', contact: 'ana@example.com' })
  })

  it('responde 404 genérico si no hay coincidencia', async () => {
    const res = await post('/api/orders/status', { code: 'PED-000009', contact: 'x@y.co' }, fakeData({ getOrderStatus: async () => null }))
    expect(res.status).toBe(404)
    expect((await errorOf(res)).code).toBe('order_not_found')
  })

  it('rechaza códigos mal formados con 422', async () => {
    const res = await post('/api/orders/status', { code: '123', contact: 'ana@example.com' }, fakeData())
    expect(res.status).toBe(422)
  })

  it('aplica el límite de solicitudes', async () => {
    const limiter = { limit: vi.fn(async () => ({ success: false })) }
    const res = await post('/api/orders/status', { code: 'PED-000001', contact: 'ana@example.com' }, fakeData(), {
      PUBLIC_RATE_LIMITER: limiter as unknown as RateLimit,
    })
    expect(res.status).toBe(429)
  })
})

describe('transformaciones de datos', () => {
  const rows = [
    {
      id: 'p2', slug: 'b', name: 'B', description: null, is_customizable: false, sort_order: 2, category: null,
      variants: [],
    },
    {
      id: 'p1', slug: 'a', name: 'A', description: 'd', is_customizable: true, sort_order: 1, category: { slug: 'c', name: 'C' },
      variants: [
        {
          id: 'v2', sku: 'A-L', name: 'L', dimensions_label: null, catalog_price: null, sort_order: 2, price_tiers: [],
        },
        {
          id: 'v1', sku: 'A-S', name: 'S', dimensions_label: '65*46*4', catalog_price: 100,
          sort_order: 1, price_tiers: [{ min_quantity: 10, unit_price: 80 }, { min_quantity: 5, unit_price: 90 }],
        },
        {
          id: 'v3', sku: 'A-M', name: 'M', dimensions_label: null, catalog_price: null,
          sort_order: 3, price_tiers: [],
        },
      ],
    },
  ]

  it('ordena, omite productos sin variantes activas y no expone stock ni disponibilidad', () => {
    const catalog = buildCatalog(rows)
    expect(catalog.products.map((p) => p.id)).toEqual(['p1'])
    const variants = catalog.products[0].variants
    expect(variants.map((v) => v.id)).toEqual(['v1', 'v2', 'v3'])
    expect(variants[0].priceTiers).toEqual([
      { minQuantity: 5, unitPrice: 90 },
      { minQuantity: 10, unitPrice: 80 },
    ])
    expect(JSON.stringify(catalog)).not.toMatch(/availability|stock|fulfillment/i)
    expect(variants[1].price).toBeNull()
  })

  it('arma el payload de la función SQL con canal web y sin precios', () => {
    const payload = toQuoteRpcPayload(quoteRequestSchema.parse(quoteBody))
    expect(payload.channel).toBe('web')
    expect(payload.request_id).toBe(REQUEST_ID)
    expect(payload.items[0]).toEqual({
      variant_id: VARIANT_ID, description: null, quantity: 2, custom_dimensions: null, customization: null,
    })
  })
})
