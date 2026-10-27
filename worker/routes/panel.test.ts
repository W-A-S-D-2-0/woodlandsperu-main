import { describe, expect, it, vi } from 'vitest'
import type { ApiErrorBody, StaffIdentity } from '../../shared/api/contracts'
import { createApp } from '../app'
import { generateTestKeys } from '../integrations/test-keys'
import type { StaffAuthProvider } from '../auth/staff-auth'
import { PanelDataError, type PanelData } from '../data/panel-data'
import { directOrderBody } from '../../shared/api/panel-schemas'
import { camelize, mapDbError, toDirectOrderPayload, sanitizeSearch, toDashboard, toInventoryLevel, toPanelProduct, toQuoteListItem } from '../data/supabase-panel'

const ID = '3f2b8c1e-5d4a-4e7b-9a10-2c6d8e9f0a1b'
const ADMIN = 'token.admin'
const WORKSHOP = 'token.taller'

const staff: Record<string, StaffIdentity> = {
  [ADMIN]: { userId: 'u-admin', role: 'admin', fullName: 'Admin' },
  [WORKSHOP]: { userId: 'u-taller', role: 'workshop', fullName: 'Taller' },
}
const provider: StaffAuthProvider = {
  verifyAccessToken: async (token) => (token in staff ? `user-${token}` : null),
  findActiveStaff: async (token) => staff[token] ?? null,
}

const movement = {
  id: 1, variantId: ID, movementType: 'production_in' as const, quantity: 3, onHandAfter: 3, reservedAfter: 0,
  orderId: null, reason: null, actorRole: 'workshop', createdAt: '2026-10-17T10:00:00Z',
}

function fakeData(): PanelData {
  const empty = { items: [] }
  return {
    getDashboard: vi.fn(async () => ({}) as never),
    listProducts: vi.fn(async () => empty),
    updateProduct: vi.fn(async () => {}),
    updateVariant: vi.fn(async () => {}),
    listInventory: vi.fn(async () => empty),
    listMovements: vi.fn(async () => empty),
    applyMovement: vi.fn(async () => movement),
    updateInventorySettings: vi.fn(async () => {}),
    listQuotes: vi.fn(async () => empty),
    getQuote: vi.fn(async () => ({ id: ID }) as never),
    setQuoteItemPrice: vi.fn(async () => {}),
    sendQuote: vi.fn(async () => {}),
    acceptQuote: vi.fn(async () => {}),
    cancelQuote: vi.fn(async () => {}),
    convertQuote: vi.fn(async () => 'order-1'),
    listOrders: vi.fn(async () => empty),
    getOrder: vi.fn(async () => ({ id: ID }) as never),
    createDirectOrder: vi.fn(async () => 'order-9'),
    confirmOrder: vi.fn(async () => {}),
    setOrderStatus: vi.fn(async () => {}),
    dispatchOrder: vi.fn(async () => {}),
    cancelOrder: vi.fn(async () => {}),
    updateOrder: vi.fn(async () => {}),
    listCustomers: vi.fn(async () => empty),
    getCustomer: vi.fn(async () => ({ id: ID }) as never),
    addCustomerNote: vi.fn(async () => {}),
    listConversations: vi.fn(async () => empty),
    getConversation: vi.fn(async () => null),
    setConversationStatus: vi.fn(async () => {}),
    deleteConversation: vi.fn(async () => {}),
    getMessageAttachment: vi.fn(async () => null),
    getReportSource: vi.fn(async () => ({ conversations: [], quotes: [], orders: [], inventory: [], truncated: false })),
  }
}

function call(method: string, path: string, opts: { token?: string; body?: unknown; data?: PanelData | null } = {}) {
  const { token = ADMIN, body, data = fakeData() } = opts
  const factory = vi.fn(() => data)
  const app = createApp({ staffAuth: () => provider, panelData: factory })
  const res = app.request(
    `/api/admin${path}`,
    {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    { APP_ENV: 'development' } as Env,
  )
  return { res, factory }
}

const errorOf = async (res: Response) => ((await res.json()) as ApiErrorBody).error

describe('autenticación y roles', () => {
  it('exige sesión en las rutas nuevas', async () => {
    const app = createApp({ staffAuth: () => provider, panelData: () => fakeData() })
    const res = await app.request('/api/admin/dashboard', {}, { APP_ENV: 'development' } as Env)
    expect(res.status).toBe(401)
  })

  it('reenvía el JWT del usuario a la capa de datos', async () => {
    const { res, factory } = call('GET', '/dashboard')
    expect((await res).status).toBe(200)
    expect(factory).toHaveBeenCalledWith(expect.anything(), ADMIN)
  })

  it.each([
    ['GET', '/dashboard'],
    ['GET', '/products'],
    ['PATCH', '/products/' + ID],
    ['GET', '/quotes'],
    ['POST', `/quotes/${ID}/send`],
    ['POST', `/orders/${ID}/confirm`],
    ['POST', `/orders/${ID}/cancel`],
    ['GET', '/customers'],
    ['GET', '/reports?from=2026-10-01&to=2026-10-31'],
    ['PUT', `/inventory/${ID}/settings`],
  ])('el taller no puede %s %s', async (method, path) => {
    const data = fakeData()
    const { res } = call(method, path, { token: WORKSHOP, body: method === 'GET' ? undefined : {}, data })
    const response = await res
    expect(response.status).toBe(403)
    expect(Object.values(data).every((fn) => !vi.mocked(fn).mock.calls.length)).toBe(true)
  })

  it('el taller consulta inventario y pedidos', async () => {
    expect((await call('GET', '/inventory', { token: WORKSHOP }).res).status).toBe(200)
    expect((await call('GET', `/inventory/${ID}/movements`, { token: WORKSHOP }).res).status).toBe(200)
    expect((await call('GET', '/orders', { token: WORKSHOP }).res).status).toBe(200)
    expect((await call('GET', `/orders/${ID}`, { token: WORKSHOP }).res).status).toBe(200)
  })
})

describe('reportes', () => {
  it('lee el rango en días de Lima y devuelve los indicadores', async () => {
    const data = fakeData()
    const res = await call('GET', '/reports?from=2026-10-01&to=2026-10-31', { data }).res
    expect(res.status).toBe(200)
    expect(data.getReportSource).toHaveBeenCalledWith({ start: '2026-10-01T00:00:00-05:00', end: '2026-11-01T00:00:00-05:00' })
    const body = (await res.json()) as { range: unknown; sales: unknown }
    expect(body.range).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(body.sales).toEqual({ count: 0, total: 0, averageTicket: null })
  })

  it('rechaza un rango inválido sin leer datos', async () => {
    const data = fakeData()
    const res = await call('GET', '/reports?from=2026-10-31&to=2026-10-01', { data }).res
    expect(res.status).toBe(422)
    expect(data.getReportSource).not.toHaveBeenCalled()
    expect((await call('GET', '/reports', { data }).res).status).toBe(422)
  })
})

describe('inventario', () => {
  const production = { variantId: ID, type: 'production_in', quantity: 3, idempotencyKey: 'clave-12345678' }

  it('el taller registra producción', async () => {
    const data = fakeData()
    const res = await call('POST', '/inventory/movements', { token: WORKSHOP, body: production, data }).res
    expect(res.status).toBe(201)
    expect(data.applyMovement).toHaveBeenCalledWith(production)
  })

  it('el taller no puede hacer ajustes', async () => {
    const data = fakeData()
    const body = { ...production, type: 'adjustment_out', reason: 'merma' }
    const res = await call('POST', '/inventory/movements', { token: WORKSHOP, body, data }).res
    expect(res.status).toBe(403)
    expect(data.applyMovement).not.toHaveBeenCalled()
  })

  it('administración puede ajustar con motivo, pero no sin él', async () => {
    const body = { ...production, type: 'adjustment_in' }
    expect((await call('POST', '/inventory/movements', { body }).res).status).toBe(422)
    expect((await call('POST', '/inventory/movements', { body: { ...body, reason: 'conteo' } }).res).status).toBe(201)
  })

  it.each(['reservation', 'reservation_release', 'sale_out'])('no acepta el tipo %s desde el panel', async (type) => {
    const res = await call('POST', '/inventory/movements', { body: { ...production, type } }).res
    expect(res.status).toBe(422)
  })

  it('exige clave de idempotencia y cantidad entera positiva', async () => {
    expect((await call('POST', '/inventory/movements', { body: { ...production, idempotencyKey: 'corta' } }).res).status).toBe(422)
    expect((await call('POST', '/inventory/movements', { body: { ...production, quantity: 1.5 } }).res).status).toBe(422)
  })
})

describe('validación y errores', () => {
  it('trata un id mal formado como inexistente', async () => {
    expect((await call('GET', '/quotes/no-es-uuid').res).status).toBe(404)
  })

  it('devuelve 404 si el registro no existe', async () => {
    const data = fakeData()
    vi.mocked(data.getOrder).mockResolvedValue(null)
    expect((await call('GET', `/orders/${ID}`, { data }).res).status).toBe(404)
  })

  it('rechaza estados de pedido que no se cambian directamente', async () => {
    const res = await call('POST', `/orders/${ID}/status`, { body: { status: 'shipped' } }).res
    expect(res.status).toBe(422)
  })

  it('valida filtros y cuerpos', async () => {
    expect((await call('GET', '/quotes?status=inventado').res).status).toBe(422)
    expect((await call('POST', `/orders/${ID}/cancel`, { body: { reason: '  ' } }).res).status).toBe(422)
    expect((await call('PATCH', `/variants/${ID}`, { body: {} }).res).status).toBe(422)
    expect((await call('PATCH', `/variants/${ID}`, { body: { catalogPrice: -1 } }).res).status).toBe(422)
  })

  it('permite publicar o quitar el precio de una variante', async () => {
    const data = fakeData()
    await call('PATCH', `/variants/${ID}`, { body: { catalogPrice: 120.5 }, data }).res
    await call('PATCH', `/variants/${ID}`, { body: { catalogPrice: null }, data }).res
    expect(vi.mocked(data.updateVariant).mock.calls.map((c) => c[1])).toEqual([{ catalogPrice: 120.5 }, { catalogPrice: null }])
  })

  it('llama las funciones del flujo con los parámetros esperados', async () => {
    const data = fakeData()
    await call('POST', `/quotes/${ID}/send`, { body: { discountTotal: 10 }, data }).res
    await call('POST', `/orders/${ID}/dispatch`, { body: {}, data }).res
    const convert = await call('POST', `/quotes/${ID}/convert`, { body: { customerConfirmed: true }, data }).res
    expect(data.sendQuote).toHaveBeenCalledWith(ID, { discountTotal: 10 })
    expect(data.dispatchOrder).toHaveBeenCalledWith(ID, 'delivered')
    expect(convert.status).toBe(201)
    expect(await convert.json()).toEqual({ orderId: 'order-1' })
  })

  it('archiva una cotización solo con sesión de administración', async () => {
    const data = fakeData()
    const res = await call('POST', `/quotes/${ID}/cancel`, { data }).res
    expect(res.status).toBe(200)
    expect(data.cancelQuote).toHaveBeenCalledWith(ID)
    const forbidden = await call('POST', `/quotes/${ID}/cancel`, { data, token: WORKSHOP }).res
    expect(forbidden.status).toBe(403)
  })

  it('traduce los errores de la base a su código HTTP', async () => {
    const data = fakeData()
    vi.mocked(data.confirmOrder).mockRejectedValue(new PanelDataError(422, 'invalid_request', 'Stock insuficiente.'))
    const res = await call('POST', `/orders/${ID}/confirm`, { body: { customerConfirmed: true }, data }).res
    expect(res.status).toBe(422)
    expect((await errorOf(res)).message).toBe('Stock insuficiente.')
  })

  it('responde 503 si la base no está configurada', async () => {
    expect((await call('GET', '/products', { data: null }).res).status).toBe(503)
  })

  it('un error inesperado devuelve 500 sin detalles', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const data = fakeData()
    vi.mocked(data.listProducts).mockRejectedValue(new Error('secreto interno'))
    const res = await call('GET', '/products', { data }).res
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('secreto')
    spy.mockRestore()
  })
})

describe('venta directa', () => {
  const sale = {
    customer: { type: 'individual', fullName: 'Ana Pérez', phone: '987654321' },
    items: [{ variantId: ID, quantity: 2 }],
  }

  it('crea el pedido y devuelve su id', async () => {
    const data = fakeData()
    const res = await call('POST', '/orders', { body: sale, data }).res
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ orderId: 'order-9' })
    expect(data.createDirectOrder).toHaveBeenCalledOnce()
  })

  it('acepta un cliente existente por id y una pieza a medida con precio', async () => {
    const data = fakeData()
    const body = { customer: { id: ID }, items: [{ description: 'Tabla especial', quantity: 1, unitPrice: 200 }] }
    expect((await call('POST', '/orders', { body, data }).res).status).toBe(201)
  })

  it.each([
    ['sin productos', { ...sale, items: [] }],
    ['a medida sin precio', { ...sale, items: [{ description: 'Especial', quantity: 1 }] }],
    ['a medida sin descripción', { ...sale, items: [{ quantity: 1, unitPrice: 10 }] }],
    ['confirmar sin confirmación del cliente', { ...sale, confirm: true }],
    ['cliente sin contacto', { ...sale, customer: { type: 'individual', fullName: 'Ana' } }],
    ['precio negativo', { ...sale, items: [{ variantId: ID, quantity: 1, unitPrice: -1 }] }],
  ])('rechaza con 422: %s', async (_name, body) => {
    const data = fakeData()
    const res = await call('POST', '/orders', { body, data }).res
    expect(res.status).toBe(422)
    expect(data.createDirectOrder).not.toHaveBeenCalled()
  })

  it('el taller no puede crear ventas', async () => {
    const data = fakeData()
    expect((await call('POST', '/orders', { token: WORKSHOP, body: sale, data }).res).status).toBe(403)
    expect(data.createDirectOrder).not.toHaveBeenCalled()
  })

  it('arma el JSON de la función SQL con claves en snake_case', () => {
    const parsed = directOrderBody.parse({ ...sale, customerConfirmed: true, confirm: true, discountTotal: 5 })
    const payload = toDirectOrderPayload(parsed)
    expect(payload).toMatchObject({ channel: 'admin', confirm: true, customer_confirmed: true, discount_total: 5 })
    expect(payload.customer).toMatchObject({ full_name: 'Ana Pérez', phone: '987654321' })
    expect(payload.items[0]).toMatchObject({ variant_id: ID, quantity: 2, unit_price: null })
  })
})

describe('transformaciones de datos', () => {
  it('camelize convierte claves y deja los valores intactos', () => {
    expect(camelize({ order_id: 'pending_confirmation', items: [{ unit_price: 1 }] })).toEqual({
      orderId: 'pending_confirmation',
      items: [{ unitPrice: 1 }],
    })
  })

  it('toDashboard conserva los estados como claves', () => {
    const dash = toDashboard({
      quotes_pending: 2, quotes_sent: 1, orders_by_status: { pending_confirmation: 3 },
      confirmed_sales_30d: { count: 1, total: 50 }, low_stock: [{ variant_id: 'v' }], recent_orders: [], recent_quotes: [],
    })
    expect(dash.ordersByStatus).toEqual({ pending_confirmation: 3 })
    expect(dash.lowStock).toEqual([{ variantId: 'v' }])
  })

  it('toPanelProduct ordena variantes y tolera el precio interno como objeto o lista', () => {
    const base = { id: 'p', slug: 's', name: 'N', description: null, is_active: true, is_customizable: false, category: null }
    const variant = (id: string, sort: number, internal: unknown) => ({
      id, sku: id, name: id, dimensions_label: null, catalog_price: null, fulfillment_type: 'stock', is_active: true,
      sort_order: sort, price_tiers: [{ min_quantity: 10, unit_price: 8 }, { min_quantity: 5, unit_price: 9 }], internal,
    })
    const internal = { unit_cost: 10, negotiated_price: 20, catalog_price_reference: 30 }
    const product = toPanelProduct({ ...base, variants: [variant('b', 2, [internal]), variant('a', 1, internal), variant('c', 3, null)] })
    expect(product.variants.map((v) => v.id)).toEqual(['a', 'b', 'c'])
    expect(product.variants[0].internalPricing).toEqual({ unitCost: 10, negotiatedPrice: 20, catalogPriceReference: 30 })
    expect(product.variants[1].internalPricing?.unitCost).toBe(10)
    expect(product.variants[2].internalPricing).toBeNull()
    expect(product.variants[0].priceTiers[0].minQuantity).toBe(5)
  })

  it('toQuoteListItem cuenta los productos sin precio y no expone las líneas', () => {
    const row = {
      id: 'q', code: 'COT-000001', status: 'submitted', requires_review: true, review_reason: null, total: 40, created_at: '2026-10-17T00:00:00Z',
      customer: { full_name: 'Ana', company_name: null }, items: [{ unit_price: 20 }, { unit_price: null }, { unit_price: null }],
    }
    const item = toQuoteListItem(row)
    expect(item.pendingPrices).toBe(2)
    expect(item.customer).toEqual({ fullName: 'Ana', companyName: null })
    expect(item).not.toHaveProperty('items')
    expect(toQuoteListItem({ ...row, items: null }).pendingPrices).toBe(0)
  })

  it('toInventoryLevel marca stock bajo según las alertas abiertas', () => {
    const row = {
      variant_id: 'v1', on_hand: 5, reserved: 2, available: 3, min_stock: 4, custodian: 'Luis',
      variant: { sku: 'A-S', name: 'S', dimensions_label: null, product: { slug: 'moshaco', name: 'Moshaco', category: { slug: 'parrilla-y-cocina', name: 'Colección Parrilla y Cocina' } } },
    }
    expect(toInventoryLevel(row, new Set(['v1'])).collection).toEqual({ slug: 'parrilla-y-cocina', name: 'Colección Parrilla y Cocina' })
    expect(toInventoryLevel(row, new Set(['v1'])).productSlug).toBe('moshaco')
    expect(toInventoryLevel(row, new Set(['v1'])).lowStock).toBe(true)
    expect(toInventoryLevel(row, new Set()).lowStock).toBe(false)
  })

  it('mapDbError traduce códigos de Postgres', () => {
    const status = (code: string) => {
      try {
        mapDbError({ code, message: 'mensaje de la base' })
      } catch (err) {
        return err instanceof PanelDataError ? err.status : 'otro'
      }
    }
    expect(status('42501')).toBe(403)
    expect(status('P0002')).toBe(404)
    expect(status('22023')).toBe(422)
    expect(status('23505')).toBe(409)
    expect(status('XX000')).toBe('otro')
  })

  it('sanitizeSearch quita caracteres de filtro de PostgREST', () => {
    expect(sanitizeSearch('ana),email.eq.x,(  pérez%')).toBe('ana email.eq.x pérez')
  })
})

describe('exportación de reportes a Google Sheets', () => {
  const google = {
    GOOGLE_SERVICE_ACCOUNT_EMAIL: 'woodland@proyecto.iam.gserviceaccount.com',
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: 'se-reemplaza-en-la-prueba',
    GOOGLE_SHEETS_REPORT_ID: 'hoja-123',
  }

  const pemKey = async () => (await generateTestKeys()).pem

  function request(opts: { token?: string; env?: Partial<Env>; fetchImpl?: typeof fetch; data?: PanelData; path?: string; method?: string } = {}) {
    const { token = ADMIN, env = {}, fetchImpl, data = fakeData(), path = '/reports/export?from=2026-10-01&to=2026-10-31', method = 'POST' } = opts
    const app = createApp({ staffAuth: () => provider, panelData: () => data, fetchImpl })
    return app.request(`/api/admin${path}`, { method, headers: { Authorization: `Bearer ${token}` } }, { APP_ENV: 'development', ...env } as Env)
  }

  const sheetsFetch = () =>
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('oauth2')) return new Response(JSON.stringify({ access_token: 't' }))
      if (url.includes('?fields=')) return new Response(JSON.stringify({ sheets: [] }))
      return new Response('{}')
    })

  it('GET /reports avisa si la exportación está disponible', async () => {
    const off = (await (await request({ method: 'GET', path: '/reports?from=2026-10-01&to=2026-10-31' })).json()) as { canExport: boolean }
    expect(off.canExport).toBe(false)
    const on = (await (await request({ method: 'GET', path: '/reports?from=2026-10-01&to=2026-10-31', env: google })).json()) as { canExport: boolean }
    expect(on.canExport).toBe(true)
  })

  it('escribe las tres hojas con el rango pedido', async () => {
    const fetchImpl = sheetsFetch()
    const data = fakeData()
    const res = await request({ env: { ...google, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: await pemKey() }, fetchImpl: fetchImpl as unknown as typeof fetch, data })
    expect(res.status).toBe(200)
    expect(data.getReportSource).toHaveBeenCalledWith({ start: '2026-10-01T00:00:00-05:00', end: '2026-11-01T00:00:00-05:00' })
    const body = (await res.json()) as { spreadsheetUrl: string; sheets: { title: string }[] }
    expect(body.spreadsheetUrl).toBe('https://docs.google.com/spreadsheets/d/hoja-123')
    expect(body.sheets.map((s) => s.title)).toEqual(['Resumen', 'Cotizaciones', 'Pedidos'])
    const write = fetchImpl.mock.calls.find(([url]) => String(url).endsWith('values:batchUpdate'))
    expect(write).toBeDefined()
  })

  it('responde 409 sin tocar datos ni Google si no hay configuración', async () => {
    const fetchImpl = sheetsFetch()
    const data = fakeData()
    const res = await request({ fetchImpl: fetchImpl as unknown as typeof fetch, data })
    expect(res.status).toBe(409)
    expect(await errorOf(res)).toMatchObject({ code: 'sheets_not_connected' })
    expect(data.getReportSource).not.toHaveBeenCalled()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('solo administración exporta', async () => {
    const fetchImpl = sheetsFetch()
    const res = await request({ token: WORKSHOP, env: google, fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(res.status).toBe(403)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('valida el rango antes de llamar a Google', async () => {
    const fetchImpl = sheetsFetch()
    const res = await request({ env: google, fetchImpl: fetchImpl as unknown as typeof fetch, path: '/reports/export?from=2026-10-31&to=2026-10-01' })
    expect(res.status).toBe(422)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('traduce el rechazo de Google a un error 502 con ayuda, sin filtrar detalles', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes('oauth2') ? new Response(JSON.stringify({ access_token: 't' })) : new Response('{"error":"secreto"}', { status: 403 }),
    )
    const res = await request({ env: { ...google, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: await pemKey() }, fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(res.status).toBe(502)
    const text = await res.text()
    expect(text).toContain('sheets_export_failed')
    expect(text).toContain('compartida')
    expect(text).not.toContain('secreto')
  })
})
