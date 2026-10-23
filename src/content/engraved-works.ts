/**
 * Trabajos de grabado láser sobre teca. Fotos entregadas por el equipo (2026-10-17), vienen de las
 * publicaciones de Woodland. La etiqueta es el nombre que se lee grabado en cada tabla.
 * Permiso de las marcas: confirmado por el equipo (2026-10-17).
 */
export interface EngravedWork {
  src: string
  label: string
  alt: string
}

export const engravedWorks: readonly EngravedWork[] = [
  { src: '/images/trabajos/fuegos-y-mas.jpg', label: 'Fuegos y más', alt: 'Tabla de teca con el logo «Fuegos y más» grabado' },
  { src: '/images/trabajos/el-quincho.jpg', label: 'El Quincho', alt: 'Tabla de teca con asa de hierro y el logo «El Quincho» grabado' },
  { src: '/images/trabajos/alemana-haus.jpg', label: 'Alemana Haus', alt: 'Tabla de teca con el logo «Salchichería Alemana Haus» grabado' },
  { src: '/images/trabajos/herencia.jpg', label: 'Herencia', alt: 'Tabla de teca con el logo «Herencia, la parrilla de Chema» grabado' },
  { src: '/images/trabajos/la-vaca-y-sus-amigos.jpg', label: 'La Vaca y sus amigos', alt: 'Tabla de teca oscura con el logo «La Vaca y sus amigos» grabado' },
  { src: '/images/trabajos/otorongos-grill.jpg', label: "Otorongo's Grill", alt: "Tabla de teca con el logo «Otorongo's Grill» grabado" },
  { src: '/images/trabajos/ahumudo.jpg', label: 'Ahumudo', alt: 'Tabla de teca con el logo «Ahumudo» grabado' },
  { src: '/images/trabajos/tambo.jpg', label: 'Tambo', alt: 'Tabla de teca con el logo «Tambo» grabado y la etiqueta de Woodland atada con cabuya' },
  { src: '/images/trabajos/fpf.jpg', label: 'FPF', alt: 'Tabla de teca con un escudo «FPF» grabado' },
  { src: '/images/trabajos/alexim.jpg', label: 'Alexim', alt: 'Tabla de teca con el logo «Alexim» grabado' },
  { src: '/images/trabajos/el-quincho-angulo.jpg', label: 'El Quincho', alt: 'Detalle en ángulo del grabado «El Quincho» sobre teca' },
]
