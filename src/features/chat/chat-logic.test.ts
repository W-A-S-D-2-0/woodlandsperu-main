import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '../../../shared/api/chat'
import { chatToken } from '../../../shared/api/chat'
import { createChatToken, lastMessageId, loadChatToken, messageTime, formatSizes, parseBody, photoForModel, typedLength, mergeMessages, splitFlowFooter, startsNewConversation, statusNotice, trailingWarnings, transientMessages, isPlainText, parseRich, chatImage } from './chat-logic'

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

describe('startsNewConversation', () => {
  const teca = (body: string) => ({ role: 'assistant' as const, body })
  const cancelled = teca('Listo, cancelé el pedido. No dudes en volver a escribirnos.')

  it('tras cancelar, «Hola» o un botón abren una conversación nueva', () => {
    expect(startsNewConversation(cancelled, 'Hola', false)).toBe(true)
    expect(startsNewConversation(cancelled, '¡Holaaa! buenas tardes', false)).toBe(true)
    expect(startsNewConversation(cancelled, 'Ver los productos', true)).toBe(true)
  })

  it('tras cancelar, otro texto cualquiera sigue en la misma conversación', () => {
    expect(startsNewConversation(cancelled, 'gracias', false)).toBe(false)
    expect(startsNewConversation(cancelled, 'quiero hacer un pedido', false)).toBe(false)
  })

  it('también cuando se registró una cotización o se confirmó el pago', () => {
    expect(startsNewConversation(teca('Listo, registré tu pedido COT-000012. El equipo lo revisa.'), 'Hola', false)).toBe(true)
    expect(startsNewConversation(teca('¡Listo, recibimos tu pago de S/ 297.00! Tu pedido PED-000009 ya está en producción.'), 'Pedido para mi empresa', true)).toBe(true)
  })

  it('un pedido que espera su pago NO termina la conversación: la captura se sube en ella', () => {
    const waiting = teca('Listo, tu pedido PED-000009 quedó registrado por S/ 297.00.\n\nPara empezar a producir… toca «Subir captura de pago»')
    expect(startsNewConversation(waiting, 'Hola', false)).toBe(false)
    expect(startsNewConversation(waiting, 'Ver los productos', true)).toBe(false)
  })

  it('en plena conversación, ni «Hola» ni un botón la reinician', () => {
    expect(startsNewConversation(teca('¿Cuántas unidades quieres?'), 'Hola', false)).toBe(false)
    expect(startsNewConversation({ role: 'customer', body: 'Hola' }, 'Hola', false)).toBe(false)
    expect(startsNewConversation(undefined, 'Hola', false)).toBe(false)
  })
})

describe('splitFlowFooter', () => {
  const footer = '(Pedido paso a paso · escribe «cancelar» para salir)'

  it('quita la frase final del pedido paso a paso y avisa que la tenía', () => {
    expect(splitFlowFooter(`¿Cuántas unidades quieres?\n${footer}`)).toEqual({ text: '¿Cuántas unidades quieres?', inFlow: true })
    expect(splitFlowFooter(`Este es tu pedido:\n• 1 × Moshaco — S/ 433.90\n\n¿Confirmas el pedido? (sí/no)\n${footer}\n`)).toMatchObject({ inFlow: true })
  })

  it('un mensaje normal queda igual', () => {
    expect(splitFlowFooter('Hola, ¿qué te interesa?')).toEqual({ text: 'Hola, ¿qué te interesa?', inFlow: false })
    expect(splitFlowFooter('Para salir escribe «cancelar» cuando quieras.').inFlow).toBe(false)
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

  it('el resumen del pedido con grabado, sin precio o con «Total a pagar» no se confunde con la tarjeta de un modelo', () => {
    const blocks = parseBody('Este es tu pedido:\n• 1 × Sacha Paleta · Con mango · 52*30*2 — S/ 335.90 (grabado: «Familia Rojas»)\n• 2 × Moshaco · Small · 35*25*2 — precio por confirmar\nTotal a pagar: S/ 335.90\nLo registro como pedido.\nA nombre de: Ana')
    expect(blocks.map((b) => b.kind)).toEqual(['text', 'line', 'line', 'total', 'text'])
    expect(blocks[1]).toEqual({ kind: 'line', label: '1 × Sacha Paleta · Con mango · 52*30*2 (grabado: «Familia Rojas»)', amount: 'S/ 335.90' })
    expect(blocks[3]).toEqual({ kind: 'total', amount: 'S/ 335.90', note: 'Lo registro como pedido.', label: 'Total a pagar' })
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

describe('mensajes que no se guardan (agresión verbal)', () => {
  const entry = (id: number, role: 'customer' | 'assistant', body = 'x') => ({ id, role, body, createdAt: '' })

  it('no cuentan para pedir los mensajes nuevos al servidor', () => {
    expect(lastMessageId([entry(4, 'assistant'), entry(4.001, 'customer'), entry(4.002, 'assistant')])).toBe(4)
  })

  it('se muestran al final de lo guardado, en orden y sin chocar entre sí', () => {
    const saved = [entry(1, 'assistant'), entry(2, 'customer'), entry(3, 'assistant')]
    const first = transientMessages(saved, 'Pene', 'Disculpa')
    const second = transientMessages([...saved, ...first], 'Basura', 'Noto un tono agresivo')
    const merged = mergeMessages([...saved, ...first], second)
    expect(merged.map((m) => m.body)).toEqual(['x', 'x', 'x', 'Pene', 'Disculpa', 'Basura', 'Noto un tono agresivo'])
    expect(new Set(merged.map((m) => m.id)).size).toBe(merged.length)
    expect(merged.at(-1)!.id).toBeLessThan(4)
  })

  it('cuenta los mensajes agresivos seguidos; uno respetuoso reinicia la cuenta', () => {
    const saved = [entry(1, 'assistant'), entry(1.001, 'customer'), entry(1.002, 'assistant'), entry(1.003, 'customer'), entry(1.004, 'assistant')]
    expect(trailingWarnings(saved)).toBe(2)
    expect(trailingWarnings([...saved, entry(2, 'customer'), entry(3, 'assistant')])).toBe(0)
    expect(trailingWarnings([entry(1, 'assistant')])).toBe(0)
  })
})

describe('chatImage', () => {
  it('pide la imagen con el token en un encabezado y devuelve el archivo', async () => {
    const calls: [string, RequestInit | undefined][] = []
    const fetcher = (async (url: string, init?: RequestInit) => {
      calls.push([url, init])
      return new Response(new Blob(['x'], { type: 'image/png' }))
    }) as unknown as typeof fetch
    const blob = await chatImage(7, 'tok-123', fetcher)
    expect(blob.type).toBe('image/png')
    expect(calls[0]![0]).toBe('/api/chat/attachments/7')
    expect(calls[0]![0]).not.toContain('tok-123')
    expect(calls[0]![1]?.headers).toEqual({ 'x-chat-token': 'tok-123' })
  })

  it('si no existe, falla', async () => {
    await expect(chatImage(7, 'tok', (async () => new Response('x', { status: 404 })) as unknown as typeof fetch)).rejects.toThrow()
  })
})

describe('parseRich', () => {
  it('separa párrafos y arma listas con viñetas', () => {
    const blocks = parseRich('Ya casi. Necesito estos datos:\n\n• Tu celular\n• Tu correo\n\nEnvíamelos en un solo mensaje.\n\nEjemplo:\n987654321, ana@correo.com')
    expect(blocks).toEqual([
      { kind: 'p', lines: [{ label: null, text: 'Ya casi. Necesito estos datos:' }] },
      { kind: 'ul', items: ['Tu celular', 'Tu correo'] },
      { kind: 'p', lines: [{ label: null, text: 'Envíamelos en un solo mensaje.' }] },
      { kind: 'p', lines: [{ label: 'Ejemplo', text: '' }, { label: null, text: '987654321, ana@correo.com' }] },
    ])
  })

  it('reconoce listas numeradas y rótulos con su valor', () => {
    const blocks = parseRich('Estos son nuestros modelos:\n\n1. Moshaco\n2. Sacha Paleta\n\nA nombre de: Ana · ana@correo.com\nEntrega en: Jr. Lima 123, Tarapoto')
    expect(blocks[1]).toEqual({ kind: 'ol', items: [{ n: '1', text: 'Moshaco' }, { n: '2', text: 'Sacha Paleta' }] })
    expect(blocks[2]).toEqual({
      kind: 'p',
      lines: [{ label: 'A nombre de', text: 'Ana · ana@correo.com' }, { label: 'Entrega en', text: 'Jr. Lima 123, Tarapoto' }],
    })
  })

  it('una frase corrida es texto simple y lo demás no', () => {
    expect(isPlainText(parseRich('¡Hola! ¿Qué te interesa?'))).toBe(true)
    expect(isPlainText(parseRich('Hola.\n\nSegundo párrafo.'))).toBe(false)
    expect(isPlainText(parseRich('Me falta tu correo.\nEjemplo: a@b.co'))).toBe(false)
  })
})
