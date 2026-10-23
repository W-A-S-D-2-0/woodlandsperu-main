import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { ids, seedFixtures } from './support/fixtures'
import { anon, as, createTestDb, service, user } from './support/test-db'

let db: PGlite

beforeAll(async () => {
  db = await createTestDb()
  await seedFixtures(db)
}, 60_000)

const count = async (sql: string) => Number((await db.query<{ n: number }>(`select count(*)::int as n from ${sql}`)).rows[0]?.n)

describe('visitante anónimo', () => {
  it('ve solo el catálogo activo', async () => {
    await as(db, anon, async () => {
      expect(await count('public.products')).toBe(1)
      // La variante activa de un producto inactivo tampoco se ve.
      const skus = (await db.query<{ sku: string }>('select sku from public.product_variants order by sku')).rows.map((r) => r.sku)
      expect(skus).toEqual(['TEST-MTO', 'TEST-NOPRICE', 'TEST-STOCK'])
      expect(await count('public.price_tiers')).toBe(2)
    })
  })

  it.each([
    'public.variant_internal_pricing',
    'public.inventory_levels',
    'public.inventory_movements',
    'public.stock_alerts',
    'public.customers',
    'public.quotes',
    'public.orders',
    'public.staff_members',
    'public.audit_log',
    'public.business_settings',
  ])('no puede leer %s', async (table) => {
    await expect(as(db, anon, () => db.query(`select * from ${table}`))).rejects.toThrow(/permission denied/)
  })

  it('no puede escribir en el catálogo', async () => {
    await expect(
      as(db, anon, () => db.query(`update public.product_variants set catalog_price = 1 where id = $1`, [ids.variantStock])),
    ).rejects.toThrow(/permission denied/)
    await expect(
      as(db, anon, () =>
        db.query(`insert into public.customers (customer_type, full_name, email) values ('individual', 'x', 'x@x.pe')`),
      ),
    ).rejects.toThrow(/permission denied/)
  })

  it('no puede ejecutar funciones internas ni de inventario', async () => {
    await expect(
      as(db, anon, () => db.query(`select public.apply_inventory_movement($1, 'production_in', 5)`, [ids.variantStock])),
    ).rejects.toThrow(/permission denied/)
    await expect(as(db, anon, () => db.query(`select * from app.resolve_unit_price($1, 1)`, [ids.variantStock]))).rejects.toThrow(
      /permission denied/,
    )
  })

  it('consulta disponibilidad sin cantidades', async () => {
    const rows = await as(db, anon, async () =>
      (
        await db.query<{ variant_id: string; availability: string }>(
          'select * from public.get_variant_availability($1) order by variant_id',
          [[ids.variantStock, ids.variantMadeToOrder, ids.variantHidden]],
        )
      ).rows,
    )
    expect(rows).toEqual([
      { variant_id: ids.variantStock, availability: 'out_of_stock' },
      { variant_id: ids.variantMadeToOrder, availability: 'made_to_order' },
    ])
  })
})

describe('usuario autenticado sin rol de personal', () => {
  it('no ve datos privados', async () => {
    await as(db, user(ids.outsider), async () => {
      expect(await count('public.customers')).toBe(0)
      expect(await count('public.orders')).toBe(0)
      expect(await count('public.inventory_levels')).toBe(0)
      expect(await count('public.variant_internal_pricing')).toBe(0)
      expect(await count('public.products')).toBe(1)
    })
  })

  it('no puede modificar el catálogo', async () => {
    const result = await as(db, user(ids.outsider), () =>
      db.query(`update public.product_variants set catalog_price = 1 where id = $1`, [ids.variantStock]),
    )
    expect(result.affectedRows).toBe(0)
  })

  it('un administrador dado de baja pierde el acceso', async () => {
    await as(db, user(ids.inactiveStaff), async () => {
      expect(await count('public.customers')).toBe(0)
      expect(await count('public.products')).toBe(1)
    })
  })
})

describe('taller', () => {
  it('ve catálogo completo, inventario y pedidos', async () => {
    await as(db, user(ids.workshop), async () => {
      expect(await count('public.products')).toBe(2)
      expect(await count('public.orders')).toBe(1)
      expect(await count('public.inventory_levels')).toBe(0)
    })
  })

  it('no ve costos, clientes, cotizaciones ni auditoría', async () => {
    await as(db, user(ids.workshop), async () => {
      expect(await count('public.variant_internal_pricing')).toBe(0)
      expect(await count('public.customers')).toBe(0)
      expect(await count('public.quotes')).toBe(0)
      expect(await count('public.audit_log')).toBe(0)
    })
  })

  it('no puede cambiar precios ni pedidos', async () => {
    await as(db, user(ids.workshop), async () => {
      const price = await db.query(`update public.product_variants set catalog_price = 1 where id = $1`, [ids.variantStock])
      expect(price.affectedRows).toBe(0)
      const order = await db.query(`update public.orders set internal_notes = 'x' where id = $1`, [ids.order])
      expect(order.affectedRows).toBe(0)
    })
  })
})

describe('administración', () => {
  it('lee costos, clientes y auditoría', async () => {
    await as(db, user(ids.admin), async () => {
      expect(await count('public.variant_internal_pricing')).toBe(1)
      expect(await count('public.customers')).toBe(1)
      expect(await count('public.staff_members')).toBe(3)
    })
  })

  it('actualiza precios y queda registrado en auditoría', async () => {
    await as(db, user(ids.admin), async () => {
      const res = await db.query(`update public.product_variants set catalog_price = 120 where id = $1`, [ids.variantStock])
      expect(res.affectedRows).toBe(1)
      const audit = await db.query<{ actor_role: string; actor_user_id: string }>(
        `select actor_role, actor_user_id from public.audit_log where entity_type = 'product_variants' and entity_id = $1`,
        [ids.variantStock],
      )
      expect(audit.rows).toEqual([{ actor_role: 'admin', actor_user_id: ids.admin }])
    })
  })

  it('no puede alterar ni borrar la auditoría', async () => {
    await expect(as(db, user(ids.admin), () => db.query('delete from public.audit_log'))).rejects.toThrow(/permission denied/)
    await expect(as(db, service, () => db.query('delete from public.audit_log'))).rejects.toThrow(/solo inserción/)
  })

  it('no puede cambiar roles del personal por la API', async () => {
    await expect(
      as(db, user(ids.admin), () => db.query(`update public.staff_members set role = 'admin' where user_id = $1`, [ids.workshop])),
    ).rejects.toThrow(/permission denied/)
  })
})

describe('estado de pago protegido', () => {
  it('ni administración puede marcar un pedido como pagado', async () => {
    await expect(
      as(db, user(ids.admin), () => db.query(`update public.orders set payment_status = 'paid' where id = $1`, [ids.order])),
    ).rejects.toThrow(/permission denied/)
  })

  it('el backend tampoco puede hacerlo sin pasar por una confirmación de pago', async () => {
    await expect(
      as(db, service, () => db.query(`update public.orders set payment_status = 'paid' where id = $1`, [ids.order])),
    ).rejects.toThrow(/proveedor de pagos/)
  })

  it('no se puede crear un pedido ya pagado', async () => {
    await expect(
      as(db, service, () =>
        db.query(`insert into public.orders (customer_id, channel, payment_status) values ($1, 'web', 'paid')`, [ids.customer]),
      ),
    ).rejects.toThrow(/no puede registrarse como pagado/)
  })
})

describe('flujo de estados del pedido', () => {
  it('rechaza saltos de estado no permitidos', async () => {
    await expect(
      as(db, user(ids.admin), () => db.query(`update public.orders set status = 'delivered' where id = $1`, [ids.order])),
    ).rejects.toThrow(/Transición de estado no permitida/)
  })

  it('los estados que mueven stock no se alcanzan con un update directo', async () => {
    for (const status of ['confirmed', 'cancelled']) {
      await expect(
        as(db, user(ids.admin), () =>
          db.query(`update public.orders set status = $2, cancel_reason = 'Prueba' where id = $1`, [ids.order, status]),
        ),
      ).rejects.toThrow(/Usa la operación de pedido/)
    }
  })

  it('cancelar exige motivo y registra la fecha', async () => {
    await expect(
      as(db, user(ids.admin), () => db.query(`select public.cancel_order($1, '  ')`, [ids.order])),
    ).rejects.toThrow(/motivo/)

    await as(db, user(ids.admin), async () => {
      await db.query(`select public.cancel_order($1, 'Prueba')`, [ids.order])
      const row = (await db.query<{ cancelled_at: Date | null }>('select cancelled_at from public.orders where id = $1', [ids.order])).rows[0]
      expect(row?.cancelled_at).toBeInstanceOf(Date)
    })
  })
})
