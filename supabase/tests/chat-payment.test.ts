import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { ids, seedFixtures } from './support/fixtures'
import { anon, as, createTestDb, service, user } from './support/test-db'

/** Pago por Yape desde el chat: registro con captura, pedido pagado y en producción. Datos ficticios. */

let db: PGlite

beforeAll(async () => {
  db = await createTestDb()
  await seedFixtures(db)
  await as(db, service, () => db.query(`select public.apply_inventory_movement($1, 'production_in', 20)`, [ids.variantStock]), { commit: true })
}, 60_000)

let counter = 0
const newOrder = async (quantity = 2, confirm = true) => {
  counter += 1
  const payload = {
    channel: 'web_chat',
    customer: { type: 'individual', full_name: 'Cliente chat', email: `chat${counter}@test.local`, phone: '987654321' },
    items: [{ variant_id: ids.variantStock, quantity }],
    shipping_address: 'Jr. Prueba 123, Tarapoto',
    customer_confirmed: true,
    confirm,
  }
  return as(db, service, async () => (await db.query<{ id: string }>('select public.create_direct_order($1) as id', [JSON.stringify(payload)])).rows[0]!.id, { commit: true })
}

const pay = (orderId: string, path: string | null = 'PED/captura.jpg') =>
  as(db, service, async () => (await db.query<{ r: Record<string, unknown> }>('select public.record_chat_payment($1, $2) as r', [orderId, path])).rows[0]!.r, { commit: true })

const order = async (id: string) =>
  (await as(db, service, () => db.query<Record<string, unknown>>('select * from public.orders where id = $1', [id]))).rows[0]!

describe('record_chat_payment', () => {
  it('deja el pedido pagado y en producción, con el pago registrado', async () => {
    const id = await newOrder()
    expect((await order(id)).status).toBe('confirmed')

    const result = await pay(id)
    expect(result).toMatchObject({ status: 'in_production', payment_status: 'paid', already_paid: false })

    const o = await order(id)
    expect(o).toMatchObject({ status: 'in_production', payment_status: 'paid' })
    expect(String(o.internal_notes)).toContain('verificar en la app de Yape')

    const rows = (await as(db, service, () => db.query<Record<string, unknown>>('select * from public.order_payments where order_id = $1', [id]))).rows
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ method: 'yape', proof_path: 'PED/captura.jpg' })
    expect(Number(rows[0]!.amount)).toBe(Number(o.total))
  })

  it('un pedido sin confirmar se confirma al pagar', async () => {
    const id = await newOrder(1, false)
    expect((await order(id)).status).toBe('pending_confirmation')
    expect(await pay(id)).toMatchObject({ status: 'in_production', payment_status: 'paid' })
  })

  it('pagar dos veces no duplica el pago', async () => {
    const id = await newOrder()
    await pay(id)
    expect(await pay(id)).toMatchObject({ already_paid: true, payment_status: 'paid' })
    const n = (await as(db, service, () => db.query<{ n: number }>('select count(*)::int as n from public.order_payments where order_id = $1', [id]))).rows[0]!.n
    expect(n).toBe(1)
  })

  it('sin stock suficiente lo que se paga se fabrica a pedido y entra a producción', async () => {
    const id = await newOrder(25, false)
    const result = await pay(id)
    expect(result).toMatchObject({ status: 'in_production', payment_status: 'paid' })
    const [item] = await as(db, service, async () => (await db.query<{ fulfillment_type: string }>('select fulfillment_type from public.order_items where order_id = $1', [id])).rows)
    expect(item!.fulfillment_type).toBe('made_to_order')
  })

  it('un pedido cancelado no se puede pagar', async () => {
    const id = await newOrder()
    await as(db, service, () => db.query(`select public.cancel_order($1, 'prueba')`, [id]), { commit: true })
    await expect(pay(id)).rejects.toThrow(/cancelado/)
  })

  it('solo el backend puede registrar el pago', async () => {
    const id = await newOrder()
    await expect(as(db, anon, () => db.query('select public.record_chat_payment($1, null)', [id]))).rejects.toThrow(/permission denied/)
    await expect(as(db, user(ids.admin), () => db.query('select public.record_chat_payment($1, null)', [id]))).rejects.toThrow(/permission denied/)
  })
})

describe('order_payments', () => {
  it('el administrador la lee; el visitante no; no se edita', async () => {
    const id = await newOrder()
    await pay(id)
    const admin = await as(db, user(ids.admin), () => db.query('select * from public.order_payments where order_id = $1', [id]))
    expect(admin.rows).toHaveLength(1)
    await expect(as(db, anon, () => db.query('select * from public.order_payments'))).rejects.toThrow(/permission denied/)
    await expect(as(db, service, () => db.query('update public.order_payments set amount = 1'))).rejects.toThrow()
  })
})
