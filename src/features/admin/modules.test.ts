import { describe, expect, it } from 'vitest'
import { adminModules, findAdminModule, modulesFor } from './modules'

describe('adminModules', () => {
  it('no repite slugs (cada módulo tiene una ruta única)', () => {
    const slugs = adminModules.map((m) => m.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('usa slugs válidos para URL', () => {
    for (const { slug } of adminModules) expect(slug).toMatch(/^[a-z0-9-]+$/)
  })

  it('encuentra módulos por slug', () => {
    expect(findAdminModule('inventario')?.label).toBe('Inventario')
    expect(findAdminModule('no-existe')).toBeUndefined()
    expect(findAdminModule(undefined)).toBeUndefined()
  })
})

describe('modulesFor', () => {
  it('el taller solo ve inventario y pedidos', () => {
    expect(modulesFor('workshop').map((m) => m.slug)).toEqual(['inventario', 'produccion', 'pedidos'])
  })

  it('administración ve todos los módulos', () => {
    expect(modulesFor('admin')).toHaveLength(adminModules.length)
  })
})
