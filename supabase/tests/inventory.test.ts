import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { ids, seedFixtures } from './support/fixtures'
import { as, createTestDb, service, user, type Actor } from './support/test-db'

let db: PGlite

beforeAll(async () => {
  db = await createTestDb()
  await seedFixtures(db)
}, 60_000)

interface Level {
  on_hand: number
  reserved: number
  available: number
}

const move = (type: string, quantity: number, extra: { reason?: string; order?: string; key?: string; variant?: string } = {}) =>
  db.query(`select * from public.apply_inventory_movement($1, $2::public.inventory_movement_type, $3, $4, $5, $6)`, [
    extra.variant ?? ids.variantStock,
    type,
    quantity,
    extra.reason ?? null,
    extra.order ?? null,
    extra.key ?? null,
  ])

const level = async (variant: string = ids.variantStock): Promise<Level | undefined> =>
  (await db.query<Level>('select on_hand, reserved, available from public.inventory_levels where variant_id = $1', [variant])).rows[0]

const admin: Actor = user(ids.admin)

describe('movimientos de inventario', () => {
  it('registra producción, reserva y salida por venta con stock disponible correcto', async () => {
    await as(db, admin, async () => {
      await move('production_in', 10)
      expect(await level()).toEqual({ on_hand: 10, reserved: 0, available: 10 })

      await move('reservation', 4, { order: ids.order })
      expect(await level()).toEqual({ on_hand: 10, reserved: 4, available: 6 })

      await move('sale_out', 3, { order: ids.order })
      expect(await level()).toEqual({ on_hand: 7, reserved: 1, available: 6 })

      await move('reservation_release', 1, { order: ids.order })
      expect(await level()).toEqual({ on_hand: 7, reserved: 0, available: 7 })

      const history = await db.query<{ movement_type: string; on_hand_after: number; created_by: string }>(
        'select movement_type, on_hand_after, created_by from public.inventory_movements order by id',
      )
      expect(history.rows.map((r) => r.movement_type)).toEqual(['production_in', 'reservation', 'sale_out', 'reservation_release'])
      expect(history.rows.every((r) => r.created_by === ids.admin)).toBe(true)
    })
  })

  it('nunca deja stock negativo', async () => {
    await expect(
      as(db, admin, async () => {
        await move('production_in', 2)
        await move('adjustment_out', 3, { reason: 'Merma' })
      }),
    ).rejects.toThrow(/Stock insuficiente/)
  })

  it('no reserva más de lo disponible', async () => {
    await expect(
      as(db, admin, async () => {
        await move('production_in', 2)
        await move('reservation', 3, { order: ids.order })
      }),
    ).rejects.toThrow(/Stock disponible insuficiente/)
  })

  it('un ajuste negativo no puede dejar reservas sin respaldo', async () => {
    await expect(
      as(db, admin, async () => {
        await move('production_in', 5)
        await move('reservation', 4, { order: ids.order })
        await move('adjustment_out', 2, { reason: 'Merma' })
      }),
    ).rejects.toThrow(/reservas sin respaldo/)
  })

  it('la salida por venta requiere reserva previa', async () => {
    await expect(
      as(db, admin, async () => {
        await move('production_in', 5)
        await move('sale_out', 1, { order: ids.order })
      }),
    ).rejects.toThrow(/requiere stock reservado/)
  })

  it('exige motivo en ajustes y pedido en reservas', async () => {
    await expect(as(db, admin, () => move('adjustment_in', 1))).rejects.toThrow(/requieren un motivo/)
    await expect(as(db, admin, () => move('adjustment_in', 1, { reason: '   ' }))).rejects.toThrow(/requieren un motivo/)
    await expect(as(db, admin, () => move('reservation', 1))).rejects.toThrow(/requieren un pedido/)
    await expect(as(db, admin, () => move('production_in', 0))).rejects.toThrow(/mayor que cero/)
  })

  it('no lleva inventario de piezas fabricadas bajo pedido', async () => {
    await expect(as(db, admin, () => move('production_in', 1, { variant: ids.variantMadeToOrder }))).rejects.toThrow(
      /fabricadas bajo pedido/,
    )
  })
})

describe('idempotencia', () => {
  it('la misma clave no aplica el movimiento dos veces', async () => {
    await as(db, admin, async () => {
      const first = (await move('production_in', 5, { key: 'produccion-lote-0001' })).rows[0] as { id: number }
      const second = (await move('production_in', 5, { key: 'produccion-lote-0001' })).rows[0] as { id: number }
      expect(second.id).toBe(first.id)
      expect(await level()).toEqual({ on_hand: 5, reserved: 0, available: 5 })
    })
  })

  it('rechaza reutilizar la clave con otros datos', async () => {
    await expect(
      as(db, admin, async () => {
        await move('production_in', 5, { key: 'produccion-lote-0002' })
        await move('production_in', 6, { key: 'produccion-lote-0002' })
      }),
    ).rejects.toThrow(/clave de idempotencia ya se usó/)
  })
})

describe('historial inmutable', () => {
  it('no se pueden editar ni borrar movimientos', async () => {
    await expect(
      as(db, service, async () => {
        await move('production_in', 1)
        await db.query('update public.inventory_movements set quantity = 99')
      }),
    ).rejects.toThrow(/solo inserción/)

    await expect(
      as(db, service, async () => {
        await move('production_in', 1)
        await db.query('delete from public.inventory_movements')
      }),
    ).rejects.toThrow(/solo inserción/)
  })

  it('el personal no puede escribir existencias directamente', async () => {
    await expect(
      as(db, admin, () => db.query(`insert into public.inventory_levels (variant_id, on_hand) values ($1, 100)`, [ids.variantStock])),
    ).rejects.toThrow(/permission denied/)
  })
})

describe('permisos por rol', () => {
  it('el taller registra producción pero no ajustes', async () => {
    await as(db, user(ids.workshop), async () => {
      await move('production_in', 3)
      expect((await level())?.on_hand).toBe(3)
    })
    await expect(as(db, user(ids.workshop), () => move('adjustment_in', 1, { reason: 'x' }))).rejects.toThrow(/Solo administración/)
  })

  it('un usuario sin rol no registra movimientos', async () => {
    await expect(as(db, user(ids.outsider), () => move('production_in', 1))).rejects.toThrow(/No autorizado/)
  })

  it('el backend puede reservar para pedidos', async () => {
    await as(db, service, async () => {
      await move('production_in', 2)
      const row = (await move('reservation', 2, { order: ids.order })).rows[0] as { actor_role: string; created_by: string | null }
      expect(row.actor_role).toBe('service')
      expect(row.created_by).toBeNull()
    })
  })
})

describe('alertas de stock mínimo', () => {
  const openAlerts = async () =>
    Number((await db.query<{ n: number }>('select count(*)::int as n from public.stock_alerts where resolved_at is null')).rows[0]?.n)

  it('genera una sola alerta al bajar del mínimo y la resuelve al reponer', async () => {
    await as(db, admin, async () => {
      await move('production_in', 10)
      await db.query('select public.update_inventory_settings($1, 5, $2)', [ids.variantStock, 'Responsable de prueba'])
      expect(await openAlerts()).toBe(0)

      await move('reservation', 6, { order: ids.order }) // disponible 4 <= 5
      expect(await openAlerts()).toBe(1)

      await move('reservation', 2, { order: ids.order }) // disponible 2: sin duplicar
      expect(await openAlerts()).toBe(1)

      await move('production_in', 10) // disponible 12
      expect(await openAlerts()).toBe(0)
      expect(Number((await db.query<{ n: number }>('select count(*)::int as n from public.stock_alerts')).rows[0]?.n)).toBe(1)
    })
  })

  it('sin mínimo configurado no hay alertas', async () => {
    await as(db, admin, async () => {
      await move('production_in', 1)
      await move('reservation', 1, { order: ids.order })
      expect(await openAlerts()).toBe(0)
    })
  })

  it('solo administración configura el mínimo', async () => {
    await expect(
      as(db, user(ids.workshop), () => db.query('select public.update_inventory_settings($1, 5, null)', [ids.variantStock])),
    ).rejects.toThrow(/Solo administración/)
  })
})
