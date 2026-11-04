import { createClient } from '@supabase/supabase-js'
import { readSupabaseConfig } from '../auth/supabase-auth'

/**
 * Perfil del personal: hoy, solo cambiar el propio nombre.
 * `staff_members` no admite escrituras con el JWT del usuario (altas, bajas y roles van por SQL), así que se usa la
 * clave de servicio y se actualiza únicamente la fila del usuario ya verificado y solo la columna `full_name`.
 */
export interface StaffProfileStore {
  updateFullName(userId: string, fullName: string): Promise<void>
}

export type StaffProfileFactory = (env: Env) => StaffProfileStore | null

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
} as const

export const createSupabaseStaffProfile: StaffProfileFactory = (env) => {
  const config = readSupabaseConfig(env)
  const secretKey = env.SUPABASE_SECRET_KEY?.trim()
  if (!config || !secretKey) return null
  const db = createClient(config.url, secretKey, clientOptions)

  return {
    async updateFullName(userId, fullName) {
      const { error } = await db.from('staff_members').update({ full_name: fullName }).eq('user_id', userId)
      if (error) throw new Error(`staff_members: ${error.code ?? 'error'}`)
    },
  }
}
