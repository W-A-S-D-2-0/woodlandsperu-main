/**
 * Pago por Yape o Plin (manual: sin pasarela ni claves de API, que tienen costo).
 *
 * El cliente paga al número del negocio y el equipo confirma el pago con el código de la solicitud.
 * El número y el titular son datos de la empresa: NO se inventan. Mientras estén en `null`, no se muestra
 * ningún dato de pago y el asistente dice que el equipo los comparte al confirmar la cotización.
 *
 * Para activarlo, el administrador entrega el número (y el nombre con que aparece en Yape) y se completan
 * aquí. Es un dato público: se muestra al cliente.
 */
export const yapePlin: { number: string | null; holder: string | null } = {
  number: '965 402 725',
  holder: 'Alex Cárdenas Inchaústegui',
}

export const paymentConfigured = (): boolean => yapePlin.number !== null && yapePlin.number.trim() !== ''

/**
 * Cuándo pagar. El monto final lo confirma el equipo en la propuesta; las condiciones habituales
 * (corporativo: 50% de adelanto; 1 a 3 tablas: pago completo antes de producir) las confirma siempre el equipo.
 */
export const paymentTimingNote = 'Paga cuando el equipo te confirme el monto final de tu propuesta.'

/**
 * Líneas con los datos para pagar, o null si aún no hay número cargado. Con `amount` (pedido con precios ya
 * calculados) se indica el monto y que el equipo confirma las condiciones (adelanto o pago completo).
 */
export function paymentLines(code?: string, amount?: number): string[] | null {
  if (!paymentConfigured()) return null
  const when =
    amount === undefined
      ? paymentTimingNote
      : `Monto del pedido: S/ ${amount.toFixed(2)}. El equipo te confirma las condiciones de pago (adelanto o pago completo).`
  return [
    `Yape o Plin al número ${yapePlin.number!.trim()}${yapePlin.holder ? ` (a nombre de ${yapePlin.holder.trim()})` : ''}.`,
    code ? `En el mensaje del pago escribe tu código ${code} para que el equipo lo reconozca.` : 'En el mensaje del pago escribe tu código de solicitud para que el equipo lo reconozca.',
    when,
  ]
}

/** Texto plano para el chat. Null si no hay número cargado. */
export function paymentChatText(code?: string, amount?: number): string | null {
  const lines = paymentLines(code, amount)
  return lines ? `Para pagar: ${lines.join(' ')}` : null
}

/** Nombre del botón del chat para adjuntar la captura del pago. El widget lo reconoce en la respuesta de Teca. */
export const PROOF_BUTTON_LABEL = 'Subir captura de pago'

/**
 * Pago inmediato de un pedido del chat (precio ya conocido): monto completo por Yape y subida de la captura.
 * Null si no hay número cargado.
 */
export function paymentRequestText(code: string, amount: number): string | null {
  if (!paymentConfigured()) return null
  const holder = yapePlin.holder ? ` (${yapePlin.holder.trim()})` : ''
  return `Paga ahora por Yape o Plin:\n\n• Monto: S/ ${amount.toFixed(2)}\n• Número: ${yapePlin.number!.trim()}${holder}\n• Mensaje del pago: ${code}\n\nLuego toca «${PROOF_BUTTON_LABEL}» (el clip) y sube la captura: te confirmo al instante.`
}

/** Pregunta con la que Teca ofrece las formas de pago al registrar el pedido. El widget la reconoce y muestra los botones. */
export const PAYMENT_CHOICE_LABEL = '¿Cómo quieres pagar?'
export const CHOICE_YAPE_PLIN = 'Yape / Plin'
export const CHOICE_DEPOSIT = 'Depósito'

export type PaymentChoice = 'yape_plin' | 'deposit'

/** Lo que el cliente quiso decir al elegir cómo pagar; null si su mensaje no es una elección. */
export function detectPaymentChoice(text: string): PaymentChoice | null {
  const t = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  if (t.length > 40) return null
  if (/\b(yape|plin)\b/.test(t)) return 'yape_plin'
  if (/\b(deposito|depositar|transferencia|banco|bancario|cuenta)\b/.test(t)) return 'deposit'
  return null
}

/** Cierre del pedido: las dos formas de pago. Por ahora solo Yape/Plin está activo. */
export function paymentChoiceText(): string {
  return `${PAYMENT_CHOICE_LABEL}\n\n• ${CHOICE_YAPE_PLIN}\n• ${CHOICE_DEPOSIT}\n\nElige una de las dos.`
}

/** Respuesta al elegir depósito mientras no esté disponible. */
export const DEPOSIT_SOON_TEXT = `El pago por depósito todavía no está disponible aquí. Por ahora puedes pagar con Yape o Plin.\n\n${PAYMENT_CHOICE_LABEL}\n\n• ${CHOICE_YAPE_PLIN}\n• ${CHOICE_DEPOSIT}`
