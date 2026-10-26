import { useId, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { Wordmark } from '../../components/ui/Wordmark'
import { PUBLIC_SITE_URL } from '../../lib/public-site'
import { roleLabels, useStaffSession } from '../auth/auth-context'
import { SignOutButton } from '../auth/SignOutButton'
import type { StaffRole } from '../../../shared/api/contracts'
import { LowStockAlarm } from './LowStockAlarm'
import { modulesFor } from './modules'
import { NavIcon } from './nav-icons'

const itemClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
    isActive ? 'bg-marfil/12 text-marfil shadow-[inset_3px_0_0_var(--color-madera)]' : 'text-beige/80 hover:bg-marfil/5 hover:text-marfil'
  }`

function AdminNav({ role }: { role: StaffRole }) {
  return (
    <ul className="grid gap-1">
      {role === 'admin' && (
        <li>
          <NavLink to="/" end className={itemClass}>
            <NavIcon slug="resumen" />
            Resumen
          </NavLink>
        </li>
      )}
      {modulesFor(role).map((adminModule) => (
        <li key={adminModule.slug}>
          <NavLink to={`/${adminModule.slug}`} className={itemClass}>
            <NavIcon slug={adminModule.slug} />
            {adminModule.label}
          </NavLink>
        </li>
      ))}
    </ul>
  )
}

export function AdminLayout() {
  const { staff, signOut } = useStaffSession()
  // El menú queda abierto solo para la ruta en que se abrió: al navegar se cierra sin efectos.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const navId = useId()
  const { pathname } = useLocation()
  const open = openOn === pathname
  const setOpen = (value: boolean) => setOpenOn(value ? pathname : null)

  return (
    <div className="min-h-dvh bg-marfil lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="bg-nogal text-beige lg:sticky lg:top-0 lg:h-dvh">
        <div className="flex h-16 items-center justify-between px-5">
          <Wordmark to="/" tone="light" suffix="Panel" />
          <button
            type="button"
            className="inline-flex h-11 items-center rounded-full px-4 text-sm font-medium text-marfil hover:bg-marfil/10 lg:hidden"
            aria-expanded={open}
            aria-controls={navId}
            onClick={() => setOpen(!open)}
          >
            {open ? 'Cerrar' : 'Menú'}
          </button>
        </div>
        <nav id={navId} aria-label="Administración" className={`${open ? 'block' : 'hidden'} px-3 pb-4 lg:block`}>
          <AdminNav role={staff.role} />
          <a href={PUBLIC_SITE_URL} className="mt-6 flex min-h-11 items-center px-3 text-xs text-beige/70 hover:text-marfil">
            ← Ir a la web pública
          </a>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col">
        <div className="flex min-h-14 items-center justify-end gap-4 border-b border-linea px-5 text-sm sm:px-8">
          <p className="min-w-0 truncate text-carbon-600">
            <span className="font-semibold text-carbon">{staff.fullName}</span> · {roleLabels[staff.role]}
          </p>
          {/* Vigila el stock bajo en todo el panel y suena la alarma. */}
          <LowStockAlarm inventoryPath="/inventario" />
          <SignOutButton
            onConfirm={signOut}
            className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-nogal/30 px-4 text-sm font-medium text-nogal transition-colors hover:border-nogal hover:bg-nogal/5"
          />
        </div>
        <main className="flex-1 px-5 py-8 sm:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
