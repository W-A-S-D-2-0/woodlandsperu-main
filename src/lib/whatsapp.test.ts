import { describe, expect, it } from 'vitest'
import { normalizeWhatsappNumber, pageWhatsappMessage, whatsappUrl } from './whatsapp'

describe('whatsapp', () => {
  it('normaliza el número a solo dígitos y rechaza los inválidos', () => {
    expect(normalizeWhatsappNumber('+51 987-654 321')).toBe('51987654321')
    expect(normalizeWhatsappNumber('123')).toBeNull()
    expect(normalizeWhatsappNumber(null)).toBeNull()
  })

  it('arma el enlace con el mensaje codificado', () => {
    expect(whatsappUrl('51987654321', 'Hola, quiero 120 tablas')).toBe('https://wa.me/51987654321?text=Hola%2C%20quiero%20120%20tablas')
  })

  it('sin número no hay enlace', () => {
    expect(whatsappUrl(null, 'Hola')).toBeNull()
  })

  it('el mensaje cambia según la página, con uno general para las demás', () => {
    expect(pageWhatsappMessage('/')).toMatch(/^Hola Woodland, vengo de su página web/)
    expect(pageWhatsappMessage('/alianzas')).toMatch(/alianzas/)
    expect(pageWhatsappMessage('/alianzas/')).toBe(pageWhatsappMessage('/alianzas'))
    expect(pageWhatsappMessage('/no-existe')).toBe(pageWhatsappMessage('/'))
  })
})
