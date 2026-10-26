import { useEffect, useMemo, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import type { StaffMeResponse } from '../../../shared/api/contracts'
import { ApiError, apiFetch } from '../../lib/api'
import { AuthNotice, primaryButtonClass, secondaryButtonClass } from './AuthNotice'
import { StaffContext, useAuth, type StaffSession } from './auth-context'

type Check =
  | { kind: 'checking'; token: string }
  | { kind: 'ok'; token: string; staff: StaffMeResponse }
  | { kind: 'forbidden'; token: string }
  | { kind: 'error'; token: string; message: string }

/**
 * Guardia de las rutas /admin. Exige sesión de Supabase y que el backend confirme
 * que el usuario es personal activo (GET /api/admin/me). La interfaz nunca decide
 * permisos por sí sola: la API y RLS vuelven a verificarlos en cada operación.
 */
export function RequireStaff() {
  const { status, session, signOut } = useAuth()
  const location = useLocation()
  const token = session?.access_token ?? null
  const [check, setCheck] = useState<Check | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    apiFetch<StaffMeResponse>('/api/admin/me', {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((staff) => setCheck({ kind: 'ok', token, staff }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        if (error instanceof ApiError && error.status === 401) {
          void signOut()
        } else if (error instanceof ApiError && error.status === 403) {
          setCheck({ kind: 'forbidden', token })
        } else {
          setCheck({ kind: 'error', token, message: error instanceof ApiError ? error.message : 'Error desconocido.' })
        }
      })
    return () => controller.abort()
  }, [token, signOut, attempt])

  // El resultado solo vale para el token con que se verificó (al renovarse se vuelve a verificar).
  const current: Check | null = token ? (check?.token === token ? check : { kind: 'checking', token }) : null

  const verified = check?.kind === 'ok' && check.token === token ? check : null
  const staffSession = useMemo<StaffSession | null>(
    () => (verified ? { staff: verified.staff, accessToken: verified.token, signOut } : null),
    [verified, signOut],
  )

  if (status === 'unconfigured') {
    return (
      <AuthNotice title="Panel no disponible">
        La autenticación no está configurada en este ambiente, por lo que el panel permanece cerrado.
      </AuthNotice>
    )
  }

  if (status === 'signed_out') {
    const next = `${location.pathname}${location.search}`
    return <Navigate to={`/ingresar?next=${encodeURIComponent(next)}`} replace />
  }

  if (status === 'loading' || !current || current.kind === 'checking') {
    return (
      <AuthNotice title="Verificando acceso…">
        <span role="status">Estamos comprobando tu sesión.</span>
      </AuthNotice>
    )
  }

  if (current.kind === 'forbidden') {
    return (
      <AuthNotice
        title="Sin acceso al panel"
        actions={
          <button type="button" className={primaryButtonClass} onClick={() => void signOut()}>
            Cerrar sesión
          </button>
        }
      >
        Tu cuenta aún no tiene acceso al panel. Si acabas de crearla, administración debe aprobarla; si crees que es un
        error, contacta a administración.
      </AuthNotice>
    )
  }

  if (current.kind === 'error') {
    return (
      <AuthNotice
        title="No pudimos verificar tu acceso"
        actions={
          <>
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() => {
                setCheck(null)
                setAttempt((n) => n + 1)
              }}
            >
              Reintentar
            </button>
            <button type="button" className={secondaryButtonClass} onClick={() => void signOut()}>
              Cerrar sesión
            </button>
          </>
        }
      >
        {current.message}
      </AuthNotice>
    )
  }

  return (
    <StaffContext.Provider value={staffSession}>
      <Outlet />
    </StaffContext.Provider>
  )
}
