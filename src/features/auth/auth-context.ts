import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'
import type { StaffIdentity } from '../../../shared/api/contracts'

export type AuthStatus = 'unconfigured' | 'loading' | 'signed_out' | 'signed_in'

export interface AuthContextValue {
  status: AuthStatus
  session: Session | null
  /** Devuelve un mensaje de error para mostrar, o null si inició sesión. */
  signIn: (email: string, password: string) => Promise<string | null>
  /** Crea la cuenta (sin acceso al panel hasta que administración la apruebe). Devuelve un error o el siguiente paso. */
  signUp: (input: SignUpInput) => Promise<{ error: string } | { error: null; needsConfirmation: boolean; accessToken: string | null }>
  /** Envía el enlace para restablecer la contraseña. Devuelve un error para mostrar, o null. */
  requestPasswordReset: (email: string) => Promise<string | null>
  /** Guarda la contraseña nueva de quien llegó por el enlace del correo. Devuelve un error o null. */
  updatePassword: (password: string) => Promise<string | null>
  /** La persona llegó por el enlace de «restablecer contraseña» y debe elegir una nueva. */
  recovering: boolean
  signOut: () => Promise<void>
}

export interface SignUpInput {
  firstName: string
  lastName: string
  email: string
  password: string
}

/** Largo mínimo de la contraseña (el mismo que exige Supabase en su configuración). */
export const MIN_PASSWORD_LENGTH = 8

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

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Mensaje si la contraseña no sirve (o no coincide con su repetición); null si está bien. */
export function validateNewPassword(password: string, repeat: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`
  if (password !== repeat) return 'Las contraseñas no coinciden.'
  return null
}

/** Mensaje si falta o está mal algún dato para crear la cuenta; null si todo está bien. */
export function validateSignUp(input: SignUpInput, repeat: string): string | null {
  if (!input.firstName.trim() || !input.lastName.trim()) return 'Ingresa tu nombre y tu apellido.'
  if (!EMAIL.test(input.email.trim())) return 'Ingresa un correo válido.'
  return validateNewPassword(input.password, repeat)
}
