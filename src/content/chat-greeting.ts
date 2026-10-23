/**
 * Primer mensaje de Teca. Lo muestra el chat al abrirse y, al enviar el cliente su primer mensaje, el servidor lo guarda
 * en la conversación: así el historial sabe que Teca preguntó el nombre y puede usar la respuesta en el pedido.
 */

/** Frase fija con la que se reconoce, en el historial, que Teca ya preguntó el nombre. */
export const GREETING_ASK = '¿cómo te llamas?'

export const chatGreeting = `¡Hola! Soy Teca, tu guía en Woodland Perú. Te ayudo con precios, plazos, grabado y pedidos, y te respondo al instante. Para empezar, ${GREETING_ASK}`
