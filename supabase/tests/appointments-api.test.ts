import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { ChatResponse } from '../../shared/api/chat'
import { availableDays, slotInstant } from '../../shared/config/appointments'
import { createApp } from '../../worker/app'
import { seedFixtures } from './support/fixtures'
import { as, createTestDb, service } from './support/test-db'

/**
 * Prueba de punta a punta de «Agendar cita»: la ruta real del Worker y el adaptador real de Supabase,
 * con las llamadas `rpc` dirigidas a PostgreSQL (PGlite) con todas las migraciones, incluida la de citas.
 * Así se comprueban juntos los nombres de parámetros, los códigos de error y la regla de no repetir hora.
 */

let db: PGlite

/** Lo mínimo de `.from(tabla).select().eq().gt().order().limit().maybeSingle()` que usa el adaptador, traducido a SQL. */
function query(table: string, columns: string) {
  const where: string[] = []
  const values: unknown[] = []
  let order = ''
  let limit = ''
  const run = async (single: boolean) => {
    const sql = `select ${columns} from public.${table}${where.length ? ` where ${where.join(' and ')}` : ''}${order}${limit}`
    const rows = await as(db, service, () => db.query(sql, values))
    const data = JSON.parse(JSON.stringify(rows.rows))
    return { data: single ? (data[0] ?? null) : data, error: null }
  }
  const b = {
    eq: (col: string, v: unknown) => (values.push(v), where.push(`${col} = $${values.length}`), b),
    gt: (col: string, v: unknown) => (values.push(v), where.push(`${col} > $${values.length}`), b),
    order: (col: string, o?: { ascending?: boolean }) => ((order = ` order by ${col}${o?.ascending === false ? ' desc' : ''}`), b),
    limit: (n: number) => ((limit = ` limit ${n}`), b),
    maybeSingle: () => run(true),
    then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => run(false).then(ok, bad),
  }
  return b
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => ({ select: (columns: string) => query(table, columns) }),
    rpc: async (fn: string, args: Record<string, unknown>) => {
      const keys = Object.keys(args)
      const named = keys.map((k, i) => `${k} => $${i + 1}`).join(', ')
      const values = keys.map((k) => (typeof args[k] === 'object' && args[k] !== null ? JSON.stringify(args[k]) : args[k]))
      try {
        const rows = await as(db, service, () => db.query<{ r: unknown }>(`select public.${fn}(${named}) as r`, values), { commit: true })
        // PostgREST devuelve JSON: fechas como texto, jsonb como objeto.
        return { data: JSON.parse(JSON.stringify(rows.rows[0]?.r ?? null)), error: null }
      } catch (error) {
        const e = error as { code?: string; message: string }
        return { data: null, error: { code: e.code, message: e.message } }
      }
    },
  }),
}))

beforeAll(async () => {
  db = await createTestDb()
  await seedFixtures(db)
}, 60_000)

const ENV = {
  APP_ENV: 'development',
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_PUBLISHABLE_KEY: 'publishable-test',
  SUPABASE_SECRET_KEY: 'secret-test',
} as Env

const token = (c: string) => c.repeat(32)
const app = createApp({})

const firstSlots = (count: number) =>
  availableDays(new Date(), [])
    .flatMap((d) => d.hours.map((h) => slotInstant(d.date, h).toISOString()))
    .slice(0, count)

const post = (body: Record<string, unknown>) =>
  app.request('/api/chat/appointments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }, ENV)

describe('Agendar cita de punta a punta', () => {
  it('guarda la cita en la base, la anota en la conversación y la deja pendiente para el panel', async () => {
    const [startsAt] = firstSlots(1)
    const res = await post({ token: token('b'), name: 'Mario Quispe', phone: '900 345 392', startsAt })
    expect(res.status).toBe(200)
    const body = (await res.json()) as ChatResponse
    expect(body.messages.map((m) => m.role)).toEqual(['customer', 'assistant'])

    const saved = (await as(db, service, () => db.query<{ customer_name: string; contact_phone: string; status: string; starts_at: string; conversation_id: string | null }>('select * from public.appointments'))).rows
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({ customer_name: 'Mario Quispe', contact_phone: '900345392', status: 'pending' })
    expect(new Date(saved[0]!.starts_at).toISOString()).toBe(startsAt)
    expect(saved[0]!.conversation_id).not.toBeNull()
  })

  it('la hora tomada aparece en la lista de horas y otro cliente ya no puede reservarla', async () => {
    const [taken] = firstSlots(1)
    const list = await app.request(`/api/chat/appointments/slots?token=${token('c')}`, {}, ENV)
    expect(((await list.json()) as { taken: string[] }).taken.map((t) => new Date(t).toISOString())).toContain(taken)

    const again = await post({ token: token('c'), name: 'Lucía Pérez', phone: '911222333', startsAt: taken })
    expect(again.status).toBe(422)
    const count = (await as(db, service, () => db.query<{ n: number }>('select count(*)::int as n from public.appointments'))).rows[0]!.n
    expect(count).toBe(1)
  })

  it('otro cliente reserva otra hora sin problema', async () => {
    const [, other] = firstSlots(2)
    const res = await post({ token: token('d'), name: 'Lucía Pérez', phone: '911222333', startsAt: other })
    expect(res.status).toBe(200)
    const count = (await as(db, service, () => db.query<{ n: number }>('select count(*)::int as n from public.appointments'))).rows[0]!.n
    expect(count).toBe(2)
  })

  it('rechaza datos inválidos sin tocar la base', async () => {
    const [, , third] = firstSlots(3)
    expect((await post({ token: token('e'), name: '', phone: '900345392', startsAt: third })).status).toBe(422)
    expect((await post({ token: token('e'), name: 'Mario', phone: '12', startsAt: third })).status).toBe(422)
    const count = (await as(db, service, () => db.query<{ n: number }>('select count(*)::int as n from public.appointments'))).rows[0]!.n
    expect(count).toBe(2)
  })
})
