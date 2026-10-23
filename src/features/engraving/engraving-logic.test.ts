import { describe, expect, it } from 'vitest'
import { engravingLimits, engravingPositions } from '../../content/engraving'
import {
  cleanLine,
  defaultEngraving,
  engravingFontSize,
  engravingSummary,
  hasEngravingText,
  normalizeEngraving,
} from './engraving-logic'

const values = { ...defaultEngraving, line1: 'Rolando', line2: 'Desde 2026', position: 'bottom-right' as const, font: 'italic' as const }

describe('engraving-logic', () => {
  it('limpia saltos de línea, espacios repetidos y largo', () => {
    expect(cleanLine('Ana\n  María', 50)).toBe('Ana María')
    expect(cleanLine('x'.repeat(100), 24)).toHaveLength(24)
    expect(normalizeEngraving({ ...values, line1: '  ' + 'a'.repeat(40) }).line1).toHaveLength(engravingLimits.line1)
  })

  it('ofrece las cuatro esquinas y el centro, con la esquina inferior derecha por defecto', () => {
    expect(defaultEngraving.position).toBe('bottom-right')
    expect(engravingPositions.map((p) => p.value)).toEqual(['bottom-right', 'bottom-left', 'top-left', 'top-right', 'center'])
  })

  it('exige texto en la primera línea', () => {
    expect(hasEngravingText(defaultEngraving)).toBe(false)
    expect(hasEngravingText({ ...defaultEngraving, line1: '   ' })).toBe(false)
    expect(hasEngravingText(values)).toBe(true)
  })

  it('resume el grabado con posición y letra en español', () => {
    expect(engravingSummary(values)).toBe('Grabado: "Rolando" / "Desde 2026" · Posición: Esquina inferior derecha · Letra: Cursiva')
    expect(engravingSummary({ ...values, line2: '' })).not.toContain('/')
  })
})

describe('engravingFontSize', () => {
  it('reduce el tamaño de las líneas largas para que quepan', () => {
    expect(engravingFontSize('Ana', 'classic', 'line1')).toBe(9)
    expect(engravingFontSize('x'.repeat(24), 'classic', 'line1')).toBeLessThan(6.5)
    expect(engravingFontSize('x'.repeat(24), 'modern', 'line1')).toBeLessThan(engravingFontSize('x'.repeat(24), 'classic', 'line1'))
  })

  it('la segunda línea es siempre más pequeña', () => {
    expect(engravingFontSize('Hola', 'classic', 'line2')).toBeLessThan(engravingFontSize('Hola', 'classic', 'line1'))
  })

  it('no falla con texto vacío', () => {
    expect(engravingFontSize('', 'classic', 'line1')).toBe(9)
  })
})
