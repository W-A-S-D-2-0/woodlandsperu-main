import { describe, expect, it } from 'vitest'
import { alliancesContent } from '../../src/content/alliances'
import { alliesReply } from './assistant'

describe('alliesReply', () => {
  it('lista a todos los aliados de la web cuando preguntan quiénes trabajan con Woodland', () => {
    const reply = alliesReply('¿Quiénes trabajan con Woodland?')!
    for (const group of alliancesContent.groups) {
      for (const ally of group.allies) expect(reply).toContain(ally.name)
    }
    expect(reply).toMatch(/pestaña Alianzas/)
  })

  it('reconoce a un aliado por su nombre aunque no lleve tildes ni apóstrofo', () => {
    expect(alliesReply('quien es giacomo bocchio')).toMatch(/Giacomo Bocchio \(chef\)/)
    expect(alliesReply('que es otorongos grill')).toMatch(/Otorongo’s Grill/)
    expect(alliesReply('quien es Promune?')).toMatch(/^Promune es parte de las alianzas/)
  })

  it('no inventa nada sobre el aliado: solo repite su rubro de la web', () => {
    const reply = alliesReply('quien es tambo')!
    expect(reply).toContain('cadena de tiendas de conveniencia')
    expect(reply).not.toMatch(/fundad|a[ñn]os|sucursales/i)
  })

  it('deja pasar lo que no trata de aliados, incluido un pedido para una empresa', () => {
    expect(alliesReply('quiero hacer un pedido para mi empresa')).toBeNull()
    expect(alliesReply('cuanto cuesta la moshaco')).toBeNull()
    expect(alliesReply('quien es el presidente')).toBeNull()
    expect(alliesReply('')).toBeNull()
  })
})
