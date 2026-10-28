import { describe, expect, it } from 'vitest'
import type { CatalogResponse } from '../../shared/api/contracts'
import { parseMarkerLine, type PreviewMarker, type WhatsappMarker } from '../../src/features/engraving/preview-marker'
import { guidedFlowFirst, type HistoryMessage } from './assistant'
import { ASK_TEXT, customerName, engravingHelpReply, requestedPosition } from './engraving-help'

const catalog: CatalogResponse = {
  currency: 'PEN',
  products: [
    { id: 'p1', slug: 'ya-vuelta', name: 'Ya Vuelta', description: null, category: null, isCustomizable: true, variants: [{ id: '3f2b8c1e-5d4a-4e7b-9a10-2c6d8e9f0a1b', sku: 'YV', name: 'Circular', dimensionsLabel: '40*1.5', price: 297, priceTiers: [] }] },
  ],
}

const customer = (body: string): HistoryMessage => ({ role: 'customer', body })
const teca = (body: string): HistoryMessage => ({ role: 'assistant', body })

const markers = (reply: string | null) => (reply ?? '').split('\n').map(parseMarkerLine).filter((m) => m !== null)
const preview = (reply: string | null) => markers(reply).find((m): m is PreviewMarker => m.kind === 'preview')
const whatsapp = (reply: string | null) => markers(reply).find((m): m is WhatsappMarker => m.kind === 'whatsapp')

const WEB = 'Quiero pedir Ya Vuelta · Circular. Grabado: "Ana" · Posición: Esquina inferior derecha · Letra: Clásica'
const DATA_ASK = '¿A nombre de quién registro el pedido? Escribe tu nombre completo.'

describe('posición que pide el cliente', () => {
  it('entiende esquinas, centro y arriba/abajo', () => {
    expect(requestedPosition('arriba a la derecha')).toBe('top-right')
    expect(requestedPosition('abajo a la izquierda')).toBe('bottom-left')
    expect(requestedPosition('esquina superior izquierda')).toBe('top-left')
    expect(requestedPosition('en el medio')).toBe('center')
    expect(requestedPosition('en el centro por favor')).toBe('center')
    expect(requestedPosition('cuánto cuesta')).toBeNull()
  })
})

describe('dudas de personalización', () => {
  it('con el texto ya escrito muestra la tabla en otras posiciones y el WhatsApp de Brigitte', () => {
    const reply = engravingHelpReply([customer(WEB), teca('ok'), customer('no me gusta cómo queda')], catalog)
    const view = preview(reply)!
    expect(view).toMatchObject({ line1: 'Ana', font: 'classic', model: 'Ya Vuelta' })
    // No repite la posición que no le gustó, y recomienda primero las esquinas.
    expect(view.positions).not.toContain('bottom-right')
    expect(view.positions.slice(0, 2)).toEqual(['bottom-left', 'top-right'])
    const wa = whatsapp(reply)!
    expect(wa.message).toContain('Hola Brigitte')
    expect(wa.message).toContain('«Ana»')
    expect(wa.message).toContain('Ya Vuelta')
    expect(wa.query).toContain('t=Ana')
    expect(reply).toContain('Brigitte')
  })

  it('pide el texto si todavía no lo dijo y, al recibirlo, usa la posición que ya había pedido', () => {
    const first = engravingHelpReply([customer('quiero mi nombre en el centro')], catalog)
    expect(first).toContain(ASK_TEXT)
    expect(preview(first)).toBeUndefined()
    const second = engravingHelpReply([customer('quiero mi nombre en el centro'), teca(first!), customer('Luis')], catalog)
    const view = preview(second)!
    expect(view.line1).toBe('Luis')
    expect(view.positions[0]).toBe('center')
    expect(second).toContain('Así quedaría «Luis» en el centro')
  })

  it('muestra la posición pedida primero y otras dos para comparar', () => {
    const view = preview(engravingHelpReply([customer(WEB), teca('ok'), customer('¿cómo se vería mi nombre arriba a la derecha?')], catalog))!
    expect(view.positions[0]).toBe('top-right')
    expect(view.positions).toHaveLength(3)
  })

  it('usa el nombre del cliente en el mensaje de WhatsApp cuando ya dio sus datos', () => {
    const history = [customer('quiero hacer un pedido'), teca(DATA_ASK), customer('María Ríos'), teca('...'), customer(WEB), teca('ok'), customer('no me gusta')]
    expect(whatsapp(engravingHelpReply(history, catalog))!.message).toContain('soy María Ríos')
  })

  it('si ya vio recomendaciones y sigue sin convencerse, deja solo el botón de Brigitte', () => {
    const first = engravingHelpReply([customer(WEB), teca('ok'), customer('no me gusta')], catalog)!
    const reply = engravingHelpReply([customer(WEB), teca('ok'), customer('no me gusta'), teca(first), customer('ninguna me convence')], catalog)!
    expect(preview(reply)).toBeUndefined()
    expect(whatsapp(reply)!.message).toMatch(/Teca me recomendó/)
    expect(reply).toMatch(/Brigitte, de nuestro equipo de ventas/)
  })

  it('al elegir una posición la confirma y dice cómo dejarla en el pedido', () => {
    const first = engravingHelpReply([customer(WEB), teca('ok'), customer('no me gusta')], catalog)!
    const reply = engravingHelpReply([customer(WEB), teca('ok'), customer('no me gusta'), teca(first), customer('Prefiero la posición Esquina inferior izquierda')], catalog)!
    expect(reply).toContain('Perfecto, dejamos «Ana» en la esquina inferior izquierda')
    expect(reply).toContain('Ana · esquina inferior izquierda')
    expect(preview(reply)).toBeUndefined()
  })

  it('pedir hablar con Brigitte da el botón aunque no haya texto de grabado', () => {
    const reply = engravingHelpReply([customer('quiero hablar con Brigitte sobre la personalización de mi tabla')], catalog)
    // Sin texto conocido primero lo pide; con texto, va directo al botón.
    expect(reply).toContain(ASK_TEXT)
    const withText = engravingHelpReply([customer(WEB), teca('ok'), customer('prefiero hablar con Brigitte')], catalog)!
    expect(whatsapp(withText)).toBeDefined()
  })

  it('no interviene en otras consultas', () => {
    for (const text of ['¿cuánto cuesta la tabla?', 'hola', '¿cuánto cuesta el grabado?', 'quiero hacer un pedido', '¿cuál es el plazo de entrega?']) {
      expect(engravingHelpReply([customer(text)], catalog)).toBeNull()
    }
  })

  it('en pleno pedido, una duda del grabado se atiende sin perder el paso', () => {
    const history: HistoryMessage[] = [customer('quiero hacer un pedido')]
    const step = (body: string) => {
      const out = guidedFlowFirst(history, catalog)!
      history.push(teca(out.text), customer(body))
      return out
    }
    step('1')
    step('1')
    const engrave = guidedFlowFirst(history, catalog)!
    expect(engrave.text).toContain('¿Quieres grabado')
    history.push(teca(engrave.text), customer('no sé, mejor en el centro'))
    const answer = guidedFlowFirst(history, catalog)!
    // No toma la duda como el texto del grabado: Teca la atiende y vuelve a preguntar.
    expect(answer.text).toContain(ASK_TEXT)
    expect(answer.text).toContain('¿Quieres grabado')
    expect(answer.call).toBeUndefined()
  })
})

describe('con todas las tablas del catálogo', () => {
  const names = ['Moshaco', 'Ya Vuelta', 'Sacha Paleta', 'Bosques Amazónicos', 'Huambrilla', 'Ñañito']
  const full: CatalogResponse = {
    currency: 'PEN',
    products: names.map((name, i) => ({
      id: `p${i}`, slug: name.toLowerCase(), name, description: null, category: null, isCustomizable: true,
      variants: [{ id: `3f2b8c1e-5d4a-4e7b-9a10-2c6d8e9f0a1${i}`, sku: `SKU${i}`, name: 'Estándar', dimensionsLabel: null, price: 200, priceTiers: [] }],
    })),
  }

  it.each(names)('%s: muestra la silueta de su modelo en las posiciones recomendadas', (name) => {
    const reply = engravingHelpReply([customer(`quiero ver cómo queda mi nombre «Ana» en la ${name}`)], full)
    const view = preview(reply)!
    expect(view.model).toBe(name)
    expect(view.line1).toBe('Ana')
    expect(view.positions).toHaveLength(3)
    expect(whatsapp(reply)!.message).toContain(name)
    expect(whatsapp(reply)!.query).toContain(`m=${encodeURIComponent(name).replace(/%20/g, '+')}`)
  })

  it.each(names)('%s: respeta la posición que pide el cliente', (name) => {
    const asks: [string, string][] = [
      ['arriba a la derecha', 'top-right'],
      ['abajo a la izquierda', 'bottom-left'],
      ['arriba a la izquierda', 'top-left'],
      ['abajo a la derecha', 'bottom-right'],
      ['en el centro', 'center'],
    ]
    for (const [words, position] of asks) {
      const view = preview(engravingHelpReply([customer(`quiero mi nombre «Ana» ${words} de la ${name}`)], full))!
      expect(view.positions[0], `${name} ${words}`).toBe(position)
      expect(view.model).toBe(name)
    }
  })

  it('el modelo que eligió en el pedido se usa aunque no lo repita al dudar', () => {
    const history: HistoryMessage[] = [customer('quiero hacer un pedido de Huambrilla'), teca('...'), customer(WEB.replace('Ya Vuelta', 'Huambrilla')), teca('ok'), customer('no me gusta')]
    expect(preview(engravingHelpReply(history, full))!.model).toBe('Huambrilla')
  })

  it('si no se sabe el modelo, usa la tabla genérica y funciona igual', () => {
    const view = preview(engravingHelpReply([customer('quiero mi nombre «Ana» en el centro de la tabla')], full))!
    expect(view.model).toBe('')
    expect(view.positions[0]).toBe('center')
  })
})

describe('dudas en cualquier paso del pedido', () => {
  const contact = 'Ana Pérez, 987654321, ana@example.com, Jr. Lima 123, Tarapoto'
  /** Lleva el pedido hasta el paso pedido y devuelve la conversación y la pregunta de ese paso. */
  function until(steps: string[]) {
    const history: HistoryMessage[] = [customer('quiero hacer un pedido')]
    let out = guidedFlowFirst(history, catalog)!
    for (const body of ['1', '1', ...steps]) {
      history.push(teca(out.text), customer(body))
      out = guidedFlowFirst(history, catalog)!
    }
    return { history, out }
  }

  it('«ninguna» al preguntar por el grabado significa que no quiere grabado', () => {
    const { out } = until(['ninguna'])
    expect(out.text).toMatch(/necesito estos datos/)
  })

  it('«no me gusta» al preguntar por el grabado pide el texto para mostrarlo', () => {
    const { out } = until(['no me gusta cómo se vería'])
    expect(out.text).toContain(ASK_TEXT)
    expect(out.text).toContain('¿Quieres grabado')
  })

  it('con el grabado ya escrito, una duda antes de seguir muestra las imágenes y no avanza el pedido', () => {
    const { out } = until(['Ana', 'no me gusta cómo quedaría'])
    expect(preview(out.text)!.line1).toBe('Ana')
    expect(preview(out.text)!.model).toBe('Ya Vuelta')
    // Sigue en la vista previa: no se piden datos hasta que diga «continuar».
    expect(out.text).toContain('«continuar»')
    expect(out.text).not.toMatch(/necesito estos datos/)
    expect(out.call).toBeUndefined()
  })

  it('en la confirmación, «no me gusta cómo queda» no cancela el pedido', () => {
    const { out } = until(['Ana', 'continuar', contact, 'no me gusta cómo queda'])
    expect(out.text).not.toMatch(/cancelé/)
    expect(preview(out.text)).toBeDefined()
    expect(out.text).toContain('Este es tu pedido')
  })

  it('«quiero personalizar la tabla con el nombre «Marta»» muestra cómo quedaría', () => {
    const view = preview(engravingHelpReply([customer('quiero personalizar la Ya Vuelta con el nombre «Marta»')], catalog))!
    expect(view).toMatchObject({ line1: 'Marta', model: 'Ya Vuelta' })
  })
})

describe('recuerda lo que el cliente ya dijo', () => {
  it('el nombre que dio entre comillas sirve para las preguntas siguientes (por ejemplo, pedir hablar con Brigitte)', () => {
    const first = customer('quiero personalizar la Ya Vuelta con el nombre «Marta»')
    const reply = engravingHelpReply([first, teca(engravingHelpReply([first], catalog)!), customer('prefiero hablar con Brigitte')], catalog)!
    expect(preview(reply)).toBeUndefined()
    expect(whatsapp(reply)!.message).toContain('«Marta»')
  })
})

describe('quejas de ubicación', () => {
  it('«muy abajo» no se toma como pedir abajo: se muestran posiciones más arriba', () => {
    expect(requestedPosition('la veo muy abajo')).toBeNull()
    expect(requestedPosition('demasiado arriba')).toBeNull()
    const view = preview(engravingHelpReply([customer(WEB), teca('ok'), customer('no me gusta, la veo muy abajo')], catalog))!
    expect(view.positions[0]).toBe('top-right')
    expect(view.positions.slice(0, 2)).toEqual(['top-right', 'top-left'])
    expect(view.positions).not.toContain('bottom-right')
  })

  it('«muy arriba» muestra primero las de abajo, y la queja sola también activa la ayuda', () => {
    const history = [customer('Quiero pedir Ya Vuelta · Circular. Grabado: "Ana" · Posición: Esquina superior derecha · Letra: Clásica'), teca('ok')]
    const view = preview(engravingHelpReply([...history, customer('la veo demasiado arriba')], catalog))!
    expect(view.positions[0]).toBe('bottom-right')
    expect(view.positions).not.toContain('top-right')
  })
})

describe('queja de ubicación tras una primera ronda', () => {
  it('primero otra ronda con lo contrario; si después sigue sin convencerse, Brigitte', () => {
    const first = engravingHelpReply([customer('quiero mi nombre «Familia Rojas» en la Bosques Amazónicos')], catalog)!
    const h1 = [customer('quiero mi nombre «Familia Rojas» en la Bosques Amazónicos'), teca(first)]
    const second = engravingHelpReply([...h1, customer('no me gusta, la veo muy abajo')], catalog)!
    expect(preview(second)!.positions.slice(0, 2)).toEqual(['top-right', 'top-left'])
    const third = engravingHelpReply([...h1, customer('no me gusta, la veo muy abajo'), teca(second), customer('no me gusta ninguna')], catalog)!
    expect(preview(third)).toBeUndefined()
    expect(whatsapp(third)).toBeDefined()
  })
})

describe('el mensaje a Brigitte parte de lo que el cliente pidió al principio', () => {
  it('nombra la posición original y lo que Teca le recomendó después', () => {
    const q = customer('quiero mi nombre «Familia Rojas» en la Bosques Amazónicos')
    const first = engravingHelpReply([q], catalog)!
    const second = engravingHelpReply([q, teca(first), customer('no me gusta, la veo muy abajo')], catalog)!
    const third = engravingHelpReply([q, teca(first), customer('no me gusta, la veo muy abajo'), teca(second), customer('ninguna me convence')], catalog)!
    const message = whatsapp(third)!.message
    expect(message).toContain('«Familia Rojas» en la esquina inferior derecha')
    expect(message).toMatch(/Teca me recomendó (la esquina inferior izquierda|la esquina superior derecha)/)
  })
})

describe('el nombre de la conversación para el panel', () => {
  const ask = teca('Para empezar: ¿A nombre de quién registro el pedido? Escribe tu nombre completo.')

  it('toma el nombre que dio el cliente en el pedido', () => {
    expect(customerName([customer('quiero hacer un pedido'), ask, customer('Ana Pérez')])).toBe('Ana Pérez')
  })

  it('una palabra de cancelar, una consulta o un dato no es un nombre', () => {
    for (const text of ['cancelar', 'quiero ver los precios', '987654321', 'ana@correo.com', 'empezar de nuevo']) {
      expect(customerName([customer('quiero hacer un pedido'), ask, customer(text)]), text).toBeUndefined()
    }
  })
})
