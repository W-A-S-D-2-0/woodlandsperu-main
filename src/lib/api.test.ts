import { describe, expect, it } from 'vitest'
import { ApiError, apiFetch } from './api'

function fakeFetch(response: Response | Error): typeof fetch {
  return async () => {
    if (response instanceof Error) throw response
    return response
  }
}

describe('apiFetch', () => {
  it('devuelve el cuerpo JSON en respuestas exitosas', async () => {
    const data = await apiFetch<{ ok: boolean }>('/api/health', {}, fakeFetch(Response.json({ ok: true })))
    expect(data).toEqual({ ok: true })
  })

  it('convierte el error estándar de la API en ApiError', async () => {
    const res = Response.json({ error: { code: 'not_found', message: 'No existe.', requestId: 'abc' } }, { status: 404 })
    await expect(apiFetch('/api/x', {}, fakeFetch(res))).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      code: 'not_found',
      requestId: 'abc',
    })
  })

  it('reporta errores HTTP sin cuerpo estándar', async () => {
    const res = new Response('fallo', { status: 502 })
    await expect(apiFetch('/api/x', {}, fakeFetch(res))).rejects.toMatchObject({ status: 502, code: 'http_error' })
  })

  it('reporta fallas de red', async () => {
    await expect(apiFetch('/api/x', {}, fakeFetch(new TypeError('offline')))).rejects.toBeInstanceOf(ApiError)
  })

  it('rechaza rutas fuera de /api', async () => {
    await expect(apiFetch('https://otro-sitio.com', {}, fakeFetch(Response.json({})))).rejects.toThrow('Ruta de API inválida')
  })
})
