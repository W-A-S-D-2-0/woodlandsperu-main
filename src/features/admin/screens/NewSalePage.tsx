import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import type { ListResponse, PanelProduct, PanelVariant } from '../../../../shared/api/panel-contracts'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { buildDirectOrder, emptySale, saleSubtotal, suggestedPrice, type SaleLine, type SaleValues } from '../direct-sale-logic'
import { formatMoney } from '../panel-logic'
import { useAdminAction, useAdminQuery } from '../use-admin-api'
import { BackLink, Card, Field, inputClass, Notice, PageHeader, primaryButton, QueryView, secondaryButton } from '../ui'

interface VariantOption {
  variant: PanelVariant
  label: string
}

const channelOptions = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'admin', label: 'En persona o por teléfono' },
  { value: 'web_chat', label: 'Chat web' },
] as const

function SaleForm({ products }: { products: PanelProduct[] }) {
  const navigate = useNavigate()
  const { run, pending, error } = useAdminAction()
  const [values, setValues] = useState<SaleValues>(emptySale)
  const [errors, setErrors] = useState<string[]>([])
  const [pick, setPick] = useState('')

  const options = useMemo<VariantOption[]>(
    () =>
      products
        .filter((p) => p.isActive)
        .flatMap((p) => p.variants.filter((v) => v.isActive).map((v) => ({ variant: v, label: `${p.name} · ${v.name}${v.dimensionsLabel ? ` (${v.dimensionsLabel})` : ''}` }))),
    [products],
  )
  const byId = useMemo(() => new Map(options.map((o) => [o.variant.id, o.variant])), [options])

  const setCustomer = <K extends keyof SaleValues['customer']>(key: K, value: SaleValues['customer'][K]) =>
    setValues((v) => ({ ...v, customer: { ...v.customer, [key]: value } }))
  const set = <K extends keyof SaleValues>(key: K, value: SaleValues[K]) => setValues((v) => ({ ...v, [key]: value }))
  const updateLine = (key: string, patch: Partial<SaleLine>) =>
    setValues((v) => ({ ...v, lines: v.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }))
  const removeLine = (key: string) => setValues((v) => ({ ...v, lines: v.lines.filter((l) => l.key !== key) }))

  const addVariant = (variantId: string) => {
    const option = options.find((o) => o.variant.id === variantId)
    if (!option) return
    setValues((v) => ({ ...v, lines: [...v.lines, { key: crypto.randomUUID(), variantId, label: option.label, quantity: '1', unitPrice: '', customization: '' }] }))
    setPick('')
  }
  const addCustom = () =>
    setValues((v) => ({ ...v, lines: [...v.lines, { key: crypto.randomUUID(), label: '', quantity: '1', unitPrice: '', customization: '' }] }))

  /** Precio que se usará si la línea no trae uno escrito. */
  const priceOf = (line: SaleLine) => {
    const variant = line.variantId ? byId.get(line.variantId) : undefined
    const qty = Number(line.quantity)
    return variant && Number.isFinite(qty) && qty > 0 ? suggestedPrice(variant, qty) : null
  }
  const subtotal = saleSubtotal(values.lines, priceOf)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const result = buildDirectOrder(values)
    if (!result.ok) return setErrors(result.errors)
    setErrors([])
    const created = await run<{ orderId: string }>('POST', '/orders', result.body)
    if (created) void navigate(`/pedidos/${created.orderId}`)
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="mt-6 grid gap-6" noValidate>
      <Card title="1. Cliente">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo">
            <select className={inputClass} value={values.customer.type} onChange={(e) => setCustomer('type', e.target.value as 'individual' | 'business')}>
              <option value="individual">Particular</option>
              <option value="business">Empresa</option>
            </select>
          </Field>
          <Field label="Canal de la venta">
            <select className={inputClass} value={values.channel} onChange={(e) => set('channel', e.target.value as SaleValues['channel'])}>
              {channelOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={values.customer.type === 'business' ? 'Nombre del contacto' : 'Nombre completo'}>
            <input className={inputClass} maxLength={160} value={values.customer.fullName} onChange={(e) => setCustomer('fullName', e.target.value)} />
          </Field>
          {values.customer.type === 'business' && (
            <Field label="Empresa">
              <input className={inputClass} maxLength={200} value={values.customer.companyName} onChange={(e) => setCustomer('companyName', e.target.value)} />
            </Field>
          )}
          <Field label="Teléfono / WhatsApp">
            <input className={inputClass} type="tel" value={values.customer.phone} onChange={(e) => setCustomer('phone', e.target.value)} />
          </Field>
          <Field label="Correo" hint="Si ya existe un cliente con este correo o teléfono, se reutiliza.">
            <input className={inputClass} type="email" maxLength={254} value={values.customer.email} onChange={(e) => setCustomer('email', e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card title="2. Productos">
        <div className="grid gap-4">
          {values.lines.length === 0 && <p className="text-sm text-carbon-600">Aún no agregaste productos.</p>}
          {values.lines.map((line) => {
            const suggested = priceOf(line)
            return (
              <div key={line.key} className="grid gap-3 rounded-xl border border-linea bg-white p-4 sm:grid-cols-[1fr_6rem_9rem_auto] sm:items-end">
                <div className="grid gap-2">
                  {line.variantId ? (
                    <p className="text-sm font-medium">{line.label}</p>
                  ) : (
                    <Field label="Pieza a medida (descripción)">
                      <input className={inputClass} maxLength={300} value={line.label} onChange={(e) => updateLine(line.key, { label: e.target.value })} />
                    </Field>
                  )}
                  <input
                    aria-label={`Personalización de ${line.label || 'la pieza'}`}
                    className={inputClass}
                    placeholder="Personalización (opcional): grabado, logo…"
                    maxLength={1000}
                    value={line.customization}
                    onChange={(e) => updateLine(line.key, { customization: e.target.value })}
                  />
                </div>
                <Field label="Cantidad">
                  <input className={inputClass} inputMode="numeric" value={line.quantity} onChange={(e) => updateLine(line.key, { quantity: e.target.value })} />
                </Field>
                <Field label="Precio unitario" hint={line.variantId ? (suggested === null ? 'Sin precio publicado: escríbelo.' : `Sugerido: ${formatMoney(suggested)}`) : undefined}>
                  <input className={inputClass} inputMode="decimal" placeholder={suggested === null ? 'S/' : String(suggested)} value={line.unitPrice} onChange={(e) => updateLine(line.key, { unitPrice: e.target.value })} />
                </Field>
                <button type="button" className="min-h-11 px-2 text-sm font-medium text-madera-700 underline underline-offset-4" onClick={() => removeLine(line.key)}>
                  Quitar
                </button>
              </div>
            )
          })}

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-60 flex-1">
              <Field label="Agregar producto del catálogo">
                <select className={inputClass} value={pick} onChange={(e) => addVariant(e.target.value)}>
                  <option value="">Elige…</option>
                  {options.map((o) => (
                    <option key={o.variant.id} value={o.variant.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <button type="button" className={secondaryButton} onClick={addCustom}>
              + Pieza a medida
            </button>
          </div>
        </div>
      </Card>

      <Card title="3. Entrega, descuento y confirmación">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Dirección de entrega">
            <input className={inputClass} maxLength={500} value={values.shippingAddress} onChange={(e) => set('shippingAddress', e.target.value)} />
          </Field>
          <Field label="Descuento (S/)">
            <input className={inputClass} inputMode="decimal" value={values.discount} onChange={(e) => set('discount', e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notas internas" hint="Solo las ve el equipo.">
              <textarea className={`${inputClass} py-2`} rows={2} maxLength={2000} value={values.internalNotes} onChange={(e) => set('internalNotes', e.target.value)} />
            </Field>
          </div>
          <label className="flex min-h-11 items-center gap-3 text-sm sm:col-span-2">
            <input type="checkbox" className="h-5 w-5 accent-nogal" checked={values.customerConfirmed} onChange={(e) => set('customerConfirmed', e.target.checked)} />
            El cliente confirmó el pedido
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm sm:col-span-2">
            <input
              type="checkbox"
              className="h-5 w-5 accent-nogal"
              checked={values.confirm}
              disabled={!values.customerConfirmed}
              onChange={(e) => set('confirm', e.target.checked)}
            />
            Confirmar ahora y reservar el stock
          </label>
        </div>
      </Card>

      {(errors.length > 0 || error) && (
        <Notice>
          {errors.length > 0 ? (
            <ul className="grid gap-1">
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          ) : (
            error
          )}
        </Notice>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm">
          Subtotal con precios conocidos: <strong>{formatMoney(subtotal)}</strong>
        </p>
        <button type="submit" className={primaryButton} disabled={pending}>
          {pending ? 'Guardando…' : values.confirm ? 'Crear y confirmar la venta' : 'Crear venta'}
        </button>
      </div>
    </form>
  )
}

export function NewSalePage() {
  useDocumentTitle('Nueva venta')
  const { state, reload } = useAdminQuery<ListResponse<PanelProduct>>('/products')

  return (
    <div className="mx-auto max-w-4xl">
      <BackLink to="/pedidos">Pedidos</BackLink>
      <PageHeader
        title="Nueva venta"
        intro="Para ventas por WhatsApp o en persona, sin cotización previa. Al confirmar, el stock se reserva y se descontará al despachar."
      />
      <QueryView state={state} onRetry={reload}>
        {({ items }) => <SaleForm products={items} />}
      </QueryView>
    </div>
  )
}
