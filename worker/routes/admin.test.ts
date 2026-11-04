import { describe, expect, it } from 'vitest'
import type { ApiErrorBody, StaffIdentity, StaffMeResponse } from '../../shared/api/contracts'
import { createApp } from '../app'
import type { StaffAuthFactory, StaffAuthProvider } from '../auth/staff-auth'
import { readSupabaseConfig } from '../auth/supabase-auth'
import type { StaffProfileFactory } from '../data/staff-profile'

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

describe('PATCH /api/admin/me', () => {
  const configured: StaffAuthFactory = () => fakeProvider

  function patch(body: unknown, token: string | undefined, store: StaffProfileFactory) {
    const app = createApp({ staffAuth: configured, staffProfile: store })
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`
    return app.request('/api/admin/me', { method: 'PATCH', headers, body: JSON.stringify(body) }, env)
  }

  function recordingStore() {
    const calls: [string, string][] = []
    const factory: StaffProfileFactory = () => ({
      async updateFullName(userId, fullName) {
        calls.push([userId, fullName])
      },
    })
    return { calls, factory }
  }

  it('cambia solo el nombre de quien tiene la sesión, también desde el taller', async () => {
    const { calls, factory } = recordingStore()
    const res = await patch({ fullName: '  Brigitte Giraud  ' }, VALID_TOKEN, factory)
    expect(res.status).toBe(200)
    expect((await res.json()) as StaffMeResponse).toEqual({ userId: 'u-admin', role: 'admin', fullName: 'Brigitte Giraud' })
    expect((await patch({ fullName: 'Alex Cárdenas' }, WORKSHOP_TOKEN, factory)).status).toBe(200)
    expect(calls).toEqual([
      ['u-admin', 'Brigitte Giraud'],
      ['u-taller', 'Alex Cárdenas'],
    ])
  })

  it('no deja cambiar el rol ni otro usuario desde el cuerpo', async () => {
    const { calls, factory } = recordingStore()
    expect((await patch({ fullName: 'Ana', role: 'admin' }, WORKSHOP_TOKEN, factory)).status).toBe(422)
    expect((await patch({ fullName: 'Ana', userId: 'u-admin' }, WORKSHOP_TOKEN, factory)).status).toBe(422)
    expect(calls).toEqual([])
  })

  it('valida el nombre y exige sesión', async () => {
    const { calls, factory } = recordingStore()
    expect((await patch({ fullName: ' ' }, VALID_TOKEN, factory)).status).toBe(422)
    expect((await patch({ fullName: 'x'.repeat(121) }, VALID_TOKEN, factory)).status).toBe(422)
    expect((await patch({ fullName: 'Ana Quispe' }, undefined, factory)).status).toBe(401)
    expect((await patch({ fullName: 'Ana Quispe' }, OUTSIDER_TOKEN, factory)).status).toBe(403)
    expect(calls).toEqual([])
  })

  it('responde 503 si no hay clave de servicio', async () => {
    const res = await patch({ fullName: 'Ana Quispe' }, VALID_TOKEN, () => null)
    expect(res.status).toBe(503)
  })
})
