# Contexto del cliente: lo que dijeron y lo que falta construir

Fuentes (entregadas por el equipo el 2026-10-17, en `Descargas`): pitch "Woodland Peru pitch.pdf", tres
Canvas Tech del Programa Acelera Digital 2026 (inventario, ventas, atención; consultor César Cervantes,
fecha 29/09/2026), el prompt de la práctica "Crea tu landing" y `INVENTARIO.xlsx`. Ocho audios de
WhatsApp (.ogg): **todavía sin transcribir**, no se pueden escuchar desde aquí.
Las cifras son las que Woodland presentó; no se publican en la web sin su validación.

## Personas

- **Alex Cárdenas Inchaustegui**: producción y logística. Registra movimientos de inventario desde el
  taller. Nivel tecnológico básico. En el sistema: rol `workshop`.
- **Brigitte Giraud Durazo**: atención al cliente y ventas. Supervisa inventario desde la laptop,
  actualiza el catálogo y gestiona WhatsApp Business. En el sistema: rol `admin`.

## Cifras del pitch (para el panel de impacto y la presentación)

| Dato | Valor |
| --- | --- |
| Años en el mercado | 6 |
| Clientes atendidos | más de 1,000 (18 corporativos) |
| Ventas mensuales actuales | S/ 5,200 · ticket promedio S/ 275 |
| Exactitud de inventario | 50% hoy (el canvas dice 60%) → meta 95% a 100% |
| Ventas perdidas al mes por inventario | 10 (S/ 2,750) |
| Consultas y cotizaciones que se pierden | 15 al mes (S/ 4,125) |
| Tiempo para cotizar | 1 hora (el canvas dice 20 min) → meta 8 min |
| Inversión | S/ 9,200: inventario 1,980 · WhatsApp Business 700 · CRM y cotización 3,960 · web y pedidos corporativos 2,560 |

Hay dos datos que no coinciden entre documentos (exactitud 50% vs 60%, cotización 1 hora vs 20 min):
validar cuál se usa.

## Decisiones del cliente que condicionan el producto

1. **La web no muestra stock.** (Canvas de ventas.) Decisión de Brigitte tras el caso Antamina (pedido
   de 40 tablas con error de reparto por talla). Se muestran **plazos estimados según la cantidad**,
   sin cantidades de stock.
   - 2 a 3 tablas: unos 2 días si hay stock cubierto.
   - 20 a 30 tablas: aproximadamente 1 semana.
   - 150 o más: unas 3 semanas, sobre todo por curado y acabado.
   - Son plazos estimados y sujetos a confirmación.
2. **Precio por rangos de cantidad** (ej. 1 a 5 un precio, 6 a 10 otro, 10 a 15 otro) **con tope
   máximo** (ej. 100 unidades); por encima se deriva a WhatsApp para cotizar directo. Los rangos y
   precios reales los define Brigitte.
3. **Tabla a medida**: se deriva a WhatsApp, coordinado con Brigitte.
4. **El grabado lo diseña el cliente en la web** con tipografía, posición y logo, y "los pedidos
   entran solos al CRM" (pitch).
5. **El cotizador genera la cotización y un mensaje listo para enviar por WhatsApp**, con la
   cotización como enlace.
6. **Inventario**: descuento automático al vender, alerta de stock bajo en 2 unidades enviada al
   celular, y visibilidad del stock comprometido en pedidos grandes frente al disponible. Debe
   conectarse al Excel actual: "no se busca reemplazar el Excel por un sistema nuevo desde cero".
7. **WhatsApp Business dedicado** (número nuevo, separado del personal) es condición previa para
   automatizar respuestas; prioridad baja en el canvas, pero está en el pitch.
8. Para las fotos, Woodland ya usa imágenes generadas o mejoradas con IA y quiere evitar sesiones
   profesionales costosas.

## Qué ya existe y qué falta frente a esto

| Tema | Estado |
| --- | --- |
| Grabado con tipografía, posición y texto → cotización | Hecho. Falta el **logo** subido y guardado (Storage) |
| Precio escalonado por cantidad | Base de datos lista (`price_tiers`); selector de cantidad con precio hecho |
| Tope de unidades y derivación a WhatsApp | Hecho (falta el número de WhatsApp) |
| Plazos estimados por rango de cantidad sin mostrar stock | Hecho (tramos intermedios por definir) |
| Cotización como enlace y mensaje de WhatsApp | **Falta** |
| Alerta de stock bajo al celular | Alertas en el panel; falta el aviso por WhatsApp (Fase 6) |
| Conexión con el Excel | Importador de una vía; falta decidir si se mantiene el Excel en paralelo |
| Seguimiento de pedido, CRM de consultas | Seguimiento hecho; el CRM de consultas y chat son Fase 4 y 6 |

**Resuelto (2026-10-17):** la web ya no muestra stock ni disponibilidad y `GET /api/catalog` dejó de
devolverlos. En su lugar hay selector de cantidad con precio por rangos, plazos estimados por cantidad
(`src/content/delivery.ts`), tope de 100 unidades por línea (`WEB_ORDER_MAX_UNITS`, validado también en
`POST /api/quotes`) y derivación a WhatsApp por encima del tope.

**Pendiente de Woodland:** el número de WhatsApp Business (`contact.whatsapp` en `src/content/site.ts`;
sin número, la web ofrece el formulario), los plazos de los tramos 4 a 19 y 31 a 149 unidades, y los
precios y rangos reales.

## Fotos reales entregadas (ya en la web)

`public/images/landing/`: `plantacion-teca.jpg` (trabajador desbrozando en la plantación),
`artesano-fresando.jpg` (artesano con fresadora en el canal de una tabla) y `tablas-taller.jpg`
(tablas terminadas apiladas en el taller). Aparecen personas: confirmar su permiso de uso.

## Lo que dicen los audios (transcritos en local con Whisper; calidad irregular, verificar con la persona)

Los ocho audios de WhatsApp del 2026-10-17 son la conversación de la dueña con el consultor, no mensajes
dirigidos al equipo. No se versionan; esto es un resumen.

- **Stock en la cabeza:** el inventario vive en un Excel que no siempre se actualiza y, muchas veces, en la
  memoria del taller. Pasa que dicen "sí tenemos" y ya no hay. Las ventas se concretan y no se descargan del
  inventario; ella se entera después.
- **Personalización B2B:** logos de restaurantes y clubes, nombres, dibujos, logos de equipos y frases. La
  dueña pierde tiempo preguntando qué grabar y esperando el logo (a veces hasta el día siguiente).
- **Grabado en la web:** "son más opciones quizá de las que necesitamos"; casi siempre se pide en las
  esquinas, rara vez en el centro. Si el pedido es corporativo se sube el logo y se pide por WhatsApp; la
  cantidad varía (más de 100 o solo 5).
- **Pagos:** corporativos pagan 50% de adelanto y el saldo antes de entregar; de 1 a 3 tablas se paga completo
  antes de producir. Propuesta del consultor: WhatsApp automatizado conectado a la base, de modo que al
  confirmarse el pago se descuente el inventario. También un control de ventas.
- **Clientes:** guardar a todos, también a los que no compraron. Lo que más les ayuda es la recomendación de
  boca en boca. Quieren abrirse a hoteles y restaurantes (hay una línea de catálogo nueva para eso).
- **Argumento de precio:** "puede parecer cara, pero dónde vas a tener que reponerla: dura años"
  (apoya la garantía de por vida, aún por validar).
- **Forma de las tablas:** la mayoría son planas; algunas llevan canal para jugos. Los diseños especiales
  primero se hacen como muestra.
- **Facturación:** sí emiten comprobantes ("¿Ustedes aplican facturación? Sí, claro"). Falta confirmar si
  es factura, boleta o ambas.
- **Marketing:** quiere mejorar el enlace de Instagram y tener el calendario de contenidos integrado en una
  misma plataforma (fuera del alcance actual; consultar).

## Indicaciones de la dueña (audio del 2026-10-22, transcrito por el consultor)

- **Marca premium** para los sectores A+, A y B; no es exclusiva (han comprado todos los sectores). La web debe ser
  **minimalista y elegante**: poco texto (quitar lo que no sea lo más importante), **como máximo dos fuentes** y
  **fotos grandes que se noten**.
- **Mensajes que deben quedar claros:** la marca **siembra la teca**; madera de **reforestación sostenible
  certificada por SERFOR**; entrega un **certificado para toda la vida** (lo que ninguna empresa de tablas hace);
  el **mantenimiento** va en un lugar más pequeño.
- **Personalización automática:** hoy dos personalizaciones le costaron medio día porque los clientes tardan en
  enviar el logo. Que **el cliente la haga en el momento** (texto y logo) y, si tiene dudas o quiere algo más,
  tenga la opción de **abrir WhatsApp y hablar con ella directamente**.
- **Líneas:** tablas premium (parrilla, servir, piqueos) y una sección pequeña **B2B** para corporativos que piden
  **más de 10 tablas**, con personalización o **diseño a sus medidas o necesidades**.
- **Aliados ≠ clientes:** los aliados (parrilleros, restaurantes, colaboradores de la marca) recibieron tablas de
  regalo **a cambio de publicidad**. Su lugar es uno **pequeño**, que no ocupe mucho espacio. Los **clientes** son
  otra cosa: la base está desactualizada (clientes del año pasado; lo demás vive en su WhatsApp).
