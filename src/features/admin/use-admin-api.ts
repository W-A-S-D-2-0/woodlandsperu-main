import { useCallback, useEffect, useState } from 'react'
import { ApiError, apiFetch } from '../../lib/api'
import { useStaffSession } from '../auth/auth-context'

type Method = 'POST' | 'PUT' | 'PATCH'

/** Llamada a /api/admin/* con el JWT de la sesión. La API y RLS vuelven a verificar los permisos. */
export function adminFetch<T>(token: string, path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init
  const headers = new Headers(rest.headers)
  headers.set('Authorization', `Bearer ${token}`)
  if (json !== undefined) headers.set('Content-Type', 'application/json')
  return apiFetch<T>(`/api/admin${path}`, { ...rest, headers, body: json === undefined ? rest.body : JSON.stringify(json) })
}

/** Una imagen privada del panel (por ejemplo la captura de pago de un cliente), pedida con la sesión del personal. */
export async function adminImage(token: string, path: string, fetcher: typeof fetch = fetch): Promise<Blob> {
  const response = await fetcher(`/api/admin${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) throw new Error('No se pudo cargar la imagen.')
  return response.blob()
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Ocurrió un error inesperado.'
}

export type QueryState<T> = { status: 'loading' } | { status: 'ok'; data: T } | { status: 'error'; message: string }

/**
 * Carga datos del panel. Mientras la ruta o la versión cambian, el estado vuelve a "loading"
 * sin efectos síncronos: el resultado solo vale para la clave con la que se pidió. Las recargas de la misma
 * ruta conservan los datos anteriores hasta que llegan los nuevos.
 */
export function useAdminQuery<T>(path: string): { state: QueryState<T>; reload: () => void } {
  const { accessToken } = useStaffSession()
  const [version, setVersion] = useState(0)
  const key = `${path}#${version}`
  const [result, setResult] = useState<{ key: string; path: string; state: QueryState<T> } | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    adminFetch<T>(accessToken, path, { signal: controller.signal })
      .then((data) => setResult({ key, path, state: { status: 'ok', data } }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        // Si ya había datos de esta misma pantalla (recarga automática o reintento), se conservan:
        // un fallo pasajero no debe borrar lo que la persona está leyendo ni lo que está escribiendo.
        setResult((prev) =>
          prev?.path === path && prev.state.status === 'ok'
            ? { ...prev, key }
            : { key, path, state: { status: 'error', message: errorMessage(error) } },
        )
      })
    return () => controller.abort()
  }, [accessToken, path, key])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  // Mientras recarga la misma pantalla se siguen mostrando los datos anteriores (sin parpadeo ni perder lo escrito).
  const state: QueryState<T> =
    result?.key === key || (result?.path === path && result.state.status === 'ok') ? result!.state : { status: 'loading' }
  return { state, reload }
}

/** Ejecuta una acción de escritura y expone su estado (pendiente / error). */
export function useAdminAction() {
  const { accessToken } = useStaffSession()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(
    async <T = { ok: true }>(method: Method, path: string, json?: unknown): Promise<T | null> => {
      setPending(true)
      setError(null)
      try {
        return await adminFetch<T>(accessToken, path, { method, json: json ?? {} })
      } catch (err) {
        setError(errorMessage(err))
        return null
      } finally {
        setPending(false)
      }
    },
    [accessToken],
  )

  return { run, pending, error, clearError: () => setError(null) }
}
