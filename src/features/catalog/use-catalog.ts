import { useCallback, useEffect, useState } from 'react'
import type { CatalogResponse } from '../../../shared/api/contracts'
import { ApiError, apiFetch } from '../../lib/api'

export type CatalogState =
  | { kind: 'loading' }
  | { kind: 'ok'; data: CatalogResponse }
  | { kind: 'error'; message: string }

/** Una sola petición compartida por todas las secciones de la página. Se descarta al reintentar o fallar. */
let shared: Promise<CatalogResponse> | null = null

function loadCatalog(): Promise<CatalogResponse> {
  shared ??= apiFetch<CatalogResponse>('/api/catalog').catch((error: unknown) => {
    shared = null
    throw error
  })
  return shared
}

function toError(error: unknown): CatalogState {
  return {
    kind: 'error',
    message: error instanceof ApiError && error.status === 503 ? 'El catálogo no está disponible por ahora.' : 'No pudimos cargar el catálogo.',
  }
}

/** Carga el catálogo público (GET /api/catalog). Con `retry` vuelve a pedirlo. */
export function useCatalog(): { state: CatalogState; retry: () => void } {
  const [state, setState] = useState<CatalogState>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    loadCatalog()
      .then((data) => active && setState({ kind: 'ok', data }))
      .catch((error: unknown) => active && setState(toError(error)))
    return () => {
      active = false
    }
  }, [attempt])

  const retry = useCallback(() => {
    shared = null
    setState({ kind: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  return { state, retry }
}
