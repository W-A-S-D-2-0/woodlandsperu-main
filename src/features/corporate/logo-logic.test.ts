import { describe, expect, it } from 'vitest'
import { LOGO_MAX_BYTES, validateLogoFile } from './logo-logic'

describe('validateLogoFile', () => {
  it('acepta imágenes comunes dentro del límite', () => {
    expect(validateLogoFile({ name: 'logo.png', type: 'image/png', size: 1000 })).toBeNull()
    expect(validateLogoFile({ name: 'logo.svg', type: 'image/svg+xml', size: 1000 })).toBeNull()
  })

  it('rechaza tipos no admitidos, archivos pesados y vacíos', () => {
    expect(validateLogoFile({ name: 'a.pdf', type: 'application/pdf', size: 1000 })).toMatch(/PNG/)
    expect(validateLogoFile({ name: 'a.png', type: 'image/png', size: LOGO_MAX_BYTES + 1 })).toMatch(/5 MB/)
    expect(validateLogoFile({ name: 'a.png', type: 'image/png', size: 0 })).toMatch(/vacío/)
  })
})
