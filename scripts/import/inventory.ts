import { splitRef, type Cell, type Sheet } from './xlsx.ts'

/**
 * Interpreta INVENTARIO.xlsx (hoja de stock de Woodland) y prepara la importación.
 *
 * Reglas (decididas con el equipo, ver docs/architecture/data-model.md):
 *  - El precio de catálogo NO se publica: va a variant_internal_pricing.catalog_price_reference
 *    hasta que Woodland confirme qué precio ve el público.
 *  - El stock inicial entra como movimiento `production_in` (nunca se escribe el saldo).
 *  - Un costo que es copia de la celda de precio no es un costo real: no se importa.
 *  - Las medidas se guardan como texto; las unidades no están confirmadas.
 */

export type Severity = 'bloqueante' | 'revisar' | 'info'

export interface Issue {
  severity: Severity
  row: number | null
  message: string
}

export interface InventoryRow {
  row: number
  itemNumber: string | null
  name: string
  initialStock: number | null
  dimensions: string | null
  custodian: string | null
  catalogPrice: number | null
  unitCost: number | null
  costIsPriceCopy: boolean
  costFromExternalFile: boolean
  negotiatedPrice: number | null
}

const HEADERS = {
  name: (h: string) => h === 'TABLA',
  initialStock: (h: string) => h.startsWith('STOCK INICIAL'),
  dimensions: (h: string) => h === 'MEDIDAS',
  custodian: (h: string) => h.startsWith('QUIEN TIENE EL STOCK'),
  catalogPrice: (h: string) => h === 'PRECIO CATALOGO',
  unitCost: (h: string) => h === 'COSTO UNITARIO',
  negotiatedPrice: (h: string) => h === 'PRECIO CONVERSADO',
} as const

type Field = keyof typeof HEADERS

export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

function asText(cell: Cell | undefined): string | null {
  if (!cell || cell.value === null) return null
  const text = String(cell.value).replace(/\s+/g, ' ').trim()
  return text === '' ? null : text
}

function asNumber(cell: Cell | undefined): number | null {
  if (!cell || cell.value === null || cell.value === '') return null
  const value = typeof cell.value === 'number' ? cell.value : Number(String(cell.value).replace(',', '.'))
  return Number.isFinite(value) ? value : null
}

const round2 = (value: number) => Math.round(value * 100) / 100

export function parseInventory(sheet: Sheet): { rows: InventoryRow[]; issues: Issue[] } {
  const issues: Issue[] = []
  const byRow = new Map<number, Map<string, Cell>>()
  for (const [ref, cell] of sheet) {
    const { column, row } = splitRef(ref)
    if (!byRow.has(row)) byRow.set(row, new Map())
    byRow.get(row)!.set(column, cell)
  }
  const rowNumbers = [...byRow.keys()].sort((a, b) => a - b)

  // Fila de encabezados: la que contiene "TABLA".
  let headerRow: number | null = null
  const columns: Partial<Record<Field, string>> = {}
  for (const row of rowNumbers) {
    const cells = byRow.get(row)!
    if (![...cells.values()].some((cell) => normalize(String(cell.value ?? '')) === 'TABLA')) continue
    headerRow = row
    for (const [column, cell] of cells) {
      const header = normalize(String(cell.value ?? ''))
      for (const field of Object.keys(HEADERS) as Field[]) {
        if (!columns[field] && HEADERS[field](header)) columns[field] = column
      }
    }
    break
  }

  if (headerRow === null || !columns.name) {
    issues.push({ severity: 'bloqueante', row: null, message: 'No se encontró la fila de encabezados (columna "TABLA").' })
    return { rows: [], issues }
  }
  for (const field of ['initialStock', 'catalogPrice'] as Field[]) {
    if (!columns[field]) issues.push({ severity: 'bloqueante', row: headerRow, message: `Falta la columna de ${field}.` })
  }

  const rows: InventoryRow[] = []
  const seenItemNumbers = new Map<string, number>()

  for (const row of rowNumbers.filter((r) => r > headerRow!)) {
    const cells = byRow.get(row)!
    const get = (field: Field) => (columns[field] ? cells.get(columns[field]!) : undefined)
    const name = asText(get('name'))
    if (!name) continue
    if (normalize(name) === 'TOTAL') break

    const itemNumber = asText(cells.get('A'))
    const costCell = get('unitCost')
    const priceColumn = columns.catalogPrice
    const costFormula = costCell?.formula?.replace(/\s/g, '') ?? ''
    const parsed: InventoryRow = {
      row,
      itemNumber,
      name,
      initialStock: asNumber(get('initialStock')),
      dimensions: asText(get('dimensions')),
      custodian: asText(get('custodian')),
      catalogPrice: asNumber(get('catalogPrice')),
      unitCost: asNumber(costCell),
      costIsPriceCopy: Boolean(priceColumn && new RegExp(`^\\+?\\$?${priceColumn}\\$?${row}$`).test(costFormula)),
      costFromExternalFile: /\[\d+\]/.test(costFormula),
      negotiatedPrice: asNumber(get('negotiatedPrice')),
    }

    const hasData =
      (parsed.initialStock ?? 0) > 0 || parsed.catalogPrice !== null || parsed.negotiatedPrice !== null || parsed.dimensions !== null
    if (!hasData) {
      issues.push({ severity: 'revisar', row, message: `"${name}" no tiene stock, precios ni medidas: se omite.` })
      continue
    }

    if (itemNumber) {
      const previous = seenItemNumbers.get(itemNumber)
      if (previous !== undefined) {
        issues.push({ severity: 'info', row, message: `El N.° de ítem ${itemNumber} se repite (también en la fila ${previous}).` })
      } else {
        seenItemNumbers.set(itemNumber, row)
      }
    }
    if (parsed.initialStock !== null && (!Number.isInteger(parsed.initialStock) || parsed.initialStock < 0)) {
      issues.push({ severity: 'bloqueante', row, message: `"${name}": stock inicial inválido (${parsed.initialStock}).` })
    }
    if (!parsed.dimensions) {
      issues.push({ severity: 'revisar', row, message: `"${name}" no tiene medidas.` })
    } else if (parsed.dimensions.split('*').length !== 3) {
      issues.push({ severity: 'revisar', row, message: `"${name}": medidas "${parsed.dimensions}" no tienen largo × ancho × espesor.` })
    }
    if ((parsed.initialStock ?? 0) > 0 && !parsed.custodian) {
      issues.push({ severity: 'revisar', row, message: `"${name}" tiene stock pero no indica quién lo tiene.` })
    }
    if (parsed.catalogPrice === null) {
      issues.push({ severity: 'revisar', row, message: `"${name}" no tiene precio de catálogo.` })
    }
    if (parsed.catalogPrice !== null && parsed.negotiatedPrice !== null && parsed.negotiatedPrice > parsed.catalogPrice) {
      issues.push({
        severity: 'revisar',
        row,
        message: `"${name}": el precio conversado (${parsed.negotiatedPrice}) es mayor que el de catálogo (${parsed.catalogPrice}).`,
      })
    }
    if (parsed.costIsPriceCopy) {
      issues.push({ severity: 'revisar', row, message: `"${name}": el costo es una copia del precio de catálogo; no se importa.` })
      parsed.unitCost = null
    } else if (parsed.costFromExternalFile) {
      issues.push({ severity: 'info', row, message: `"${name}": el costo viene de otro libro de Excel; verificar que esté vigente.` })
    }
    if (parsed.unitCost !== null) parsed.unitCost = round2(parsed.unitCost)

    rows.push(parsed)
  }

  return { rows, issues }
}

// ---------------------------------------------------------------------------
// Plan de catálogo
// ---------------------------------------------------------------------------

export interface PlannedVariant {
  sourceRow: number
  sku: string
  name: string
  dimensions: string | null
  custodian: string | null
  initialStock: number
  catalogPriceReference: number | null
  negotiatedPrice: number | null
  unitCost: number | null
  costSource: string | null
}

export interface PlannedProduct {
  slug: string
  name: string
  variants: PlannedVariant[]
}

export interface ImportOptions {
  /** Prefijos que agrupan filas como variantes de un mismo producto (p. ej. "Super Grill"). */
  groups?: string[]
  /** Publica productos y variantes (sin precio: "a cotizar"). Por defecto quedan inactivos. */
  activate?: boolean
}

function slugify(text: string): string {
  return normalize(text)
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function buildCatalogPlan(rows: InventoryRow[], options: ImportOptions = {}): PlannedProduct[] {
  const groups = (options.groups ?? [])
    .map((group) => group.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
  const products = new Map<string, PlannedProduct>()
  const usedSkus = new Set<string>()

  for (const row of rows) {
    const normalizedName = normalize(row.name)
    const group = groups.find((g) => normalizedName === normalize(g) || normalizedName.startsWith(`${normalize(g)} `))
    const productName = group ?? row.name
    const variantName = group ? row.name.slice(group.length).trim() || 'Estándar' : 'Estándar'

    const slug = slugify(productName).toLowerCase()
    if (!products.has(slug)) products.set(slug, { slug, name: productName, variants: [] })

    let sku = slugify(variantName === 'Estándar' ? productName : `${productName} ${variantName}`).slice(0, 37)
    for (let n = 2; usedSkus.has(sku); n++) sku = `${sku.slice(0, 36)}-${n}`
    usedSkus.add(sku)

    products.get(slug)!.variants.push({
      sourceRow: row.row,
      sku,
      name: variantName,
      dimensions: row.dimensions,
      custodian: row.custodian,
      initialStock: row.initialStock ?? 0,
      catalogPriceReference: row.catalogPrice,
      negotiatedPrice: row.negotiatedPrice,
      unitCost: row.unitCost,
      costSource: row.unitCost === null ? null : row.costFromExternalFile ? 'Excel externo vinculado' : 'INVENTARIO.xlsx',
    })
  }

  return [...products.values()]
}

// ---------------------------------------------------------------------------
// SQL de importación (transaccional e idempotente)
// ---------------------------------------------------------------------------

const lit = (value: string | number | null): string =>
  value === null ? 'null' : typeof value === 'number' ? String(value) : `'${value.replace(/'/g, "''")}'`

export function renderImportSql(plan: PlannedProduct[], options: ImportOptions = {}, generatedAt = new Date()): string {
  const active = options.activate ? 'true' : 'false'
  const lines: string[] = [
    `-- Importación de INVENTARIO.xlsx · generado ${generatedAt.toISOString()}`,
    '-- CONFIDENCIAL: contiene costos y precios internos de Woodland. No versionar.',
    '-- Idempotente: volver a ejecutarlo no duplica productos ni stock.',
    'begin;',
    '',
    '-- Se ejecuta con permisos de backend (los movimientos de inventario lo exigen).',
    `select set_config('request.jwt.claims', '{"role":"service_role"}', true);`,
    '',
  ]

  for (const product of plan) {
    lines.push(`-- ${product.name}`)
    lines.push(
      `insert into public.products (slug, name, is_active) values (${lit(product.slug)}, ${lit(product.name)}, ${active}) on conflict (slug) do nothing;`,
    )
    product.variants.forEach((variant, index) => {
      const variantRef = `(select id from public.product_variants where sku = ${lit(variant.sku)})`
      lines.push(
        `insert into public.product_variants (product_id, sku, name, dimensions_label, catalog_price, fulfillment_type, is_active, sort_order)` +
          ` select id, ${lit(variant.sku)}, ${lit(variant.name)}, ${lit(variant.dimensions)}, null, 'stock', ${active}, ${index}` +
          ` from public.products where slug = ${lit(product.slug)} on conflict (sku) do nothing;`,
      )
      lines.push(
        `insert into public.variant_internal_pricing (variant_id, unit_cost, negotiated_price, catalog_price_reference, cost_source, notes)` +
          ` values (${variantRef}, ${lit(variant.unitCost)}, ${lit(variant.negotiatedPrice)}, ${lit(variant.catalogPriceReference)}, ${lit(variant.costSource)}, ${lit(`Importado de la fila ${variant.sourceRow} de INVENTARIO.xlsx`)})` +
          ` on conflict (variant_id) do update set unit_cost = excluded.unit_cost, negotiated_price = excluded.negotiated_price,` +
          ` catalog_price_reference = excluded.catalog_price_reference, cost_source = excluded.cost_source, notes = excluded.notes;`,
      )
      lines.push(
        `insert into public.inventory_levels (variant_id, custodian) values (${variantRef}, ${lit(variant.custodian)})` +
          ` on conflict (variant_id) do update set custodian = excluded.custodian;`,
      )
      if (variant.initialStock > 0) {
        lines.push(
          `select public.apply_inventory_movement(${variantRef}, 'production_in', ${variant.initialStock}, ` +
            `'Stock inicial (INVENTARIO.xlsx)', null, ${lit(`import:inventario-xlsx:${variant.sku}`)});`,
        )
      }
    })
    lines.push('')
  }

  lines.push('commit;', '')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Reporte para revisar con la empresa
// ---------------------------------------------------------------------------

export function renderReport(plan: PlannedProduct[], issues: Issue[], options: ImportOptions = {}): string {
  const variants = plan.flatMap((product) => product.variants)
  const totalStock = variants.reduce((sum, variant) => sum + variant.initialStock, 0)
  const order: Severity[] = ['bloqueante', 'revisar', 'info']
  const sorted = [...issues].sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity))

  const lines = [
    '# Reporte de importación · INVENTARIO.xlsx',
    '',
    'CONFIDENCIAL: no compartir fuera del equipo ni versionar.',
    '',
    `- Productos: ${plan.length} · Variantes: ${variants.length} · Unidades en stock: ${totalStock}`,
    `- Publicación: ${options.activate ? 'activos, con precio "a cotizar"' : 'inactivos (se publican desde el panel)'}`,
    '- Precio de catálogo: guardado como referencia interna, no publicado (pendiente de confirmar con Woodland).',
    '- Medidas: se guardan como texto; falta confirmar la unidad (¿cm?).',
    '',
    '## Observaciones',
    '',
    ...(sorted.length === 0
      ? ['Sin observaciones.']
      : sorted.map((issue) => `- **${issue.severity}**${issue.row ? ` (fila ${issue.row})` : ''}: ${issue.message}`)),
    '',
    '## Resultado',
    '',
    '| Producto | Variante | SKU | Medidas | Stock | Custodio |',
    '| --- | --- | --- | --- | --- | --- |',
    ...plan.flatMap((product) =>
      product.variants.map(
        (v) => `| ${product.name} | ${v.name} | ${v.sku} | ${v.dimensions ?? '—'} | ${v.initialStock} | ${v.custodian ?? '—'} |`,
      ),
    ),
    '',
  ]
  return lines.join('\n')
}
