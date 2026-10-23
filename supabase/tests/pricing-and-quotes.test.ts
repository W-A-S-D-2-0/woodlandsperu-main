import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { ids, seedFixtures } from './support/fixtures'
import { as, createTestDb, service } from './support/test-db'

let db: PGlite

beforeAll(async () => {
  db = await createTestDb()
  await seedFixtures(db)
}, 60_000)

const price = (variant: string, qty: number) =>
  as(db, service, async () =>
    (
      await db.query<{ unit_price: string | null; price_source: string | null }>(
        'select unit_price, price_source from app.resolve_unit_price($1, $2)',
        [variant, qty],
      )
    ).rows[0],
  )

describe('precio unitario autorizado', () => {
  it('usa el precio de catálogo por debajo de la primera escala', async () => {
    expect(await price(ids.variantStock, 9)).toEqual({ unit_price: '100.00', price_source: 'catalog' })
  })

  it('aplica la escala más alta alcanzada', async () => {
    expect(await price(ids.variantStock, 10)).toEqual({ unit_price: '90.00', price_source: 'tier' })
    expect(await price(ids.variantStock, 49)).toEqual({ unit_price: '90.00', price_source: 'tier' })
    expect(await price(ids.variantStock, 50)).toEqual({ unit_price: '80.00', price_source: 'tier' })
  })

  it('sin precio publicado devuelve null (requiere cotización)', async () => {
    expect(await price(ids.variantNoPrice, 1)).toEqual({ unit_price: null, price_source: null })
  })

  it('rechaza variantes no disponibles y cantidades inválidas', async () => {
    await expect(price(ids.variantHidden, 1)).rejects.toThrow(/no está disponible/)
    await expect(price(ids.variantStock, 0)).rejects.toThrow(/mayor que cero/)
  })
})

describe('cotizaciones', () => {
  it('genera código, recalcula el subtotal y exige revisión si falta un precio', async () => {
    await as(db, service, async () => {
      const quote = (
        await db.query<{ id: string; code: string }>(
          `insert into public.quotes (customer_id, channel, requires_review) values ($1, 'web', false) returning id, code`,
          [ids.customer],
        )
      ).rows[0]!
      expect(quote.code).toMatch(/^COT-\d{6}$/)

      await db.query(
        `insert into public.quote_items (quote_id, variant_id, description, quantity, unit_price, price_source)
         values ($1, $2, 'Pieza de prueba', 10, 90, 'tier')`,
        [quote.id, ids.variantStock],
      )
      let row = (await db.query<{ subtotal: string; total: string; requires_review: boolean }>(
        'select subtotal, total, requires_review from public.quotes where id = $1',
        [quote.id],
      )).rows[0]
      expect(row).toEqual({ subtotal: '900.00', total: '900.00', requires_review: false })

      await db.query(
        `insert into public.quote_items (quote_id, description, quantity, custom_dimensions)
         values ($1, 'Tabla a medida', 2, '80*40*3')`,
        [quote.id],
      )
      row = (await db.query<{ subtotal: string; total: string; requires_review: boolean }>(
        'select subtotal, total, requires_review from public.quotes where id = $1',
        [quote.id],
      )).rows[0]
      expect(row).toEqual({ subtotal: '900.00', total: '900.00', requires_review: true })
    })
  })

  it('una cotización convertida no puede cambiar de estado', async () => {
    await expect(
      as(db, service, async () => {
        const id = (
          await db.query<{ id: string }>(
            `insert into public.quotes (customer_id, channel, status) values ($1, 'web', 'converted') returning id`,
            [ids.customer],
          )
        ).rows[0]!.id
        await db.query(`update public.quotes set status = 'submitted' where id = $1`, [id])
      }),
    ).rejects.toThrow(/está cerrada/)
  })

  it('los ajustes comerciales empiezan sin valores inventados', async () => {
    const rows = await as(db, service, async () =>
      (await db.query<{ key: string; value: unknown }>('select key, value from public.business_settings order by key')).rows,
    )
    expect(rows).toEqual([
      { key: 'quote_review_min_quantity', value: null },
      { key: 'quote_review_min_total', value: null },
      { key: 'quote_validity_days', value: null },
    ])
  })
})

describe('clientes', () => {
  it('exige un medio de contacto y razón social para empresas', async () => {
    await expect(
      as(db, service, () => db.query(`insert into public.customers (customer_type, full_name) values ('individual', 'Sin contacto')`)),
    ).rejects.toThrow(/customers_contact_required/)
    await expect(
      as(db, service, () =>
        db.query(`insert into public.customers (customer_type, full_name, phone) values ('business', 'Contacto', '+51999999999')`),
      ),
    ).rejects.toThrow(/customers_business_company/)
  })

  it('no duplica correos sin importar mayúsculas', async () => {
    await expect(
      as(db, service, () =>
        db.query(`insert into public.customers (customer_type, full_name, email) values ('individual', 'Otro', 'CLIENTE@test.local')`),
      ),
    ).rejects.toThrow(/customers_email_unique/)
  })
})
