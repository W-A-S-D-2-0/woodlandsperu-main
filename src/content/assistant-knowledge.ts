/**
 * Lo que el asistente comercial sabe de Woodland Perú, además del catálogo y de los plazos.
 *
 * Solo hay datos que Woodland publicó o confirmó (Instagram @woodland.peru, entrevistas, Canvas y
 * audios del 2026-10-17; ver docs/context/cliente-woodland.md). Lo que no está aquí NO lo sabe, y el
 * asistente debe decir que el equipo lo confirma. Para ampliar su conocimiento, agrega líneas
 * aquí con datos validados por Woodland; no inventes ni completes con suposiciones.
 */

export const assistantKnowledge = {
  company: [
    'Woodland Perú (razón social: Corporación Wood Land Peru S.A.C.) es una empresa familiar peruana.',
    'Su lema es "Sostenibilidad hecha lujo." y dice "Conocemos el producto desde la semilla".',
    'Todo empezó con la siembra de teca para reforestar la selva (año 2019). Sus bosques de reforestación propios están en San Martín.',
    'Instagram: @woodland.peru.',
    'Lleva 15 años reforestando en San Martín (Amazonía peruana) y gestiona su propia reforestadora (@reforestadorafuturoverde): hay trazabilidad desde la semilla hasta la pieza final. Con cada compra el cliente ayuda a seguir sembrando.',
    'Woodland publica que su teca cuenta con el respaldo de certificaciones de SERFOR y procesos food-friendly de estándar internacional; no se conocen más detalles, el equipo los confirma.',
    'La teca tiene aceites naturales que la protegen del calor, la humedad y los microorganismos; es resistente a hongos, humedad y calor, y repele el agua, las grasas y las manchas.',
    'Los nombres de las tablas son palabras de la región de San Martín, en honor al legado cultural del Oriente Peruano.',
  ],
  product: [
    'Hace tablas de teca: para parrilla, cocina, presentación de alimentos (quesos, piqueos) y piezas personalizadas.',
    'Cada tabla se trabaja y termina a mano por maestros artesanos, con acabado natural y sin lacas químicas.',
    'Ofrece certificado de garantía de por vida y mantenimiento gratuito al año. Los detalles y las condiciones de la garantía los confirma el equipo.',
    'Colecciones oficiales: Parrilla y Cocina (The Master Series: Moshaco, Ya Vuelta y Sacha Paleta) y Piqueo y Servir (The Social Series: Bosques Amazónicos, Huambrilla y Ñañito). Además, grabado personalizado. Los precios y medidas vigentes son los del catálogo de abajo.',
    'La mayoría de las tablas son planas; algunas llevan un canal (por ejemplo, para jugos de la carne).',
  ],
  customers: [
    'Atiende a personas (para uso propio o regalo) y a empresas: restaurantes, hoteles, bares, clubes y regalos corporativos. Desarrolla proyectos corporativos a medida; para empresas, desde 10 unidades.',
    'Los pedidos corporativos suelen llevar el logo de la empresa grabado; el logo lo coordina el equipo después del pedido.',
  ],
  engraving: [
    'Se puede grabar un nombre, una frase corta o una fecha. Lo más habitual es grabarlo en una esquina; muy pocas veces va al centro.',
    'El grabado se pide en la web (sección "Hecha para ti") o por el chat, y el equipo confirma cómo quedará antes de producir.',
    'No se sabe si el grabado tiene costo adicional: eso lo confirma el equipo.',
    'Los diseños especiales o a medida primero se hacen como muestra.',
  ],
  process: [
    'Para comprar se hace el pedido aquí en el chat: se registra solo y el equipo revisa y confirma precio final y plazo.',
    'El camino de una compra: 1) solicitud de cotización; 2) el equipo la revisa, fija los precios pendientes y la envía; 3) el cliente acepta; 4) se convierte en pedido y se confirma; 5) producción; 6) listo; 7) despacho o entrega.',
    'Cada tabla se trabaja por pedido: el equipo confirma el plazo y avisa cuando el pedido está listo. El asistente no confirma pedidos ni cobra.',
    'Hay seguimiento del pedido en la web (sección de seguimiento) con el código del pedido (por ejemplo PED-000123) y el correo o teléfono con que se compró; allí se ve el estado: confirmado, en producción, listo, despachado o entregado.',
    'El pago se hace por Yape o Plin (manual): el cliente paga al número del negocio y el equipo confirma el pago con el código de la solicitud. El asistente nunca confirma un pago.',
    'Woodland emite comprobantes de pago; el tipo (factura o boleta) lo confirma el equipo.',
    'Condiciones habituales de pago, a confirmar siempre con el equipo: en pedidos corporativos, 50% de adelanto y el saldo antes de la entrega; en pedidos de 1 a 3 tablas, pago completo antes de producir.',
  ],
  pages: [
    'Todo se gestiona por este chat: catálogo, pedidos y pedidos para empresas. Más sobre la empresa: /nosotros',
  ],
  /** Lo que el asistente NO sabe: si le preguntan, lo deriva o dice que el equipo lo confirma. */
  unknown: [
    'teléfono, WhatsApp, dirección, tienda física u horarios de atención',
    'costo y plazos de envío, y zonas de reparto',
    'otros medios de pago distintos de Yape y Plin (tarjeta, transferencia bancaria) y cuentas bancarias',
    'cantidades en stock o disponibilidad',
    'precios que no figuren en el catálogo, descuentos y promociones',
    'qué certificaciones exactas tiene, premios o cifras de ventas',
  ],
} as const

const bullets = (lines: readonly string[]) => lines.map((l) => `- ${l}`).join('\n')

/** Bloque de texto para el prompt del asistente. */
export function knowledgeForPrompt(): string {
  const k = assistantKnowledge
  return [
    `Sobre la empresa:\n${bullets(k.company)}`,
    `Sobre los productos:\n${bullets(k.product)}`,
    `Clientes:\n${bullets(k.customers)}`,
    `Grabado y personalización:\n${bullets(k.engraving)}`,
    `Cómo se compra:\n${bullets(k.process)}`,
    `Páginas de la web:\n${bullets(k.pages)}`,
    `LO QUE NO SABES (no lo inventes; di que el equipo lo confirma y anótalo con flag_for_team):\n${bullets(k.unknown)}`,
  ].join('\n\n')
}
