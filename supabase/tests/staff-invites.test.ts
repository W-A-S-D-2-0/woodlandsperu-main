import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { ids, seedFixtures } from './support/fixtures'
import { anon, as, createTestDb, service, user } from './support/test-db'

/** Crear cuenta: solo los correos de la lista de acceso entran al panel. Datos ficticios. */

let db: PGlite

beforeAll(async () => {
  db = await createTestDb()
  await seedFixtures(db)
  await db.exec(`insert into public.staff_invites (email, role, full_name) values ('dueno@test.local', 'admin', 'Dueño de prueba')`)
  await db.exec(`insert into public.staff_signup (singleton, open_slots) values (true, 2) on conflict (singleton) do update set open_slots = 2`)
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

  it('sin invitación, las primeras cuentas entran como administración y al agotarse el cupo ya no', async () => {
    const ana = '00000000-0000-4000-8000-0000000000a2'
    const luis = '00000000-0000-4000-8000-0000000000a3'
    const intruso = '00000000-0000-4000-8000-0000000000a4'
    await newUser(ana, 'ana@example.com', JSON.stringify({ full_name: 'Ana Quispe' }))
    await newUser(luis, 'luis@example.com', JSON.stringify({ full_name: 'Luis Ramos' }))
    await newUser(intruso, 'cualquiera@example.com', JSON.stringify({ full_name: 'Intruso' }))
    expect(await staffOf(ana)).toEqual([{ role: 'admin', full_name: 'Ana Quispe', is_active: true }])
    expect(await staffOf(luis)).toHaveLength(1)
    expect(await staffOf(intruso)).toEqual([])
    const left = await as(db, service, () => db.query('select open_slots from public.staff_signup'))
    expect(left.rows).toEqual([{ open_slots: 0 }])
  })

  it('la lista de acceso no se lee ni se edita desde la web', async () => {
    for (const actor of [anon, user(ids.admin), user(ids.workshop)]) {
      await expect(as(db, actor, () => db.query('select email from public.staff_invites'))).rejects.toThrow(/permission denied/)
      await expect(as(db, actor, () => db.query(`insert into public.staff_invites (email) values ('x@y.co')`))).rejects.toThrow(/permission denied/)
    }
    const rows = await as(db, service, () => db.query('select email from public.staff_invites'))
    expect(rows.rows).toHaveLength(1)
    for (const actor of [anon, user(ids.admin)]) {
      await expect(as(db, actor, () => db.query('update public.staff_signup set open_slots = 99'))).rejects.toThrow(/permission denied/)
    }
  })
})
