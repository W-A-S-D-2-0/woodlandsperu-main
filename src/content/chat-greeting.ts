/**
 * Primer mensaje de Teca. Lo muestra el chat al abrirse y, al enviar el cliente su primer mensaje, el servidor lo guarda
 * en la conversación: así el historial sabe que Teca preguntó el nombre y puede usar la respuesta en el pedido.
 */

/** Frase fija con la que se reconoce, en el historial, que Teca ya preguntó el nombre. */
export const GREETING_ASK = '¿cómo te llamas?'

export const chatGreeting = `¡Hola! Soy Teca, tu guía en Woodland Perú. Te ayudo con precios, plazos, grabado y pedidos, y te respondo al instante. Para empezar, ${GREETING_ASK}`

/** Lo que dice Teca al cancelar un pedido. */
export const CANCELLED_TEXT = 'Listo, cancelé el pedido. No dudes en volver a escribirnos.'

/**
 * ¿Este mensaje de Teca cierra una operación? Cancelar el pedido, registrar una cotización o confirmar el pago.
 * El pedido ya creado que espera su pago NO cuenta: el cliente aún debe subir la captura en la misma conversación.
 */
export function endsOperation(body: string): boolean {
  return body.includes(CANCELLED_TEXT) || /Listo, registré tu pedido COT-\d{6,}/.test(body) || body.includes('recibimos tu pago')
}

/** «Hola» y saludos parecidos: junto con los botones, abren una conversación nueva cuando la anterior ya terminó. */
export const isGreetingWord = (text: string): boolean =>
  /^(hola|holi|holis|holaa+|buenas|buen dia|buenos dias|buenas tardes|buenas noches|hey|hi)\b/.test(
    text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/^[^a-z]+/, ''),
  )
