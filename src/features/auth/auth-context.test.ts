import { describe, expect, it } from 'vitest'
import { safeNextPath, validateNewPassword, validateSignUp } from './auth-context'

// Las rutas son relativas a la base del router del panel (/panel).
describe('safeNextPath', () => {
  it('permite volver a rutas internas del panel', () => {
    expect(safeNextPath('/')).toBe('/')
    expect(safeNextPath('/inventario')).toBe('/inventario')
    expect(safeNextPath('/pedidos?estado=confirmed')).toBe('/pedidos?estado=confirmed')
  })

  it('bloquea redirecciones externas, ambiguas o de vuelta al login', () => {
    expect(safeNextPath(null)).toBe('/')
    expect(safeNextPath('https://sitio-malicioso.com')).toBe('/')
    expect(safeNextPath('//sitio-malicioso.com/inventario')).toBe('/')
    expect(safeNextPath('/\\sitio-malicioso.com')).toBe('/')
    expect(safeNextPath('inventario')).toBe('/')
    expect(safeNextPath('/ingresar?next=/')).toBe('/')
  })
})

describe('validación de cuentas', () => {
  const base = { firstName: 'Ana', lastName: 'Quispe', email: 'ana@example.com', password: 'clave-segura-1' }

  it('acepta datos completos', () => {
    expect(validateSignUp(base, 'clave-segura-1')).toBeNull()
  })

  it('pide nombre y apellido, correo válido y una contraseña que coincida', () => {
    expect(validateSignUp({ ...base, lastName: ' ' }, base.password)).toMatch(/nombre y tu apellido/)
    expect(validateSignUp({ ...base, email: 'ana@' }, base.password)).toMatch(/correo válido/)
    expect(validateSignUp({ ...base, password: 'corta' }, 'corta')).toMatch(/al menos 8/)
    expect(validateSignUp(base, 'otra-clave-123')).toMatch(/no coinciden/)
  })

  it('la contraseña nueva exige largo y repetición', () => {
    expect(validateNewPassword('12345678', '12345678')).toBeNull()
    expect(validateNewPassword('1234567', '1234567')).toMatch(/al menos 8/)
    expect(validateNewPassword('12345678', '123456789')).toMatch(/no coinciden/)
  })
})
