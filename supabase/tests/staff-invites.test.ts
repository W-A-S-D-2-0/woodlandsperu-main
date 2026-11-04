import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { ids, seedFixtures } from './support/fixtures'
import { anon, as, createTestDb, service, user } from './support/test-db'

/** Crear cuenta: solo entra al panel quien tiene su correo en la lista de invitaciones, con ese rol. Datos ficticios. */

let db: PGlite

beforeAll(async () => {
  db = await createTestDb()
  await seedFixtures(db)
  await db.exec(`insert into public.staff_invites (email, role, full_name) values ('dueno@test.local', 'admin', 'Dueño de prueba')`)
}, 60_000)

const newUser = (id: string, email: string, meta = '{}') =>
  db.query('insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3::jsonb)', [id, email, meta])

const staffOf = async (id: string) =>
  (await db.query<{ role: string; full_name: string; is_active: boolean }>('select role, full_name, is_active from public.staff_members where user_id = $1', [id])).rows

describe('cuentas nuevas y lista de acceso', () => {
  it('un correo autorizado entra como administración con el nombre que escribió', async () => {
    const id = '00000000-0000-4000-8000-0000000000a1'
    await newUser(id, 'Dueno@Test.local', JSON.stringify({ full_name: 'Ana Quispe' }))
    expect(await staffOf(id)).toEqual([{ role: 'admin', full_name: 'Ana Quispe', is_active: true }])
  })

  it('una cuenta sin invitación se crea pero no entra al panel', async () => {
    const extraño = '00000000-0000-4000-8000-0000000000a2'
    await newUser(extraño, 'cualquiera@example.com', JSON.stringify({ full_name: 'Alguien de afuera' }))
    expect(await staffOf(extraño)).toEqual([])
    const cuenta = await db.query('select 1 from auth.users where id = $1', [extraño])
    expect(cuenta.rows).toHaveLength(1)
  })

  it('con invitación entra con el rol de la invitación', async () => {
    const taller = '00000000-0000-4000-8000-0000000000a3'
    await db.exec(`insert into public.staff_invites (email, role) values ('taller@example.com', 'workshop')`)
    await newUser(taller, 'taller@example.com')
    expect(await staffOf(taller)).toEqual([{ role: 'workshop', full_name: 'taller@example.com', is_active: true }])
  })

  it('la lista de acceso no se lee ni se edita desde la web', async () => {
    for (const actor of [anon, user(ids.admin), user(ids.workshop)]) {
      await expect(as(db, actor, () => db.query('select email from public.staff_invites'))).rejects.toThrow(/permission denied/)
      await expect(as(db, actor, () => db.query(`insert into public.staff_invites (email) values ('x@y.co')`))).rejects.toThrow(/permission denied/)
    }
    const rows = await as(db, service, () => db.query('select email from public.staff_invites'))
    expect(rows.rows).toHaveLength(2)
  })
})
