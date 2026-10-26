import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet } from 'react-router'
import { getSupabase } from '../../lib/supabase'
import { AuthContext, type AuthContextValue, type AuthStatus } from './auth-context'

interface AuthState {
  status: AuthStatus
  session: Session | null
  recovering: boolean
}

/** Dirección del inicio de sesión del panel: a donde vuelve el enlace del correo para restablecer la contraseña. */
const loginUrl = () => `${window.location.origin}${(import.meta.env.VITE_PANEL_BASE || '/panel').replace(/\/$/, '')}/ingresar`

/**
 * Ruta contenedora del login y del panel: mantiene la sesión de Supabase.
 * Se carga bajo demanda, así la web pública no descarga el cliente de autenticación.
 */
export function AuthRoot() {
  const client = getSupabase()
  const [state, setState] = useState<AuthState>(() => ({
    status: client ? 'loading' : 'unconfigured',
    session: null,
    recovering: false,
  }))

  useEffect(() => {
    if (!client) return
    // Emite INITIAL_SESSION al suscribirse y luego cada inicio, cierre o renovación.
    const { data } = client.auth.onAuthStateChange((event, session) => {
      setState((prev) => ({
        status: session ? 'signed_in' : 'signed_out',
        session,
        // Quien abre el enlace del correo entra con una sesión de recuperación y debe elegir su contraseña nueva.
        recovering: session ? event === 'PASSWORD_RECOVERY' || prev.recovering : false,
      }))
    })
    return () => data.subscription.unsubscribe()
  }, [client])

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!client) return 'La autenticación no está configurada.'
      const { error } = await client.auth.signInWithPassword({ email, password })
      if (!error) return null
      if (error.code === 'invalid_credentials') return 'Correo o contraseña incorrectos.'
      if (error.status === 429) return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'
      return 'No se pudo iniciar sesión. Intenta nuevamente.'
    },
    [client],
  )

  const signUp = useCallback<AuthContextValue['signUp']>(
    async ({ firstName, lastName, email, password }) => {
      if (!client) return { error: 'La autenticación no está configurada.' }
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { data: { full_name: `${firstName} ${lastName}`.trim(), first_name: firstName, last_name: lastName }, emailRedirectTo: loginUrl() },
      })
      if (error) {
        if (error.code === 'signup_disabled') return { error: 'El registro de cuentas no está habilitado todavía. Pide a administración que lo active.' }
        if (error.code === 'weak_password') return { error: 'La contraseña es muy débil. Usa al menos 8 caracteres.' }
        if (error.status === 429) return { error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' }
        return { error: 'No se pudo crear la cuenta. Intenta nuevamente.' }
      }
      // Sin sesión: Supabase pide confirmar el correo primero.
      return { error: null, needsConfirmation: !data.session }
    },
    [client],
  )

  const requestPasswordReset = useCallback(
    async (email: string) => {
      if (!client) return 'La autenticación no está configurada.'
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: loginUrl() })
      if (!error) return null
      if (error.status === 429) return 'Ya enviamos un correo hace poco. Espera unos minutos e inténtalo de nuevo.'
      return 'No se pudo enviar el correo. Intenta nuevamente.'
    },
    [client],
  )

  const updatePassword = useCallback(
    async (password: string) => {
      if (!client) return 'La autenticación no está configurada.'
      const { error } = await client.auth.updateUser({ password })
      if (!error) {
        setState((prev) => ({ ...prev, recovering: false }))
        return null
      }
      if (error.code === 'same_password') return 'Elige una contraseña distinta a la anterior.'
      if (error.code === 'weak_password') return 'La contraseña es muy débil. Usa al menos 8 caracteres.'
      return 'No se pudo cambiar la contraseña. Pide un enlace nuevo e inténtalo de nuevo.'
    },
    [client],
  )

  const signOut = useCallback(async () => {
    await client?.auth.signOut()
  }, [client])

  const value = useMemo<AuthContextValue>(
    () => ({ status: state.status, session: state.session, recovering: state.recovering, signIn, signUp, requestPasswordReset, updatePassword, signOut }),
    [state, signIn, signUp, requestPasswordReset, updatePassword, signOut],
  )

  return (
    <AuthContext.Provider value={value}>
      <Outlet />
    </AuthContext.Provider>
  )
}
