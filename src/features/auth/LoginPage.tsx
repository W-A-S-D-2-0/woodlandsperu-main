import { useId, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { apiFetch } from '../../lib/api'
import { PUBLIC_SITE_URL } from '../../lib/public-site'
import { AuthNotice, primaryButtonClass } from './AuthNotice'
import { MIN_PASSWORD_LENGTH, safeNextPath, useAuth, validateNewPassword, validateSignUp } from './auth-context'

const inputClass =
  'mt-2 block min-h-11 w-full rounded-xl border border-linea bg-white px-4 text-base text-carbon transition-colors placeholder:text-carbon-600/60 focus:border-nogal focus:outline-none'

const linkClass = 'underline underline-offset-4 hover:text-nogal'

type View = 'login' | 'signup' | 'forgot'

function Field({ label, name, type = 'text', autoComplete, hint }: { label: string; name: string; type?: string; autoComplete?: string; hint?: string }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-carbon">
        {label}
      </label>
      <input id={id} name={name} type={type} autoComplete={autoComplete} required className={inputClass} aria-describedby={hint ? `${id}-hint` : undefined} />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-carbon-600">
          {hint}
        </p>
      )}
    </div>
  )
}

const Message = ({ tone, children }: { tone: 'error' | 'ok'; children: string }) => (
  <p role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl px-4 py-3 text-sm text-carbon ${tone === 'error' ? 'bg-beige' : 'border border-nogal/30 bg-white'}`}>
    {children}
  </p>
)

const read = (form: HTMLFormElement) => {
  const data = new FormData(form)
  return (name: string) => String(data.get(name) ?? '')
}

/** Inicio de sesión del personal, con crear cuenta y restablecer contraseña en la misma página. */
export function LoginPage() {
  useDocumentTitle('Ingresar')
  const { status, recovering, signIn, signUp, requestPasswordReset, updatePassword } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const next = safeNextPath(params.get('next'))
  const [view, setView] = useState<View>('login')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // Mientras se crea la cuenta no se redirige: primero se muestra el mensaje de bienvenida.
  const [signingUp, setSigningUp] = useState(false)

  const go = (to: View) => {
    setView(to)
    setError(null)
    setDone(null)
  }

  // Quien llegó por el enlace del correo elige aquí su contraseña nueva, aunque ya tenga sesión.
  if (status === 'signed_in' && !recovering && !signingUp) return <Navigate to={next} replace />

  if (status === 'unconfigured') {
    return (
      <AuthNotice title="Acceso no disponible">
        La autenticación del panel no está configurada en este ambiente. Define <code>VITE_SUPABASE_URL</code> y{' '}
        <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> en <code>.env.local</code>.
      </AuthNotice>
    )
  }

  async function submit(event: FormEvent<HTMLFormElement>, run: (get: (name: string) => string) => Promise<void>) {
    event.preventDefault()
    const get = read(event.currentTarget)
    setSubmitting(true)
    setError(null)
    await run(get)
    setSubmitting(false)
  }

  const onLogin = (event: FormEvent<HTMLFormElement>) =>
    submit(event, async (get) => {
      const email = get('email').trim()
      const password = get('password')
      if (!email || !password) return setError('Ingresa tu correo y tu contraseña.')
      const message = await signIn(email, password)
      if (message) setError(message)
      else navigate(next, { replace: true })
    })

  const onSignUp = (event: FormEvent<HTMLFormElement>) =>
    submit(event, async (get) => {
      const input = { firstName: get('firstName').trim(), lastName: get('lastName').trim(), email: get('email').trim(), password: get('password') }
      const problem = validateSignUp(input, get('repeat'))
      if (problem) return setError(problem)
      setSigningUp(true)
      const result = await signUp(input)
      if (!('needsConfirmation' in result)) {
        setSigningUp(false)
        return setError(result.error)
      }
      // Con confirmación de correo la persona aún no tiene sesión y debe abrir el enlace que le llega.
      if (!result.accessToken) {
        setSigningUp(false)
        return setDone('Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.')
      }
      // El backend dice si el correo está autorizado: entra de inmediato o queda a la espera de aprobación.
      const allowed = await apiFetch('/api/admin/me', { headers: { Authorization: `Bearer ${result.accessToken}` } }).then(
        () => true,
        () => false,
      )
      if (!allowed) {
        setSigningUp(false)
        return setDone('Cuenta creada, pero este correo aún no tiene acceso al panel. Administración debe aprobarlo.')
      }
      setDone(`Cuenta creada. ¡Te damos la bienvenida, ${input.firstName}!`)
      window.setTimeout(() => navigate(next, { replace: true }), 1600)
    })

  const onForgot = (event: FormEvent<HTMLFormElement>) =>
    submit(event, async (get) => {
      const email = get('email').trim()
      if (!email) return setError('Ingresa tu correo.')
      const message = await requestPasswordReset(email)
      if (message) setError(message)
      else setDone('Si el correo tiene una cuenta, te enviamos un enlace para elegir una contraseña nueva. Revisa también el spam.')
    })

  const onRecover = (event: FormEvent<HTMLFormElement>) =>
    submit(event, async (get) => {
      const problem = validateNewPassword(get('password'), get('repeat'))
      if (problem) return setError(problem)
      const message = await updatePassword(get('password'))
      if (message) setError(message)
      else navigate(next, { replace: true })
    })

  const feedback = (
    <>
      {error && <Message tone="error">{error}</Message>}
      {done && <Message tone="ok">{done}</Message>}
    </>
  )
  const submitLabel = (idle: string, busy: string) => (submitting ? busy : idle)
  const passwordHint = `Mínimo ${MIN_PASSWORD_LENGTH} caracteres.`

  if (recovering) {
    return (
      <AuthNotice title="Nueva contraseña">
        <p>Elige la contraseña con la que vas a ingresar al panel.</p>
        <form className="mt-8 grid gap-5" onSubmit={onRecover} noValidate>
          <Field label="Contraseña nueva" name="password" type="password" autoComplete="new-password" hint={passwordHint} />
          <Field label="Repite la contraseña" name="repeat" type="password" autoComplete="new-password" />
          {feedback}
          <button type="submit" className={primaryButtonClass} disabled={submitting}>
            {submitLabel('Guardar contraseña', 'Guardando…')}
          </button>
        </form>
      </AuthNotice>
    )
  }

  const tabs: ReadonlyArray<{ key: View; label: string }> = [
    { key: 'login', label: 'Iniciar sesión' },
    { key: 'signup', label: 'Crear cuenta' },
  ]

  return (
    <AuthNotice title={view === 'forgot' ? 'Restablecer contraseña' : 'Panel de Woodland'}>
      {view !== 'forgot' && (
        <div role="tablist" aria-label="Acceso" className="mt-2 grid grid-cols-2 gap-1 rounded-full border border-nogal/20 bg-white p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={view === tab.key}
              onClick={() => go(tab.key)}
              className={`min-h-10 rounded-full text-sm font-semibold transition-colors ${view === tab.key ? 'bg-nogal text-marfil' : 'text-nogal hover:bg-nogal/5'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {view === 'login' && (
        <form className="mt-6 grid gap-5" onSubmit={onLogin} noValidate>
          <Field label="Correo" name="email" type="email" autoComplete="username" />
          <Field label="Contraseña" name="password" type="password" autoComplete="current-password" />
          {feedback}
          <button type="submit" className={primaryButtonClass} disabled={submitting || status === 'loading'}>
            {submitLabel('Ingresar', 'Ingresando…')}
          </button>
          <button type="button" className={`${linkClass} justify-self-start text-xs`} onClick={() => go('forgot')}>
            ¿Olvidaste tu contraseña?
          </button>
        </form>
      )}

      {view === 'signup' && (
        <form className="mt-6 grid gap-5" onSubmit={onSignUp} noValidate>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Nombre" name="firstName" autoComplete="given-name" />
            <Field label="Apellido" name="lastName" autoComplete="family-name" />
          </div>
          <Field label="Correo" name="email" type="email" autoComplete="email" />
          <Field label="Crea tu contraseña" name="password" type="password" autoComplete="new-password" hint={passwordHint} />
          <Field label="Repite la contraseña" name="repeat" type="password" autoComplete="new-password" />
          {feedback}
          <button type="submit" className={primaryButtonClass} disabled={submitting || status === 'loading'}>
            {submitLabel('Crear cuenta', 'Creando…')}
          </button>
          <p className="text-xs">Solo los correos autorizados por Woodland entran al panel.</p>
        </form>
      )}

      {view === 'forgot' && (
        <form className="mt-6 grid gap-5" onSubmit={onForgot} noValidate>
          <p>Escribe tu correo y te enviamos un enlace para elegir una contraseña nueva.</p>
          <Field label="Correo" name="email" type="email" autoComplete="username" />
          {feedback}
          <button type="submit" className={primaryButtonClass} disabled={submitting}>
            {submitLabel('Enviar enlace', 'Enviando…')}
          </button>
          <button type="button" className={`${linkClass} justify-self-start text-xs`} onClick={() => go('login')}>
            ← Volver a iniciar sesión
          </button>
        </form>
      )}

      <p className="mt-8 text-xs">
        <a href={PUBLIC_SITE_URL} className={linkClass}>
          Ir a la web pública
        </a>
      </p>
    </AuthNotice>
  )
}
