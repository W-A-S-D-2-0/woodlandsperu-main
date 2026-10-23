/**
 * Alianzas de Woodland Perú. La lista de aliados la dio el equipo (2026-10-21). Las descripciones solo
 * dicen lo que la propia empresa publica en su sitio o lo que el equipo indicó; no hay cifras ni
 * testimonios. Quien no tiene descripción, logo o foto no los muestra: no se inventan.
 * Los logos se tomaron de los sitios oficiales de cada marca (ver docs/marca/ALIANZAS.md) y pertenecen a sus dueños:
 * confirmar con cada aliado que acepta mostrarlos.
 */

export interface Ally {
  name: string
  /** A qué se dedica o qué relación tiene con Woodland, en pocas palabras. */
  role?: string
  /** Logo oficial. `dark` = logo blanco, que necesita fondo oscuro. */
  logo?: { src: string; tone: 'light' | 'dark'; alt: string; /** Logo circular en un cuadrado: se recorta en círculo. */ round?: boolean }
  /** Foto de la persona, cuando el aliado es una persona (chef, embajador). */
  photo?: { src: string; alt: string }
  url?: string
  /** Perfil en una red social, para quien no tiene sitio web (personas, parrilleros). Se muestra como «Ver Instagram», «Ver Facebook» o «Ver YouTube». */
  profile?: { network: 'Instagram' | 'Facebook' | 'YouTube'; url: string }
}

export const alliancesContent = {
  eyebrow: 'Alianzas',
  title: 'Quienes trabajan con Woodland',
  intro: 'Empresas, restaurantes y parrilleros que llevan nuestras tablas a su mesa y a su marca.',
  logosNote: 'Los logos pertenecen a sus respectivas marcas.',
  groups: [
    {
      title: 'Empresas aliadas',
      allies: [
        {
          name: 'Tambo',
          role: 'Cadena de tiendas de conveniencia',
          logo: { src: '/images/alianzas/tambo.png', tone: 'light', alt: 'Logo de Tambo' },
          url: 'https://www.tambo.pe',
        },
        {
          name: 'Tramarsa',
          role: 'Operaciones marítimas y portuarias',
          logo: { src: '/images/alianzas/tramarsa.svg', tone: 'light', alt: 'Logo de Tramarsa' },
          url: 'https://www.tramarsa.com.pe',
        },
        {
          name: 'Redondos',
          role: 'Pollo, pavo, cerdo y productos preparados',
          logo: { src: '/images/alianzas/redondos.png', tone: 'dark', alt: 'Logo de Redondos' },
          url: 'https://www.redondos.com.pe',
        },
        { name: 'Promune' },
        {
          name: 'Tisur',
          role: 'Terminal Internacional del Sur, puerto de Matarani',
          logo: { src: '/images/alianzas/tisur.png', tone: 'dark', alt: 'Logo de Tisur' },
          url: 'https://tisur.com.pe',
        },
        {
          name: 'Alexim',
          role: 'Logística internacional de carga',
          logo: { src: '/images/alianzas/alexim.png', tone: 'dark', alt: 'Logo de Alexim' },
          url: 'https://alexim.com',
        },
      ],
    },
    {
      title: 'Restaurantes y parrilleros',
      allies: [
        {
          name: 'Grillman Perú',
          role: 'Embajador de la marca Woodland',
          logo: { src: '/images/alianzas/grillman.png', tone: 'light', round: true, alt: 'Logo de Grillman: cuchillo y trinche cruzados' },
          profile: { network: 'Facebook', url: 'https://www.facebook.com/grillmanperu/' },
        },
        {
          name: 'Giacomo Bocchio',
          role: 'Chef',
          photo: { src: '/images/alianzas/giacomo-bocchio.jpg', alt: 'El chef Giacomo Bocchio con chaqueta de cocina' },
          profile: { network: 'Instagram', url: 'https://www.instagram.com/giacomo_bocchio' },
        },
        {
          name: 'Otorongo’s Grill',
          role: 'Parrillas de acero inoxidable, catering BBQ y talleres',
          logo: { src: '/images/alianzas/otorongos-grill.png', tone: 'light', alt: 'Logo de Otorongo’s Grill' },
          url: 'https://otorongosgrill.com.pe',
        },
        {
          name: 'Recutecu',
          role: 'Parrilleros',
          logo: { src: '/images/alianzas/recutecu.png', tone: 'light', round: true, alt: 'Logo del canal de YouTube de Recutecu Parrillero' },
          profile: { network: 'YouTube', url: 'https://www.youtube.com/@RecutecuParrillero' },
        },
        {
          name: 'El Quincho',
          role: 'Restaurante de carnes',
          logo: { src: '/images/alianzas/el-quincho.png', tone: 'light', alt: 'Logo de El Quincho, Costumbres Argentinas' },
        },
        {
          name: 'Alemana Haus',
          role: 'Restaurante de charcutería',
          logo: { src: '/images/alianzas/alemana-haus.png', tone: 'dark', alt: 'Logo de Salchichería Alemana Haus' },
          url: 'https://salchicheriahaus.mesa247.pe',
        },
      ],
    },
  ],
} as const satisfies {
  eyebrow: string
  title: string
  intro: string
  logosNote: string
  groups: readonly { title: string; allies: readonly Ally[] }[]
}
