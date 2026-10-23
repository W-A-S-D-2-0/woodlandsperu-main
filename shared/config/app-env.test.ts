import { describe, expect, it } from 'vitest'
import { isProduction, parseAppEnv } from './app-env'

describe('parseAppEnv', () => {
  it('acepta los ambientes válidos sin importar mayúsculas o espacios', () => {
    expect(parseAppEnv('development')).toBe('development')
    expect(parseAppEnv(' Staging ')).toBe('staging')
    expect(parseAppEnv('PRODUCTION')).toBe('production')
  })

  it('trata valores ausentes o desconocidos como producción', () => {
    expect(parseAppEnv(undefined)).toBe('production')
    expect(parseAppEnv('')).toBe('production')
    expect(parseAppEnv('dev')).toBe('production')
    expect(parseAppEnv('test')).toBe('production')
    expect(parseAppEnv(42)).toBe('production')
  })

  it('identifica producción', () => {
    expect(isProduction('production')).toBe(true)
    expect(isProduction('development')).toBe(false)
  })
})
