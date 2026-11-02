import { useState, type FormEvent } from 'react'
import type { ListResponse, PanelProduct, PanelVariant } from '../../../../shared/api/panel-contracts'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { formatMoney, inCollection, parseDecimal, plural, uniqueCollections, variantsWithoutPrice } from '../panel-logic'
import { formatDimensions } from '../production-logic'
import { useAdminAction, useAdminQuery } from '../use-admin-api'
import { Badge, CollectionSwitch, EmptyState, inputClass, ModelThumb, Notice, PageHeader, primaryButton, QueryView, secondaryButton } from '../ui'

const quietButton = 'inline-flex min-h-12 items-center px-2 text-base font-bold text-carbon-600 underline underline-offset-4 hover:text-nogal disabled:opacity-50'

/** Un tamaño: se lee el precio y, solo si se pide, se cambia. Así no se edita un precio por error. */
function VariantRow({ variant, reload }: { variant: PanelVariant; reload: () => void }) {
  const { run, pending, error } = useAdminAction()
  const [editing, setEditing] = useState(false)
  const [price, setPrice] = useState(variant.catalogPrice?.toString() ?? '')
  const [formError, setFormError] = useState<string | null>(null)
  const internal = variant.internalPricing

  async function save(event: FormEvent, value: number | null) {
    event.preventDefault()
    if (Number.isNaN(value)) return setFormError('Escribe un precio válido, por ejemplo 250 o 249.90.')
    setFormError(null)
    // null = «a cotizar»: se retira el precio publicado.
    if (await run('PATCH', `/variants/${variant.id}`, { catalogPrice: value })) {
      setEditing(false)
      reload()
    }
  }

  return (
    <li className={`grid gap-4 rounded-2xl p-4 ${variant.isActive ? 'border border-linea' : 'border border-dashed border-linea bg-beige/30'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-0.5">
          <p className="text-xl font-bold">{variant.name}</p>
          <p className="text-base text-carbon-600">
            {[formatDimensions(variant.dimensionsLabel), variant.fulfillmentType === 'made_to_order' ? 'Se fabrica a pedido' : null].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="grid justify-items-end gap-1 text-right">
          <p className="text-base text-carbon-600">Precio en la web</p>
          {variant.catalogPrice === null ? (
            <Badge tone="warn">A cotizar</Badge>
          ) : (
            <p className="font-display text-3xl text-nogal">{formatMoney(variant.catalogPrice)}</p>
          )}
        </div>
      </div>

      {variant.priceTiers.length > 0 && (
        <p className="text-base text-carbon-600">
          Precio por cantidad: {variant.priceTiers.map((t) => `desde ${t.minQuantity} → ${formatMoney(t.unitPrice)}`).join(' · ')}
        </p>
      )}

      {editing ? (
        <form onSubmit={(e) => void save(e, parseDecimal(price))} className="grid gap-3 rounded-xl bg-marfil p-4" noValidate>
          <label className="grid gap-2 text-base font-semibold">
            Nuevo precio por unidad (S/)
            <input className={`${inputClass} w-48 text-xl font-bold`} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className={primaryButton} disabled={pending || price.trim() === ''}>
              {pending ? 'Guardando…' : 'Guardar precio'}
            </button>
            {variant.catalogPrice !== null && (
              <button type="button" className={secondaryButton} disabled={pending} onClick={(e) => void save(e, null)}>
                Quitar precio (a cotizar)
              </button>
            )}
            <button
              type="button"
              className={quietButton}
              onClick={() => {
                setEditing(false)
                setPrice(variant.catalogPrice?.toString() ?? '')
                setFormError(null)
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={secondaryButton} onClick={() => setEditing(true)}>
            {variant.catalogPrice === null ? 'Poner precio' : 'Cambiar precio'}
          </button>
          {!variant.isActive && <Badge tone="muted">Oculto en la web</Badge>}
          <button
            type="button"
            className={`${quietButton} ml-auto`}
            disabled={pending}
            onClick={() => void run('PATCH', `/variants/${variant.id}`, { isActive: !variant.isActive }).then((r) => r && reload())}
          >
            {variant.isActive ? 'Ocultar este tamaño de la web' : 'Mostrar este tamaño en la web'}
          </button>
        </div>
      )}

      {internal && (
        <details className="group">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-base font-semibold text-madera-700">Ver costos internos (no se publican)</summary>
          <dl className="mt-2 grid gap-2 sm:grid-cols-3">
            {[
              ['Costo', internal.unitCost],
              ['Precio conversado', internal.negotiatedPrice],
              ['Catálogo de referencia', internal.catalogPriceReference],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-xl bg-marfil px-4 py-3">
                <dt className="text-base text-carbon-600">{label}</dt>
                <dd className="text-lg font-bold">{formatMoney(value as number | null)}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      {(formError ?? error) && <Notice>{formError ?? error}</Notice>}
    </li>
  )
}

function ProductCard({ product, reload }: { product: PanelProduct; reload: () => void }) {
  const { run, pending, error } = useAdminAction()
  const [asking, setAsking] = useState(false)

  const toggle = async () => {
    if (await run('PATCH', `/products/${product.id}`, { isActive: !product.isActive })) {
      setAsking(false)
      reload()
    }
  }

  return (
    <section aria-label={product.name} className={`grid gap-5 rounded-2xl bg-white p-5 sm:p-6 ${product.isActive ? 'border border-linea' : 'border-2 border-dashed border-linea opacity-90'}`}>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
        <ModelThumb slug={product.slug} className="size-20" />
        <div className="min-w-0">
          <h2 className="text-3xl">{product.name}</h2>
          <p className="text-lg text-carbon-600">
            {product.category?.name ?? 'Sin colección'}
            {product.isCustomizable && ' · Se puede grabar'}
          </p>
        </div>
        <span className="col-span-2 sm:col-span-1">
          <Badge tone={product.isActive ? 'good' : 'muted'}>{product.isActive ? 'Se ve en la web' : 'Oculto en la web'}</Badge>
        </span>
      </div>

      {product.description && (
        <details>
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-base font-semibold text-madera-700">Ver la descripción de la web</summary>
          <p className="mt-2 text-lg text-carbon-600">{product.description}</p>
        </details>
      )}

      <ul className="grid gap-3">
        {product.variants.map((v) => (
          <VariantRow key={`${v.id}-${v.catalogPrice}-${v.isActive}`} variant={v} reload={reload} />
        ))}
      </ul>

      {/* Ocultar todo el producto va al final y pide confirmación. */}
      <div className="flex flex-wrap items-center gap-3 border-t border-linea pt-4">
        {asking ? (
          <>
            <p className="text-lg font-semibold">{product.isActive ? `¿Ocultar ${product.name} de la web?` : `¿Volver a mostrar ${product.name} en la web?`}</p>
            <button type="button" className={product.isActive ? 'inline-flex min-h-12 items-center rounded-full bg-alerta px-5 text-base font-bold text-marfil' : primaryButton} disabled={pending} onClick={() => void toggle()}>
              Sí
            </button>
            <button type="button" className={quietButton} onClick={() => setAsking(false)}>
              No
            </button>
          </>
        ) : (
          <button type="button" className={quietButton} onClick={() => setAsking(true)}>
            {product.isActive ? 'Ocultar todo el producto de la web' : 'Volver a mostrar el producto en la web'}
          </button>
        )}
      </div>
      {error && <Notice>{error}</Notice>}
    </section>
  )
}

export function ProductsPage() {
  useDocumentTitle('Productos')
  const { state, reload } = useAdminQuery<ListResponse<PanelProduct>>('/products')
  const [collection, setCollection] = useState('')
  const [showHidden, setShowHidden] = useState(false)

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <PageHeader title="Productos" />
      <QueryView state={state} onRetry={reload}>
        {({ items: all }) => {
          // Los ocultos (p. ej. los modelos retirados) no estorban: se ven marcando la casilla.
          const items = showHidden ? all : all.filter((p) => p.isActive)
          const hiddenCount = all.length - all.filter((p) => p.isActive).length
          const missing = variantsWithoutPrice(all)
          if (items.length === 0 && hiddenCount === 0) return <EmptyState>Aún no hay productos. Se cargan con el importador del inventario.</EmptyState>
          return (
            <>
              <p className={`rounded-2xl px-5 py-4 text-xl font-bold ${missing > 0 ? 'bg-aviso-claro text-aviso' : 'bg-exito-claro text-exito'}`}>
                {missing > 0
                  ? `${plural(missing, 'tamaño no tiene', 'tamaños no tienen')} precio: en la web salen «a cotizar».`
                  : 'Todos los tamaños publicados tienen precio.'}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <CollectionSwitch collections={uniqueCollections(items.map((p) => p.category))} value={collection} onChange={setCollection} />
                {hiddenCount > 0 && (
                  <label className="flex min-h-12 items-center gap-3 text-lg">
                    <input type="checkbox" className="size-6 accent-nogal" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
                    Ver también los ocultos ({hiddenCount})
                  </label>
                )}
              </div>
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
