import type { CatalogProduct } from '../../../shared/api/contracts'
import { modelPhotos } from '../../content/model-photos'
import { formatPrice } from '../catalog/catalog-format'

/** «65*46*4» → «65 × 46 × 4 cm». */
export const sizeLabel = (dimensions: string | null) => (dimensions ? `${dimensions.replaceAll('*', ' × ')} cm` : '')

/** El precio más bajo del modelo, para la tarjeta («desde S/ 197.00»). */
function fromPrice(product: CatalogProduct): string {
  const prices = product.variants.map((v) => v.price).filter((p): p is number => p !== null)
  return prices.length > 0 ? `desde ${formatPrice(Math.min(...prices))}` : formatPrice(null)
}

/**
 * Los modelos del catálogo con su foto oficial y, debajo, las medidas del elegido. Al tocar uno, la tabla de la vista
 * previa cambia de forma y de tamaño. Son grupos de opciones (radio) para que se usen igual con teclado.
 */
export function ModelPicker({
  products,
  productId,
  variantId,
  onChange,
}: {
  products: readonly CatalogProduct[]
  productId: string
  variantId: string
  onChange: (productId: string, variantId: string) => void
}) {
  const product = products.find((p) => p.id === productId) ?? null
  return (
    <div className="grid gap-5">
      <fieldset className="grid gap-2.5">
        <legend className="mb-2.5 text-sm font-medium text-marfil">Elige tu tabla</legend>
        <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
          {products.map((p) => {
            const photo = modelPhotos[p.slug]
            const active = p.id === productId
            return (
              <label
                key={p.id}
                className={`group relative flex w-36 shrink-0 cursor-pointer snap-start flex-col overflow-hidden rounded-2xl border transition-[border-color,background-color,box-shadow,transform] duration-300 ease-suave has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-marfil sm:w-auto ${
                  active
                    ? 'border-brasa bg-nogal-800 shadow-[0_10px_30px_-12px_rgb(224_138_60/0.7)]'
                    : 'border-beige/15 bg-nogal-800/40 hover:-translate-y-0.5 hover:border-beige/40'
                }`}
              >
                <input type="radio" name="engrave-model" value={p.id} checked={active} onChange={() => onChange(p.id, p.variants[0]?.id ?? '')} className="sr-only" />
                <span className="relative block aspect-[4/3] overflow-hidden bg-nogal">
                  {photo && (
                    <img
                      src={photo.src}
                      alt=""
                      loading="lazy"
                      className={`size-full object-cover transition-[transform,opacity] duration-500 ease-suave group-hover:scale-105 ${active ? 'opacity-100' : 'opacity-75'}`}
                    />
                  )}
                  {active && (
                    <span aria-hidden="true" className="absolute top-2 right-2 inline-flex size-6 animate-chip-in items-center justify-center rounded-full bg-brasa text-xs font-bold text-nogal-800">
                      ✓
                    </span>
                  )}
                </span>
                <span className="grid gap-0.5 px-3 py-2.5">
                  <span className={`text-sm leading-tight font-semibold ${active ? 'text-marfil' : 'text-beige'}`}>{p.name}</span>
                  <span className="text-xs text-beige/70">
                    {p.variants.length > 1 ? `${p.variants.length} medidas · ` : ''}
                    {fromPrice(p)}
                  </span>
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      {product && (
        <fieldset key={product.id} className="grid animate-chip-in gap-2.5">
          <legend className="mb-2.5 text-sm font-medium text-marfil">
            Medida{product.variants.length > 1 ? 's' : ''} de {product.name}
          </legend>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((v) => {
              const active = v.id === variantId
              return (
                <label
                  key={v.id}
                  className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-marfil ${
                    active ? 'border-marfil bg-marfil text-nogal' : 'border-beige/30 text-beige hover:border-beige'
                  }`}
                >
                  <input type="radio" name="engrave-size" value={v.id} checked={active} onChange={() => onChange(product.id, v.id)} className="sr-only" />
                  <span className="font-semibold">{v.name}</span>
                  {v.dimensionsLabel && <span className={active ? 'text-nogal/75' : 'text-beige/70'}>{sizeLabel(v.dimensionsLabel)}</span>}
                  <span className={`font-semibold ${active ? 'text-madera-700' : 'text-ambar'}`}>{formatPrice(v.price)}</span>
                </label>
              )
            })}
          </div>
        </fieldset>
      )}
    </div>
  )
}
