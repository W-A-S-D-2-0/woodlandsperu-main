import { describe, expect, it } from 'vitest'
import { isPanelPath, servePanel } from './panel'

function fakeAssets() {
  const requested: string[] = []
  const assets = {
    fetch: async (input: Request | string | URL) => {
      const url = new URL(input instanceof Request ? input.url : String(input))
      requested.push(url.pathname)
      return new Response(url.pathname === '/panel/' ? '<html>panel</html>' : 'otro', {
        headers: { 'Content-Type': 'text/html' },
      })
    },
    connect: () => {
      throw new Error('no usado')
    },
  } as unknown as Fetcher
  return { assets, requested }
}

describe('rutas del panel', () => {
  it('reconoce /panel y sus subrutas, pero no rutas parecidas', () => {
    expect(isPanelPath('/panel')).toBe(true)
    expect(isPanelPath('/panel/inventario')).toBe(true)
    expect(isPanelPath('/panelito')).toBe(false)
    expect(isPanelPath('/catalogo')).toBe(false)
  })

  it('toda ruta del panel recibe el HTML del panel, no indexable ni cacheable', async () => {
    const { assets, requested } = fakeAssets()
    const res = await servePanel(new Request('https://woodland.test/panel/pedidos/PED-000001'), assets)
    expect(await res.text()).toBe('<html>panel</html>')
    expect(requested).toEqual(['/panel/'])
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('x-frame-options')).toBe('DENY')
  })

  it('rechaza métodos distintos de GET y HEAD', async () => {
    const { assets } = fakeAssets()
    const res = await servePanel(new Request('https://woodland.test/panel', { method: 'POST' }), assets)
    expect(res.status).toBe(405)
  })
})
