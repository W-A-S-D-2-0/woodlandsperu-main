/**
 * Foto de cada modelo del catálogo de Woodland, por el `slug` del producto. Fuente: «The Woodland Experience»
 * (PDF entregado por Woodland el 2026-11-06). `focus` es el punto que queda a la vista al recortar en cuadrado.
 * Las fotos `bare` (carpeta sin-comida) se hicieron con IA a partir de esas mismas fotos, quitando la comida;
 * el equipo las aprobó el 2026-11-06. Si Woodland entrega fotos reales de la tabla sola, reemplazarlas.
 */
export interface ModelPhoto {
  name: string
  src: string
  width: number
  height: number
  alt: string
  /** object-position CSS para el recorte cuadrado de la cuadrícula. */
  focus?: string
  /** La misma tabla sin comida ni utensilios; aparece al pasar el cursor por la tarjeta del catálogo. */
  bare?: { src: string; focus?: string }
}

export const modelPhotos: Record<string, ModelPhoto> = {
  moshaco: { name: 'Moshaco', src: '/images/experience/moshaco.webp', width: 1076, height: 717, alt: 'Tabla Moshaco con canal, con carne a la parrilla, espárragos y un cuchillo junto al fuego', focus: '42% 60%', bare: { src: '/images/experience/sin-comida/moshaco.webp' } },
  'ya-vuelta': { name: 'Ya Vuelta', src: '/images/experience/ya-vuelta.webp', width: 1229, height: 820, alt: 'Tabla redonda Ya Vuelta con pan, queso horneado y tomates', focus: '58% 55%', bare: { src: '/images/experience/sin-comida/ya-vuelta.webp' } },
  'sacha-paleta': { name: 'Sacha Paleta', src: '/images/experience/sacha-paleta.webp', width: 922, height: 615, alt: 'Tabla Sacha Paleta con mango, con verduras asadas y salsa', focus: '55% 60%', bare: { src: '/images/experience/sin-comida/sacha-paleta.webp' } },
  pishcota: { name: 'Pishcota', src: '/images/experience/pishcota.webp', width: 543, height: 724, alt: 'Tabla Pishcota con asas, con carne en láminas, quesos y piña sobre mármol', focus: '50% 50%', bare: { src: '/images/experience/sin-comida/pishcota.webp' } },
  nuiti: { name: 'Nuiti', src: '/images/experience/nuiti.webp', width: 769, height: 512, alt: 'Tabla Nuiti con quesos, embutidos y frutas, junto a una botella de vino y dos copas', focus: '45% 60%', bare: { src: '/images/experience/sin-comida/nuiti.webp' } },
  'bosques-amazonicos': { name: 'Bosques Amazónicos', src: '/images/experience/bosques-amazonicos.webp', width: 512, height: 768, alt: 'Tabla Bosques Amazónicos con pan, queso, higos y miel', focus: '50% 55%', bare: { src: '/images/experience/sin-comida/bosques-amazonicos.webp' } },
  huambrilla: { name: 'Huambrilla', src: '/images/experience/huambrilla.webp', width: 512, height: 768, alt: 'Tabla Huambrilla con embutidos, quesos y frutos secos en una mesa para compartir', focus: '50% 62%', bare: { src: '/images/experience/sin-comida/huambrilla.webp' } },
  nanito: { name: 'Ñañito', src: '/images/experience/nanito.webp', width: 471, height: 836, alt: 'Tabla Ñañito con quesos, jamón, uvas y galletas sobre mármol', focus: '50% 50%', bare: { src: '/images/experience/sin-comida/nanito.webp' } },
}
