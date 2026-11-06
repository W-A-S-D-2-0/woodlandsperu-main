# Comentarios de la clienta · notas de voz del 6 de noviembre de 2026

Dos notas de voz de WhatsApp de la dueña de Woodland, enviadas a las 12:25 a. m. y a las 12:28 a. m. Las transcribió ElevenLabs Scribe y se revisaron a mano. Abajo va primero lo que pide y después el texto casi literal.

## Lo que pide

### Audio 1 (12:25, 2 min 37 s)

1. **Prioridad de esta etapa:** una página web para presentarse de forma profesional, no solo Instagram (que es lo que más se mueve). Lo demás que se le propuso le parece bien, pero lo deja para una **segunda etapa**.
2. **Que la conversación ocurra en el chatbot de la web.**
3. **Un chatbot más cálido y personal**, «no tan chatbot», «no tan frío». Debe seguir siendo automático, pero que la gente sienta que habla con una persona.
   - Saludo que propone: «Hola, soy Brigitte, cofundadora de Woodland. ¿En qué te puedo ayudar?» o «¿Qué tabla te gustó?».
   - Por qué: su público es de la generación X. Casi no compran en Temu ni en Amazon; prefieren la compra directa y hablar con la gente.

### Audio 2 (12:28, 29 s)

4. **Una opción «Quiero hablar con un asesor» en el chat.** Si no se puede poner el enlace de WhatsApp, que el chat diga «habla con Brigitte» y muestre su teléfono a la vista.

## Transcripción

**Audio 1.** «Sí, sí, sí, hijo. Todo bien. Todo lo que me has dicho está muy bien. Eso es para una segunda etapa. Lo importante ahorita es tener una página web con la que nos podamos presentar de forma profesional, ¿no? No solamente tener Instagram, que es en verdad el que más se mueve. Sí, okey, que se hable en el chatbot de la página web. Sin embargo, sí me gustaría que buscáramos una forma de que se sienta más personal, ¿no? No tan chatbot… Obviamente tiene que ser automatizado y todo, pero no tan frío, un poco más cálido, como si sintieran que están hablando con una persona. Quizá decirles: "Hola, soy Brigitte, soy cofundadora de Woodland. ¿En qué te puedo ayudar?", o "¿Qué tabla te ha gustado?", algo así, pero un poquito más cálido. Porque, como les he dicho, nosotros somos generación X y somos básicamente el público que consume este tipo de cosas. No compramos en Temu, muy poquito Amazon. Nos gusta más la compra directa, hablar con la gente, conectar con la persona. Ya entiendo que esa es una segunda etapa, no importa. Pero si en ese chatbot pudiéramos ser más cálidos, más personales: "Hola, soy Brigitte, soy cofundadora de Woodland. Dime qué tabla te gustó, en qué te puedo ayudar". Algo así.»

**Audio 2.** «No sé si se pueda que en algún momento a la persona le des la opción "Quiero hablar con un asesor". Y si no puedes poner el link de WhatsApp, "habla con Brigitte" y le pones el teléfono de frente. Creo, ¿no?»

## Notas para implementar

- Hoy el asistente se llama **Teca** y se presenta como «asistente automático». Para que hable como Brigitte, cofundadora, hay que decidir si Teca desaparece o si cambia solo el saludo y el tono. También hay que cuidar la transparencia: es un bot que habla en nombre de una persona real.
- Ya existe un botón «Escríbenos por WhatsApp» (al 948 467 431, de Brigitte) dentro del chat (commit d807c53). Faltaría:
  - la opción explícita «Quiero hablar con un asesor»;
  - el número escrito a la vista y fácil de copiar (pedido también en el audio 3 del 5 de noviembre).
