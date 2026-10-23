import type { Context, MiddlewareHandler } from 'hono'
import type { ApiErrorBody, StaffIdentity, StaffRole } from '../../shared/api/contracts'
import type { AppBindings } from '../types'

/**
 * Proveedor de autenticación del personal. Se inyecta para poder probar el middleware
 * sin red y para no acoplar las rutas a Supabase.
 */
export interface StaffAuthProvider {
  /** Verifica la firma y vigencia del token. Devuelve el id del usuario o null si no es válido. */
  verifyAccessToken(token: string): Promise<string | null>
  /** Busca al usuario entre el personal activo. Lanza error si el servicio no responde. */
  findActiveStaff(token: string, userId: string): Promise<StaffIdentity | null>
}

/** Devuelve null cuando la autenticación no está configurada en este ambiente. */
export type StaffAuthFactory = (env: Env) => StaffAuthProvider | null

const BEARER = /^Bearer\s+([A-Za-z0-9\-_.]+)$/

function fail(c: Context<AppBindings>, status: 401 | 403 | 503, code: string, message: string) {
  return c.json<ApiErrorBody>({ error: { code, message, requestId: c.get('requestId') } }, status)
}

/**
 * Exige un usuario del personal activo (opcionalmente con ciertos roles).
 * 401: sin token o token inválido · 403: sin rol suficiente · 503: autenticación no disponible.
 */
export function requireStaff(factory: StaffAuthFactory, roles?: readonly StaffRole[]): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const provider = factory(c.env)
    if (!provider) return fail(c, 503, 'auth_not_configured', 'La autenticación no está configurada.')

    const token = BEARER.exec(c.req.header('Authorization') ?? '')?.[1]
    if (!token) return fail(c, 401, 'unauthenticated', 'Debes iniciar sesión.')

    let userId: string | null
    try {
      userId = await provider.verifyAccessToken(token)
    } catch {
      return fail(c, 503, 'auth_unavailable', 'No se pudo verificar la sesión. Intenta nuevamente.')
    }
    if (!userId) return fail(c, 401, 'invalid_session', 'Tu sesión no es válida o expiró.')

    let staff: StaffIdentity | null
    try {
      staff = await provider.findActiveStaff(token, userId)
    } catch {
      return fail(c, 503, 'auth_unavailable', 'No se pudo verificar tus permisos. Intenta nuevamente.')
    }
    if (!staff) return fail(c, 403, 'forbidden', 'Tu cuenta no tiene acceso al panel.')
    if (roles && !roles.includes(staff.role)) {
      return fail(c, 403, 'forbidden', 'Tu rol no tiene permiso para esta acción.')
    }

    c.set('staff', staff)
    c.set('accessToken', token)
    await next()
  }
}

/** Exige uno de los roles dados. Va después de `requireStaff`, que ya verificó la sesión. */
export function requireRole(...roles: StaffRole[]): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    if (!roles.includes(c.get('staff').role)) {
      return fail(c, 403, 'forbidden', 'Tu rol no tiene permiso para esta acción.')
    }
    await next()
  }
}
