import type { Context } from 'hono'
import { Hono } from 'hono'
import type { StaffMeResponse } from '../../shared/api/contracts'
import type { ReportExportResponse, ReportPayload } from '../../shared/api/panel-contracts'
import {
  cancelOrderBody,
  confirmOrderBody,
  conversationListQuery,
  conversationStatusBody,
  convertQuoteBody,
  customerListQuery,
  customerNoteBody,
  directOrderBody,
  dispatchOrderBody,
  idParam,
  inventoryMovementBody,
  inventorySettingsBody,
  orderListQuery,
  orderPatch,
  orderStatusBody,
  productPatch,
  quoteItemPriceBody,
  quoteListQuery,
  reportQuery,
  sendQuoteBody,
  variantPatch,
} from '../../shared/api/panel-schemas'
import { requireRole, requireStaff, type StaffAuthFactory } from '../auth/staff-auth'
import { PanelDataError, type PanelData, type PanelDataFactory } from '../data/panel-data'
import { GoogleSheetsError, readGoogleSheetsConfig, spreadsheetUrl, writeSheets } from '../integrations/google-sheets'
import { reportSheetRows, reportSheets } from '../../src/features/admin/report-logic'
import { buildReport, reportBounds } from '../services/reports'
import type { AppBindings } from '../types'
import { fail, parseBody, validate } from './http'

type Ctx = Context<AppBindings>

const MOVEMENTS_LIMIT = 50

/**
 * Rutas del panel administrativo. Todas exigen personal activo.
 * - Administración: todo.
 * - Taller: consulta inventario y pedidos y registra producción (`production_in`).
 * Los permisos se aplican aquí y, además, en la base (RLS y chequeos de rol de las funciones).
 */
export function adminRoutes(staffAuth: StaffAuthFactory, panelData: PanelDataFactory, options: { fetchImpl?: typeof fetch } = {}) {
  const admin = requireRole('admin')
  const anyStaff = requireRole('admin', 'workshop')

  /** Resuelve los datos con el JWT del usuario y traduce los errores de negocio a respuestas HTTP. */
  const handle =
    (fn: (c: Ctx, data: PanelData) => Promise<Response>) =>
    async (c: Ctx): Promise<Response> => {
      const data = panelData(c.env, c.get('accessToken'))
      if (!data) return fail(c, 503, 'data_not_configured', 'El servicio no está disponible por ahora.')
      try {
        return await fn(c, data)
      } catch (err) {
        if (err instanceof PanelDataError) return fail(c, err.status, err.code, err.message)
        throw err
      }
    }

  /** Id de la ruta. Un id mal formado se trata como inexistente. */
  const idOf = (c: Ctx, name = 'id') => {
    const parsed = idParam.safeParse(c.req.param(name))
    return parsed.success ? parsed.data : null
  }
  const notFound = (c: Ctx) => fail(c, 404, 'not_found', 'El registro no existe.')
  const ok = (c: Ctx) => c.json({ ok: true })

  /** Ruta con id y cuerpo validados. */
  const withIdBody =
    <T>(schema: Parameters<typeof parseBody<T>>[1], fn: (c: Ctx, data: PanelData, id: string, body: T) => Promise<Response>) =>
    handle(async (c, data) => {
      const id = idOf(c)
      if (!id) return notFound(c)
      const body = await parseBody(c, schema)
      if ('response' in body) return body.response
      return fn(c, data, id, body.data)
    })

  const withId = (fn: (c: Ctx, data: PanelData, id: string) => Promise<Response>) =>
    handle(async (c, data) => {
      const id = idOf(c)
      return id ? fn(c, data, id) : notFound(c)
    })

  return new Hono<AppBindings>()
    .use('*', requireStaff(staffAuth))
    .get('/me', (c) => c.json<StaffMeResponse>(c.get('staff')))

    // Resumen
    .get('/dashboard', admin, handle(async (c, d) => c.json(await d.getDashboard())))

    // Reportes (solo lectura; la exportación a Google Sheets se arma con esta misma respuesta)
    .get(
      '/reports',
      admin,
      handle(async (c, d) => {
        const query = validate(c, reportQuery, c.req.query())
        if ('response' in query) return query.response
        const source = await d.getReportSource(reportBounds(query.data.from, query.data.to))
        return c.json<ReportPayload>({ ...buildReport(source, query.data), canExport: readGoogleSheetsConfig(c.env) !== null })
      }),
    )
    .post(
      '/reports/export',
      admin,
      handle(async (c, d) => {
        const config = readGoogleSheetsConfig(c.env)
        if (!config) return fail(c, 409, 'sheets_not_connected', 'Google Sheets todavía no está conectado.')
        const query = validate(c, reportQuery, c.req.query())
        if ('response' in query) return query.response
        const report = buildReport(await d.getReportSource(reportBounds(query.data.from, query.data.to)), query.data)
        const tabs = reportSheets.map((sheet) => ({ title: sheet.label, rows: reportSheetRows(report, sheet.key) }))
        try {
          await writeSheets(config, tabs, options.fetchImpl)
        } catch (err) {
          if (err instanceof GoogleSheetsError) {
            const access = err.status === 403 || err.status === 404
            return fail(
              c,
              502,
              'sheets_export_failed',
              access
                ? 'Google no dejó escribir en la hoja. Revisa que esté compartida como Editor con el correo de la cuenta de servicio.'
                : 'No se pudo enviar el reporte a Google Sheets. Inténtalo de nuevo.',
            )
          }
          throw err
        }
        return c.json<ReportExportResponse>({
          spreadsheetUrl: spreadsheetUrl(config.spreadsheetId),
          sheets: tabs.map((t) => ({ title: t.title, rows: t.rows.length - 1 })),
        })
      }),
    )

    // Productos y variantes
    .get('/products', admin, handle(async (c, d) => c.json(await d.listProducts())))
    .patch('/products/:id', admin, withIdBody(productPatch, async (c, d, id, body) => (await d.updateProduct(id, body), ok(c))))
    .patch('/variants/:id', admin, withIdBody(variantPatch, async (c, d, id, body) => (await d.updateVariant(id, body), ok(c))))

    // Inventario
    .get('/inventory', anyStaff, handle(async (c, d) => c.json(await d.listInventory())))
    .get('/inventory/:id/movements', anyStaff, withId(async (c, d, id) => c.json(await d.listMovements(id, MOVEMENTS_LIMIT))))
    .post(
      '/inventory/movements',
      anyStaff,
      handle(async (c, d) => {
        const body = await parseBody(c, inventoryMovementBody)
        if ('response' in body) return body.response
        // El taller solo registra producción terminada.
        if (c.get('staff').role === 'workshop' && body.data.type !== 'production_in') {
          return fail(c, 403, 'forbidden', 'El taller solo puede registrar producción.')
        }
        return c.json(await d.applyMovement(body.data), 201)
      }),
    )
    .put('/inventory/:id/settings', admin, withIdBody(inventorySettingsBody, async (c, d, id, body) => (await d.updateInventorySettings(id, body), ok(c))))

    // Cotizaciones
    .get(
      '/quotes',
      admin,
      handle(async (c, d) => {
        const query = validate(c, quoteListQuery, c.req.query())
        if ('response' in query) return query.response
        return c.json(await d.listQuotes(query.data.status))
      }),
    )
    .get('/quotes/:id', admin, withId(async (c, d, id) => {
      const quote = await d.getQuote(id)
      return quote ? c.json(quote) : notFound(c)
    }))
    .put('/quotes/items/:id/price', admin, withIdBody(quoteItemPriceBody, async (c, d, id, body) => (await d.setQuoteItemPrice(id, body.unitPrice), ok(c))))
    .post('/quotes/:id/send', admin, withIdBody(sendQuoteBody, async (c, d, id, body) => (await d.sendQuote(id, body), ok(c))))
    .post('/quotes/:id/accept', admin, withId(async (c, d, id) => (await d.acceptQuote(id), ok(c))))
    .post('/quotes/:id/cancel', admin, withId(async (c, d, id) => (await d.cancelQuote(id), ok(c))))
    .post('/quotes/:id/convert', admin, withIdBody(convertQuoteBody, async (c, d, id, body) => c.json({ orderId: await d.convertQuote(id, body) }, 201)))

    // Pedidos (el taller solo consulta)
    .get(
      '/orders',
      anyStaff,
      handle(async (c, d) => {
        const query = validate(c, orderListQuery, c.req.query())
        if ('response' in query) return query.response
        return c.json(await d.listOrders(query.data.status))
      }),
    )
    .post(
      '/orders',
      admin,
      handle(async (c, d) => {
        const body = await parseBody(c, directOrderBody)
        if ('response' in body) return body.response
        return c.json({ orderId: await d.createDirectOrder(body.data) }, 201)
      }),
    )
    .get('/orders/:id', anyStaff, withId(async (c, d, id) => {
      const order = await d.getOrder(id)
      return order ? c.json(order) : notFound(c)
    }))
    .patch('/orders/:id', admin, withIdBody(orderPatch, async (c, d, id, body) => (await d.updateOrder(id, body), ok(c))))
    .post('/orders/:id/confirm', admin, withIdBody(confirmOrderBody, async (c, d, id, body) => (await d.confirmOrder(id, body.customerConfirmed), ok(c))))
    .post('/orders/:id/status', admin, withIdBody(orderStatusBody, async (c, d, id, body) => (await d.setOrderStatus(id, body.status), ok(c))))
    .post('/orders/:id/dispatch', admin, withIdBody(dispatchOrderBody, async (c, d, id, body) => (await d.dispatchOrder(id, body.finalStatus), ok(c))))
    .post('/orders/:id/cancel', admin, withIdBody(cancelOrderBody, async (c, d, id, body) => (await d.cancelOrder(id, body.reason), ok(c))))

    // Clientes y notas
    .get(
      '/customers',
      admin,
      handle(async (c, d) => {
        const query = validate(c, customerListQuery, c.req.query())
        if ('response' in query) return query.response
        return c.json(await d.listCustomers(query.data.search))
      }),
    )
    .get('/customers/:id', admin, withId(async (c, d, id) => {
      const customer = await d.getCustomer(id)
      return customer ? c.json(customer) : notFound(c)
    }))
    .post('/customers/:id/notes', admin, withIdBody(customerNoteBody, async (c, d, id, body) => (await d.addCustomerNote(id, body.body), c.json({ ok: true }, 201))))

    // Conversaciones (chat web y WhatsApp): solo administración, para supervisar al asistente
    .get(
      '/conversations',
      admin,
      handle(async (c, d) => {
        const query = validate(c, conversationListQuery, c.req.query())
        if ('response' in query) return query.response
        return c.json(await d.listConversations(query.data.status))
      }),
    )
    // Solo lectura: el asistente atiende solo; el equipo no conversa con el cliente desde el panel.
    .get('/conversations/:id', admin, withId(async (c, d, id) => {
      const conversation = await d.getConversation(id)
      return conversation ? c.json(conversation) : notFound(c)
    }))
    .post(
      '/conversations/:id/status',
      admin,
      withIdBody(conversationStatusBody, async (c, d, id, body) => (await d.setConversationStatus(id, body.status), ok(c))),
    )
}
