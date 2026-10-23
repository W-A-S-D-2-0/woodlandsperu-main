/**
 * Importador de INVENTARIO.xlsx.
 *
 *   node scripts/import-inventory.ts <ruta.xlsx> [--groups "Super Grill,Serving Board"] [--activate]
 *
 * No se conecta a ninguna base: genera en .data/ (ignorado por git)
 *   - import-report.md   observaciones para revisar con Woodland
 *   - import-catalog.sql SQL transaccional e idempotente para el editor SQL de Supabase
 * Si hay observaciones bloqueantes no genera el SQL.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { buildCatalogPlan, parseInventory, renderImportSql, renderReport } from './import/inventory.ts'
import { readFirstSheet } from './import/xlsx.ts'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    groups: { type: 'string' },
    activate: { type: 'boolean', default: false },
    out: { type: 'string', default: '.data' },
  },
})

const input = positionals[0]
if (!input) {
  console.error('Uso: node scripts/import-inventory.ts <INVENTARIO.xlsx> [--groups "A,B"] [--activate]')
  process.exit(1)
}

const options = {
  groups: values.groups?.split(',').map((group) => group.trim()).filter(Boolean),
  activate: values.activate,
}

const { rows, issues } = parseInventory(readFirstSheet(readFileSync(resolve(input))))
const plan = buildCatalogPlan(rows, options)
const outDir = resolve(values.out)
mkdirSync(outDir, { recursive: true })

writeFileSync(join(outDir, 'import-report.md'), renderReport(plan, issues, options))
console.log(`Reporte: ${join(outDir, 'import-report.md')}`)

const blocking = issues.filter((issue) => issue.severity === 'bloqueante')
if (blocking.length > 0) {
  console.error(`${blocking.length} observación(es) bloqueante(s): corrige el Excel antes de importar.`)
  process.exit(2)
}

writeFileSync(join(outDir, 'import-catalog.sql'), renderImportSql(plan, options))
const variants = plan.reduce((sum, product) => sum + product.variants.length, 0)
console.log(`SQL: ${join(outDir, 'import-catalog.sql')} (${plan.length} productos, ${variants} variantes, ${issues.length} observaciones)`)
