import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet } from 'react-router'
import { getSupabase } from '../../lib/supabase'
import { AuthContext, type AuthContextValue, type AuthStatus } from './auth-context'

interface AuthState {
  status: AuthStatus
  session: Session | null
}

/**
 * Ruta contenedora del login y del panel: mantiene la sesión de Supabase.
 * Se carga bajo demanda, así la web pública no descarga el cliente de autenticación.
 */
export function AuthRoot() {
  const client = getSupabase()
  const [state, setState] = useState<AuthState>(() => ({
    status: client ? 'loading' : 'unconfigured',
    session: null,
  }))

  useEffect(() => {
    if (!client) return
    // Emite INITIAL_SESSION al suscribirse y luego cada inicio, cierre o renovación.
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setState({ status: session ? 'signed_in' : 'signed_out', session })
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

  const signOut = useCallback(async () => {
    await client?.auth.signOut()
  }, [client])

  const value = useMemo<AuthContextValue>(
    () => ({ status: state.status, session: state.session, signIn, signOut }),
    [state, signIn, signOut],
  )

  return (
    <AuthContext.Provider value={value}>
      <Outlet />
    </AuthContext.Provider>
  )
}
