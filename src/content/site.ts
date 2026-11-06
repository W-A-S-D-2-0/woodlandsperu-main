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
 * Brigitte, de ventas, atiende por WhatsApp las dudas de personalización que Teca no resuelve (dato entregado
 * por el usuario el 2026-10-23). Es un dato público: el botón del chat abre su WhatsApp con un mensaje ya escrito.
 */
export const brigitte = { name: 'Brigitte', whatsapp: '51948467431', display: '948 467 431' } as const

/**
 * Contacto de la empresa. El 2026-11-05 el usuario pidió, dentro del chat de Teca, un botón de WhatsApp «a su número de
 * Woodland»; el único número entregado es el de ventas (Brigitte), así que el botón lleva ahí. Si la empresa
 * abre un WhatsApp Business propio, se cambia solo este dato.
 */
export const contact = { whatsapp: brigitte.whatsapp, display: brigitte.display } as const

/**
 * Mensaje con el que se abre WhatsApp desde el botón del chat, según la página en que está la persona: así el
 * equipo sabe de dónde viene y qué busca. La clave es la ruta; `default` sirve para las demás.
 */
export const whatsappMessages: Readonly<Record<string, string>> = {
  default: 'Hola Woodland, vengo de su página web y quiero información sobre sus tablas.',
  '/alianzas': 'Hola Woodland, vengo de su página web y quiero información sobre sus alianzas con empresas y restaurantes.',
  '/nosotros': 'Hola Woodland, vengo de su página web, conocí su historia y quiero información sobre sus tablas.',
  '/grabado': 'Hola Woodland, vengo de su página web y quiero consultar por el grabado de mi tabla.',
}

export interface NavItem {
  label: string
  to: string
}

export const publicNav: readonly NavItem[] = [
  { label: 'Inicio', to: '/' },
  { label: 'Alianzas', to: '/alianzas' },
  { label: 'Nosotros', to: '/nosotros' },
]
