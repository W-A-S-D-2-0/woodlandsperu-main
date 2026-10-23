import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente de Supabase del navegador. Solo se usa para la sesión del personal
 * (iniciar y cerrar sesión, renovar el token). Los datos se piden a nuestra API (/api).
 *
 * Usa la URL y la clave PUBLICABLE (públicas por diseño y protegidas por RLS).
 * Devuelve null si el ambiente no tiene Supabase configurado.
 */
let client: SupabaseClient | null | undefined

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client

  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  client = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } }) : null
  return client
}
