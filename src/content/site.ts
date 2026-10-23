/**
 * Contenido de marca y navegación pública.
 *
 * Solo contiene información confirmada por el equipo o publicada por la empresa. Datos como
 * teléfono, WhatsApp, dirección o RUC se agregarán cuando la empresa los entregue y valide.
 * No completar con datos supuestos.
 */
export const brand = {
  name: 'Woodland Perú',
  legalName: 'Corporación Wood Land Peru S.A.C.',
  slogan: 'Sostenibilidad hecha lujo.',
  tagline: 'Conocemos el producto desde la semilla.',
  description:
    'Tablas artesanales de madera para parrilla, cocina y presentación de alimentos, y pedidos personalizados para personas, restaurantes, hoteles y empresas.',
  instagram: { handle: '@woodland.peru', url: 'https://www.instagram.com/woodland.peru/' },
} as const

/**
 * Contacto de la empresa. El WhatsApp Business dedicado todavía no existe (condición previa del
 * Canvas de atención): sin número, la web ofrece el formulario de cotización en su lugar.
 * Completar con el número real con código de país, p. ej. '51987654321'.
 */
export const contact: { whatsapp: string | null } = { whatsapp: null }

/**
 * Brigitte, de ventas, atiende por WhatsApp las dudas de personalización que Teca no resuelve (dato entregado
 * por el usuario el 2026-10-23). Es un dato público: el botón del chat abre su WhatsApp con un mensaje ya escrito.
 */
export const brigitte = { name: 'Brigitte', whatsapp: '51948467431', display: '948 467 431' } as const

export interface NavItem {
  label: string
  to: string
}

export const publicNav: readonly NavItem[] = [
  { label: 'Inicio', to: '/' },
  { label: 'Alianzas', to: '/alianzas' },
  { label: 'Nosotros', to: '/nosotros' },
]
