/**
 * Textos de la portada. Provienen de lo que Woodland confirmó en las entrevistas, de lo que la
 * propia empresa publica en su Instagram (@woodland.peru) y de su catálogo oficial (PDF B2B y sitio de Canva,
 * entregados el 2026-10-21; ver docs/marca/CATALOGO-OFICIAL.md); cada dato indica su publicación de origen. Sin cifras de ventas, testimonios ni certificaciones que la empresa no haya publicado.
 * Pendiente: que Woodland valide la redacción final (en especial garantía y mantenimiento).
 */

export interface LandingImage {
  /** Ruta dentro de /public, p. ej. '/images/landing/hero-1600.webp'. */
  src: string
  srcSet?: string
  sizes?: string
  /** Descripción real de la foto (qué tabla, qué uso). Obligatoria por accesibilidad. */
  alt: string
  width: number
  height: number
  /** Punto de la foto que debe quedar a la vista al recortarla (object-position CSS). */
  focus?: string
}

type ImageKey = 'hero' | 'heroDetail' | 'grill' | 'serving' | 'engraveBoard' | 'kitchen' | 'custom' | 'plantation' | 'workshop' | 'boards' | 'purpose'

/**
 * Fotografías de la portada (ver docs/content/fotografias.md). Cada foto aparece una sola vez.
 * PROVISIONALES para la demo: recortes del Instagram de Woodland, usados con su autorización,
 * de 640 px como máximo. Reemplazar por los originales en alta resolución.
 * Si un valor es null se muestra un espacio rotulado "Fotografía pendiente".
 */
export const landingImages: Record<ImageKey, LandingImage | null> = {
  /** Fotos propias de Woodland entregadas por el equipo (2026-10-17), sin recortes. Confirmar permiso de uso de las personas que aparecen. */
  plantation: {
    src: '/images/landing/plantacion-teca.jpg',
    alt: 'Trabajador con casco y desbrozadora limpiando entre los árboles de una plantación de teca',
    width: 1280,
    height: 1040,
  },
  workshop: {
    src: '/images/landing/artesano-fresando.jpg',
    alt: 'Artesano con mascarilla fresando el canal de una tabla de teca sobre la mesa del taller',
    width: 960,
    height: 1280,
  },
  boards: {
    src: '/images/landing/tablas-taller.jpg',
    alt: 'Tablas de teca terminadas, apiladas en el taller junto a tablones de madera',
    width: 1280,
    height: 720,
  },
  /** Tabla de teca limpia, recortada de una foto propia de Woodland (publicada en su página de Canva) para el grabado vivo. Reemplazar por el original en alta resolución. */
  engraveBoard: {
    src: '/images/landing/tabla-grabado.jpg',
    alt: 'Tabla de teca con canal para jugos, vista desde arriba',
    width: 1540,
    height: 940,
  },
  /** Catálogo oficial (Canva, 2026-10-21): Moshaco, la joya de la colección Parrilla y Cocina. */
  grill: {
    src: '/images/oficial/moshaco.jpg',
    alt: 'Tabla Moshaco de teca con canal para jugos, costillas en un sartén blanco y un cuchillo, vista desde arriba',
    width: 799,
    height: 533,
  },
  /** Catálogo oficial: Ya Vuelta, la tabla redonda. */
  kitchen: {
    src: '/images/oficial/ya-vuelta.jpg',
    alt: 'Tabla redonda Ya Vuelta con pan, queso, aceitunas y tomates, vista desde arriba',
    width: 800,
    height: 533,
  },
  /** Grabado real de Woodland sobre teca (entregada por el equipo, 2026-10-17). */
  custom: {
    src: '/images/trabajos/fuegos-y-mas.jpg',
    alt: 'Tabla de teca con el logo «Fuegos y más» grabado con láser',
    width: 960,
    height: 1280,
    focus: '50% 38%',
  },
  /** Tabla de teca real con canal para jugos, foto propia de Woodland (página de Canva, 960×1280). Sustituye a la foto de carne de la portada. */
  hero: {
    src: '/images/landing/tabla-teca-taller.jpg',
    alt: 'Tabla de teca terminada con canal para jugos, sobre otras tablas en el taller',
    width: 820,
    height: 1060,
  },
  /** Foto entregada por el equipo (2026-10-17): el momento de atar la etiqueta a la tabla. */
  heroDetail: {
    src: '/images/landing/detalle-mano-cabuya.jpg',
    alt: 'Una mano sostiene la cabuya con la que se ata la etiqueta a una tabla de teca con agarradera',
    width: 900,
    height: 900,
  },
  /** Catálogo oficial: tabla con agarradera de la colección Piqueo y Servir, con embutidos, quesos y frutas. */
  serving: {
    src: '/images/oficial/huambrilla-piqueo.jpg',
    alt: 'Tabla de teca con agarradera cargada de embutidos, quesos y frutas sobre una mesa servida',
    width: 533,
    height: 800,
  },
  /** Foto del catálogo oficial (Canva, 1599×1070): el propósito de reforestar. */
  purpose: {
    src: '/images/oficial/mujer-en-el-bosque.jpg',
    alt: 'Mujer con sombrero y atuendo tradicional junto a un árbol, en el bosque amazónico',
    width: 1400,
    height: 937,
  },
}

export const homeContent = {
  hero: {
    eyebrow: 'Teca de nuestros bosques en San Martín', // posts Ddnb14mEWhZ y DeaEJDTvF85
    title: 'Sostenibilidad hecha lujo.',
    body: 'Tablas de teca premium de nuestras propias plantaciones forestales en San Martín, con trazabilidad desde la semilla y terminadas a mano. Para la parrilla, la cocina, la mesa y el regalo corporativo.', // catálogo oficial
    primaryCta: { label: 'Ver los productos', chat: 'Ver los productos' },
    secondaryCta: { label: 'Pedido para mi empresa', chat: 'Quiero hacer un pedido para mi empresa' },
    badge: 'Piezas con origen peruano', // post DeaEJDTvF85: "WOODLAND PERÚ. Piezas con origen."
  },
  /** Atributos que la empresa publica sobre sus tablas. */
  highlights: [
    'Teca sembrada en San Martín', // Ddnb14mEWhZ
    '15 años de reforestación', // catálogo oficial B2B
    'Trazabilidad desde la semilla', // catálogo oficial
    'Terminadas a mano por maestros artesanos', // Ddnb14mEWhZ
    'Sin lacas químicas', // Ddnb14mEWhZ
    'Garantía de por vida', // catálogo oficial
    'Mantenimiento gratuito al año', // catálogo oficial
    'Resistentes a hongos, humedad y calor', // catálogo oficial
    'Empresa familiar peruana', // DdKwV9ixBFP
  ],
  origin: {
    eyebrow: 'Nuestra historia',
    year: '2019', // el usuario (2026-10-18) pidió 2019; el Instagram de Woodland (publicación DLBRs2RP220) dice 2006: confirmar con la empresa
    yearLabel: 'Un sueño sembrado para reforestar nuestra selva', // DLBRs2RP220
    title: 'Conocemos el producto desde la semilla.',
    body: 'Sembramos lo que vendemos: nuestra teca crece en bosques de reforestación propios en San Martín. Cada tabla se trabaja y termina a mano, cuidando la belleza natural de la madera.', // DeLcCLJR-PU, Ddnb14mEWhZ
    steps: [
      { title: 'Sembramos', body: 'Teca de nuestros bosques de reforestación.' },
      { title: 'Trabajamos a mano', body: 'Maestros artesanos dan forma y acabado a cada pieza.' },
      { title: 'Llega a tu mesa', body: 'Piezas hechas para durar y para compartir.' },
    ],
    cta: { label: 'Conoce nuestra historia', to: '/nosotros' },
  },
  /** Capítulo 2: la plantación. La foto de fondo es `landingImages.plantation`. */
  seed: {
    lines: [
      'Sembramos lo que vendemos.', // DeLcCLJR-PU, Ddnb14mEWhZ
      'Nuestra teca crece en bosques de reforestación propios, en San Martín.', // Ddnb14mEWhZ
    ],
  },
  /** Capítulo 3: la veta y el acabado. Textos de las publicaciones Ddnb14mEWhZ y DeLcCLJR-PU. */
  grain: {
    eyebrow: 'El oficio',
    title: 'Cuidamos la belleza natural de la madera.',
    body: 'Cada tabla se trabaja y termina a mano, con un acabado natural que deja sentir la textura real de la teca.', // Ddnb14mEWhZ
    points: [
      { title: 'Terminadas a mano', body: 'Maestros artesanos dan forma y acabado a cada pieza.' },
      { title: 'Sin lacas químicas', body: 'Acabado natural, sin barnices que tapen la veta.' },
    ],
    before: 'Trabajada a mano',
    after: 'Terminada',
  },
  audiences: {
    eyebrow: 'Para quién trabajamos',
    title: 'Pedidos personales, corporativos y regalos', // DeLcCLJR-PU
    items: [
      {
        title: 'Personas',
        body: 'Elige tu tabla, solicita una personalización y recibe instrucciones claras para tu pedido.',
      },
      {
        title: 'Restaurantes, hoteles y bares',
        body: 'Menaje personalizado en teca para el servicio diario y para convertir una bienvenida en una experiencia.', // Dd4_yUDRWae y catálogo oficial
      },
      {
        title: 'Empresas',
        body: 'Regalos corporativos personalizados y proyectos a medida, desde 10 unidades, con atención directa.', // catálogo oficial
      },
    ],
  },
  commitment: {
    eyebrow: 'Nuestro compromiso',
    title: 'Una inversión que perdura.', // DdmvpUED7xP
    body: 'La calidad no termina con la venta. Cuando tu tabla necesite renovarse, la recibimos, la restauramos y te la devolvemos lista para muchos años más.', // DdmvpUED7xP
    points: [
      { title: 'Garantía de por vida', body: 'Cada tabla se entrega con su certificado de garantía.' }, // catálogo oficial
      { title: 'Mantenimiento gratuito al año', body: 'Una restauración gratuita cada año para que tu tabla luzca como nueva.' }, // catálogo oficial
      { title: 'Resistente por naturaleza', body: 'La teca resiste hongos, humedad y calor, y repele el agua, las grasas y las manchas.' }, // catálogo oficial
    ],
  },
  /** Propósito de la marca (catálogo oficial B2B y Canva). */
  purpose: {
    eyebrow: 'Nuestro propósito',
    title: 'Recuperemos nuestra selva amazónica.',
    body: 'Con cada compra nos ayudas a seguir sembrando. Woodland gestiona su propia reforestadora en San Martín: conocemos cada tabla desde que es una semilla.',
    facts: [
      '15 años de reforestación en San Martín, Amazonía peruana.',
      'Trazabilidad absoluta, desde la semilla hasta la pieza final en tu mesa.',
      'Teca con aceites naturales que la protegen del calor, la humedad y los microorganismos.',
      'Respaldo de certificaciones de SERFOR y procesos food-friendly de estándar internacional.',
    ],
    note: 'Los nombres de nuestras tablas vienen de palabras de San Martín, en honor al legado cultural del Oriente Peruano.',
  },
  closing: {
    title: '¿Necesitas varias piezas o un diseño especial?',
    body: 'Cuéntanos qué buscas y preparamos una propuesta para tu empresa, tu restaurante o tu evento.',
    cta: { label: 'Pedido para mi empresa', chat: 'Quiero hacer un pedido para mi empresa' },
  },
} as const
