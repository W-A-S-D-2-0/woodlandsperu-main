/** Foto de cada modelo del catálogo oficial de Woodland, por el `slug` del producto. */
export interface ModelPhoto {
  name: string
  src: string
  width: number
  height: number
  alt: string
}

export const modelPhotos: Record<string, ModelPhoto> = {
  moshaco: { name: 'Moshaco', src: '/images/oficial/moshaco.jpg', width: 799, height: 533, alt: 'Tabla Moshaco, rectangular con canal, con cuchillo y alimentos' },
  'ya-vuelta': { name: 'Ya Vuelta', src: '/images/oficial/ya-vuelta.jpg', width: 800, height: 533, alt: 'Tabla redonda Ya Vuelta con pan, queso y tomates' },
  'sacha-paleta': { name: 'Sacha Paleta', src: '/images/oficial/sacha-paleta.jpg', width: 800, height: 527, alt: 'Tabla Sacha Paleta con mango, con verduras y salsa' },
  'bosques-amazonicos': { name: 'Bosques Amazónicos', src: '/images/oficial/bosques-amazonicos.jpg', width: 512, height: 768, alt: 'Tabla de presentación con pan, queso fresco, higos y miel' },
  huambrilla: { name: 'Huambrilla', src: '/images/oficial/huambrilla-piqueo.jpg', width: 533, height: 800, alt: 'Tabla Huambrilla con embutidos, quesos, frutos secos y frutas para compartir' },
  nanito: { name: 'Ñañito', src: '/images/oficial/nanito.jpg', width: 512, height: 768, alt: 'Tabla Ñañito con un sándwich y papas en un servicio individual' },
}
