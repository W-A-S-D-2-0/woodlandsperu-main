import { describe, expect, it } from 'vitest'
import type { ApiErrorBody, HealthResponse } from '../shared/api/contracts'
import { createApp } from './app'

const app = createApp()

function request(path: string, env: Partial<Env> = { APP_ENV: 'development' }) {
  return app.request(path, {}, env as Env)
}

describe('API /api/health', () => {
  it('responde 200 con el estado del servicio', async () => {
    const res = await request('/api/health')
    expect(res.status).toBe(200)

    const body = (await res.json()) as HealthResponse
    expect(body.status).toBe('ok')
    expect(body.service).toBe('woodland-api')
    expect(body.environment).toBe('development')
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false)
  })

  it('reporta producción si APP_ENV falta o es inválido', async () => {
    const res = await request('/api/health', {})
    const body = (await res.json()) as HealthResponse
    expect(body.environment).toBe('production')
  })

  it('incluye cabeceras de seguridad y no se cachea', async () => {
    const res = await request('/api/health')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('x-request-id')).toBeTruthy()
  })
})

describe('API rutas desconocidas', () => {
  it('responde 404 con el formato estándar de error', async () => {
    const res = await request('/api/no-existe')
    expect(res.status).toBe(404)

    const body = (await res.json()) as ApiErrorBody
    expect(body.error.code).toBe('not_found')
    expect(body.error.requestId).toBeTruthy()
  })
})
