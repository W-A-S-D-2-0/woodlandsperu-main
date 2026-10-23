import { Navigate, Outlet } from 'react-router'
import { useStaffSession } from '../auth/auth-context'

/**
 * Rutas solo para administración. El taller vuelve a su inicio (producción).
 * Es una comodidad de la interfaz: la API y RLS exigen el rol en cada operación.
 */
export function AdminOnly() {
  const { staff } = useStaffSession()
  return staff.role === 'admin' ? <Outlet /> : <Navigate to="/produccion" replace />
}
