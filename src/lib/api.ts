import type { ApiErrorBody } from '../../shared/api/contracts'

/** Error de la API con el código estándar devuelto por el Worker. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId?: string

  constructor(status: number, code: string, message: string, requestId?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.requestId = requestId
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false
  const error = (value as { error: unknown }).error
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error
}

/**
 * Cliente mínimo para la API propia (/api). El frontend solo habla con nuestro Worker;
 * nunca llama directamente a proveedores que requieren credenciales privadas.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}, fetcher: typeof fetch = fetch): Promise<T> {
  if (!path.startsWith('/api/')) throw new Error(`Ruta de API inválida: ${path}`)

  const headers = new Headers(init.headers)
  if (!headers.has('Accept')) headers.set('Accept', 'application/json')

  let response: Response
  try {
    response = await fetcher(path, { ...init, headers })
  } catch {
    throw new ApiError(0, 'network_error', 'No se pudo conectar con el servidor.')
  }

  const body: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    if (isApiErrorBody(body)) {
      throw new ApiError(response.status, body.error.code, body.error.message, body.error.requestId)
    }
    throw new ApiError(response.status, 'http_error', `Error HTTP ${response.status}.`)
  }

  if (body === null) throw new ApiError(response.status, 'invalid_response', 'Respuesta inválida del servidor.')
  return body as T
}
