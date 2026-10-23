import type { Context } from 'hono'
import type { ZodType } from 'zod'
import type { ApiErrorBody } from '../../shared/api/contracts'
import type { AppBindings } from '../types'

export type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 413 | 422 | 429 | 502 | 503

/** Respuesta de error estándar de la API. `details` lista los campos inválidos en los 422. */
export function fail(c: Context<AppBindings>, status: ErrorStatus, code: string, message: string, details?: unknown) {
  const body: ApiErrorBody & { error: { details?: unknown } } = {
    error: { code, message, requestId: c.get('requestId'), ...(details === undefined ? {} : { details }) },
  }
  return c.json(body, status)
}

/** Lee y valida un cuerpo JSON. Si no es válido devuelve la respuesta de error lista para enviar. */
export async function parseBody<T>(c: Context<AppBindings>, schema: ZodType<T>): Promise<{ data: T } | { response: Response }> {
  let raw: unknown
  try {
    raw = await c.req.json()
  } catch {
    return { response: fail(c, 400, 'invalid_json', 'El cuerpo debe ser JSON válido.') }
  }
  return validate(c, schema, raw)
}

/** Valida un valor ya leído (query, parámetros de ruta). */
export function validate<T>(c: Context<AppBindings>, schema: ZodType<T>, raw: unknown): { data: T } | { response: Response } {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
    return { response: fail(c, 422, 'invalid_request', fields[0]?.message ?? 'Solicitud no válida.', fields) }
  }
  return { data: parsed.data }
}
