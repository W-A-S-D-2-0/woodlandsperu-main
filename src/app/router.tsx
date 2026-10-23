import { createBrowserRouter, redirect } from 'react-router'
import { PublicLayout } from '../components/layout/PublicLayout'
import { openChat } from '../features/chat/open-chat'
import { AlliancesPage } from '../features/alliances/AlliancesPage'
import { AboutPage } from '../features/home/AboutPage'
import { HomePage } from '../features/home/HomePage'
import { NotFoundPage } from './NotFoundPage'
import { RouteError } from './RouteError'

/** Los enlaces viejos a catálogo, corporativo y cotizar llevan al inicio y abren el chat. */
const toChat = (message: string) => () => {
  // El chat se monta junto con la página: se espera a que esté listo para escuchar.
  setTimeout(() => openChat(message), 400)
  return redirect('/')
}

/**
 * Rutas de la web pública. El sistema interno (panel) es otra aplicación, servida en
 * /panel con su propio HTML: aquí no existe ninguna ruta ni código del panel.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    Component: PublicLayout,
    ErrorBoundary: RouteError,
    children: [
      { index: true, Component: HomePage },
      { path: 'catalogo', loader: toChat('Ver los productos') },
      { path: 'corporativo', loader: toChat('Quiero hacer un pedido para mi empresa') },
      { path: 'cotizar', loader: toChat('Quiero hacer un pedido') },
      { path: 'alianzas', Component: AlliancesPage },
      { path: 'nosotros', Component: AboutPage },
      { path: '*', Component: NotFoundPage },
    ],
  },
])
