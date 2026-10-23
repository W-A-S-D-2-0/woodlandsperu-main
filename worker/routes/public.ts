import type { Context, MiddlewareHandler } from 'hono'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { orderStatusRequestSchema, quoteRequestSchema } from '../../shared/api/public-schemas'
import { PublicDataError, type PublicData, type PublicDataFactory } from '../data/public-data'
import type { AppBindings } from '../types'
import { clientKey } from './client-key'
import { fail, parseBody } from './http'

/** Limita las solicitudes por IP. Sin el binding (local o pruebas) no limita. */
const rateLimit: MiddlewareHandler<AppBindings> = async (c, next) => {
  const limiter = c.env.PUBLIC_RATE_LIMITER as RateLimit | undefined
  if (limiter) {
    const key = clientKey(c)
    const { success } = await limiter.limit({ key })
    if (!success) {
      c.header('Retry-After', '60')
      return fail(c, 429, 'rate_limited', 'Demasiadas solicitudes. Intenta nuevamente en un minuto.')
    }
  }
  await next()
}

/** Convierte los errores de negocio de la base en 422; el resto sube al manejador global (500). */
function handleDataError(c: Context<AppBindings>, err: unknown) {
  if (err instanceof PublicDataError) return fail(c, 422, err.code, err.message)
  throw err
}

/** Rutas públicas: catálogo, solicitud de cotización y consulta de pedido. Sin sesión. */
export function publicRoutes(dataFactory: PublicDataFactory) {
  const withData = async (c: Context<AppBindings>): Promise<PublicData | Response> =>
    dataFactory(c.env) ?? fail(c, 503, 'data_not_configured', 'El servicio no está disponible por ahora.')

  const bodyTooLarge = bodyLimit({
    maxSize: 64 * 1024,
    onError: (c) => fail(c as Context<AppBindings>, 413, 'payload_too_large', 'La solicitud es demasiado grande.'),
  })

  return new Hono<AppBindings>()
    .get('/catalog', async (c) => {
      const data = await withData(c)
      if (data instanceof Response) return data
      const catalog = await data.listCatalog()
      // El catálogo es público y cambia poco: caché corta en el borde.
      c.header('Cache-Control', 'public, max-age=60, s-maxage=60')
      return c.json(catalog)
    })

    .post('/quotes', rateLimit, bodyTooLarge, async (c) => {
      const body = await parseBody(c, quoteRequestSchema)
      if ('response' in body) return body.response
      const data = await withData(c)
      if (data instanceof Response) return data
      try {
        return c.json(await data.submitQuote(body.data), 201)
      } catch (err) {
        return handleDataError(c, err)
      }
    })

    .post('/orders/status', rateLimit, bodyTooLarge, async (c) => {
      const body = await parseBody(c, orderStatusRequestSchema)
      if ('response' in body) return body.response
      const data = await withData(c)
      if (data instanceof Response) return data
      try {
        const status = await data.getOrderStatus(body.data)
        // Misma respuesta si el pedido no existe o el contacto no coincide.
        if (!status) return fail(c, 404, 'order_not_found', 'No encontramos un pedido con esos datos.')
        return c.json(status)
      } catch (err) {
        return handleDataError(c, err)
      }
    })
}
