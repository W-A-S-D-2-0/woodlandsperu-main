import { describe, expect, it } from 'vitest'
import { abuseReply, AGGRESSION_TEXT, isAbusive, NOT_UNDERSTOOD_TEXT } from './abuse'

describe('agresión verbal', () => {
  it.each(['Pene', 'pene', 'Basura', 'Porquería', 'eres una mierda', 'PUTA', 'puuuuta', 'm1erda', 'conchatumadre', 'concha tu madre', 'cállate', 'hdp', 'ctm', 'qué huevón', 'eres un idiota'])(
    'detecta «%s»',
    (text) => expect(isAbusive(text)).toBe(true),
  )

  it.each(['rctmr', 'RCTMR', 'eres un crj', 'q mrd', 'pn', 'np', 'kk', 'kkk', 'ptmr', 'csmre', 'pndjo', 'eres un hvn', 'ctmr ya pues'])(
    'detecta la abreviatura «%s»',
    (text) => expect(isAbusive(text)).toBe(true),
  )

  it.each([
    'pinga', 'qué pingas', 'orto', 'culo', 'forro', 'forrrro', 'boludo', 'pelotudo', 'maricón', 'maricones', 'cabro', 'rosquete', 'brocca', 'lameculos',
    'chucha', 'cojudazo', 'gonorrea', 'malparido', 'hijueputa', 'gilipollas', 'pendeja', 'culiao', 'aweonao', 'chinga tu madre', 'la concha de tu madre',
    'fuck you', 'son of a bitch', 'caralho', 'vaffanculo', 'cazzo', 'mamahuevo', 'cabrones',
  ])('detecta la grosería de cualquier país «%s»', (text) => expect(isAbusive(text)).toBe(true))

  it.each([
    'Hugo',
    'Necesito una broca para madera',
    'Vi la tabla en el foro',
    'Un cazo y una tabla',
    'Puedo coger el pedido en el taller',
    'Soy pinche de cocina en un restaurante',
    'Me llamo Ana Gil',
    'Una concha de abanico de entrada',
    'La cola de la tabla está bien',
    'Tengo una maraca',
    'Quiero que el pedido llegue en la mañana',
    'Pero quiero dos',
    'Necesito tablas para mi parrilla',
    'k precio tiene la Moshaco',
    'Quiero la tabla Ñañito',
    'Pnto de entrega en Miraflores',
    'Mi número es 987 654 321',
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
