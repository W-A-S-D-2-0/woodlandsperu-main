import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'
import type { StaffIdentity } from '../../../shared/api/contracts'

export type AuthStatus = 'unconfigured' | 'loading' | 'signed_out' | 'signed_in'

export interface AuthContextValue {
  status: AuthStatus
  session: Session | null
  /** Devuelve un mensaje de error para mostrar, o null si inició sesión. */
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth debe usarse dentro de <AuthProvider>.')
  return value
}

export interface StaffSession {
  staff: StaffIdentity
  accessToken: string
  signOut: () => Promise<void>
}

export const StaffContext = createContext<StaffSession | null>(null)

/** Personal autenticado y verificado por el backend. Solo dentro de las rutas protegidas del panel. */
export function useStaffSession(): StaffSession {
  const value = useContext(StaffContext)
  if (!value) throw new Error('useStaffSession debe usarse dentro de <RequireStaff>.')
  return value
}

export const roleLabels: Record<StaffIdentity['role'], string> = {
  admin: 'Administración',
  workshop: 'Taller',
}

/**
 * Evita redirecciones abiertas: después del login solo se vuelve a una ruta interna del panel
 * (relativa a /panel, la base del router). Nunca a otro sitio ni de vuelta al login.
 */
export function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || value.startsWith('/ingresar')) {
    return '/'
  }
  return value
}
