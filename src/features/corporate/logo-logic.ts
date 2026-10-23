
/** Lógica del cotizador con logo para empresas. Sin React: se prueba sola. */

export const LOGO_MAX_BYTES = 5 * 1024 * 1024
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'] as const

export interface LogoFileInfo {
  name: string
  type: string
  size: number
}

/** Mensaje de error si el archivo no sirve para la vista previa; null si es válido. */
export function validateLogoFile(file: LogoFileInfo): string | null {
  if (!(LOGO_TYPES as readonly string[]).includes(file.type)) return 'Sube el logo como PNG, JPG, SVG o WebP.'
  if (file.size > LOGO_MAX_BYTES) return 'El archivo pesa más de 5 MB. Prueba con una versión más liviana.'
  if (file.size === 0) return 'El archivo está vacío.'
  return null
}

export interface CorporateValues {
  quantity: number
  /** Medida aproximada que la empresa tiene en mente (texto libre). */
  size: string
  /** Para cuándo lo necesitan (texto libre; el plazo real lo confirma el equipo). */
  when: string
  logoName: string | null
}

export const defaultCorporate: CorporateValues = { quantity: 10, size: '', when: '', logoName: null }
