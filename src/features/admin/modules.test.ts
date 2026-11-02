import { describe, expect, it } from 'vitest'
import { adminModules, adminSections, findAdminModule, modulesFor, sectionForPath, sectionsFor } from './modules'

describe('adminModules', () => {
  it('no repite slugs (cada módulo tiene una ruta única)', () => {
    const slugs = adminModules.map((m) => m.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('usa slugs válidos para URL', () => {
    for (const { slug } of adminModules) expect(slug).toMatch(/^[a-z0-9-]+$/)
  })

  it('encuentra módulos por slug', () => {
    expect(findAdminModule('inventario')?.label).toBe('Stock')
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

describe('secciones del menú', () => {
  it('cada módulo está en una sola sección', () => {
    const grouped = adminSections.flatMap((s) => s.modules)
    expect(new Set(grouped).size).toBe(grouped.length)
    expect([...grouped].sort()).toEqual(adminModules.map((m) => m.slug).sort())
  })

  it('administración ve cinco secciones, empezando por Hoy', () => {
    const sections = sectionsFor('admin')
    expect(sections.map((s) => s.slug)).toEqual(['hoy', 'ventas', 'clientes', 'taller', 'mas'])
    expect(sections.find((s) => s.slug === 'ventas')?.to).toBe('/pedidos')
  })

  it('el taller ve su trabajo y los pedidos, con el nombre del módulo', () => {
    const sections = sectionsFor('workshop')
    expect(sections.map((s) => s.label)).toEqual(['Taller y stock', 'Pedidos'])
    expect(sections[0]?.modules.map((m) => m.slug)).toEqual(['produccion', 'inventario'])
  })

  it('reconoce la sección de cada ruta', () => {
    expect(sectionForPath('/', 'admin')?.slug).toBe('hoy')
    expect(sectionForPath('/pedidos/nueva', 'admin')?.slug).toBe('ventas')
    expect(sectionForPath('/conversaciones', 'admin')?.slug).toBe('clientes')
    expect(sectionForPath('/cotizaciones', 'workshop')).toBeUndefined()
  })
})
