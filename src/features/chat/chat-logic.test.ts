import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '../../../shared/api/chat'
import { chatToken } from '../../../shared/api/chat'
import { createChatToken, lastMessageId, loadChatToken, messageTime, formatSizes, parseBody, photoForModel, typedLength, mergeMessages, statusNotice } from './chat-logic'

const msg = (id: number, body = 'x'): ChatMessage => ({ id, role: 'customer', body, createdAt: '2026-10-17T10:00:00Z' })

describe('token de chat', () => {
  it('genera tokens válidos para la API y distintos entre sí', () => {
    const a = createChatToken()
    expect(chatToken.safeParse(a).success).toBe(true)
    expect(createChatToken()).not.toBe(a)
  })

  it('reutiliza el guardado y tolera un almacenamiento bloqueado', () => {
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
    const first = loadChatToken(storage)
    expect(loadChatToken(storage)).toBe(first)

    const blocked = {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('bloqueado')
      },
    }
    expect(chatToken.safeParse(loadChatToken(blocked)).success).toBe(true)
    expect(chatToken.safeParse(loadChatToken(null)).success).toBe(true)
  });

  it('descarta un token guardado que no es válido', () => {
    const storage = { getItem: () => 'corto', setItem: () => {} }
    expect(loadChatToken(storage)).not.toBe('corto')
  })
})

describe('mensajes', () => {
  it('une sin duplicar y en orden', () => {
    const merged = mergeMessages([msg(1), msg(3)], [msg(2), msg(3, 'nuevo')])
    expect(merged.map((m) => m.id)).toEqual([1, 2, 3])
    expect(merged[2]?.body).toBe('nuevo')
  })

  it('calcula el último id', () => {
    expect(lastMessageId([])).toBe(0)
    expect(lastMessageId([msg(4), msg(9), msg(2)])).toBe(9)
  })

  it('avisa que quedó anotado para el equipo sin prometer que una persona escriba en el chat', () => {
    expect(statusNotice('open')).toBeNull()
    expect(statusNotice('needs_human')).toMatch(/anotada para el equipo/)
    expect(statusNotice('needs_human')).toMatch(/asistente sigue/)
    expect(statusNotice('with_human')).toBe(statusNotice('needs_human'))
  })
})

describe('parseBody', () => {
  it('convierte la lista de precios en tarjetas sin tocar las cifras', () => {
    const blocks = parseBody('Estos son:\n• Moshaco: desde S/ 197.00\n• Ñañito: desde S/ 178.00\nEl precio baja.')
    expect(blocks.map((b) => b.kind)).toEqual(['text', 'price', 'price', 'text'])
    expect(blocks[1]).toEqual({ kind: 'price', name: 'Moshaco', price: 'S/ 197.00' })
  })

  it('destaca el total y absorbe su nota', () => {
    const blocks = parseBody('• 2 × Moshaco — S/ 394.00\nTotal estimado: S/ 394.00\nSe registra como pedido.')
    expect(blocks.map((b) => b.kind)).toEqual(['line', 'total'])
    expect(blocks[1]).toEqual({ kind: 'total', amount: 'S/ 394.00', note: 'Se registra como pedido.' })
  })

  it('deja intacto un texto sin formato especial', () => {
    expect(parseBody('Hola')).toEqual([{ kind: 'text', text: 'Hola' }])
  })
})

describe('photoForModel', () => {
  it('encuentra la foto sin importar tildes ni mayúsculas', () => {
    expect(photoForModel('Ñañito')?.src).toBe('/images/oficial/nanito.jpg')
    expect(photoForModel('bosques amazonicos')?.src).toBe('/images/oficial/bosques-amazonicos.jpg')
  })

  it('devuelve undefined si el modelo no tiene foto', () => {
    expect(photoForModel('2 × Moshaco')).toBeUndefined()
  })
})

describe('messageTime y typedLength', () => {
  it('no devuelve hora si la fecha falta', () => {
    expect(messageTime('')).toBe('')
    expect(messageTime('no-es-fecha')).toBe('')
  })

  it('la escritura avanza y siempre termina a tiempo', () => {
    expect(typedLength(100, 0)).toBe(0)
    expect(typedLength(100, 700)).toBe(50)
    expect(typedLength(100, 5000)).toBe(100)
    expect(typedLength(0, 0)).toBe(0)
  })
})

describe('parseBody · productos', () => {
  it('reconoce cada modelo con colección, medidas y frase, sin confundirlo con una línea de pedido', () => {
    const body = 'Estos son:\n• Moshaco (Colección Parrilla) — Large 65*46*4 · Small 35*25*2\n  La joya de la corona.\n• Ya Vuelta — Circular 40*1.5\n• 2 × Moshaco — S/ 394.00'
    const blocks = parseBody(body)
    expect(blocks.map((b) => b.kind)).toEqual(['text', 'product', 'product', 'line'])
    expect(blocks[1]).toEqual({ kind: 'product', name: 'Moshaco', collection: 'Colección Parrilla', sizes: 'Large 65*46*4 · Small 35*25*2', description: 'La joya de la corona.' })
    expect(blocks[2]).toEqual({ kind: 'product', name: 'Ya Vuelta', collection: null, sizes: 'Circular 40*1.5', description: null })
  })
})

describe('formatSizes', () => {
  it('escribe las medidas con × y cm', () => {
    expect(formatSizes('Large 65*46*4 · Small 35*25*2')).toBe('Large 65 × 46 × 4 cm · Small 35 × 25 × 2 cm')
    expect(formatSizes('Circular 40*1.5')).toBe('Circular 40 × 1.5 cm')
  })

  it('deja igual lo que no es una medida', () => {
    expect(formatSizes('medidas por confirmar')).toBe('medidas por confirmar')
  })
})
