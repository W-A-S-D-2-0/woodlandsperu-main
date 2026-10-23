import { Outlet, ScrollRestoration } from 'react-router'
import { ChatWidget } from '../../features/chat/ChatWidget'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'

export function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-nogal focus:px-4 focus:py-2 focus:text-marfil"
        >
          Saltar al contenido
        </a>
        <SiteHeader />
        <main id="contenido" className="flex-1">
          <Outlet />
        </main>
        <SiteFooter />
        <ChatWidget />
        <ScrollRestoration />
    </div>
  )
}
