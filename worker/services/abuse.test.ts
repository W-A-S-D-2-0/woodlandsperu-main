import { describe, expect, it } from 'vitest'
import { abuseReply, AGGRESSION_TEXT, isAbusive, NOT_UNDERSTOOD_TEXT } from './abuse'

describe('agresión verbal', () => {
  it.each(['Pene', 'pene', 'Basura', 'Porquería', 'eres una mierda', 'PUTA', 'puuuuta', 'm1erda', 'conchatumadre', 'concha tu madre', 'cállate', 'hdp', 'ctm', 'qué huevón', 'eres un idiota'])(
    'detecta «%s»',
    (text) => expect(isAbusive(text)).toBe(true),
  )

  it.each([
    'Hugo',
    'Me llamo Pedro Vergara',
    'Quiero 10 tablas Moshaco',
    'Necesito una computadora para el pedido',
    'Hola, ¿cuánto cuesta la tabla Super Grill?',
    'Mi apellido es Peña',
    'Pásame el catálogo, por favor',
    'No me gusta cómo quedó el grabado',
    '',
  ])('no confunde «%s»', (text) => expect(isAbusive(text)).toBe(false))

  it('la primera vez Teca pide repetir; si el cliente insiste, reconoce la agresión', () => {
    expect(abuseReply(0)).toBe(NOT_UNDERSTOOD_TEXT)
    expect(abuseReply(0)).toMatch(/no logré entenderte/)
    expect(abuseReply(1)).toBe(AGGRESSION_TEXT)
    expect(abuseReply(3)).toBe(AGGRESSION_TEXT)
  })
})
