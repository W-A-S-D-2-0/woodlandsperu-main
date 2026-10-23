import { createClient } from '@supabase/supabase-js'
import type { StaffIdentity, StaffRole } from '../../shared/api/contracts'
import type { StaffAuthFactory, StaffAuthProvider } from './staff-auth'

const STAFF_ROLES: readonly StaffRole[] = ['admin', 'workshop']

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
} as const

/** Lee la configuración pública de Supabase del Worker. Null si falta o es inválida. */
export function readSupabaseConfig(env: Pick<Env, 'SUPABASE_URL' | 'SUPABASE_PUBLISHABLE_KEY'>) {
  const url = env.SUPABASE_URL?.trim()
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY?.trim()
  if (!url || !publishableKey) return null
  try {
    const parsed = new URL(url)
    const isLocal = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost'
    if (parsed.protocol !== 'https:' && !isLocal) return null
  } catch {
    return null
  }
  return { url, publishableKey }
}

/**
 * Autenticación real con Supabase:
 * - `getClaims` verifica el JWT (con las claves públicas del proyecto, o con el servidor de Auth
 *   si el proyecto aún usa secreto simétrico).
 * - El rol se lee de `staff_members` con el JWT del propio usuario, así RLS solo le deja ver su fila.
 */
export const createSupabaseStaffAuth: StaffAuthFactory = (env) => {
  const config = readSupabaseConfig(env)
  if (!config) return null

  const provider: StaffAuthProvider = {
    async verifyAccessToken(token) {
      const client = createClient(config.url, config.publishableKey, clientOptions)
      const { data, error } = await client.auth.getClaims(token)
      if (error || !data) return null
      const { sub, role } = data.claims
      return typeof sub === 'string' && role === 'authenticated' ? sub : null
    },

    async findActiveStaff(token, userId) {
      const client = createClient(config.url, config.publishableKey, {
        ...clientOptions,
        global: { headers: { Authorization: `Bearer ${token}` } },
      })
      const { data, error } = await client
        .from('staff_members')
        .select('user_id, role, full_name, is_active')
        .eq('user_id', userId)
        .maybeSingle()

      if (error) throw new Error(`staff_members: ${error.code ?? 'error'}`)
      if (!data || !data.is_active || !STAFF_ROLES.includes(data.role)) return null

      const staff: StaffIdentity = { userId: data.user_id, role: data.role, fullName: data.full_name }
      return staff
    },
  }
  return provider
}
