import { createBrowserRouter } from 'react-router'
import { NotFoundPage } from '../app/NotFoundPage'
import { RouteError } from '../app/RouteError'
import { AdminOnly } from '../features/admin/RoleGuards'
import { AuthRoot } from '../features/auth/AuthRoot'
import { LoginPage } from '../features/auth/LoginPage'
import { RequireStaff } from '../features/auth/RequireStaff'

/**
 * Base de todas las rutas del sistema interno. En local y en el Worker completo vive bajo /panel;
 * en su despliegue propio (Vercel) ocupa la raíz del dominio y se construye con VITE_PANEL_BASE=/.
 */
export const PANEL_BASE = import.meta.env.VITE_PANEL_BASE || '/panel'

/**
 * Rutas del sistema interno, relativas a /panel:
 *   /panel/ingresar  inicio de sesión del personal
 *   /panel           resumen (requiere sesión y rol verificado por el backend)
 *   /panel/<módulo>  inventario, cotizaciones, pedidos, etc.
 */
export const panelRouter = createBrowserRouter(
  [
    {
      Component: AuthRoot,
      ErrorBoundary: RouteError,
      children: [
        { path: 'ingresar', Component: LoginPage },
        {
          Component: RequireStaff,
          children: [
            {
              lazy: async () => ({ Component: (await import('../features/admin/AdminLayout')).AdminLayout }),
              children: [
                {
                  // Solo administración: el taller vuelve a su inicio (producción).
                  Component: AdminOnly,
                  children: [
                    { index: true, lazy: async () => ({ Component: (await import('../features/admin/AdminOverviewPage')).AdminOverviewPage }) },
                    { path: 'productos', lazy: async () => ({ Component: (await import('../features/admin/screens/ProductsPage')).ProductsPage }) },
                    { path: 'cotizaciones', lazy: async () => ({ Component: (await import('../features/admin/screens/QuotesPages')).QuotesPage }) },
                    { path: 'cotizaciones/:id', lazy: async () => ({ Component: (await import('../features/admin/screens/QuotesPages')).QuoteDetailPage }) },
                    { path: 'conversaciones', lazy: async () => ({ Component: (await import('../features/admin/screens/ConversationsPage')).ConversationsPage }) },
                    { path: 'citas', lazy: async () => ({ Component: (await import('../features/admin/screens/AppointmentsPage')).AppointmentsPage }) },
                    { path: 'clientes', lazy: async () => ({ Component: (await import('../features/admin/screens/CustomersPages')).CustomersPage }) },
                    { path: 'pedidos/nueva', lazy: async () => ({ Component: (await import('../features/admin/screens/NewSalePage')).NewSalePage }) },
                    { path: 'clientes/:id', lazy: async () => ({ Component: (await import('../features/admin/screens/CustomersPages')).CustomerDetailPage }) },
                    { path: 'reportes', lazy: async () => ({ Component: (await import('../features/admin/screens/ReportsPage')).ReportsPage }) },
                  ],
                },
                { path: 'produccion', lazy: async () => ({ Component: (await import('../features/admin/screens/ProductionPage')).ProductionPage }) },
                { path: 'inventario', lazy: async () => ({ Component: (await import('../features/admin/screens/InventoryPage')).InventoryPage }) },
                { path: 'pedidos', lazy: async () => ({ Component: (await import('../features/admin/screens/OrdersPages')).OrdersPage }) },
                { path: 'pedidos/:id', lazy: async () => ({ Component: (await import('../features/admin/screens/OrdersPages')).OrderDetailPage }) },
                {
                  path: ':slug',
                  lazy: async () => ({ Component: (await import('../features/admin/AdminModulePage')).AdminModulePage }),
                },
                { path: '*', element: <NotFoundPage homeTo="/" /> },
              ],
            },
          ],
        },
      ],
    },
  ],
  { basename: PANEL_BASE },
)
