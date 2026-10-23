/**
 * Sistema interno (panel) servido en /panel. Es otra aplicación, separada de la web pública:
 * toda navegación bajo /panel recibe el HTML del panel (nunca el de la landing) y se marca
 * como no indexable. La seguridad real no depende de esto: el panel exige sesión y el
 * backend y RLS verifican el rol en cada operación. En producción puede agregarse
 * Cloudflare Access delante de /panel (ver docs/architecture/README.md).
 */

export const PANEL_PREFIX = '/panel'

export function isPanelPath(pathname: string): boolean {
  return pathname === PANEL_PREFIX || pathname.startsWith(`${PANEL_PREFIX}/`)
}

const PANEL_HEADERS: Record<string, string> = {
  'X-Robots-Tag': 'noindex, nofollow',
  'Cache-Control': 'no-store',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
}

export async function servePanel(request: Request, assets: Fetcher): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Método no permitido.', { status: 405, headers: { Allow: 'GET, HEAD' } })
  }

  // Todas las rutas del panel cargan el mismo HTML; el router del panel decide la pantalla.
  const htmlUrl = new URL(`${PANEL_PREFIX}/`, request.url)
  const asset = await assets.fetch(new Request(htmlUrl, { method: request.method, headers: request.headers }))

  const response = new Response(asset.body, asset)
  for (const [name, value] of Object.entries(PANEL_HEADERS)) response.headers.set(name, value)
  return response
}
