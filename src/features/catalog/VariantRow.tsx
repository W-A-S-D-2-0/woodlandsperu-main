import type { CatalogProduct, CatalogVariant } from '../../../shared/api/contracts'
import { openChat } from '../chat/open-chat'
import { formatPrice, tierLabel } from './catalog-format'

/** Variante del catálogo: precio publicado, escalas por volumen y un botón que sigue el pedido en el chat. */
export function VariantRow({ product, variant }: { product: CatalogProduct; variant: CatalogVariant }) {
  const label = `${product.name} · ${variant.name}`
  return (
    <li className="grid gap-2 border-t border-linea py-4 first:border-t-0">
      <p className="font-medium text-carbon">
        {variant.name}
        {variant.dimensionsLabel && <span className="font-normal text-carbon-600"> · {variant.dimensionsLabel.replaceAll('*', ' × ')} cm</span>}
      </p>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-carbon">
          {formatPrice(variant.price)}
          {variant.price !== null && <span className="font-normal text-carbon-600"> c/u</span>}
        </p>
        <button
          type="button"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-nogal/30 px-5 text-sm font-semibold text-nogal transition-colors hover:border-madera-700 hover:bg-madera/10"
          onClick={() => openChat(`Quiero pedir ${label}`)}
        >
          Pedir por chat
        </button>
      </div>
      {variant.priceTiers.length > 0 && <p className="text-xs text-carbon-600">{variant.priceTiers.map(tierLabel).join(' · ')}</p>}
    </li>
  )
}
