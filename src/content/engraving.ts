/**
 * Opciones del personalizador de grabado.
 *
 * PENDIENTE DE VALIDAR CON WOODLAND: qué tipos de letra ofrece realmente, cuántos
 * caracteres caben y si el grabado tiene costo adicional. Estas opciones son una propuesta de
 * diseño; no se muestra ningún precio de grabado. Lo que la persona elige viaja a la cotización
 * como texto y el equipo lo confirma antes de producir.
 */

export type EngravingPosition = 'bottom-right' | 'bottom-left' | 'top-left' | 'top-right' | 'center'
export type EngravingFont = 'classic' | 'italic' | 'modern'

/**
 * Según la dueña, casi todos los pedidos van en una esquina y muy pocos al centro: se ofrecen las
 * cuatro esquinas y el centro, con la esquina inferior derecha como opción inicial.
 */
export const defaultEngravingPosition: EngravingPosition = 'bottom-right'

export const engravingPositions: readonly { value: EngravingPosition; label: string }[] = [
  { value: 'bottom-right', label: 'Esquina inferior derecha' },
  { value: 'bottom-left', label: 'Esquina inferior izquierda' },
  { value: 'top-left', label: 'Esquina superior izquierda' },
  { value: 'top-right', label: 'Esquina superior derecha' },
  { value: 'center', label: 'Centro' },
]

export const engravingFonts: readonly { value: EngravingFont; label: string }[] = [
  { value: 'classic', label: 'Clásica' },
  { value: 'italic', label: 'Cursiva' },
  { value: 'modern', label: 'Moderna' },
]

/**
 * Pedidos de la dueña (notas de voz del 5 de noviembre de 2026, docs/context/comentarios-cliente-2026-11-05.md):
 * con dos líneas, elegir cuál va más grande; alinear el texto; y sumar un dibujo pequeño (cuchillos, utensilios,
 * gorro de cocinero). Los dibujos son una propuesta de diseño: el equipo confirma el grabado antes de producir.
 */
export type EngravingSizes = 'top' | 'bottom' | 'same'
export type EngravingAlign = 'left' | 'center' | 'right'
export type EngravingMotif = 'none' | 'knives' | 'utensils' | 'chef-hat'

export const engravingSizes: readonly { value: EngravingSizes; label: string }[] = [
  { value: 'top', label: 'Arriba más grande' },
  { value: 'bottom', label: 'Abajo más grande' },
  { value: 'same', label: 'Iguales' },
]

export const engravingAligns: readonly { value: EngravingAlign; label: string }[] = [
  { value: 'left', label: 'Izquierda' },
  { value: 'center', label: 'Centro' },
  { value: 'right', label: 'Derecha' },
]

export const engravingMotifs: readonly { value: EngravingMotif; label: string }[] = [
  { value: 'none', label: 'Sin dibujo' },
  { value: 'knives', label: 'Cuchillos' },
  { value: 'utensils', label: 'Utensilios' },
  { value: 'chef-hat', label: 'Gorro de chef' },
]

/** El dibujo dicho en una frase (vista previa accesible y mensajes de Teca). */
export const motifDescriptions: Record<Exclude<EngravingMotif, 'none'>, string> = {
  knives: 'cuchillo y cuchilla cruzados',
  utensils: 'tenedor y espátula cruzados',
  'chef-hat': 'gorro de cocinero',
}

/** La alineación que corresponde a cada posición si la persona no elige otra: a la derecha en las esquinas derechas, etc. */
export function naturalAlign(position: EngravingPosition): EngravingAlign {
  if (position === 'center') return 'center'
  return position.endsWith('left') ? 'left' : 'right'
}

export const engravingLimits = { line1: 24, line2: 32 } as const

export const engravingContent = {
  eyebrow: 'Hecha para ti',
  title: 'Escribe lo que quieras grabar y míralo nacer en la tabla.',
  body: 'Un nombre, una frase, una fecha. Lo que escribas llega a tu pedido tal cual, y nuestro equipo te confirma cómo quedará antes de producir.',
  placeholder: 'Tu nombre aquí',
  boardNote: 'Vista de referencia. El grabado final lo confirma nuestro equipo antes de producir.',
  cta: 'Pedir esta tabla',
  noModel: 'Sin elegir modelo: lo definimos al hacer el pedido.',
} as const
