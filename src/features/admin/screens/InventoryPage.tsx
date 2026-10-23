import { useState, type FormEvent } from 'react'
import type { InventoryLevel, InventoryMovement, ListResponse } from '../../../../shared/api/panel-contracts'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { useStaffSession } from '../../auth/auth-context'
import {
  formatDateTime,
  inCollection,
  manualMovementOptions,
  movementLabels,
  newIdempotencyKey,
  parseWholeNumber,
  uniqueCollections,
  type ManualMovementType,
} from '../panel-logic'
import { useAdminAction, useAdminQuery } from '../use-admin-api'
import { Badge, Card, CollectionSwitch, DataTable, EmptyState, Field, inputClass, ModelThumb, Notice, PageHeader, primaryButton, QueryView, secondaryButton } from '../ui'

function MovementForm({ levels, initialVariantId, onDone }: { levels: InventoryLevel[]; initialVariantId: string | null; onDone: () => void }) {
  const { staff } = useStaffSession()
  const { run, pending, error } = useAdminAction()
  const options = staff.role === 'admin' ? manualMovementOptions : manualMovementOptions.filter((o) => o.value === 'production_in')
  const [variantId, setVariantId] = useState(initialVariantId ?? '')
  const [type, setType] = useState<ManualMovementType>('production_in')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  // La clave solo cambia tras un registro exitoso: reintentar tras un fallo de red no duplica.
  const [key, setKey] = useState(newIdempotencyKey)

  const needsReason = type === 'adjustment_in' || type === 'adjustment_out'

  async function submit(event: FormEvent) {
    event.preventDefault()
    setDone(false)
    const qty = parseWholeNumber(quantity)
    if (!variantId) return setFormError('Elige la variante.')
    if (qty === null || Number.isNaN(qty) || qty < 1) return setFormError('La cantidad debe ser un entero mayor que cero.')
    if (needsReason && !reason.trim()) return setFormError('Los ajustes requieren un motivo.')
    setFormError(null)
    const result = await run('POST', '/inventory/movements', {
      variantId,
      type,
      quantity: qty,
      reason: reason.trim() || undefined,
      idempotencyKey: key,
    })
    if (result) {
      setQuantity('')
      setReason('')
      setKey(newIdempotencyKey())
      setDone(true)
      onDone()
    }
  }

  return (
    <Card title="Registrar movimiento">
      <p className="mb-4 max-w-2xl text-sm text-carbon-600">
        Aquí solo se anota la producción terminada y los ajustes del equipo. Las reservas y salidas por pedidos (también los
        que el cliente confirma en el chat) se registran solas.
      </p>
      <form onSubmit={(e) => void submit(e)} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Variante">
          <select className={inputClass} value={variantId} onChange={(e) => setVariantId(e.target.value)}>
            <option value="">Elige…</option>
            {levels.map((l) => (
              <option key={l.variantId} value={l.variantId}>
                {l.product} · {l.variant} ({l.sku})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tipo">
          <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as ManualMovementType)}>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Cantidad">
          <input className={inputClass} inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </Field>
        <Field label={needsReason ? 'Motivo (obligatorio)' : 'Motivo (opcional)'}>
          <input className={inputClass} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <div className="grid gap-3 sm:col-span-2">
          {(formError ?? error) && <Notice>{formError ?? error}</Notice>}
          {done && <Notice kind="info">Movimiento registrado.</Notice>}
          <div>
            <button type="submit" className={primaryButton} disabled={pending}>
              {pending ? 'Registrando…' : 'Registrar'}
            </button>
          </div>
        </div>
      </form>
    </Card>
  )
}

function SettingsForm({ level, onDone }: { level: InventoryLevel; onDone: () => void }) {
  const { run, pending, error } = useAdminAction()
  const [minStock, setMinStock] = useState(level.minStock?.toString() ?? '')
  const [custodian, setCustodian] = useState(level.custodian ?? '')
  const [formError, setFormError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const min = parseWholeNumber(minStock)
    if (Number.isNaN(min)) return setFormError('El stock mínimo debe ser un entero.')
    setFormError(null)
    const result = await run('PUT', `/inventory/${level.variantId}/settings`, {
      minStock: min,
      custodian: custodian.trim() || null,
    })
    if (result) onDone()
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="grid gap-4 sm:grid-cols-2" noValidate>
      <Field label="Stock mínimo" hint="Vacío = sin alertas de reposición.">
        <input className={inputClass} inputMode="numeric" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
      </Field>
      <Field label="Quién tiene el stock">
        <input className={inputClass} value={custodian} maxLength={120} onChange={(e) => setCustodian(e.target.value)} />
      </Field>
      <div className="grid gap-3 sm:col-span-2">
        {(formError ?? error) && <Notice>{formError ?? error}</Notice>}
        <div>
          <button type="submit" className={secondaryButton} disabled={pending}>
            {pending ? 'Guardando…' : 'Guardar configuración'}
          </button>
        </div>
      </div>
    </form>
  )
}

const DETAIL_ID = 'detalle-variante'

function VariantDetail({ level, onChanged }: { level: InventoryLevel; onChanged: () => void }) {
  const { staff } = useStaffSession()
  const { state, reload } = useAdminQuery<ListResponse<InventoryMovement>>(`/inventory/${level.variantId}/movements`)

  return (
    <Card title={`${level.product} · ${level.variant}`} id={DETAIL_ID} className="scroll-mt-6">
      <div className="grid gap-6">
        {staff.role === 'admin' && <SettingsForm key={level.variantId} level={level} onDone={onChanged} />}
        <QueryView state={state} onRetry={reload}>
          {({ items }) =>
            items.length === 0 ? (
              <EmptyState>Sin movimientos registrados.</EmptyState>
            ) : (
              <DataTable caption="Últimos movimientos" head={['Fecha', 'Tipo', 'Cantidad', 'Existencias', 'Motivo']}>
                {items.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3">{formatDateTime(m.createdAt)}</td>
                    <td className="px-4 py-3">{movementLabels[m.movementType]}</td>
                    <td className="px-4 py-3">{m.quantity}</td>
                    <td className="px-4 py-3">
                      {m.onHandAfter} físico · {m.reservedAfter} reservado
                    </td>
                    <td className="px-4 py-3 text-carbon-600">{m.reason ?? '—'}</td>
                  </tr>
                ))}
              </DataTable>
            )
          }
        </QueryView>
      </div>
    </Card>
  )
}

export function InventoryPage() {
  useDocumentTitle('Inventario')
  const { state, reload } = useAdminQuery<ListResponse<InventoryLevel>>('/inventory')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [collection, setCollection] = useState('')
  // Cambia tras cada registro para que el historial abierto se vuelva a cargar.
  const [version, setVersion] = useState(0)
  const refresh = () => {
    reload()
    setVersion((v) => v + 1)
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8">
      <PageHeader
        title="Inventario"
        intro="Stock físico, reservado y disponible por variante. Solo lo ve el equipo: la web no muestra stock."
      />
      <QueryView state={state} onRetry={reload}>
        {({ items }) =>
          items.length === 0 ? (
            <EmptyState>
              No hay variantes con inventario. Importa el inventario de la empresa o crea los productos primero.
            </EmptyState>
          ) : (
            <>
              <CollectionSwitch collections={uniqueCollections(items.map((l) => l.collection))} value={collection} onChange={setCollection} />
              <DataTable caption="Existencias por variante" head={['Producto', 'Físico', 'Reservado', 'Disponible', 'Mínimo', 'Responsable', '']}>
                {inCollection(items, collection, (l) => l.collection).map((l) => (
                  <tr key={l.variantId} className={selectedId === l.variantId ? 'bg-beige/40' : undefined}>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-3">
                        <ModelThumb slug={l.productSlug} className="size-12" />
                        <span>
                          <span className="font-medium">
                            {l.product} · {l.variant}
                          </span>
                          {l.dimensionsLabel && <span className="block text-xs text-carbon-600">{l.dimensionsLabel.replaceAll('*', ' × ')} cm</span>}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{l.onHand}</td>
                    <td className="px-4 py-3 tabular-nums">{l.reserved}</td>
                    <td className="px-4 py-3">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold tabular-nums">{l.available}</span>
                        {l.available <= 0 ? <Badge tone="warn">Sin stock</Badge> : l.lowStock && <Badge tone="warn">Bajo</Badge>}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{l.minStock ?? '—'}</td>
                    <td className="px-4 py-3">{l.custodian ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="min-h-11 text-sm font-medium text-madera-700 hover:underline"
                        aria-pressed={selectedId === l.variantId}
                        aria-controls={selectedId === l.variantId ? DETAIL_ID : undefined}
                        onClick={() => {
                          const opening = selectedId !== l.variantId
                          setSelectedId(opening ? l.variantId : null)
                          // El detalle aparece debajo de la tabla: al abrirlo se lleva a la vista.
                          if (opening) requestAnimationFrame(() => document.getElementById(DETAIL_ID)?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
                        }}
                      >
                        {selectedId === l.variantId ? 'Ocultar' : 'Detalle'}
                      </button>
                    </td>
                  </tr>
                ))}
              </DataTable>

              {items.find((l) => l.variantId === selectedId) && (
                <VariantDetail key={`${selectedId}-${version}`} level={items.find((l) => l.variantId === selectedId)!} onChanged={refresh} />
              )}
              {/* Con una variante abierta, el formulario ya la trae elegida. */}
              <MovementForm key={selectedId ?? 'ninguna'} levels={items} initialVariantId={selectedId} onDone={refresh} />
            </>
          )
        }
      </QueryView>
    </div>
  )
}
