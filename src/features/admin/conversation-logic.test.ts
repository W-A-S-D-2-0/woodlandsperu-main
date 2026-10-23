import { describe, expect, it } from 'vitest'
import { contactLabel, conversationTone, preview, timeAgo } from './conversation-logic'

const now = new Date('2026-10-17T12:00:00Z')

describe('conversaciones', () => {
  it('resalta las que el equipo debe revisar', () => {
    expect(conversationTone('needs_human')).toBe('warn')
    expect(conversationTone('with_human')).toBe('info')
    expect(conversationTone('open')).toBe('good')
    expect(conversationTone('closed')).toBe('muted')
  })

  it('nombra al contacto con lo que haya', () => {
    expect(contactLabel({ contactName: 'Luis', contactPhone: '5199' })).toBe('Luis')
    expect(contactLabel({ contactName: null, contactPhone: '5199' })).toBe('5199')
    expect(contactLabel({ contactName: null, contactPhone: null })).toBe('Visitante de la web')
  })

  it('recorta sin cortar palabras y respeta los textos cortos', () => {
    expect(preview('Hola   mundo')).toBe('Hola mundo')
    expect(preview(null)).toBe('')
    const long = 'palabra '.repeat(30)
    const out = preview(long, 40)
    expect(out.endsWith('…')).toBe(true)
    expect(out.length).toBeLessThanOrEqual(41)
    expect(out).not.toMatch(/palab…$/)
  })

  it('cuenta el tiempo transcurrido', () => {
    expect(timeAgo('2026-10-17T11:59:40Z', now)).toBe('ahora')
    expect(timeAgo('2026-10-17T11:30:00Z', now)).toBe('hace 30 min')
    expect(timeAgo('2026-10-17T09:00:00Z', now)).toBe('hace 3 h')
    expect(timeAgo('2026-10-15T12:00:00Z', now)).toBe('hace 2 d')
  })
})
