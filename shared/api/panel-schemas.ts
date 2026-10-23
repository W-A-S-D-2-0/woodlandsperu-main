/**
 * Validación de las solicitudes del panel (/api/admin/*). La base de datos sigue siendo la
 * barrera final (RLS, roles, transiciones); esto da respuestas claras antes de llegar a ella.
 */
import { z } from 'zod'
import { customerSchema } from './public-schemas'

const optionalText = (max: number) => z.string().trim().max(max)
const money = z.number().min(0).max(99_999_999.99)

export const quoteStatuses = [
  'submitted', 'under_review', 'sent', 'accepted', 'rejected', 'expired', 'converted', 'cancelled',
] as const
export const orderStatuses = [
  'pending_confirmation', 'confirmed', 'in_production', 'ready', 'shipped', 'delivered', 'cancelled',
] as const

export const idParam = z.uuid()

export const quoteListQuery = z.object({ status: z.enum(quoteStatuses).optional() })
export const orderListQuery = z.object({ status: z.enum(orderStatuses).optional() })
/** Máximo de días de un reporte: un año, para que las lecturas sigan siendo livianas. */
export const REPORT_MAX_DAYS = 366

/** Rango de un reporte en días calendario (AAAA-MM-DD), ambos incluidos. */
export const reportQuery = z
  .object({ from: z.iso.date(), to: z.iso.date() })
  .refine((r) => r.from <= r.to, { message: 'La fecha inicial no puede ser posterior a la final.', path: ['from'] })
  .refine((r) => (Date.parse(r.to) - Date.parse(r.from)) / 86_400_000 < REPORT_MAX_DAYS, {
    message: `El rango no puede superar ${REPORT_MAX_DAYS} días.`,
    path: ['to'],
  })

export const customerListQuery =z.object({ search: z.string().trim().max(80).optional() })

export const productPatch = z
  .object({
    isActive: z.boolean().optional(),
    name: z.string().trim().min(1).max(120).optional(),
    description: optionalText(4000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No hay cambios que guardar.' })

export const variantPatch = z
  .object({
    isActive: z.boolean().optional(),
    /** Null = "a cotizar" (precio no publicado). */
    catalogPrice: money.nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No hay cambios que guardar.' })

/** Tipos de movimiento manuales. Reservas y salidas por venta solo las generan los pedidos. */
export const manualMovementTypes = ['production_in', 'adjustment_in', 'adjustment_out', 'return_in'] as const

export const inventoryMovementBody = z
  .object({
    variantId: z.uuid(),
    type: z.enum(manualMovementTypes),
    quantity: z.number().int().min(1).max(100000),
    reason: optionalText(500).optional(),
    /** Generada por el cliente: reintentar el envío no duplica el movimiento. */
    idempotencyKey: z.string().min(8).max(200),
  })
  .refine((v) => !(v.type === 'adjustment_in' || v.type === 'adjustment_out') || !!v.reason, {
    message: 'Los ajustes requieren un motivo.',
    path: ['reason'],
  })

export const inventorySettingsBody = z.object({
  minStock: z.number().int().min(0).nullable(),
  custodian: z.string().trim().min(1).max(120).nullable(),
})

export const quoteItemPriceBody = z.object({ unitPrice: money })

export const sendQuoteBody = z.object({
  discountTotal: money.default(0),
  /** AAAA-MM-DD. Si se omite, se usa la vigencia configurada. */
  validUntil: z.iso.date().optional(),
  deliveryEstimateNote: optionalText(300).optional(),
})

export const convertQuoteBody = z.object({
  customerConfirmed: z.boolean().default(false),
  shippingAddress: optionalText(500).optional(),
})

export const confirmOrderBody = z.object({ customerConfirmed: z.boolean() })

/** Cambios directos permitidos: el resto de estados pasa por confirmar, despachar o cancelar. */
export const orderStatusBody = z.object({ status: z.enum(['in_production', 'ready']) })

export const dispatchOrderBody = z.object({ finalStatus: z.enum(['shipped', 'delivered']).default('delivered') })

export const cancelOrderBody = z.object({ reason: z.string().trim().min(1, 'Indica el motivo.').max(500) })

export const orderPatch = z
  .object({
    internalNotes: optionalText(2000).nullable().optional(),
    shippingAddress: optionalText(500).nullable().optional(),
    deliveryEstimateNote: optionalText(300).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No hay cambios que guardar.' })

export const customerNoteBody = z.object({ body: z.string().trim().min(1).max(2000) })

/** Cliente de una venta directa: uno existente (id) o los datos para crearlo o reutilizarlo. */
const directOrderCustomer = z.union([z.object({ id: z.uuid() }).strict(), customerSchema])

const directOrderItem = z
  .object({
    variantId: z.uuid().optional(),
    description: optionalText(300).optional(),
    quantity: z.number().int().min(1).max(100000),
    /** Sin precio se usa el de la regla de siempre (escalas por volumen). Una pieza a medida lo exige. */
    unitPrice: money.optional(),
    customDimensions: optionalText(120).optional(),
    customization: optionalText(1000).optional(),
  })
  .refine((i) => i.variantId !== undefined || (i.description !== undefined && i.description !== ''), {
    message: 'Un producto a medida necesita una descripción.',
    path: ['description'],
  })
  .refine((i) => i.variantId !== undefined || i.unitPrice !== undefined, {
    message: 'Un producto a medida necesita un precio.',
    path: ['unitPrice'],
  })

/** POST /api/admin/orders: venta directa sin cotización previa. */
export const directOrderBody = z
  .object({
    channel: z.enum(['admin', 'whatsapp', 'web_chat']).default('admin'),
    customer: directOrderCustomer,
    items: z.array(directOrderItem).min(1, 'Agrega al menos un producto.').max(50),
    discountTotal: money.default(0),
    shippingAddress: optionalText(500).optional(),
    internalNotes: optionalText(2000).optional(),
    deliveryEstimateNote: optionalText(300).optional(),
    /** El cliente confirmó el pedido. */
    customerConfirmed: z.boolean().default(false),
    /** Confirmar ya: reserva el stock. Exige que el cliente haya confirmado. */
    confirm: z.boolean().default(false),
  })
  .refine((v) => !v.confirm || v.customerConfirmed, {
    message: 'Para confirmar y reservar stock, el cliente debe haber confirmado el pedido.',
    path: ['confirm'],
  })

export type DirectOrderInput = z.infer<typeof directOrderBody>

// --- Conversaciones ----------------------------------------------------------

export const conversationStatuses = ['open', 'needs_human', 'with_human', 'closed'] as const

export const conversationListQuery = z.object({ status: z.enum(conversationStatuses).optional() })
/** El equipo solo devuelve al asistente o cierra: derivar y tomar tienen su propia acción. */
export const conversationStatusBody = z.object({ status: z.enum(['open', 'closed']) })
