import type { PanelVariant } from '../../../shared/api/panel-contracts'
import { directOrderBody, type DirectOrderInput } from '../../../shared/api/panel-schemas'
import { resolveUnitPrice } from '../catalog/pricing'
import { parseDecimal } from './panel-logic'

/** Lógica del formulario de venta directa. Sin React: se prueba sola. */

export interface SaleLine {
  /** Identificador local de la línea. */
  key: string
  variantId?: string
  /** Nombre para mostrar ("Producto · Variante") o la descripción de la pieza a medida. */
  label: string
  quantity: string
  /** Texto del precio; vacío = usar el de la regla de siempre (solo para variantes del catálogo). */
  unitPrice: string
  customization: string
}

export interface SaleCustomerValues {
  type: 'individual' | 'business'
  fullName: string
  companyName: string
  email: string
  phone: string
}

export interface SaleValues {
  channel: 'admin' | 'whatsapp' | 'web_chat'
  customer: SaleCustomerValues
  lines: SaleLine[]
  discount: string
  shippingAddress: string
  internalNotes: string
  customerConfirmed: boolean
  confirm: boolean
}

export const emptySale = (): SaleValues => ({
  channel: 'whatsapp',
  customer: { type: 'individual', fullName: '', companyName: '', email: '', phone: '' },
  lines: [],
  discount: '',
  shippingAddress: '',
  internalNotes: '',
  customerConfirmed: false,
  confirm: false,
})

const blank = (value: string) => (value.trim() === '' ? undefined : value.trim())

/** Precio que sugiere el catálogo para una variante y una cantidad; null si aún no tiene precio publicado. */
export function suggestedPrice(variant: Pick<PanelVariant, 'catalogPrice' | 'priceTiers'>, quantity: number): number | null {
  return resolveUnitPrice({ price: variant.catalogPrice, priceTiers: variant.priceTiers }, quantity)
}

/** Total de la venta con lo que se conoce hoy: líneas con precio escrito o sugerido. */
export function saleSubtotal(lines: readonly SaleLine[], priceOf: (line: SaleLine) => number | null): number {
  return lines.reduce((sum, line) => {
    const qty = Number(line.quantity)
    const price = parseDecimal(line.unitPrice) ?? priceOf(line)
    return Number.isFinite(qty) && qty > 0 && price !== null && !Number.isNaN(price) ? sum + Math.round(price * qty * 100) / 100 : sum
  }, 0)
}

/** Valida con el mismo esquema que el servidor y arma el cuerpo de POST /api/admin/orders. */
export function buildDirectOrder(values: SaleValues): { ok: true; body: DirectOrderInput } | { ok: false; errors: string[] } {
  const discount = parseDecimal(values.discount)
  if (Number.isNaN(discount)) return { ok: false, errors: ['El descuento no es válido (máximo 2 decimales).'] }

  const items: Record<string, unknown>[] = []
  for (const [index, line] of values.lines.entries()) {
    const price = parseDecimal(line.unitPrice)
    if (Number.isNaN(price)) return { ok: false, errors: [`El precio del producto ${index + 1} no es válido (máximo 2 decimales).`] }
    items.push({
      variantId: line.variantId,
      description: line.variantId ? undefined : blank(line.label),
      quantity: Number(line.quantity),
      unitPrice: price ?? undefined,
      customization: blank(line.customization),
    })
  }

  const c = values.customer
  const candidate = {
    channel: values.channel,
    customer: {
      type: c.type,
      fullName: c.fullName,
      companyName: c.type === 'business' ? blank(c.companyName) : undefined,
      email: blank(c.email),
      phone: blank(c.phone),
    },
    items,
    discountTotal: discount ?? 0,
    shippingAddress: blank(values.shippingAddress),
    internalNotes: blank(values.internalNotes),
    customerConfirmed: values.customerConfirmed,
    confirm: values.confirm,
  }

  const parsed = directOrderBody.safeParse(candidate)
  if (parsed.success) return { ok: true, body: parsed.data }
  const messages = [...new Set(parsed.error.issues.map((i) => i.message))]
  return { ok: false, errors: messages }
}
