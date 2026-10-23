import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { ids, seedFixtures } from './support/fixtures'
import { anon, as, createTestDb, service, user } from './support/test-db'

/** Conversaciones del chat web y de WhatsApp. Datos ficticios. */

let db: PGlite

beforeAll(async () => {
  db = await createTestDb()
  await seedFixtures(db)
}, 60_000)

interface Recorded {
  conversation_id: string
  message_id: number
  status: string
  duplicate: boolean
}

let counter = 0
const ref = () => `ref-web-${(counter += 1)}-${Date.now()}`

const record = (payload: Record<string, unknown>, actor = service) =>
  as(
    db,
    actor,
    async () => (await db.query<{ r: Recorded }>('select public.record_conversation_message($1) as r', [JSON.stringify(payload)])).rows[0]!.r,
    { commit: true },
  )

const customerSays = (external_ref: string, body = 'Hola, quiero una tabla', extra: Record<string, unknown> = {}) =>
  record({ channel: 'web_chat', external_ref, role: 'customer', body, ...extra })

const conversation = async (id: string) =>
  (await as(db, service, () => db.query<Record<string, unknown>>('select * from public.conversations where id = $1', [id]))).rows[0]!

const messages = async (id: string) =>
  (await as(db, service, () => db.query<{ role: string; body: string }>('select role, body from public.conversation_messages where conversation_id = $1 order by id', [id]))).rows

describe('record_conversation_message', () => {
  it('crea la conversación con el primer mensaje y agrega los siguientes a la misma', async () => {
    const r = ref()
    const first = await customerSays(r)
    expect(first.status).toBe('open')
    expect(first.duplicate).toBe(false)
    const reply = await record({ channel: 'web_chat', external_ref: r, role: 'assistant', body: '¡Hola! ¿Qué modelo buscas?' })
    expect(reply.conversation_id).toBe(first.conversation_id)
    expect((await messages(first.conversation_id)).map((m) => m.role)).toEqual(['customer', 'assistant'])
  })

  it('un reintento con el mismo id del proveedor no duplica el mensaje', async () => {
    const r = `5191${Date.now()}`
    const payload = { channel: 'whatsapp', external_ref: r, role: 'customer', body: 'Hola por WhatsApp', external_id: `wamid.${Date.now()}` }
    const first = await record(payload)
    const again = await record(payload)
    expect(again.duplicate).toBe(true)
    expect(again.conversation_id).toBe(first.conversation_id)
    expect(await messages(first.conversation_id)).toHaveLength(1)
    const c = await conversation(first.conversation_id)
    expect(c.contact_phone).toBe(r)
  })

  it('rechaza mensajes vacíos, demasiado largos o con rol del equipo', async () => {
    await expect(customerSays(ref(), '   ')).rejects.toThrow(/entre 1 y 4000/)
    await expect(customerSays(ref(), 'x'.repeat(4001))).rejects.toThrow(/entre 1 y 4000/)
    await expect(record({ channel: 'web_chat', external_ref: ref(), role: 'staff', body: 'hola' })).rejects.toThrow(/panel/)
  })

  it('limita los mensajes del cliente por hora', async () => {
    const r = ref()
    for (let i = 0; i < 60; i += 1) await customerSays(r, `mensaje ${i}`)
    await expect(customerSays(r, 'uno más')).rejects.toThrow(/Demasiados mensajes/)
  }, 60_000)

  it('solo el backend registra mensajes', async () => {
    for (const actor of [anon, user(ids.admin)]) {
      await expect(record({ channel: 'web_chat', external_ref: ref(), role: 'customer', body: 'hola' }, actor)).rejects.toThrow(/permission denied|reservada al backend/)
    }
  })
})

describe('derivación a una persona', () => {
  it('pasa a needs_human con el motivo y no pisa a quien ya la tomó', async () => {
    const { conversation_id } = await customerSays(ref(), 'Quiero hablar con alguien')
    const status = await as(db, service, async () => (await db.query<{ s: string }>('select public.request_handoff($1, $2) as s', [conversation_id, 'Pidió hablar con una persona'])).rows[0]!.s, { commit: true })
    expect(status).toBe('needs_human')
    const c = await conversation(conversation_id)
    expect(c.handoff_reason).toBe('Pidió hablar con una persona')
    expect(c.handoff_requested_at).not.toBeNull()

    await as(db, user(ids.admin), () => db.query('select public.take_conversation($1)', [conversation_id]), { commit: true })
    const again = await as(db, service, async () => (await db.query<{ s: string }>('select public.request_handoff($1, $2) as s', [conversation_id, 'otra vez'])).rows[0]!.s, { commit: true })
    expect(again).toBe('with_human')
  })

  it('el equipo responde, toma la conversación y la devuelve al asistente o la cierra', async () => {
    const { conversation_id } = await customerSays(ref())
    await as(db, user(ids.admin), () => db.query('select public.staff_reply($1, $2)', [conversation_id, 'Hola, soy del equipo']), { commit: true })
    let c = await conversation(conversation_id)
    expect(c.status).toBe('with_human')
    expect(c.assigned_to).toBe(ids.admin)
    expect((await messages(conversation_id)).at(-1)).toEqual({ role: 'staff', body: 'Hola, soy del equipo' })

    await as(db, user(ids.admin), () => db.query(`select public.set_conversation_status($1, 'open')`, [conversation_id]), { commit: true })
    c = await conversation(conversation_id)
    expect(c.status).toBe('open')
    expect(c.assigned_to).toBeNull()

    await as(db, user(ids.admin), () => db.query(`select public.set_conversation_status($1, 'closed')`, [conversation_id]), { commit: true })
    expect((await conversation(conversation_id)).status).toBe('closed')
  })

  it('un mensaje del cliente reabre una conversación cerrada', async () => {
    const r = ref()
    const { conversation_id } = await customerSays(r)
    await as(db, user(ids.admin), () => db.query(`select public.set_conversation_status($1, 'closed')`, [conversation_id]), { commit: true })
    const back = await customerSays(r, 'Una pregunta más')
    expect(back.status).toBe('open')
  })

  it('solo se puede devolver al asistente o cerrar (no forzar otros estados)', async () => {
    const { conversation_id } = await customerSays(ref())
    await expect(
      as(db, user(ids.admin), () => db.query(`select public.set_conversation_status($1, 'with_human')`, [conversation_id])),
    ).rejects.toThrow(/devolver al asistente o cerrar/)
  })

  it('el taller y los externos no pueden responder ni leer', async () => {
    const { conversation_id } = await customerSays(ref())
    for (const actor of [user(ids.workshop), user(ids.outsider), user(ids.inactiveStaff), anon]) {
      await expect(as(db, actor, () => db.query('select public.staff_reply($1, $2)', [conversation_id, 'hola']))).rejects.toThrow(/permission denied|Solo administración/)
      const read = await as(db, actor, () => db.query('select id from public.conversations').catch(() => ({ rows: [] })))
      expect(read.rows).toHaveLength(0)
    }
  })

  it('el administrador lee conversaciones y mensajes', async () => {
    const { conversation_id } = await customerSays(ref())
    const rows = await as(db, user(ids.admin), () => db.query('select id from public.conversations where id = $1', [conversation_id]))
    expect(rows.rows).toHaveLength(1)
    const msgs = await as(db, user(ids.admin), () => db.query('select id from public.conversation_messages where conversation_id = $1', [conversation_id]))
    expect(msgs.rows).toHaveLength(1)
  })
})

describe('registro inalterable y cotizaciones del asistente', () => {
  it('los mensajes no se editan ni se borran', async () => {
    const { conversation_id } = await customerSays(ref())
    await expect(as(db, service, () => db.query(`update public.conversation_messages set body = 'otro' where conversation_id = $1`, [conversation_id]))).rejects.toThrow(/solo inserción/)
    await expect(as(db, service, () => db.query('delete from public.conversation_messages where conversation_id = $1', [conversation_id]))).rejects.toThrow(/solo inserción/)
  })

  it('vincula la cotización creada y el cliente que quedó registrado', async () => {
    const { conversation_id } = await customerSays(ref())
    const quote = await as(
      db,
      service,
      async () =>
        (
          await db.query<{ r: { quote_id: string } }>('select public.submit_quote_request($1) as r', [
            JSON.stringify({
              request_id: `chat-quote-${Date.now()}`,
              channel: 'web_chat',
              customer: { type: 'individual', full_name: 'Clienta del chat', email: `chat${Date.now()}@test.local` },
              items: [{ variant_id: ids.variantStock, quantity: 3 }],
            }),
          ])
        ).rows[0]!.r,
      { commit: true },
    )
    await as(db, service, () => db.query('select public.link_conversation_quote($1, $2)', [conversation_id, quote.quote_id]), { commit: true })
    const c = await conversation(conversation_id)
    expect(c.quote_id).toBe(quote.quote_id)
    expect(c.customer_id).not.toBeNull()
  })

  it('solo el backend vincula cotizaciones o deriva', async () => {
    const { conversation_id } = await customerSays(ref())
    for (const actor of [anon, user(ids.admin)]) {
      await expect(as(db, actor, () => db.query('select public.request_handoff($1, $2)', [conversation_id, 'x']))).rejects.toThrow(/permission denied|reservada al backend/)
    }
  })
})
