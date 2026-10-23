/**
 * Ambiente de ejecución de la plataforma. Lo comparten el Worker y el frontend.
 *
 * Regla de seguridad: cualquier valor desconocido o ausente se trata como "production",
 * que es el ambiente más restrictivo. Así una configuración olvidada nunca habilita
 * comportamientos de prueba (por ejemplo, el proveedor de pagos MOCK).
 */
export const APP_ENVS = ['development', 'staging', 'production'] as const

export type AppEnv = (typeof APP_ENVS)[number]

export function parseAppEnv(value: unknown): AppEnv {
  if (typeof value !== 'string') return 'production'
  const normalized = value.trim().toLowerCase()
  return (APP_ENVS as readonly string[]).includes(normalized) ? (normalized as AppEnv) : 'production'
}

export function isProduction(env: AppEnv): boolean {
  return env === 'production'
}
