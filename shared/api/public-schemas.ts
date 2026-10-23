/**
 * Validación de las solicitudes públicas (/api/quotes y /api/orders/status).
 * Espeja las restricciones de la base de datos para responder 422 con un mensaje claro
 * antes de llegar a ella. La base sigue siendo la barrera final.
 */
import { z } from 'zod'

/** Tope por línea en la web pública: por encima se cotiza directo por WhatsApp (decisión de Woodland). */
export const WEB_ORDER_MAX_UNITS = 100

const text = (max: number) => z.string().trim().max(max)
const optionalText = (max: number) =>
  text(max)
    .transform((value) => (value === '' ? undefined : value))
    .optional()

/** Teléfono sin espacios, paréntesis ni guiones; mismo formato que `customers.phone`. */
const phoneSchema = z
  .string()
  .transform((value) => value.replace(/[\s()-]/g, ''))
  .pipe(z.string().regex(/^\+?[0-9]{7,15}$/, 'Teléfono no válido.'))

const emailSchema = z
  .string()
  .trim()
  .max(254)
  .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, 'Correo no válido.')

export const customerSchema = z
  .object({
    type: z.enum(['individual', 'business']),
    fullName: text(160).min(1, 'Indica tu nombre.'),
    companyName: optionalText(200),
    documentType: z.enum(['DNI', 'RUC', 'CE', 'PASAPORTE']).optional(),
    documentNumber: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[0-9A-Z]{6,15}$/, 'Número de documento no válido.')
      .optional(),
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
  })
  .refine((c) => c.email !== undefined || c.phone !== undefined, {
    message: 'Indica un correo o un teléfono de contacto.',
    path: ['email'],
  })
  .refine((c) => c.type !== 'business' || c.companyName !== undefined, {
    message: 'Indica el nombre de la empresa.',
    path: ['companyName'],
  })
  .refine((c) => (c.documentType === undefined) === (c.documentNumber === undefined), {
    message: 'Indica el tipo y el número de documento juntos.',
    path: ['documentNumber'],
  })

const quoteItemSchema = z
  .object({
    variantId: z.uuid().optional(),
    description: optionalText(300),
    quantity: z.number().int().min(1).max(WEB_ORDER_MAX_UNITS, `Desde ${WEB_ORDER_MAX_UNITS + 1} unidades cotizamos directo por WhatsApp.`),
    customDimensions: optionalText(120),
    customization: optionalText(1000),
  })
  .refine((item) => item.variantId !== undefined || item.description !== undefined, {
    message: 'Un producto a medida necesita una descripción.',
    path: ['description'],
  })

/** POST /api/quotes. Los precios nunca vienen del cliente. */
export const quoteRequestSchema = z.object({
  /** Generado por el cliente; hace seguro reintentar el envío. */
  requestId: z.uuid(),
  customer: customerSchema,
  message: optionalText(2000),
  items: z.array(quoteItemSchema).min(1, 'Agrega al menos un producto.').max(50),
})

/** POST /api/orders/status */
export const orderStatusRequestSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^PED-[0-9]{6,}$/, 'Código de pedido no válido.'),
  /** Correo o teléfono con el que se hizo el pedido. */
  contact: z.string().trim().min(5).max(254),
})

export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>
export type OrderStatusRequestInput = z.infer<typeof orderStatusRequestSchema>
