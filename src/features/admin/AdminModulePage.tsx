import { useParams } from 'react-router'
import { PendingModule } from '../../components/ui/PendingModule'
import { NotFoundPage } from '../../app/NotFoundPage'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useStaffSession } from '../auth/auth-context'
import { findAdminModule } from './modules'

export function AdminModulePage() {
  const { slug } = useParams()
  const { staff } = useStaffSession()
  const adminModule = findAdminModule(slug)
  useDocumentTitle(adminModule ? `${adminModule.label} · Admin` : 'Página no encontrada')

  if (!adminModule || !adminModule.roles.includes(staff.role)) return <NotFoundPage homeTo="/" />

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl sm:text-4xl">{adminModule.label}</h1>
      <div className="mt-8">
        <PendingModule
          title={`Módulo de ${adminModule.label.toLowerCase()}`}
          phase={adminModule.phase}
          description={adminModule.description}
          planned={adminModule.planned}
        />
      </div>
    </div>
  )
}
