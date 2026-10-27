import { useEffect, useRef, useState } from 'react'

/**
 * Imagen privada: se pide con una función (que lleva el token o la sesión) y se muestra desde una dirección temporal del
 * navegador. Al tocarla se abre grande en otra pestaña. `cacheKey` identifica la imagen: si cambia, se vuelve a pedir.
 */
export function AuthedImage({ cacheKey, load, alt, className }: { cacheKey: string; load: () => Promise<Blob>; alt: string; className?: string }) {
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  })
  const [state, setState] = useState<{ key: string; url: string | null }>({ key: '', url: null })

  useEffect(() => {
    let revoked = false
    let objectUrl: string | null = null
    loadRef
      .current()
      .then((blob) => {
        if (revoked) return
        objectUrl = URL.createObjectURL(blob)
        setState({ key: cacheKey, url: objectUrl })
      })
      .catch(() => {
        if (!revoked) setState({ key: cacheKey, url: '' })
      })
    return () => {
      revoked = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [cacheKey])

  if (state.key !== cacheKey || state.url === null) return <span className="block h-24 w-32 animate-pulse rounded-xl bg-carbon/10" role="status" aria-label="Cargando la imagen" />
  if (state.url === '') return <span className="block text-xs opacity-70">No se pudo cargar la imagen.</span>
  return (
    <a href={state.url} target="_blank" rel="noreferrer" className="block w-fit" aria-label={`${alt} (abrir en grande)`}>
      <img src={state.url} alt={alt} className={className ?? 'max-h-56 max-w-full rounded-xl object-contain'} />
    </a>
  )
}
