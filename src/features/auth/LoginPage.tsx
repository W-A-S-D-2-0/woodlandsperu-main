import { useId, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { AuthNotice, primaryButtonClass } from './AuthNotice'
import { safeNextPath, useAuth } from './auth-context'
import { PUBLIC_SITE_URL } from '../../lib/public-site'

const inputClass =
  'mt-2 block min-h-11 w-full rounded-xl border border-linea bg-white px-4 text-base text-carbon transition-colors placeholder:text-carbon-600/60 focus:border-nogal focus:outline-none'

export function LoginPage() {
  useDocumentTitle('Ingresar')
  const { status, signIn } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const next = safeNextPath(params.get('next'))
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const emailId = useId()
  const passwordId = useId()
  const errorId = useId()

  if (status === 'signed_in') return <Navigate to={next} replace />

  if (status === 'unconfigured') {
    return (
      <AuthNotice title="Acceso no disponible">
        La autenticación del panel no está configurada en este ambiente. Define{' '}
        <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> en <code>.env.local</code>.
      </AuthNotice>
    )
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')
    if (!email || !password) {
      setError('Ingresa tu correo y tu contraseña.')
      return
    }
    setSubmitting(true)
    setError(null)
    const message = await signIn(email, password)
    setSubmitting(false)
    if (message) setError(message)
    else navigate(next, { replace: true })
  }

  return (
    <AuthNotice title="Ingreso del personal">
      <p>Acceso exclusivo para el equipo de Woodland.</p>
      <form className="mt-8 grid gap-5" onSubmit={onSubmit} noValidate aria-describedby={error ? errorId : undefined}>
        <div>
          <label htmlFor={emailId} className="text-sm font-medium text-carbon">
            Correo
          </label>
          <input id={emailId} name="email" type="email" autoComplete="username" required className={inputClass} />
        </div>
        <div>
          <label htmlFor={passwordId} className="text-sm font-medium text-carbon">
            Contraseña
          </label>
          <input
            id={passwordId}
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={inputClass}
          />
        </div>
        {error && (
          <p id={errorId} role="alert" className="rounded-xl bg-beige px-4 py-3 text-sm text-carbon">
            {error}
          </p>
        )}
        <button type="submit" className={primaryButtonClass} disabled={submitting || status === 'loading'}>
          {submitting ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
      <p className="mt-8 text-xs">
        ¿Olvidaste tu contraseña? Pide a administración que la restablezca. ·{' '}
        <a href={PUBLIC_SITE_URL} className="underline underline-offset-4 hover:text-nogal">
          Ir a la web pública
        </a>
      </p>
    </AuthNotice>
  )
}
