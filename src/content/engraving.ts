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
