import { useEffect, useId, useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import { publicNav } from '../../content/site'
import { openChat } from '../../features/chat/open-chat'
import { useScrolled } from '../../hooks/useScrolled'
import { Container } from '../ui/Container'
import { Wordmark } from '../ui/Wordmark'

// Subrayado que crece desde la izquierda al pasar el cursor; fijo en la página activa.
const desktopLinkClass = ({ isActive }: { isActive: boolean }) =>
  `relative inline-flex min-h-11 items-center px-3 text-sm font-medium transition-colors duration-300 after:absolute after:inset-x-3 after:bottom-2 after:h-px after:origin-left after:bg-madera after:transition-transform after:duration-500 after:ease-suave ${
    isActive ? 'text-nogal after:scale-x-100' : 'text-carbon-600 after:scale-x-0 hover:text-nogal hover:after:scale-x-100'
  }`

const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-12 items-center justify-between border-b border-linea/60 font-display text-xl transition-colors ${
    isActive ? 'text-nogal' : 'text-carbon-600 hover:text-nogal'
  }`

export function SiteHeader() {
  // El menú queda abierto solo para la ruta en que se abrió: al navegar se cierra sin efectos.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const menuId = useId()
  const { pathname } = useLocation()
  const scrolled = useScrolled()
  const open = openOn === pathname
  const setOpen = (value: boolean) => setOpenOn(value ? pathname : null)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpenOn(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <header
      className={`site-header sticky top-0 z-30 border-b bg-marfil transition-[border-color,box-shadow] duration-500 ease-suave ${
        scrolled || open ? 'border-linea/80 shadow-[0_8px_24px_-18px_rgb(34_34_31/0.35)]' : 'border-transparent'
      }`}
    >
      <Container className="flex h-16 items-center justify-between">
        <Wordmark />

        <nav aria-label="Principal" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {publicNav.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.to === '/'} viewTransition className={desktopLinkClass}>
                  {item.label}
                </NavLink>
              </li>
            ))}
            <li>
              <button type="button" onClick={() => openChat()} className="ml-2 inline-flex min-h-10 items-center rounded-full bg-madera-700 px-5 text-sm font-semibold text-marfil transition-colors hover:bg-nogal">
                Chatea con nosotros
              </button>
            </li>
          </ul>
        </nav>

        <button
          type="button"
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-full text-nogal transition-colors hover:bg-beige md:hidden"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          onClick={() => setOpen(!open)}
        >
          {/* Tres líneas que se convierten en una X. */}
          <span aria-hidden="true" className="relative block h-3.5 w-5">
            <span
              className={`absolute left-0 h-[1.5px] w-5 rounded bg-current transition-transform duration-300 ease-suave ${
                open ? 'top-1.5 rotate-45' : 'top-0'
              }`}
            />
            <span
              className={`absolute top-1.5 left-0 h-[1.5px] w-5 rounded bg-current transition-opacity duration-200 ${
                open ? 'opacity-0' : 'opacity-100'
              }`}
            />
            <span
              className={`absolute left-0 h-[1.5px] w-5 rounded bg-current transition-transform duration-300 ease-suave ${
                open ? 'top-1.5 -rotate-45' : 'top-3'
              }`}
            />
          </span>
        </button>
      </Container>

      <nav id={menuId} aria-label="Principal móvil" data-open={open} className="disclosure md:hidden">
        <div>
          <Container className="pt-2 pb-6">
            <ul className="flex flex-col">
              {publicNav.map((item, index) => (
                <li
                  key={item.to}
                  className={`transition-[opacity,transform] duration-500 ease-suave ${
                    open ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'
                  }`}
                  style={{ transitionDelay: open ? `${80 + index * 50}ms` : '0ms' }}
                >
                  <NavLink to={item.to} end={item.to === '/'} viewTransition className={mobileLinkClass}>
                    {item.label}
                    <span aria-hidden="true" className="text-base text-madera">
                      →
                    </span>
                  </NavLink>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    openChat()
                  }}
                  className="flex min-h-12 w-full items-center justify-between font-display text-xl text-madera-700 transition-colors hover:text-nogal"
                >
                  Chatea con nosotros
                  <span aria-hidden="true" className="text-base text-madera">
                    →
                  </span>
                </button>
              </li>
            </ul>
          </Container>
        </div>
      </nav>
    </header>
  )
}
