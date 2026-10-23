import { describe, expect, it } from 'vitest'
import { boardShapeFor, defaultBoardShape } from '../../content/board-shapes'
import { engravingPositions } from '../../content/engraving'
import { modelPhotos } from '../../content/model-photos'
import { textPlacement } from './EngravingBoard'
import { engravingFontSize } from './engraving-logic'

const models = Object.values(modelPhotos).map((p) => p.name)

describe('silueta de cada tabla', () => {
  it('todos los modelos del catálogo oficial tienen su propia forma', () => {
    expect(models).toHaveLength(6)
    for (const name of models) expect(boardShapeFor(name), name).not.toBe(defaultBoardShape)
  })

  it('reconoce el nombre sin importar tildes ni mayúsculas, y usa la genérica si no lo conoce', () => {
    expect(boardShapeFor('ÑAÑITO').kind).toBe('rounded-sides')
    expect(boardShapeFor('bosques amazonicos').ratio).toBeCloseTo(40 / 16)
    expect(boardShapeFor('Ya Vuelta').kind).toBe('round')
    expect(boardShapeFor('Sacha Paleta').kind).toBe('paddle')
    expect(boardShapeFor('Moshaco').groove).toBe(true)
    expect(boardShapeFor(undefined)).toBe(defaultBoardShape)
    expect(boardShapeFor('Tabla inventada')).toBe(defaultBoardShape)
  })

  it('las proporciones son las de las medidas oficiales', () => {
    expect(boardShapeFor('Huambrilla').ratio).toBeCloseTo(53 / 20)
    expect(boardShapeFor('Ñañito').ratio).toBeCloseTo(30 / 18)
    expect(boardShapeFor('Moshaco').ratio).toBeCloseTo(65 / 46)
    expect(boardShapeFor('Ya Vuelta').ratio).toBe(1)
  })

  it('con cualquier modelo y posición el texto queda dentro de la tabla', () => {
    for (const name of [...models, undefined]) {
      const shape = boardShapeFor(name)
      for (const { value } of engravingPositions) {
        const place = textPlacement(value, shape) as Record<string, string>
        for (const edge of Object.values(place)) {
          const percent = Number.parseFloat(edge)
          expect(percent, `${name} ${value}`).toBeGreaterThan(0)
          expect(percent, `${name} ${value}`).toBeLessThanOrEqual(26)
        }
        expect(Object.keys(place), `${name} ${value}`).toHaveLength(value === 'center' ? 0 : 2)
      }
    }
  })

  it('el texto más largo cabe en la tabla más chica (el tamaño baja, no se corta)', () => {
    const long = 'Familia Rodríguez Pérez'
    for (const name of models) {
      const shape = boardShapeFor(name)
      for (const font of ['classic', 'italic', 'modern'] as const) {
        const size = engravingFontSize(long, font, 'line1', shape.room)
        const width = size * long.length * { classic: 0.56, italic: 0.52, modern: 0.82 }[font]
        expect(width, `${name} ${font}`).toBeLessThanOrEqual(shape.room + 0.5)
      }
    }
  })
})
