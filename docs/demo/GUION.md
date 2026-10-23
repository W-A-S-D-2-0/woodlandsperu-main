# Guion de la demo · Woodland Perú (≈ 3 min 30 s)

Pensado para el video automático (`npm run demo`) y también para grabarlo en vivo con voz propia (OBS, Loom).
Las frases entre comillas son la locución; el recuadro del subtítulo del video dice lo mismo, más corto.

| Tiempo | Pantalla | Locución |
| --- | --- | --- |
| 0:00 – 0:20 | Portada de la web | «Woodland Perú hace tablas de teca desde la semilla: sembramos, trabajamos a mano y entregamos. Este es el sistema que lleva el negocio: una web que vende y un panel que ordena todo.» |
| 0:20 – 1:00 | Recorrido de la landing (historia, oficio, grabado, seguimiento) | «El cliente conoce el origen de la teca, ve cómo queda su grabado antes de pedir y puede seguir su pedido desde que lo recibimos hasta que llega.» |
| 1:00 – 1:25 | Catálogo y Cotizar | «El catálogo muestra modelos reales con plazos estimados y precio por cantidad, sin exponer el stock. Si prefiere, pide una cotización en un minuto.» |
| 1:25 – 2:10 | Chat con el asistente | «El asistente atiende solo, a cualquier hora. Conoce el catálogo, los plazos y el proceso. Cuando el cliente confirma, crea el pedido y reserva el stock; y le explica cómo pagar por Yape o Plin, sin pasarelas ni comisiones extra.» |
| 2:10 – 2:30 | Panel · Inicio de sesión y Resumen | «Del otro lado está el panel del negocio, solo para el equipo. El Resumen muestra lo que espera una acción: cotizaciones por revisar, conversaciones y stock bajo.» |
| 2:30 – 2:50 | Panel · Conversaciones | «Nadie del equipo tiene que contestar mensajes: el asistente atiende y el equipo solo supervisa lo que quedó marcado por revisar.» |
| 2:50 – 3:05 | Panel · Cotizaciones y Pedidos | «Las cotizaciones se completan con los precios pendientes; los pedidos nacidos del chat llegan con su estado de producción y de pago. El pago por Yape o Plin lo confirma el equipo con el código.» |
| 3:05 – 3:20 | Panel · Inventario | «El inventario se mueve solo: cada pedido reserva y descuenta stock. El equipo solo registra la producción terminada.» |
| 3:20 – 3:35 | Panel · Reportes | «Y los reportes muestran ventas, ticket promedio y conversión, con exportación a Google Sheets.» |
| 3:35 – 3:45 | Cierre | «Woodland Perú: más ventas, menos trabajo manual.» |

## Mensajes clave para el jurado

- **Problema que resuelve**: cotizar tomaba mucho tiempo y el inventario era manual; el asistente cotiza y vende 24/7 y el stock se actualiza solo.
- **IA con control**: el asistente solo puede anotar seguimientos, cotizar o crear el pedido que el cliente confirmó; los precios y el stock los decide la base de datos, nunca el modelo.
- **Costo cero en pagos**: Yape/Plin manual, sin pasarela ni API de pago.
- **Seguro**: el panel exige sesión y rol; la landing y el panel son dos aplicaciones separadas.

## Datos de prueba que deja la grabación

El chat envía mensajes reales: quedan 1 o 2 conversaciones de prueba («Hola, quiero 3 tablas Super Grill XL…») que se ven en
Panel › Conversaciones. No se confirma ningún pedido, así que no se reserva stock. Si se quiere mostrar un pedido completo,
hacerlo a mano con un producto barato y cancelar el pedido después.
