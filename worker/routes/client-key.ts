import type { Context } from 'hono'
import type { AppBindings } from '../types'

/**
 * Clave para los límites de uso por visitante. Detrás del hosting (Vercel reenvía /api al Worker) la
 * conexión llega desde el proxy, así que CF-Connecting-IP sería la misma para todos; el hosting indica
 * la IP real en X-Forwarded-For (primer valor). Sin proxy se usa CF-Connecting-IP.
 * Es una barrera contra abuso, no de seguridad: la base y RLS siguen siendo la defensa real.
 */
export function clientKey(c: Context<AppBindings>): string {
  const forwarded = c.req.header('X-Forwarded-For')?.split(',')[0]?.trim()
  return forwarded || c.req.header('CF-Connecting-IP') || 'unknown'
}
