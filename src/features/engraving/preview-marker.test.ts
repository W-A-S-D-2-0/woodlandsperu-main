import { describe, expect, it } from 'vitest'
import { parseBody } from '../chat/chat-logic'
import { buildPreviewMarker, buildWhatsappMarker, parseMarkerLine, parseShareParams, previewQuery, whatsappUrl } from './preview-marker'

describe('marcas de vista previa y WhatsApp', () => {
  it('lo que arma el servidor lo lee el chat', () => {
    const line = buildPreviewMarker({ line1: 'Ana', line2: 'y Luis', font: 'italic', positions: ['center', 'top-right'], model: 'Ya Vuelta' })
    expect(parseMarkerLine(line)).toEqual({ kind: 'preview', line1: 'Ana', line2: 'y Luis', font: 'italic', positions: ['center', 'top-right'], model: 'Ya Vuelta' })
    const wa = buildWhatsappMarker('Hola Brigitte, soy Ana.', 't=Ana')
    expect(parseMarkerLine(wa)).toEqual({ kind: 'whatsapp', message: 'Hola Brigitte, soy Ana.', query: 't=Ana' })
  })

  it('el texto del cliente no puede romper la marca', () => {
    const line = buildPreviewMarker({ line1: 'A|na]] [[x', font: 'classic', positions: ['center'] })
    const marker = parseMarkerLine(line)
    expect(marker).toMatchObject({ kind: 'preview', positions: ['center'] })
    expect(marker?.kind === 'preview' && marker.line1).not.toMatch(/[|[\]]/)
  })

  it('una marca inválida se muestra como texto', () => {
    expect(parseMarkerLine('[[vista|Ana||classic|no-existe|]]')).toBeNull()
    expect(parseMarkerLine('[[vista||| classic|center|]]')).toBeNull()
    expect(parseMarkerLine('hola')).toBeNull()
  })

  it('el chat separa las marcas del texto', () => {
    const body = `Así quedaría.\n${buildPreviewMarker({ line1: 'Ana', font: 'classic', positions: ['center'] })}\nToca una.\n${buildWhatsappMarker('Hola', '')}`
    expect(parseBody(body).map((b) => b.kind)).toEqual(['text', 'preview', 'text', 'whatsapp'])
  })

  it('el enlace de WhatsApp lleva solo el mensaje, sin ningún vínculo a otra página', () => {
    const url = whatsappUrl('51948467431', { kind: 'whatsapp', message: 'Hola Brigitte', query: 't=Ana&p=center' })
    expect(url.startsWith('https://wa.me/51948467431?text=')).toBe(true)
    expect(decodeURIComponent(url.split('text=')[1]!)).toBe('Hola Brigitte')
    expect(url).not.toContain('grabado')
  })

  it('la página que se comparte valida lo que trae la dirección', () => {
    const query = previewQuery({ line1: 'Ana', line2: 'Luis', font: 'modern', positions: ['center', 'bottom-left'], model: 'Moshaco' })
    expect(parseShareParams(`?${query}`)).toMatchObject({ line1: 'Ana', line2: 'Luis', font: 'modern', positions: ['center', 'bottom-left'], model: 'Moshaco' })
    expect(parseShareParams('?t=Ana&p=nada')).toBeNull()
    expect(parseShareParams('?p=center')).toBeNull()
    expect(parseShareParams('?t=Ana&p=center&f=otra')?.font).toBe('classic')
  })
})
