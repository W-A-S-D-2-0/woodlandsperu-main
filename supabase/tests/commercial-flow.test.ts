import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { ids, seedFixtures } from './support/fixtures'
import { anon, as, createTestDb, service, user } from './support/test-db'

/**
 * Flujo comercial completo: solicitud → revisión → aceptación → pedido → confirmación
 * (reserva) → despacho (venta) y cancelación (liberación). Todos los datos son ficticios.
 */

let db: PGlite

beforeAll(async () => {
  db = await createTestDb()
  await seedFixtures(db)
  // Stock inicial de la variante de prueba: 20 unidades producidas.
  await as(db, service, () => db.query(`select public.apply_inventory_movement($1, 'production_in', 20)`, [ids.variantStock]), {
    commit: true,
  })
}, 60_000)

interface QuoteSummary {
  quote_id: string
  code: string
  status: string
  requires_review: boolean
  subtotal: string | number
  total: string | number
  items: { description: string; quantity: number; unit_price: string | number | null }[]
}

let requestCounter = 0

function quoteRequest(overrides: Record<string, unknown> = {}) {
  requestCounter += 1
  return {
    request_id: `test-request-${requestCounter}-${Date.now()}`,
    channel: 'web',
    customer: { type: 'individual', full_name: 'Cliente Web de Prueba', email: `web${requestCounter}@test.local` },
    message: 'Quiero cotizar',
    items: [{ variant_id: ids.variantStock, quantity: 12 }],
    ...overrides,
  }
}

const submit = (request: object, commit = true) =>
  as(
    db,
    service,
    async () => (await db.query<{ r: QuoteSummary }>('select public.submit_quote_request($1) as r', [JSON.stringify(request)])).rows[0]!.r,
    { commit },
  )

const asAdmin = <T>(fn: () => Promise<T>, commit = true) => as(db, user(ids.admin), fn, { commit })

const level = async () =>
  (
    await as(db, service, () =>
      db.query<{ on_hand: number; reserved: number; available: number }>(
        'select on_hand, reserved, available from public.inventory_levels where variant_id = $1',
        [ids.variantStock],
      ),
    )
  ).rows[0]!

/** Lleva una solicitud hasta un pedido pendiente de confirmación. */
async function orderFromNewQuote(quantity: number) {
  const quote = await submit(quoteRequest({ items: [{ variant_id: ids.variantStock, quantity }] }))
  return asAdmin(async () => {
    await db.query('select public.send_quote($1)', [quote.quote_id])
    await db.query('select public.accept_quote($1)', [quote.quote_id])
    return (await db.query<{ id: string }>('select public.convert_quote_to_order($1) as id', [quote.quote_id])).rows[0]!.id
  })
}

describe('solicitud de cotización', () => {
  it('calcula el precio en la base (escala por volumen) y crea el cliente', async () => {
    const quote = await submit(quoteRequest())
    expect(quote.code).toMatch(/^COT-\d{6}$/)
    expect(quote.status).toBe('submitted')
    expect(quote.items[0]).toMatchObject({ description: 'Producto de prueba · Stock', quantity: 12 })
    expect(Number(quote.items[0]!.unit_price)).toBe(90) // escala de 10 unidades
    expect(Number(quote.total)).toBe(1080)
  })

  it('sin límites comerciales configurados, toda cotización pasa a revisión', async () => {
    const quote = await submit(quoteRequest())
    expect(quote.requires_review).toBe(true)
  })

  it('con límites configurados, una cotización pequeña no requiere revisión', async () => {
    await as(
      db,
      service,
      async () => {
        await db.query(`update public.business_settings set value = '5000' where key = 'quote_review_min_total'`)
        await db.query(`update public.business_settings set value = '100' where key = 'quote_review_min_quantity'`)
        const quote = (
          await db.query<{ r: QuoteSummary }>('select public.submit_quote_request($1) as r', [JSON.stringify(quoteRequest())])
        ).rows[0]!.r
        expect(quote.requires_review).toBe(false)

        const big = (
          await db.query<{ r: QuoteSummary }>('select public.submit_quote_request($1) as r', [
            JSON.stringify(quoteRequest({ items: [{ variant_id: ids.variantStock, quantity: 100 }] })),
          ])
        ).rows[0]!.r
        expect(big.requires_review).toBe(true)
      },
      { commit: false },
    )
  })

  it('reenviar la misma solicitud no duplica la cotización', async () => {
    const request = quoteRequest()
    const first = await submit(request)
    const second = await submit(request)
    expect(second.quote_id).toBe(first.quote_id)
  })

  it('reutiliza el cliente existente por correo sin modificar sus datos', async () => {
    await submit(quoteRequest({ customer: { type: 'individual', full_name: 'Otro Nombre', email: 'CLIENTE@test.local' } }))
    const row = (
      await as(db, service, () => db.query<{ full_name: string; n: number }>(
        `select full_name, (select count(*)::int from public.customers where lower(email) = 'cliente@test.local') as n
           from public.customers where id = $1`,
        [ids.customer],
      ))
    ).rows[0]!
    expect(row).toEqual({ full_name: 'Cliente de prueba', n: 1 })
  })

  it('personalización o medidas especiales quedan sin precio para el equipo', async () => {
    const quote = await submit(
      quoteRequest({
        items: [
          { variant_id: ids.variantStock, quantity: 2, customization: 'Grabado con logo' },
          { description: 'Tabla a medida 80x40', quantity: 1, custom_dimensions: '80x40x3' },
        ],
      }),
    )
    expect(quote.items.map((item) => item.unit_price)).toEqual([null, null])
    expect(quote.requires_review).toBe(true)
  })

  it('rechaza productos inactivos, cantidades inválidas y el canal admin', async () => {
    await expect(submit(quoteRequest({ items: [{ variant_id: ids.variantHidden, quantity: 1 }] }), false)).rejects.toThrow(
      /no está disponible/,
    )
    await expect(submit(quoteRequest({ items: [{ variant_id: ids.variantStock, quantity: 0 }] }), false)).rejects.toThrow(
      /Cantidad no válida/,
    )
    await expect(submit(quoteRequest({ channel: 'admin' }), false)).rejects.toThrow(/Canal no válido/)
    await expect(submit(quoteRequest({ items: [] }), false)).rejects.toThrow(/entre 1 y 50/)
  })

  it('solo el backend puede registrar solicitudes', async () => {
    for (const actor of [anon, user(ids.admin)]) {
      await expect(
        as(db, actor, () => db.query('select public.submit_quote_request($1)', [JSON.stringify(quoteRequest())])),
      ).rejects.toThrow(/permission denied|reservada al backend/)
    }
  })
})

describe('revisión y envío', () => {
  it('no se envía una cotización con productos sin precio; el equipo puede definirlo', async () => {
    const quote = await submit(quoteRequest({ items: [{ variant_id: ids.variantNoPrice, quantity: 3 }] }))
    await expect(asAdmin(() => db.query('select public.send_quote($1)', [quote.quote_id]), false)).rejects.toThrow(
      /Define el precio/,
    )

    const sent = await asAdmin(async () => {
      const item = (await db.query<{ id: string }>('select id from public.quote_items where quote_id = $1', [quote.quote_id])).rows[0]!
      await db.query('select public.set_quote_item_price($1, 45.5)', [item.id])
      return (await db.query<{ r: QuoteSummary }>(`select public.send_quote($1, 10, null, 'Entrega estimada en 2 semanas') as r`, [quote.quote_id])).rows[0]!.r
    })
    expect(sent.status).toBe('sent')
    expect(Number(sent.subtotal)).toBe(136.5)
    expect(Number(sent.total)).toBe(126.5)
  })

  it('el taller no puede enviar cotizaciones', async () => {
    const quote = await submit(quoteRequest())
    await expect(
      as(db, user(ids.workshop), () => db.query('select public.send_quote($1)', [quote.quote_id])),
    ).rejects.toThrow(/permission denied|Solo administración/)
  })

  it('archiva una cotización abierta, no una ya convertida, y solo lo hace el equipo', async () => {
    const open = await submit(quoteRequest())
    await expect(as(db, user(ids.workshop), () => db.query('select public.cancel_quote($1)', [open.quote_id]))).rejects.toThrow(
      /permission denied|Solo administración/,
    )
    const cancelled = await asAdmin(async () => (await db.query<{ r: QuoteSummary }>('select public.cancel_quote($1) as r', [open.quote_id])).rows[0]!.r)
    expect(cancelled.status).toBe('cancelled')

    const orderId = await orderFromNewQuote(1)
    const converted = (await as(db, service, () => db.query<{ quote_id: string }>('select quote_id from public.orders where id = $1', [orderId]))).rows[0]!
    await expect(asAdmin(() => db.query('select public.cancel_quote($1)', [converted.quote_id]), false)).rejects.toThrow(/ya es un pedido/)
  })

  it('solo se acepta una cotización enviada y solo una aceptada se convierte en pedido', async () => {
    const quote = await submit(quoteRequest())
    await expect(asAdmin(() => db.query('select public.accept_quote($1)', [quote.quote_id]), false)).rejects.toThrow(
      /enviada/,
    )
    await expect(
      asAdmin(() => db.query('select public.convert_quote_to_order($1)', [quote.quote_id]), false),
    ).rejects.toThrow(/aceptada/)
  })
})

describe('pedido e inventario', () => {
  it('la conversión copia precios y es idempotente', async () => {
    const quote = await submit(quoteRequest({ items: [{ variant_id: ids.variantStock, quantity: 2 }] }))
    const [first, second] = await asAdmin(async () => {
      await db.query('select public.send_quote($1)', [quote.quote_id])
      await db.query('select public.accept_quote($1)', [quote.quote_id])
      const a = (await db.query<{ id: string }>('select public.convert_quote_to_order($1) as id', [quote.quote_id])).rows[0]!.id
      const b = (await db.query<{ id: string }>('select public.convert_quote_to_order($1) as id', [quote.quote_id])).rows[0]!.id
      return [a, b]
    })
    expect(second).toBe(first)

    const order = (
      await as(db, service, () =>
        db.query<{ status: string; subtotal: string; code: string; quote_status: string }>(
          `select o.status, o.subtotal, o.code, q.status as quote_status
             from public.orders o join public.quotes q on q.id = o.quote_id where o.id = $1`,
          [first],
        ),
      )
    ).rows[0]!
    expect(order).toMatchObject({ status: 'pending_confirmation', subtotal: '200.00', quote_status: 'converted' })
    expect(order.code).toMatch(/^PED-\d{6}$/)
  })

  it('confirmar exige la confirmación del cliente y reserva el stock una sola vez', async () => {
    const orderId = await orderFromNewQuote(5)
    const before = await level()

    await expect(asAdmin(() => db.query('select public.confirm_order($1)', [orderId]), false)).rejects.toThrow(
      /confirmación del cliente/,
    )

    await asAdmin(() => db.query('select public.confirm_order($1, true)', [orderId]))
    await asAdmin(() => db.query('select public.confirm_order($1, true)', [orderId])) // repetir no reserva de nuevo

    const after = await level()
    expect(after.reserved - before.reserved).toBe(5)
    expect(after.on_hand).toBe(before.on_hand)
  })

  it('no confirma si no hay stock disponible suficiente', async () => {
    const orderId = await orderFromNewQuote(500)
    await expect(asAdmin(() => db.query('select public.confirm_order($1, true)', [orderId]), false)).rejects.toThrow(
      /Stock disponible insuficiente/,
    )
  })

  it('despachar descuenta el stock reservado; entregar después no lo descuenta otra vez', async () => {
    const orderId = await orderFromNewQuote(3)
    await asAdmin(() => db.query('select public.confirm_order($1, true)', [orderId]))
    const confirmed = await level()

    await expect(
      asAdmin(() => db.query(`select public.dispatch_order($1, 'shipped')`, [orderId]), false),
    ).rejects.toThrow(/pedido listo/)

    await asAdmin(async () => {
      await db.query(`update public.orders set status = 'ready' where id = $1`, [orderId])
      await db.query(`select public.dispatch_order($1, 'shipped')`, [orderId])
      await db.query(`select public.dispatch_order($1, 'delivered')`, [orderId])
    })

    const delivered = await level()
    expect(confirmed.on_hand - delivered.on_hand).toBe(3)
    expect(confirmed.reserved - delivered.reserved).toBe(3)
  })

  it('cancelar libera la reserva y no se puede cancelar lo ya despachado', async () => {
    const orderId = await orderFromNewQuote(4)
    await asAdmin(() => db.query('select public.confirm_order($1, true)', [orderId]))
    const confirmed = await level()

    await asAdmin(() => db.query(`select public.cancel_order($1, 'El cliente desistió')`, [orderId]))
    const cancelled = await level()
    expect(confirmed.reserved - cancelled.reserved).toBe(4)
    expect(cancelled.on_hand).toBe(confirmed.on_hand)

    const shipped = await orderFromNewQuote(1)
    await asAdmin(async () => {
      await db.query('select public.confirm_order($1, true)', [shipped])
      await db.query(`update public.orders set status = 'ready' where id = $1`, [shipped])
      await db.query(`select public.dispatch_order($1, 'shipped')`, [shipped])
    })
    await expect(asAdmin(() => db.query(`select public.cancel_order($1, 'Tarde')`, [shipped]), false)).rejects.toThrow(
      /No se puede cancelar/,
    )
  })

  it('los productos a pedido no reservan stock', async () => {
    const quote = await submit(quoteRequest({ items: [{ variant_id: ids.variantMadeToOrder, quantity: 2 }] }))
    const before = await level()
    await asAdmin(async () => {
      await db.query('select public.send_quote($1)', [quote.quote_id])
      await db.query('select public.accept_quote($1)', [quote.quote_id])
      const orderId = (await db.query<{ id: string }>('select public.convert_quote_to_order($1, true) as id', [quote.quote_id])).rows[0]!.id
      await db.query('select public.confirm_order($1)', [orderId])
    })
    expect(await level()).toEqual(before)
  })
})

describe('consulta pública del pedido', () => {
  it('responde solo si el código y el contacto coinciden, sin datos del cliente', async () => {
    const request = quoteRequest()
    const quote = await submit(request)
    const code = await asAdmin(async () => {
      await db.query('select public.send_quote($1)', [quote.quote_id])
      await db.query('select public.accept_quote($1)', [quote.quote_id])
      const id = (await db.query<{ id: string }>('select public.convert_quote_to_order($1) as id', [quote.quote_id])).rows[0]!.id
      return (await db.query<{ code: string }>('select code from public.orders where id = $1', [id])).rows[0]!.code
    })
    const email = (request.customer as { email: string }).email

    const lookup = (contact: string) =>
      as(db, service, async () => (await db.query<{ r: Record<string, unknown> | null }>('select public.get_order_status_public($1, $2) as r', [code, contact])).rows[0]!.r)

    const found = await lookup(email.toUpperCase())
    expect(found).toMatchObject({ code, status: 'pending_confirmation', payment_status: 'unpaid' })
    expect(JSON.stringify(found)).not.toContain(email)
    expect(await lookup('otro@correo.com')).toBeNull()
    await expect(as(db, anon, () => db.query('select public.get_order_status_public($1, $2)', [code, email]))).rejects.toThrow(
      /permission denied/,
    )
  })
})

describe('resumen del panel', () => {
  it('administración ve el resumen; el taller no', async () => {
    const summary = await asAdmin(async () => (await db.query<{ r: Record<string, unknown> }>('select public.get_admin_dashboard() as r')).rows[0]!.r, false)
    expect(summary).toHaveProperty('quotes_pending')
    expect(summary).toHaveProperty('confirmed_sales_30d')
    await expect(
      as(db, user(ids.workshop), () => db.query('select public.get_admin_dashboard()')),
    ).rejects.toThrow(/permission denied|Solo administración/)
  })
})
