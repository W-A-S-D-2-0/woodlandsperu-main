import { describe, expect, it } from 'vitest'
import { smallTalkReply } from './assistant'

describe('smallTalkReply', () => {
  it('responde a saludos, gracias, despedidas y asentimientos', () => {
    expect(smallTalkReply('Hola')).toMatch(/Teca/)
    expect(smallTalkReply('¡Buenas tardes!')).toMatch(/Teca/)
    expect(smallTalkReply('Muchas gracias 😊')).toMatch(/Con gusto/)
    expect(smallTalkReply('chao')).toMatch(/Hasta pronto/)
    expect(smallTalkReply('Ok, gracias')).toMatch(/Perfecto/)
  })

  it('deja pasar todo mensaje que traiga algo más', () => {
    expect(smallTalkReply('Hola, ¿cuánto cuesta la Moshaco?')).toBeNull()
    expect(smallTalkReply('gracias, ahora quiero 5 tablas')).toBeNull()
    expect(smallTalkReply('ok quiero hacer un pedido')).toBeNull()
    expect(smallTalkReply('')).toBeNull()
  })
})
