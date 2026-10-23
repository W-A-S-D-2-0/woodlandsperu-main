import { describe, expect, it } from 'vitest'
import { shortBlurb } from './assistant'

describe('shortBlurb', () => {
  it('suma frases cuando la primera es demasiado corta', () => {
    const text = 'The Forest Paddle. Ergonomía, arte y resistencia en una sola pieza, diseñada para quienes ven en el servicio un arte. Incluye el mango.'
    expect(shortBlurb(text)).toBe('The Forest Paddle. Ergonomía, arte y resistencia en una sola pieza, diseñada para quienes ven en el servicio un arte.')
  })

  it('corta una frase larga en los dos puntos, sin dejar la idea a medias', () => {
    const text = 'La opción perfecta para usar tu creatividad: una fusión perfecta de maderas, colores y texturas, para pizzas, piqueos, postres, panes, carnes, o lo que quieras.'
    expect(shortBlurb(text)).toBe('La opción perfecta para usar tu creatividad.')
  })

  it('deja intacta una descripción corta y tolera la ausencia', () => {
    expect(shortBlurb('Tabla de presentación delicada y minimalista.')).toBe('Tabla de presentación delicada y minimalista.')
    expect(shortBlurb(null)).toBeNull()
    expect(shortBlurb('')).toBeNull()
  })

  it('nunca pasa del máximo aunque no haya puntuación para cortar', () => {
    const long = 'palabra '.repeat(40).trim()
    const out = shortBlurb(long)!
    expect(out.length).toBeLessThanOrEqual(131)
    expect(out.endsWith('…')).toBe(true)
  })
})
