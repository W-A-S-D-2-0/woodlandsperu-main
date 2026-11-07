import type { CatalogPriceTier, CatalogProduct, CatalogVariant } from '../../../shared/api/contracts'
import type { OrderModel } from '../chat/open-chat'

const money = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })

/** Sin precio publicado se muestra "A cotizar" (decisión comercial vigente). */
export function formatPrice(price: number | null): string {
  return price === null ? 'A cotizar' : money.format(price)
}

export function tierLabel(tier: CatalogPriceTier): string {
  return `desde ${tier.minQuantity} u.: ${money.format(tier.unitPrice)} c/u`
}

/** Medidas «65*46*4» como «65 × 46 × 4 cm»; null si la variante no tiene medidas. */
export function dimensionsText(label: string | null): string | null {
  return label ? `${label.replaceAll('*', ' × ')} cm` : null
}

/** Una medida de una tabla tal como la recibe la tarjeta de pedido del chat. */
export function toOrderModel(product: Pick<CatalogProduct, 'name'>, variant: Pick<CatalogVariant, 'name' | 'dimensionsLabel' | 'price'>): OrderModel {
  return { product: product.name, variant: variant.name, dimensions: dimensionsText(variant.dimensionsLabel), price: formatPrice(variant.price) }
}
