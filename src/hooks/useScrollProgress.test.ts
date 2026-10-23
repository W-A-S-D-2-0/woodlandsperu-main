import { describe, expect, it } from 'vitest'
import { scrollProgress } from './useScrollProgress'

describe('scrollProgress', () => {
  it('en secciones fijas va de 0 al inicio a 1 cuando termina el recorrido', () => {
    // Sección de 3 pantallas (3000 px) con ventana de 1000 px: recorrido fijo de 2000 px.
    expect(scrollProgress('pin', 0, 3000, 1000)).toBe(0)
    expect(scrollProgress('pin', -1000, 3000, 1000)).toBe(0.5)
    expect(scrollProgress('pin', -2000, 3000, 1000)).toBe(1)
  })

  it('no se sale del rango 0..1', () => {
    expect(scrollProgress('pin', 500, 3000, 1000)).toBe(0)
    expect(scrollProgress('pin', -9000, 3000, 1000)).toBe(1)
  })

  it('en secciones que salen de pantalla mide su propia altura', () => {
    expect(scrollProgress('leave', 0, 800, 1000)).toBe(0)
    expect(scrollProgress('leave', -400, 800, 1000)).toBe(0.5)
  })

  it('al cruzar la pantalla empieza al asomar por abajo y termina al salir por arriba', () => {
    expect(scrollProgress('cross', 1000, 800, 1000)).toBe(0)
    expect(scrollProgress('cross', 100, 800, 1000)).toBeCloseTo(0.5)
    expect(scrollProgress('cross', -800, 800, 1000)).toBe(1)
  })

  it('una sección sin recorrido queda completa', () => {
    expect(scrollProgress('pin', 0, 900, 1000)).toBe(1)
  })
})
