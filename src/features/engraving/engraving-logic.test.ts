import { describe, expect, it } from 'vitest'
import { engravingLimits, engravingPositions } from '../../content/engraving'
import {
  cleanLine,
  decodeStyle,
  defaultEngraving,
  encodeStyle,
  engravingFontSize,
  engravingSummary,
  hasEngravingText,
  normalizeEngraving,
  styleDetails,
  styleFromSummary,
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

  it('el resumen suma solo el estilo que se cambió, y se puede leer de vuelta', () => {
    const styled = { ...values, sizes: 'bottom' as const, align: 'center' as const, motif: 'chef-hat' as const }
    const summary = engravingSummary(styled)
    expect(summary).toBe('Grabado: "Rolando" / "Desde 2026" · Posición: Esquina inferior derecha · Letra: Cursiva · Tamaño: Abajo más grande · Alineación: Centro · Dibujo: Gorro de chef')
    expect(styleFromSummary(summary)).toEqual({ sizes: 'bottom', align: 'center', motif: 'chef-hat' })
    // Con una sola línea no hay tamaños que comparar.
    expect(engravingSummary({ ...styled, line2: '' })).not.toContain('Tamaño')
    expect(styleFromSummary('Grabado: "Ana" · Posición: Centro · Letra: Clásica')).toEqual({ sizes: 'top', align: null, motif: 'none' })
  })

  it('el estilo se describe para el pedido y viaja codificado', () => {
    const style = { sizes: 'same', align: 'left', motif: 'utensils' } as const
    expect(styleDetails(style, true)).toEqual(['iguales', 'alineado a la izquierda', 'dibujo: utensilios'])
    expect(styleDetails({ sizes: 'bottom', align: null, motif: 'none' }, false)).toEqual([])
    expect(decodeStyle(encodeStyle(style))).toEqual(style)
    expect(decodeStyle(undefined)).toEqual({ sizes: 'top', align: null, motif: 'none' })
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

  it('la persona elige qué línea va más grande, o las dos iguales', () => {
    const top = engravingFontSize('La parrilla', 'classic', 'line1', 80, 'bottom')
    const bottom = engravingFontSize('De Andrea', 'classic', 'line2', 80, 'bottom')
    expect(bottom).toBeGreaterThan(top)
    expect(engravingFontSize('Ana', 'classic', 'line1', 80, 'same')).toBe(engravingFontSize('Ana', 'classic', 'line2', 80, 'same'))
    // Una sola línea va siempre en grande, elija lo que elija.
    expect(engravingFontSize('Ana', 'classic', 'line1', 80, 'bottom', false)).toBe(9)
  })

  it('no falla con texto vacío', () => {
    expect(engravingFontSize('', 'classic', 'line1')).toBe(9)
  })
})
