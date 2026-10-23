import { isRouteErrorResponse, useRouteError } from 'react-router'
import { NotFoundPage } from './NotFoundPage'

/** Límite de errores de las rutas: evita pantallas en blanco ante fallas de carga o render. */
export function RouteError() {
  const error = useRouteError()

  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />

  return (
    <div className="mx-auto max-w-xl px-5 py-24">
      <h1 className="text-3xl">Algo salió mal</h1>
      <p className="mt-4 text-carbon-600">Ocurrió un error al cargar esta página. Intenta recargar en unos segundos.</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-8 inline-flex min-h-11 items-center rounded-full bg-nogal px-6 text-sm font-semibold text-marfil hover:bg-nogal-800"
      >
        Recargar
      </button>
    </div>
  )
}
