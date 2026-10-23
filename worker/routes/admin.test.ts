import { describe, expect, it } from 'vitest'
import type { ApiErrorBody, StaffIdentity, StaffMeResponse } from '../../shared/api/contracts'
import { createApp } from '../app'
import type { StaffAuthFactory, StaffAuthProvider } from '../auth/staff-auth'
import { readSupabaseConfig } from '../auth/supabase-auth'

const VALID_TOKEN = 'token.valido.admin'
const WORKSHOP_TOKEN = 'token.valido.taller'
const OUTSIDER_TOKEN = 'token.valido.sinrol'

const staffByToken: Record<string, StaffIdentity | null> = {
  [VALID_TOKEN]: { userId: 'u-admin', role: 'admin', fullName: 'Admin de prueba' },
  [WORKSHOP_TOKEN]: { userId: 'u-taller', role: 'workshop', fullName: 'Taller de prueba' },
  [OUTSIDER_TOKEN]: null,
}

const fakeProvider: StaffAuthProvider = {
  async verifyAccessToken(token) {
    return token in staffByToken ? `user-of-${token}` : null
  },
  async findActiveStaff(token) {
    return staffByToken[token] ?? null
  },
}

const env = { APP_ENV: 'development' } as Env

function request(path: string, factory: StaffAuthFactory, token?: string) {
  const app = createApp({ staffAuth: factory })
  return app.request(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} }, env)
}

describe('GET /api/admin/me', () => {
  const configured: StaffAuthFactory = () => fakeProvider

  it('responde 503 si la autenticación no está configurada', async () => {
    const res = await request('/api/admin/me', () => null, VALID_TOKEN)
    expect(res.status).toBe(503)
    expect(((await res.json()) as ApiErrorBody).error.code).toBe('auth_not_configured')
  })

  it('responde 401 sin token', async () => {
    const res = await request('/api/admin/me', configured)
    expect(res.status).toBe(401)
    expect(((await res.json()) as ApiErrorBody).error.code).toBe('unauthenticated')
  })

  it('responde 401 con token inválido o mal formado', async () => {
    expect((await request('/api/admin/me', configured, 'otro.token.cualquiera')).status).toBe(401)
    const app = createApp({ staffAuth: configured })
    const res = await app.request('/api/admin/me', { headers: { Authorization: 'Basic abc' } }, env)
    expect(res.status).toBe(401)
  })

  it('responde 403 si el usuario no es personal activo', async () => {
    const res = await request('/api/admin/me', configured, OUTSIDER_TOKEN)
    expect(res.status).toBe(403)
    expect(((await res.json()) as ApiErrorBody).error.code).toBe('forbidden')
  })

  it('devuelve la identidad del personal', async () => {
    const res = await request('/api/admin/me', configured, WORKSHOP_TOKEN)
    expect(res.status).toBe(200)
    expect((await res.json()) as StaffMeResponse).toEqual({ userId: 'u-taller', role: 'workshop', fullName: 'Taller de prueba' })
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('responde 503 si el servicio de autenticación falla', async () => {
    const failing: StaffAuthFactory = () => ({
      verifyAccessToken: async () => {
        throw new Error('red caída')
      },
      findActiveStaff: async () => null,
    })
    const res = await request('/api/admin/me', failing, VALID_TOKEN)
    expect(res.status).toBe(503)
    expect(((await res.json()) as ApiErrorBody).error.code).toBe('auth_unavailable')
  })

  it('protege también rutas administrativas desconocidas', async () => {
    expect((await request('/api/admin/no-existe', configured)).status).toBe(401)
  })
})

describe('readSupabaseConfig', () => {
  it('exige URL y clave publicable', () => {
    expect(readSupabaseConfig({ SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: 'k' })).toBeNull()
    expect(readSupabaseConfig({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_PUBLISHABLE_KEY: ' ' })).toBeNull()
  })

  it('exige HTTPS salvo en local', () => {
    expect(readSupabaseConfig({ SUPABASE_URL: 'http://x.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'k' })).toBeNull()
    expect(readSupabaseConfig({ SUPABASE_URL: 'no es url', SUPABASE_PUBLISHABLE_KEY: 'k' })).toBeNull()
    expect(readSupabaseConfig({ SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_PUBLISHABLE_KEY: 'k' })).toEqual({
      url: 'http://127.0.0.1:54321',
      publishableKey: 'k',
    })
    expect(readSupabaseConfig({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'k' })?.url).toBe(
      'https://x.supabase.co',
    )
  })
})
