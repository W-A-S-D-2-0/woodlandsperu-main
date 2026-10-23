import { strToU8, zipSync } from 'fflate'
import { beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { asOwner, createTestDb } from '../../supabase/tests/support/test-db.ts'
import { buildCatalogPlan, parseInventory, renderImportSql, renderReport } from './inventory.ts'
import { readFirstSheet } from './xlsx.ts'

/**
 * Libro de prueba con la MISMA estructura que INVENTARIO.xlsx pero datos ficticios.
 * Incluye los casos problemáticos detectados en el archivo real.
 */
function fixtureWorkbook(): Uint8Array {
  const strings = [
    'STOCK', 'TABLA', 'Stock inicial  Primera Produccion', 'Medidas', 'Quien tiene el stock',
    'PRECIO CATALOGO', 'Costo Unitario', 'PRECIO CONVERSADO', 'Modelo Uno XL', 'Modelo Uno L ',
    'Tabla Suelta', 'Ana &amp; Luis', 'Fila Vacia', 'Total', '60*40*3', '30*2',
  ]
  const s = (text: string) => strings.indexOf(text)
  const sharedXml = `<sst>${strings.map((t) => `<si><t>${t}</t></si>`).join('')}</sst>`
  const cell = (ref: string, inner: string, type = '') => `<c r="${ref}"${type ? ` t="${type}"` : ''}>${inner}</c>`
  const str = (ref: string, text: string) => cell(ref, `<v>${s(text)}</v>`, 's')
  const num = (ref: string, value: number, formula?: string) => cell(ref, `${formula ? `<f>${formula}</f>` : ''}<v>${value}</v>`)
  const rows = [
    `<row r="4">${str('B4', 'STOCK')}</row>`,
    `<row r="5">${str('B5', 'TABLA')}${str('C5', 'Stock inicial  Primera Produccion')}${str('D5', 'Medidas')}${str('E5', 'Quien tiene el stock')}${str('F5', 'PRECIO CATALOGO')}${str('H5', 'Costo Unitario')}${str('J5', 'PRECIO CONVERSADO')}</row>`,
    // Costo vinculado a otro libro.
    `<row r="7">${num('A7', 1)}${str('B7', 'Modelo Uno XL')}${num('C7', 2)}${str('D7', '60*40*3')}${str('E7', 'Ana &amp; Luis')}${num('F7', 200)}${num('H7', 80.555, "+'[1]HOJA'!$B$14")}${num('J7', 150)}</row>`,
    // Costo copiado del precio y conversado mayor que el catálogo.
    `<row r="8">${num('A8', 1)}${str('B8', 'Modelo Uno L ')}${num('C8', 0)}${str('D8', '30*2')}${num('F8', 100)}${num('H8', 100, '+F8')}${num('J8', 120)}</row>`,
    `<row r="9">${num('A9', 2)}${str('B9', 'Tabla Suelta')}${num('C9', 5)}${num('F9', 50)}</row>`,
    `<row r="10">${str('B10', 'Fila Vacia')}</row>`,
    `<row r="11">${str('B11', 'Total')}${num('C11', 7, 'SUM(C7:C10)')}</row>`,
  ]
  return zipSync({
    'xl/sharedStrings.xml': strToU8(sharedXml),
    'xl/worksheets/sheet1.xml': strToU8(`<worksheet><sheetData>${rows.join('')}</sheetData></worksheet>`),
  })
}

describe('lectura del inventario', () => {
  const { rows, issues } = parseInventory(readFirstSheet(fixtureWorkbook()))

  it('lee las filas de datos hasta "Total" y omite las vacías', () => {
    expect(rows.map((row) => row.name)).toEqual(['Modelo Uno XL', 'Modelo Uno L', 'Tabla Suelta'])
    expect(issues.some((issue) => issue.message.includes('Fila Vacia') && issue.message.includes('se omite'))).toBe(true)
  })

  it('decodifica texto y números, y redondea el costo', () => {
    expect(rows[0]).toMatchObject({
      initialStock: 2,
      dimensions: '60*40*3',
      custodian: 'Ana & Luis',
      catalogPrice: 200,
      unitCost: 80.56,
      negotiatedPrice: 150,
      costFromExternalFile: true,
    })
  })

  it('descarta el costo que es copia del precio y señala los problemas', () => {
    expect(rows[1]).toMatchObject({ unitCost: null, costIsPriceCopy: true })
    const messages = issues.map((issue) => issue.message).join('\n')
    expect(messages).toMatch(/copia del precio/)
    expect(messages).toMatch(/conversado \(120\) es mayor/)
    expect(messages).toMatch(/no tienen largo × ancho × espesor/)
    expect(messages).toMatch(/Tabla Suelta" tiene stock pero no indica quién/)
    expect(messages).toMatch(/ítem 1 se repite/)
    expect(issues.some((issue) => issue.severity === 'bloqueante')).toBe(false)
  })

  it('un archivo sin encabezados es bloqueante', () => {
    const empty = zipSync({ 'xl/worksheets/sheet1.xml': strToU8('<worksheet><sheetData></sheetData></worksheet>') })
    expect(parseInventory(readFirstSheet(empty)).issues[0]?.severity).toBe('bloqueante')
  })
})

describe('plan de catálogo', () => {
  const { rows } = parseInventory(readFirstSheet(fixtureWorkbook()))

  it('sin grupos, cada fila es un producto con variante "Estándar"', () => {
    const plan = buildCatalogPlan(rows)
    expect(plan.map((p) => p.name)).toEqual(['Modelo Uno XL', 'Modelo Uno L', 'Tabla Suelta'])
    expect(plan[0]!.variants[0]).toMatchObject({ name: 'Estándar', sku: 'MODELO-UNO-XL' })
  })

  it('con grupos, las filas con el prefijo son variantes del mismo producto', () => {
    const plan = buildCatalogPlan(rows, { groups: ['Modelo Uno'] })
    expect(plan.map((p) => [p.slug, p.variants.map((v) => v.name)])).toEqual([
      ['modelo-uno', ['XL', 'L']],
      ['tabla-suelta', ['Estándar']],
    ])
  })
})

describe('SQL de importación', () => {
  let db: PGlite
  const { rows, issues } = parseInventory(readFirstSheet(fixtureWorkbook()))
  const plan = buildCatalogPlan(rows, { groups: ['Modelo Uno'], activate: true })
  const sql = renderImportSql(plan, { activate: true }, new Date('2026-10-17T00:00:00Z'))

  beforeAll(async () => {
    db = await createTestDb()
  }, 60_000)

  it('carga catálogo, precios internos y stock inicial; repetirlo no duplica nada', async () => {
    await db.exec(sql)
    await db.exec(sql)

    await asOwner(db, async () => {
      const variants = (
        await db.query<{ sku: string; catalog_price: string | null; ref: string | null; on_hand: number; custodian: string | null }>(
          `select v.sku, v.catalog_price, ip.catalog_price_reference as ref, l.on_hand, l.custodian
             from public.product_variants v
             join public.variant_internal_pricing ip on ip.variant_id = v.id
             join public.inventory_levels l on l.variant_id = v.id
            order by v.sku`,
        )
      ).rows
      expect(variants).toEqual([
        { sku: 'MODELO-UNO-L', catalog_price: null, ref: '100.00', on_hand: 0, custodian: null },
        { sku: 'MODELO-UNO-XL', catalog_price: null, ref: '200.00', on_hand: 2, custodian: 'Ana & Luis' },
        { sku: 'TABLA-SUELTA', catalog_price: null, ref: '50.00', on_hand: 5, custodian: null },
      ])
      const movements = (await db.query<{ n: number }>('select count(*)::int as n from public.inventory_movements')).rows[0]!.n
      expect(movements).toBe(2)
    })
  })

  it('el reporte resume el resultado y las observaciones', () => {
    const report = renderReport(plan, issues, { activate: true })
    expect(report).toContain('Productos: 2 · Variantes: 3 · Unidades en stock: 7')
    expect(report).toContain('| Modelo Uno | XL | MODELO-UNO-XL | 60*40*3 | 2 | Ana & Luis |')
  })
})
