import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { ids, seedFixtures } from './support/fixtures'
import { anon, as, createTestDb, service, user } from './support/test-db'

/** Citas que los clientes agendan en el chat. Datos ficticios. */

let db: PGlite

beforeAll(async () => {
  db = await createTestDb()
  await seedFixtures(db)
}, 60_000)

const inDays = (days: number, hour = 15) => {
  const d = new Date(Date.now() + days * 86_400_000)
  d.setUTCHours(hour, 0, 0, 0)
  return d.toISOString()
}

const book = (payload: Record<string, unknown>, actor = service) =>
  as(db, actor, async () => (await db.query<{ r: { id: string; starts_at: string } }>('select public.create_appointment($1) as r', [JSON.stringify(payload)])).rows[0]!.r, { commit: true })

const request = (starts_at: string, extra: Record<string, unknown> = {}) => ({ customer_name: 'Mario Quispe', contact_phone: '900 345 392', starts_at, ...extra })

const rows = async () =>
  (await as(db, service, () => db.query<{ id: string; customer_name: string; contact_phone: string; status: string; conversation_id: string | null }>('select * from public.appointments order by created_at'))).rows

describe('create_appointment', () => {
  it('guarda la cita con el celular limpio, y la deja pendiente', async () => {
    const made = await book(request(inDays(3)))
    const found = (await rows()).find((r) => r.id === made.id)!
    expect(found).toMatchObject({ customer_name: 'Mario Quispe', contact_phone: '900345392', status: 'pending' })
  })

  it('une la cita con la conversación del chat si existe', async () => {
    const ref = `ref-cita-${Date.now()}`
    await as(db, service, () => db.query('select public.record_conversation_message($1)', [JSON.stringify({ channel: 'web_chat', external_ref: ref, role: 'customer', body: 'hola' })]), { commit: true })
    const made = await book(request(inDays(4), { external_ref: ref }))
    expect((await rows()).find((r) => r.id === made.id)?.conversation_id).not.toBeNull()
  })

  it('no deja dos citas pendientes en la misma hora', async () => {
    const at = inDays(5)
    await book(request(at))
    await expect(book(request(at, { customer_name: 'Lucía Pérez' }))).rejects.toThrow(/ya fue tomada/)
  })

  it('una cita cancelada libera la hora', async () => {
    const at = inDays(6)
    const first = await book(request(at))
    await as(db, user(ids.admin), () => db.query(`select public.set_appointment_status($1, 'cancelled')`, [first.id]), { commit: true })
    await expect(book(request(at, { customer_name: 'Lucía Pérez' }))).resolves.toBeTruthy()
  })

  it('pide nombre, celular válido y una hora futura', async () => {
    await expect(book(request(inDays(2), { customer_name: ' ' }))).rejects.toThrow(/nombre/)
    await expect(book(request(inDays(2), { contact_phone: '12' }))).rejects.toThrow(/celular/)
    await expect(book(request(inDays(-1)))).rejects.toThrow(/no hayan pasado/)
  })

  it('solo el backend crea citas', async () => {
    for (const actor of [anon, user(ids.admin), user(ids.outsider)]) {
      await expect(book(request(inDays(7)), actor)).rejects.toThrow(/permission denied|Solo el backend/)
    }
  })
})

describe('horas tomadas', () => {
  it('devuelve solo las citas pendientes del rango', async () => {
    const at = inDays(8, 16)
    await book(request(at))
    const taken = (
      await as(db, service, () => db.query<{ t: string[] }>('select public.taken_appointment_slots($1, $2) as t', [inDays(8, 0), inDays(9, 0)]))
    ).rows[0]!.t
    expect(taken.map((t) => new Date(t).toISOString())).toEqual([at])
  })
})

describe('panel', () => {
  it('administración las lee y cambia su estado; el taller y los externos no', async () => {
    const made = await book(request(inDays(10)))
    await as(db, user(ids.admin), () => db.query(`select public.set_appointment_status($1, 'done')`, [made.id]), { commit: true })
    const seen = await as(db, user(ids.admin), () => db.query<{ status: string }>('select status from public.appointments where id = $1', [made.id]))
    expect(seen.rows[0]?.status).toBe('done')

    for (const actor of [user(ids.workshop), user(ids.outsider), user(ids.inactiveStaff), anon]) {
      const read = await as(db, actor, () => db.query('select id from public.appointments').catch(() => ({ rows: [] })))
      expect(read.rows).toHaveLength(0)
      await expect(as(db, actor, () => db.query(`select public.set_appointment_status($1, 'cancelled')`, [made.id]))).rejects.toThrow(/permission denied|Solo administración/)
    }
  })

  it('deja constancia en la auditoría', async () => {
    const made = await book(request(inDays(11)))
    await as(db, user(ids.admin), () => db.query(`select public.set_appointment_status($1, 'done')`, [made.id]), { commit: true })
    const log = await as(db, service, () => db.query<{ action: string }>(`select action from public.audit_log where entity_type = 'appointments' and entity_id = $1`, [made.id]))
    expect(log.rows.map((r) => r.action)).toContain('appointment_status')
  })
})
