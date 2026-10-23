import { useState, type FormEvent } from 'react'
import type { ListResponse, PanelProduct, PanelVariant } from '../../../../shared/api/panel-contracts'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { formatMoney, fulfillmentLabels, inCollection, parseDecimal, uniqueCollections } from '../panel-logic'
import { useAdminAction, useAdminQuery } from '../use-admin-api'
import { Badge, Card, CollectionSwitch, EmptyState, Field, inputClass, ModelThumb, Notice, PageHeader, QueryView, secondaryButton } from '../ui'

function VariantRow({ variant, reload }: { variant: PanelVariant; reload: () => void }) {
  const { run, pending, error } = useAdminAction()
  const [price, setPrice] = useState(variant.catalogPrice?.toString() ?? '')
  const [formError, setFormError] = useState<string | null>(null)

  async function savePrice(event: FormEvent) {
    event.preventDefault()
    const value = parseDecimal(price)
    if (Number.isNaN(value)) return setFormError('Precio no válido (máximo 2 decimales).')
    setFormError(null)
    // Vacío = "a cotizar": se retira el precio publicado.
    if (await run('PATCH', `/variants/${variant.id}`, { catalogPrice: value })) reload()
  }

  async function toggleActive() {
    if (await run('PATCH', `/variants/${variant.id}`, { isActive: !variant.isActive })) reload()
  }

  const internal = variant.internalPricing

  return (
    <li className="grid gap-3 border-t border-linea/70 py-4 first:border-t-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          <strong>{variant.name}</strong> <span className="text-carbon-600">· {variant.sku}</span>
          {variant.dimensionsLabel && <span className="text-carbon-600"> · {variant.dimensionsLabel.replaceAll('*', ' × ')} cm</span>}
          <span className="text-carbon-600"> · {fulfillmentLabels[variant.fulfillmentType]}</span>
        </p>
        <span className="flex items-center gap-3">
          <Badge tone={variant.isActive ? 'good' : 'neutral'}>{variant.isActive ? 'Publicada' : 'Oculta'}</Badge>
          <button type="button" className={secondaryButton} disabled={pending} onClick={() => void toggleActive()}>
            {variant.isActive ? 'Ocultar' : 'Publicar'}
          </button>
        </span>
      </div>

      <form onSubmit={(e) => void savePrice(e)} className="flex flex-wrap items-end gap-3" noValidate>
        <Field label="Precio público (S/)" hint={variant.catalogPrice === null ? 'Sin precio: se muestra “a cotizar”.' : undefined}>
          <input className={`${inputClass} w-36`} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <button type="submit" className={secondaryButton} disabled={pending}>
          {price.trim() === '' ? 'Dejar a cotizar' : 'Publicar precio'}
        </button>
      </form>

      <p className="text-xs text-carbon-600">
        Costo {formatMoney(internal?.unitCost)} · Precio conversado {formatMoney(internal?.negotiatedPrice)} · Catálogo de referencia{' '}
        {formatMoney(internal?.catalogPriceReference)} (internos, no se publican)
        {variant.priceTiers.length > 0 && (
          <> · Escalas: {variant.priceTiers.map((t) => `${t.minQuantity}+ u. → ${formatMoney(t.unitPrice)}`).join(', ')}</>
        )}
      </p>
      {(formError ?? error) && <Notice>{formError ?? error}</Notice>}
    </li>
  )
}

function ProductCard({ product, reload }: { product: PanelProduct; reload: () => void }) {
  const { run, pending, error } = useAdminAction()

  async function toggleActive() {
    if (await run('PATCH', `/products/${product.id}`, { isActive: !product.isActive })) reload()
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <ModelThumb slug={product.slug} />
          <div>
            <h2 className="font-display text-2xl text-nogal">{product.name}</h2>
            <p className="text-xs text-carbon-600">
              {product.category?.name ?? 'Sin colección'}
              {product.isCustomizable && ' · Personalizable'}
            </p>
          </div>
        </div>
        <span className="flex items-center gap-3">
          <Badge tone={product.isActive ? 'good' : 'neutral'}>{product.isActive ? 'Activo en la web' : 'Oculto'}</Badge>
          <button type="button" className={secondaryButton} disabled={pending} onClick={() => void toggleActive()}>
            {product.isActive ? 'Ocultar producto' : 'Publicar producto'}
          </button>
        </span>
      </div>
      {error && <div className="mt-3"><Notice>{error}</Notice></div>}
      {product.description && <p className="mt-3 text-sm text-carbon-600">{product.description}</p>}
      <ul className="mt-4">
        {product.variants.map((v) => (
          <VariantRow key={`${v.id}-${v.catalogPrice}-${v.isActive}`} variant={v} reload={reload} />
        ))}
      </ul>
    </Card>
  )
}

export function ProductsPage() {
  useDocumentTitle('Productos')
  const { state, reload } = useAdminQuery<ListResponse<PanelProduct>>('/products')
  const [collection, setCollection] = useState('')
  const [showHidden, setShowHidden] = useState(false)

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <PageHeader
        title="Productos"
        intro="Publica o esconde productos y variantes, y decide cuándo mostrar un precio. Sin precio publicado, la web muestra “a cotizar”."
      />
      <QueryView state={state} onRetry={reload}>
        {({ items: all }) => {
          // Los ocultos (p. ej. los modelos retirados) no estorban: se ven marcando la casilla.
          const items = showHidden ? all : all.filter((p) => p.isActive)
          const hiddenCount = all.length - all.filter((p) => p.isActive).length
          return items.length === 0 && hiddenCount === 0 ? (
            <EmptyState>Aún no hay productos. Se cargan con el importador del inventario.</EmptyState>
          ) : (
            <>
              <CollectionSwitch collections={uniqueCollections(items.map((p) => p.category))} value={collection} onChange={setCollection} />
              {hiddenCount > 0 && (
                <label className="flex min-h-11 items-center gap-3 text-sm">
                  <input type="checkbox" className="h-5 w-5 accent-nogal" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
                  Ver también los ocultos ({hiddenCount})
                </label>
              )}
              <div className="grid gap-6">
                {inCollection(items, collection, (p) => p.category).map((p) => (
                  <ProductCard key={`${p.id}-${p.isActive}`} product={p} reload={reload} />
                ))}
              </div>
            </>
          )
        }}
      </QueryView>
    </div>
  )
}
