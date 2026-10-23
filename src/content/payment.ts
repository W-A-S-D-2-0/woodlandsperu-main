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
