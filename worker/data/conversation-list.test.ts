import { describe, expect, it } from 'vitest'
import { toConversationList } from './supabase-panel'

const row = (id: string, status: string, lastMessageAt: string, createdAt = lastMessageAt) => ({
  id,
  channel: 'web_chat',
  status,
  contact_name: null,
  contact_phone: null,
  handoff_reason: null,
  handoff_requested_at: null,
  created_at: createdAt,
  last_message_at: lastMessageAt,
  quote_id: null,
  last: [{ role: 'assistant', body: 'hola' }],
})

describe('orden de la lista de conversaciones', () => {
  const rows = [
    row('vieja-por-revisar', 'needs_human', '2026-10-20T10:00:00Z'),
    row('hoy-tarde', 'open', '2026-10-23T18:39:29Z'),
    row('hoy-temprano', 'open', '2026-10-23T12:17:00Z'),
  ]

  it('en una bandeja con estado, las que esperan a una persona van primero', () => {
    expect(toConversationList(rows).map((r) => r.id)).toEqual(['vieja-por-revisar', 'hoy-tarde', 'hoy-temprano'])
  })

  it('en «Todas» manda la última actividad: las conversaciones de hoy no quedan enterradas', () => {
    expect(toConversationList(rows, { triage: false }).map((r) => r.id)).toEqual(['hoy-tarde', 'hoy-temprano', 'vieja-por-revisar'])
  })

  it('cada conversación lleva cuándo empezó (el mismo día a distinta hora son filas distintas)', () => {
    const list = toConversationList(rows, { triage: false })
    expect(list[0]).toMatchObject({ id: 'hoy-tarde', createdAt: '2026-10-23T18:39:29Z' })
    expect(list[1]).toMatchObject({ id: 'hoy-temprano', createdAt: '2026-10-23T12:17:00Z' })
    expect(list[0]!.createdAt).not.toBe(list[1]!.createdAt)
  })
})
