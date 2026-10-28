import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router'
import { CHAT_MESSAGE_MAX, type ChatMessage, type ChatResponse, type ChatStatus } from '../../../shared/api/chat'
import { chatGreeting } from '../../content/chat-greeting'
import { AuthedImage } from '../../components/ui/AuthedImage'
import { CHOICE_DEPOSIT, CHOICE_YAPE_PLIN, PAYMENT_CHOICE_LABEL, PROOF_BUTTON_LABEL } from '../../content/payment'
import { useBackdropTone } from '../../hooks/useBackdropTone'
import { ApiError, apiFetch } from '../../lib/api'
import { chatImage, createChatToken, flowChips, lastMessageId, mergeMessages, messageTime, parseBody, parseProductRows, startsNewConversation, statusNotice, trailingWarnings, transientMessages, withoutProductRows } from './chat-logic'
import { AppointmentCard } from './AppointmentCard'
import { ChatBody } from './ChatBody'
import { ChatChips } from './ChatChips'
import { OrderCard } from './OrderCard'
import { OPEN_CHAT_EVENT } from './open-chat'

const PROOF_MAX_BYTES = 5 * 1024 * 1024
const POLL_MS = 6000
const TEASER_DELAY_MS = 6000
const CATALOG_SELECTOR = '[aria-labelledby="catalog-pan-title"]'

const GREETING: ChatMessage = {
  id: 0,
  role: 'assistant',
  body: chatGreeting,
  createdAt: '',
}

const QUICK_REPLIES = ['Ver los productos', 'Ver los precios', 'Quiero hacer un pedido', 'Pedido para mi empresa']
const YES_NO = ['Sí', 'No']
const PAYMENT_CHOICES = [CHOICE_YAPE_PLIN, CHOICE_DEPOSIT]
const APPOINTMENT_CHIP = { label: '📅 Agendar cita', value: '__agendar_cita__' }
const ADD_MORE_CHIP = { label: 'Agregar otra tabla', value: 'Agregar otra tabla' }
// Salida de cualquier conversación: nunca desaparece de las respuestas rápidas.
const ALWAYS_REPLY = 'Ver los productos'

const bubble: Record<string, string> = {
  customer: 'ml-auto animate-msg-right rounded-br-md bg-nogal text-marfil shadow-sm',
  assistant: 'mr-auto animate-msg-left rounded-bl-md border border-linea/70 bg-white text-carbon shadow-sm',
  staff: 'mr-auto animate-msg-left rounded-bl-md border border-madera bg-white shadow-sm',
  system: 'mx-auto text-xs text-carbon-600',
}

/** Avatar de Teca: la marca de Woodland dentro de un círculo de nogal. */
function Avatar({ size = 'size-10', pulse = false }: { size?: string; pulse?: boolean }) {
  return (
    <span className={`relative inline-flex ${size} shrink-0 items-center justify-center rounded-full bg-nogal-800 ring-2 ring-brasa/70`}>
      <img src="/images/brand/logo-mark.png" alt="" className="size-[68%] object-contain" />
      <span className={`absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-nogal bg-selva ${pulse ? 'animate-halo' : ''}`} aria-hidden="true" />
    </span>
  )
}

function ClipIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m21 11-8.6 8.6a5 5 0 0 1-7.1-7.1l9-9a3.3 3.3 0 0 1 4.7 4.7l-9 9a1.7 1.7 0 0 1-2.4-2.4l8.3-8.3" />
    </svg>
  )
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" aria-hidden="true">
      {[0, 160, 320].map((d) => (
        <span key={d} className="size-1.5 animate-dot rounded-full bg-madera" style={{ animationDelay: `${d}ms` }} />
      ))}
    </span>
  )
}

/** Chat flotante con el asistente de Woodland. Cada carga de la página empieza una conversación nueva (el equipo conserva las anteriores en el panel). */
export function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  // Globo de bienvenida junto al botón: sale a los pocos segundos y, si se cierra, no vuelve en esta visita.
  const [teaser, setTeaser] = useState(false)
  const teaserDismissed = useRef(false)
  // Mensaje de Teca que se está escribiendo ahora (solo el recién llegado, nunca los recuperados).
  const [typingId, setTypingId] = useState<number | null>(null)
  const [away, setAway] = useState(false)
  // Tarjeta para agendar una cita con la administración.
  const [scheduling, setScheduling] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [status, setStatus] = useState<ChatStatus>('open')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  // Mensaje ya enviado a la espera de respuesta: se ve al instante en la conversación.
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Captura del pago en camino al servidor.
  const [uploading, setUploading] = useState(false)
  // Vista previa de la captura mientras se sube.
  const [preview, setPreview] = useState<string | null>(null)
  const tokenRef = useRef<string | null>(null)
  const listRef = useRef<HTMLOListElement>(null)
  const lastIdRef = useRef(0)
  const sendingRef = useRef(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  // Sobre fondos oscuros el botón pasa a brasa; sobre claros se queda en nogal.
  const tone = useBackdropTone(buttonRef)
  const titleId = useId()

  // Solo en la portada: en las demás páginas el globo taparía lo que se está leyendo.
  const { pathname } = useLocation()
  useEffect(() => {
    if (pathname !== '/') return
    const id = window.setTimeout(() => {
      if (!teaserDismissed.current) setTeaser(true)
    }, TEASER_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [pathname])

  const dismissTeaser = () => {
    teaserDismissed.current = true
    setTeaser(false)
  }

  const token = () => (tokenRef.current ??= createChatToken())

  const poll = useCallback(async (after: number) => {
    try {
      const res = await apiFetch<ChatResponse>(`/api/chat/messages?token=${encodeURIComponent(token())}&after=${after}`)
      if (sendingRef.current) return
      setStatus(res.status)
      if (res.messages.length > 0) setMessages((current) => mergeMessages(current, res.messages))
    } catch {
      // Sin conexión: se reintenta en el próximo ciclo.
    }
  }, [])

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Al abrir se recupera la conversación guardada; mientras está abierto se consultan las respuestas del equipo.
  useEffect(() => {
    if (!open) return
    const first = window.setTimeout(() => void poll(0), 0)
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void poll(lastIdRef.current)
    }, POLL_MS)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(id)
    }
  }, [open, poll])

  useEffect(() => {
    lastIdRef.current = lastMessageId(messages)
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages, open, pending])

  async function submit(event?: FormEvent, preset?: string) {
    event?.preventDefault()
    const message = (preset ?? text).trim()
    if (!message || sending) return
    // Tras cancelar o terminar una operación, «Hola» o un botón empiezan otra conversación (queda aparte en el panel).
    let shown = messages
    if (startsNewConversation(messages.at(-1), message, preset !== undefined)) {
      shown = []
      tokenRef.current = createChatToken()
      lastIdRef.current = 0
      setMessages([])
      setStatus('open')
      setTypingId(null)
    }
    // El campo se vacía y el mensaje aparece de inmediato; si falla, se devuelve al campo para reintentar.
    setText('')
    setPending(message)
    sendingRef.current = true
    setSending(true)
    setError(null)
    try {
      const res = await apiFetch<ChatResponse>('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // `greeted`: el saludo (que pide el nombre) ya se mostró; el servidor lo guarda como primer mensaje.
        body: JSON.stringify({ token: token(), message, greeted: true, warnings: trailingWarnings(shown) }),
      })
      if (res.transient) {
        // Agresión verbal: el servidor no guardó nada; el intercambio se muestra aquí y no queda en el panel.
        const exchange = transientMessages(shown, message, res.transient.reply)
        setMessages((current) => mergeMessages(current, exchange))
        setTypingId(exchange[1]!.id)
        return
      }
      setStatus(res.status)
      setMessages((current) => mergeMessages(current, res.messages))
      setTypingId(res.messages.filter((m) => m.role === 'assistant').at(-1)?.id ?? null)
    } catch (err) {
      setText(message)
      setError(err instanceof ApiError && err.status !== 0 ? err.message : 'Uy, no pude enviar tu mensaje. Parece que se cortó la conexión.')
    } finally {
      setPending(null)
      sendingRef.current = false
      setSending(false)
    }
  }

  // Captura del pago: se sube al servidor, que deja el pedido pagado y responde en el chat.
  async function uploadProof(file: File) {
    if (uploading || sending) return
    if (!file.type.startsWith('image/')) {
      setError('Sube la captura como imagen (JPG, PNG o WebP).')
      return
    }
    if (file.size > PROOF_MAX_BYTES) {
      setError('La imagen es muy pesada (máximo 5 MB).')
      return
    }
    setError(null)
    setUploading(true)
    setPreview(URL.createObjectURL(file))
    sendingRef.current = true
    try {
      const form = new FormData()
      form.set('token', token())
      form.set('file', file)
      const res = await apiFetch<ChatResponse>('/api/chat/payment-proof', { method: 'POST', body: form })
      setStatus(res.status)
      setMessages((current) => mergeMessages(current, res.messages))
      setTypingId(res.messages.filter((m) => m.role === 'assistant').at(-1)?.id ?? null)
    } catch (err) {
      setError(err instanceof ApiError && err.status !== 0 ? err.message : 'No pude subir la captura. Revisa tu conexión e inténtalo de nuevo.')
    } finally {
      sendingRef.current = false
      setUploading(false)
      setPreview((url) => {
        if (url) URL.revokeObjectURL(url)
        return null
      })
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // Desde cualquier botón de la web se abre el chat, a veces con el primer mensaje ya escrito.
  const onScroll = () => {
    const list = listRef.current
    if (list) setAway(list.scrollHeight - list.scrollTop - list.clientHeight > 120)
  }

  // «Ver todo en la web»: solo si la página actual tiene el capítulo del catálogo. Cierra el chat y baja hasta él.
  const catalogOnPage = typeof document !== 'undefined' && !!document.querySelector(CATALOG_SELECTOR)
  const seeCatalog = () => {
    setOpen(false)
    document.querySelector(CATALOG_SELECTOR)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  const submitRef = useRef(submit)
  useEffect(() => {
    submitRef.current = submit
  })
  useEffect(() => {
    const onOpen = (event: Event) => {
      dismissTeaser()
      setOpen(true)
      const message = (event as CustomEvent<string | undefined>).detail
      if (message) void submitRef.current(undefined, message)
    }
    window.addEventListener(OPEN_CHAT_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_CHAT_EVENT, onOpen)
  }, [])

  // Atajos de respuesta: al comenzar, y «Sí/No» cuando el asistente pregunta eso.
  const last = messages.at(-1)
  const asked = new Set(messages.filter((m) => m.role === 'customer').map((m) => m.body))
  const inFlow = !!last && last.body.includes('Pedido paso a paso')
  // Teca pidió el pago y espera la captura: el botón para subirla se destaca.
  const awaitingProof = !uploading && !!last && last.role !== 'customer' && last.body.includes(PROOF_BUTTON_LABEL)
  // La pregunta de los modelos se contesta en la tarjeta del pedido (modelo, cantidad y grabado), no con botones.
  const orderRows = !pending && !uploading && inFlow && last && last.role !== 'customer' ? parseProductRows(last.body) : null
  const chips = pending || uploading || awaitingProof || orderRows
    ? []
    : !last
      ? QUICK_REPLIES
      : last.role !== 'customer' && last.body.includes(PAYMENT_CHOICE_LABEL)
        ? // En el resumen del pedido (paso a paso) también se puede sumar otra tabla.
          inFlow
          ? [...PAYMENT_CHOICES, ADD_MORE_CHIP]
          : PAYMENT_CHOICES
        : last.role !== 'customer' && inFlow && flowChips(last.body)
        ? flowChips(last.body)!
        : last.role !== 'customer' && last.body.includes('(sí/no)')
        ? YES_NO
        : last.role !== 'customer' && !inFlow
          ? QUICK_REPLIES.filter((q) => q === ALWAYS_REPLY || !asked.has(q))
          : []
  // «Agendar cita» siempre está a mano: quien prefiere hablar con la administración no depende del horario del equipo.
  const rowChips = pending || uploading || scheduling ? [] : [...chips, APPOINTMENT_CHIP]
  const notice = statusNotice(status)
  // El servidor guarda el saludo en la conversación: no se muestra dos veces.
  const shown = [GREETING, ...messages.filter((m) => m.body !== GREETING.body)]

  return (
    <div className="fixed right-4 bottom-4 z-40 sm:right-6 sm:bottom-6">
      {open && (
        <section
          role="dialog"
          aria-labelledby={titleId}
          className={`relative mb-3 flex ${expanded ? 'h-[calc(100dvh-6rem)] w-[min(48rem,calc(100vw-2rem))]' : 'h-[min(38rem,calc(100dvh-6rem))] w-[min(26rem,calc(100vw-2rem))]'} max-sm:h-[calc(100dvh-5.5rem)] animate-chat-open flex-col overflow-hidden rounded-3xl border border-linea bg-marfil shadow-2xl shadow-nogal/30`}
        >
          <header className="relative flex items-center gap-3 bg-nogal px-4 py-3.5 text-marfil">
            <Avatar size="size-11" pulse />
            <div className="relative min-w-0 flex-1">
              <h2 id={titleId} className="font-display text-lg leading-tight !text-marfil">
                Teca
              </h2>
              <p className="text-xs text-beige/85">Asistente automático de Woodland · respuestas orientativas</p>
            </div>
            <button
              type="button"
              aria-label={expanded ? 'Reducir el chat' : 'Expandir el chat'}
              aria-pressed={expanded}
              className="relative inline-flex size-11 items-center justify-center rounded-full transition-colors hover:bg-marfil/15 max-sm:hidden"
              onClick={() => setExpanded((v) => !v)}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {expanded ? <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" /> : <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />}
              </svg>
            </button>
            <button type="button" aria-label="Cerrar el chat" className="relative inline-flex size-11 items-center justify-center rounded-full text-xl transition-colors hover:bg-marfil/15" onClick={() => setOpen(false)}>
              ×
            </button>
          </header>

          <div className="relative flex min-h-0 flex-1 flex-col">
          <ol ref={listRef} className="grid flex-1 content-start gap-2.5 overflow-y-auto bg-[radial-gradient(circle_at_top,var(--color-beige)_0%,var(--color-marfil)_70%)] p-4" aria-live="polite" aria-label="Conversación" onScroll={onScroll}>
            {shown.map((m) => (
              <li key={m.id} className={`${m.role !== 'customer' && parseBody(m.body).some((b) => b.kind !== 'text') ? 'w-full max-w-full' : 'max-w-[85%]'} rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${bubble[m.role] ?? bubble.system}`}>
                {m.role === 'staff' && <span className="mb-0.5 block text-[0.7rem] font-semibold tracking-[0.08em] text-madera-700 uppercase">Equipo Woodland</span>}
                {m.role === 'customer' ? m.body : <ChatBody body={parseProductRows(m.body) ? withoutProductRows(m.body) : m.body} typing={m.id === typingId} onAsk={(message) => void submit(undefined, message)} onSeeAll={catalogOnPage ? seeCatalog : undefined} onCancel={m.id === last?.id && !pending && !uploading ? () => void submit(undefined, 'cancelar') : undefined} onSchedule={() => setScheduling(true)} />}
                {m.id === last?.id && orderRows && <OrderCard rows={orderRows} onSubmit={(message) => void submit(undefined, message)} />}
                {m.attachment && (
                  <div className="mt-2">
                    <AuthedImage cacheKey={`${tokenRef.current}:${m.id}`} alt="Captura de tu pago" load={() => chatImage(m.id, token())} />
                  </div>
                )}
                {messageTime(m.createdAt) && <time dateTime={m.createdAt} className={`mt-1 block text-[0.65rem] ${m.role === 'customer' ? 'text-beige/70' : 'text-carbon-600'}`}>{messageTime(m.createdAt)}</time>}
              </li>
            ))}
            {uploading && (
              <>
                <li className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${bubble.customer}`}>
                  📎 Subiendo tu captura…
                  {preview && <img src={preview} alt="Tu captura" className="mt-2 max-h-40 max-w-full rounded-xl object-contain" />}
                </li>
                <li className={`rounded-2xl px-3.5 py-2 ${bubble.assistant}`} aria-label="Teca está revisando tu pago">
                  <TypingDots />
                </li>
              </>
            )}
            {pending && (
              <>
                <li className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${bubble.customer}`}>{pending}</li>
                <li className={`rounded-2xl px-3.5 py-2 ${bubble.assistant}`} aria-label="Teca está escribiendo">
                  <TypingDots />
                </li>
              </>
            )}
          </ol>
            {scheduling && (
              <AppointmentCard
                token={token}
                onClose={() => setScheduling(false)}
                onBooked={(res) => {
                  setScheduling(false)
                  setStatus(res.status)
                  setMessages((current) => mergeMessages(current, res.messages))
                  setTypingId(res.messages.filter((m) => m.role === 'assistant').at(-1)?.id ?? null)
                }}
              />
            )}
            {away && (
              <button
                type="button"
                aria-label="Ir al último mensaje"
                className="absolute right-4 bottom-3 z-10 inline-flex size-9 animate-chip-in items-center justify-center rounded-full border border-linea bg-white text-nogal shadow-lg transition-transform hover:scale-110"
                onClick={() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })}
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 5v14M6 13l6 6 6-6" />
                </svg>
              </button>
            )}

          </div>

          {rowChips.length > 0 && <ChatChips options={rowChips} onPick={(q) => (q === APPOINTMENT_CHIP.value ? setScheduling(true) : void submit(undefined, q))} />}

          {awaitingProof && (
            <div className="animate-chip-in border-t border-linea px-3 pt-3">
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-full bg-brasa px-4 py-2.5 text-sm font-semibold text-nogal-800 shadow-sm transition-colors hover:bg-ambar"
                onClick={() => fileRef.current?.click()}
              >
                <ClipIcon />
                {PROOF_BUTTON_LABEL}
              </button>
            </div>
          )}

          {notice && <p className="border-t border-linea bg-madera/10 px-4 py-2 text-xs">{notice}</p>}
          {error && (
            <div role="alert" className="flex animate-chip-in items-center justify-between gap-3 border-t border-madera-700/40 bg-madera-700/10 px-4 py-2 text-xs">
              <span>{error}</span>
              <button type="button" disabled={sending || !text.trim()} className="shrink-0 rounded-full bg-nogal px-3 py-1.5 font-semibold text-marfil transition-colors hover:bg-madera-700 disabled:opacity-40" onClick={() => void submit()}>
                Reintentar
              </button>
            </div>
          )}

          <form onSubmit={(e) => void submit(e)} className="flex items-end gap-2 border-t border-linea p-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void uploadProof(file)
              }}
            />
            <button
              type="button"
              aria-label={PROOF_BUTTON_LABEL}
              title={PROOF_BUTTON_LABEL}
              disabled={uploading || sending}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-linea bg-white text-nogal transition-all duration-200 hover:scale-105 hover:bg-beige active:scale-95 disabled:scale-100 disabled:opacity-40"
              onClick={() => fileRef.current?.click()}
            >
              <ClipIcon />
            </button>
            <label className="grid flex-1">
              <span className="sr-only">Tu mensaje</span>
              <textarea
                ref={inputRef}
                className="max-h-28 min-h-11 w-full resize-none rounded-2xl border border-linea bg-white px-3.5 py-2.5 text-sm transition-shadow focus-visible:border-madera focus-visible:shadow-[0_0_0_3px_rgb(181_112_58/0.18)]"
                rows={1}
                maxLength={CHAT_MESSAGE_MAX}
                placeholder="Escríbele a Teca…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) void submit(e)
                }}
              />
            </label>
            <button
              type="submit"
              aria-label="Enviar mensaje"
              disabled={sending || !text.trim()}
              className="group inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-nogal text-marfil transition-all duration-200 hover:scale-105 hover:bg-madera-700 active:scale-95 disabled:scale-100 disabled:opacity-40"
            >
              <svg viewBox="0 0 24 24" className="size-5 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </form>
        </section>
      )}

      {teaser && pathname === '/' && !open && (
        <div className="relative mb-3 ml-auto flex w-fit max-w-[16rem] animate-msg-left items-start gap-2 rounded-2xl rounded-br-md border border-linea bg-white py-2.5 pr-2 pl-3.5 text-sm text-nogal shadow-lg">
          <button type="button" className="text-left" onClick={() => setOpen(true)}>
            ¿Te ayudo a elegir tu tabla?
          </button>
          <button type="button" aria-label="Cerrar el mensaje" className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-carbon-600 hover:bg-beige" onClick={dismissTeaser}>
            ×
          </button>
        </div>
      )}

      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        onClick={() => {
          dismissTeaser()
          setOpen((v) => !v)
        }}
        className={`ml-auto flex min-h-12 items-center gap-2.5 rounded-full py-1.5 pr-5 pl-1.5 text-sm font-semibold shadow-lg transition-all duration-500 hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 ${open ? '' : 'animate-halo'} ${
          tone === 'dark' ? 'bg-brasa text-nogal-800 hover:bg-ambar' : 'bg-nogal text-marfil hover:bg-nogal-800'
        }`}
      >
        <Avatar size="size-9" />
        {open ? 'Cerrar chat' : 'Habla con Teca'}
      </button>
    </div>
  )
}
