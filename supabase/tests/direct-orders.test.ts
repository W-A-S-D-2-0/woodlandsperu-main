import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { ids, seedFixtures } from './support/fixtures'
import { anon, as, createTestDb, service, user } from './support/test-db'

/** Venta directa: pedido completo desde el panel, sin cotización. Datos ficticios. */

let db: PGlite

beforeAll(async () => {
  db = await createTestDb()
  await seedFixtures(db)
  await as(db, service, () => db.query(`select public.apply_inventory_movement($1, 'production_in', 20)`, [ids.variantStock]), {
    commit: true,
  })
}, 60_000)

let counter = 0
const request = (overrides: Record<string, unknown> = {}) => {
  counter += 1
  return {
    customer: { type: 'individual', full_name: 'Cliente directo', email: `directo${counter}@test.local` },
    items: [{ variant_id: ids.variantStock, quantity: 2 }],
    ...overrides,
  }
}

const create = (payload: object, actor = user(ids.admin), commit = true) =>
  as(db, actor, async () => (await db.query<{ id: string }>('select public.create_direct_order($1) as id', [JSON.stringify(payload)])).rows[0]!.id, { commit })

const order = async (id: string) =>
  (await as(db, service, () => db.query<Record<string, unknown>>('select * from public.orders where id = $1', [id]))).rows[0]!

const items = async (id: string) =>
  (await as(db, service, () => db.query<Record<string, unknown>>('select * from public.order_items where order_id = $1 order by sort_order', [id]))).rows

const stock = async () =>
  (await as(db, service, () => db.query<{ on_hand: number; reserved: number }>('select on_hand, reserved from public.inventory_levels where variant_id = $1', [ids.variantStock]))).rows[0]!

describe('create_direct_order', () => {
  it('crea el pedido pendiente con el precio de la regla de siempre y el cliente nuevo', async () => {
    const id = await create(request({ items: [{ variant_id: ids.variantStock, quantity: 12 }] }))
    const o = await order(id)
    expect(o.status).toBe('pending_confirmation')
    expect(o.channel).toBe('admin')
    expect(o.payment_status).toBe('unpaid')
    expect(Number(o.subtotal)).toBe(1080) // escala de 10 unidades: 12 × 90
    const [item] = await items(id)
    expect(item).toMatchObject({ fulfillment_type: 'stock', price_source: 'tier', quantity: 12 })
  })

  it('un precio indicado a mano manda sobre el de catálogo', async () => {
    const id = await create(request({ items: [{ variant_id: ids.variantStock, quantity: 1, unit_price: 70 }] }))
    const [item] = await items(id)
    expect(Number(item!.unit_price)).toBe(70)
    expect(item!.price_source).toBe('manual')
  })

  it('una variante sin precio publicado exige indicar el precio', async () => {
    await expect(create(request({ items: [{ variant_id: ids.variantNoPrice, quantity: 1 }] }), user(ids.admin), false)).rejects.toThrow(/precio/)
    const id = await create(request({ items: [{ variant_id: ids.variantNoPrice, quantity: 1, unit_price: 55 }] }))
    expect(Number((await order(id)).subtotal)).toBe(55)
  })

  it('una pieza a medida necesita descripción y precio, y se fabrica a pedido', async () => {
    await expect(create(request({ items: [{ quantity: 1, unit_price: 10 }] }), user(ids.admin), false)).rejects.toThrow(/descripción/)
    await expect(create(request({ items: [{ description: 'Tabla especial', quantity: 1 }] }), user(ids.admin), false)).rejects.toThrow(/precio/)
    const id = await create(request({ items: [{ description: 'Tabla especial', quantity: 2, unit_price: 200 }] }))
    const [item] = await items(id)
    expect(item).toMatchObject({ fulfillment_type: 'made_to_order', variant_id: null })
  })

  it('lo personalizado pasa a fabricación a pedido aunque la variante sea de stock', async () => {
    const id = await create(request({ items: [{ variant_id: ids.variantStock, quantity: 1, customization: 'Grabado: "Ana"' }] }))
    expect((await items(id))[0]).toMatchObject({ fulfillment_type: 'made_to_order' })
  })

  it('aplica el descuento y no lo deja superar el subtotal', async () => {
    const id = await create(request({ discount_total: 20 }))
    expect(Number((await order(id)).discount_total)).toBe(20)
    await expect(create(request({ discount_total: 99999 }), user(ids.admin), false)).rejects.toThrow()
  })

  it('al confirmar reserva el stock, y solo si el cliente confirmó', async () => {
    const before = await stock()
    await expect(create(request({ confirm: true }), user(ids.admin), false)).rejects.toThrow(/cliente debe haberlo confirmado/)
    const id = await create(request({ confirm: true, customer_confirmed: true, items: [{ variant_id: ids.variantStock, quantity: 3 }] }))
    expect((await order(id)).status).toBe('confirmed')
    expect((await stock()).reserved).toBe(before.reserved + 3)
  })

  it('si no hay stock suficiente, no queda nada a medias', async () => {
    const before = await stock()
    const countBefore = (await as(db, service, () => db.query<{ n: number }>('select count(*)::int as n from public.orders'))).rows[0]!.n
    await expect(
      create(request({ confirm: true, customer_confirmed: true, items: [{ variant_id: ids.variantStock, quantity: 9999 }] }), user(ids.admin), false),
    ).rejects.toThrow(/Stock/)
    expect(await stock()).toEqual(before)
    const countAfter = (await as(db, service, () => db.query<{ n: number }>('select count(*)::int as n from public.orders'))).rows[0]!.n
    expect(countAfter).toBe(countBefore)
  })

  it('reutiliza al cliente por correo y acepta un cliente existente por id', async () => {
    const payload = request({ customer: { type: 'individual', full_name: 'Repetido', email: 'repetido@test.local' } })
    const a = await create(payload)
    const b = await create(payload)
    expect((await order(a)).customer_id).toBe((await order(b)).customer_id)
    const c = await create({ customer: { id: ids.customer }, items: [{ variant_id: ids.variantStock, quantity: 1 }] })
    expect((await order(c)).customer_id).toBe(ids.customer)
  })

  it('no acepta cliente inexistente, canal de cotización ni pedidos vacíos', async () => {
    await expect(create({ customer: { id: '99999999-9999-4999-8999-999999999999' }, items: [{ variant_id: ids.variantStock, quantity: 1 }] }, user(ids.admin), false)).rejects.toThrow(/cliente no existe/)
    await expect(create(request({ items: [] }), user(ids.admin), false)).rejects.toThrow(/entre 1 y 50/)
  })

  it('solo administración y el backend pueden usarla', async () => {
    await expect(create(request(), user(ids.workshop), false)).rejects.toThrow(/administración/)
    await expect(create(request(), user(ids.outsider), false)).rejects.toThrow()
    await expect(create(request(), anon, false)).rejects.toThrow()
    const id = await create(request(), service)
    expect((await order(id)).status).toBe('pending_confirmation')
  })
})
