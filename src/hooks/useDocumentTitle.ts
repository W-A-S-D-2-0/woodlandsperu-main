import { useEffect } from 'react'
import { brand } from '../content/site'

/** Define el título de la pestaña: "Sección · Woodland Perú". */
export function useDocumentTitle(section?: string) {
  useEffect(() => {
    document.title = section ? `${section} · ${brand.name}` : `${brand.name} · ${brand.slogan}`
  }, [section])
}
