import { describe, expect, it } from 'vitest'
import { safeNextPath } from './auth-context'

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
