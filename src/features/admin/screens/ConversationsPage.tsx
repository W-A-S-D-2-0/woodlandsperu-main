import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import type { ConversationDetail, ConversationListItem, ListResponse } from '../../../../shared/api/panel-contracts'
import { AuthedImage } from '../../../components/ui/AuthedImage'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { useStaffSession } from '../../auth/auth-context'
import {
  contactLabel,
  conversationChannelLabels,
  conversationFilters,
  conversationNextStep,
  conversationStatusLabels,
  conversationTone,
  messageRoleLabels,
  preview,
  timeAgo,
} from '../conversation-logic'
import { formatDateTime, plural, quoteStatusLabels, whatsappLink } from '../panel-logic'
import { adminImage, useAdminAction, useAdminQuery, type QueryState } from '../use-admin-api'
import { Badge, dangerButton, EmptyState, NextStep, Notice, PageHeader, primaryButtonLarge, QueryView, secondaryButton } from '../ui'

/** Recarga una consulta cada cierto tiempo mientras la pestaña está visible. */
function usePolling(reload: () => void, ms: number) {
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') reload()
    }, ms)
    return () => window.clearInterval(id)
  }, [reload, ms])
}

const bubble: Record<string, string> = {
  customer: 'mr-auto border border-linea bg-white',
  assistant: 'ml-auto bg-beige',
  staff: 'ml-auto bg-nogal text-marfil',
  system: 'mx-auto bg-transparent text-carbon-600',
}

function Thread({ conversation }: { conversation: ConversationDetail }) {
  const { accessToken } = useStaffSession()
  const listRef = useRef<HTMLOListElement>(null)
  const count = conversation.messages.length
  // Solo se desplaza la lista de mensajes, no la página: así no se mueve lo que la persona está mirando.
  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [count, conversation.id])

  return (
    <section aria-labelledby="mensajes" className="grid gap-3">
      <h3 id="mensajes" className="text-2xl">
        La conversación
      </h3>
      <ol ref={listRef} className="grid max-h-[36rem] gap-3 overflow-y-auto rounded-2xl border border-linea bg-marfil p-4" aria-label="Mensajes">
        {conversation.messages.map((m) => (
          <li key={m.id} className={`max-w-[88%] rounded-2xl px-4 py-3 text-lg ${bubble[m.role] ?? bubble.system}`}>
            <p className={`text-sm font-bold ${m.role === 'staff' ? 'text-marfil/80' : 'text-carbon-600'}`}>
              {messageRoleLabels[m.role]} · {formatDateTime(m.createdAt)}
            </p>
            <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
            {m.attachment && (
              <div className="mt-2">
                <AuthedImage cacheKey={`m${m.id}`} alt="Captura de pago del cliente" load={() => adminImage(accessToken, `/conversations/messages/${m.id}/attachment`)} />
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

/** Lo que se hace con la conversación: revisar (acción principal) y, más abajo y aparte, cerrar o eliminar. */
function ReviewAction({ conversation, onChanged }: { conversation: ConversationDetail; onChanged: () => void }) {
  const { run, pending, error } = useAdminAction()
  if (conversation.status !== 'needs_human') return null
  return (
    <div className="grid gap-3">
      <button
        type="button"
        className={primaryButtonLarge}
        disabled={pending}
        onClick={() => void run('POST', `/conversations/${conversation.id}/status`, { status: 'open' }).then((r) => r && onChanged())}
      >
        {pending ? 'Guardando…' : 'Marcar como revisada'}
      </button>
      {error && <Notice>{error}</Notice>}
    </div>
  )
}

function CloseOrDelete({ conversation, onChanged, onDeleted }: { conversation: ConversationDetail; onChanged: () => void; onDeleted: () => void }) {
  const close = useAdminAction()
  const remove = useAdminAction()
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="grid gap-4">
      {conversation.status !== 'closed' && (
        <section aria-labelledby="cerrar" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-linea bg-white p-6">
          <div>
            <h3 id="cerrar" className="font-sans text-xl font-bold text-carbon">
              ¿Ya no hace falta seguirla?
            </h3>
            <p className="text-lg text-carbon-600">Cerrarla la saca de la bandeja. Se guarda como registro.</p>
          </div>
          <button
            type="button"
            className={secondaryButton}
            disabled={close.pending}
            onClick={() => void close.run('POST', `/conversations/${conversation.id}/status`, { status: 'closed' }).then((r) => r && onChanged())}
          >
            Cerrar conversación
          </button>
          {close.error && <Notice>{close.error}</Notice>}
        </section>
      )}

      <section aria-labelledby="eliminar" className="grid gap-4 rounded-2xl border-2 border-dashed border-alerta/30 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 id="eliminar" className="font-sans text-xl font-bold text-alerta">
              ¿Es una prueba o un chat basura?
            </h3>
            <p className="text-lg text-carbon-600">Eliminarlo lo borra para siempre, con todos sus mensajes.</p>
          </div>
          {confirming ? (
            <div className="flex flex-wrap gap-3">
              <button type="button" className={dangerButton} disabled={remove.pending} onClick={() => void remove.run('POST', `/conversations/${conversation.id}/delete`).then((r) => r && onDeleted())}>
                {remove.pending ? 'Eliminando…' : 'Sí, eliminar para siempre'}
              </button>
              <button type="button" className={secondaryButton} disabled={remove.pending} onClick={() => setConfirming(false)}>
                No, conservar
              </button>
            </div>
          ) : (
            <button type="button" className={dangerButton} onClick={() => setConfirming(true)}>
              Eliminar chat
            </button>
          )}
        </div>
        {remove.error && <Notice>{remove.error}</Notice>}
      </section>
    </div>
  )
}

function DetailView({ id, onBack, onChanged }: { id: string; onBack: () => void; onChanged: () => void }) {
  const onDeleted = () => {
    onChanged()
    onBack()
  }
  const { state, reload: reloadDetail } = useAdminQuery<ConversationDetail>(`/conversations/${id}`)
  usePolling(reloadDetail, 10_000)
  // Lo que cambia la conversación (revisarla, cerrarla) también cambia la bandeja.
  const reload = () => {
    reloadDetail()
    onChanged()
  }

  return (
    <QueryView state={state} onRetry={reload}>
      {(c) => {
        const phone = c.contactPhone ?? c.customer?.phone ?? null
        const wa = whatsappLink(phone)
        const next = conversationNextStep(c.status)
        return (
          <div className="grid gap-6">
            <button type="button" className="inline-flex min-h-12 items-center justify-self-start text-base font-bold text-madera-700 hover:underline lg:hidden" onClick={onBack}>
              ← Volver a la bandeja
            </button>

            <header className="grid gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-3xl">{c.customer?.companyName ?? c.customer?.fullName ?? contactLabel(c)}</h2>
                  <p className="mt-1 text-lg text-carbon-600">
                    {conversationChannelLabels[c.channel]}
                    {phone ? ` · ${phone}` : ''} · empezó {formatDateTime(c.createdAt)}
                  </p>
                </div>
                <Badge tone={conversationTone(c.status)}>{conversationStatusLabels[c.status]}</Badge>
              </div>
              <div className="flex flex-wrap gap-3">
                {wa && (
                  <a href={wa} target="_blank" rel="noreferrer" className={secondaryButton}>
                    Escribir por WhatsApp
                  </a>
                )}
                {c.customer && (
                  <Link to={`/clientes/${c.customer.id}`} className={secondaryButton}>
                    Ver cliente
                  </Link>
                )}
                {c.quote && (
                  <Link to={`/cotizaciones/${c.quote.id}`} className={secondaryButton}>
                    Cotización {c.quote.code} · {quoteStatusLabels[c.quote.status]}
                  </Link>
                )}
              </div>
            </header>

            <section aria-label="Qué hacer" className="grid gap-4 rounded-2xl border border-linea bg-white p-5 sm:p-6">
              {c.handoffReason && c.status === 'needs_human' && (
                <div className="grid gap-1 rounded-2xl border-2 border-madera/40 bg-aviso-claro p-5">
                  <p className="text-base font-bold text-aviso">Por qué lo marcó el asistente</p>
                  <p className="text-xl font-semibold text-carbon">{c.handoffReason}</p>
                </div>
              )}
              <NextStep label="Qué hacer" title={next.title} help={next.help}>
                <ReviewAction conversation={c} onChanged={reload} />
              </NextStep>
            </section>

            <Thread conversation={c} />
            <p className="text-base text-carbon-600">
              El asistente responde solo, con lo que sabe de Woodland. Desde el panel no se escribe en el chat: si hace falta, contacta al cliente por WhatsApp.
            </p>

            <CloseOrDelete conversation={c} onChanged={reload} onDeleted={onDeleted} />
          </div>
        )
      }}
    </QueryView>
  )
}

function Inbox({
  state,
  reload,
  selected,
  onSelect,
  hint,
}: {
  state: QueryState<ListResponse<ConversationListItem>>
  reload: () => void
  selected: string | null
  onSelect: (id: string) => void
  hint: string
}) {
  return (
    <QueryView state={state} onRetry={reload}>
      {({ items }) => (
        <div className="grid gap-3">
          <p className="text-lg text-carbon-600">
            <strong className="text-carbon">{plural(items.length, 'conversación', 'conversaciones')}.</strong> {hint}
          </p>
          {items.length === 0 ? (
            <EmptyState>No hay conversaciones aquí. ¡Todo al día!</EmptyState>
          ) : (
            <ul className="grid gap-3">
              {items.map((item) => {
                const active = selected === item.id
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(item.id)}
                      aria-current={active ? 'true' : undefined}
                      className={`grid w-full gap-2 rounded-2xl border-2 bg-white p-4 text-left transition-colors ${
                        active ? 'border-nogal' : 'border-linea hover:border-madera/60'
                      }`}
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-lg font-bold text-carbon">{contactLabel(item)}</span>
                        <span className="shrink-0 text-sm text-carbon-600">{timeAgo(item.lastMessageAt)}</span>
                      </span>
                      {item.status === 'needs_human' && item.handoffReason ? (
                        <span className="rounded-xl bg-aviso-claro px-3 py-2 text-base font-semibold text-aviso">{preview(item.handoffReason, 110)}</span>
                      ) : (
                        <span className="text-base text-carbon-600">{preview(item.lastMessage?.body) || 'Sin mensajes'}</span>
                      )}
                      <span className="flex flex-wrap items-center gap-2 text-sm text-carbon-600">
                        <Badge tone={conversationTone(item.status)}>{conversationStatusLabels[item.status]}</Badge>
                        {conversationChannelLabels[item.channel]}
                        {item.quoteId && ' · con cotización'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </QueryView>
  )
}

export function ConversationsPage() {
  useDocumentTitle('Conversaciones')
  const [params, setParams] = useSearchParams()
  const selected = params.get('c')
  const filter = conversationFilters.find((f) => f.key === params.get('estado')) ?? conversationFilters[0]!
  // La bandeja vive aquí para refrescarla cuando se revisa, se cierra o se elimina una conversación.
  const inbox = useAdminQuery<ListResponse<ConversationListItem>>(filter.status ? `/conversations?status=${filter.status}` : '/conversations')
  usePolling(inbox.reload, 15_000)
  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    setParams(next, { replace: true })
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Conversaciones" />
      {/* En el celular, al leer una conversación los filtros se ocultan: se vuelve con «Volver a la bandeja». */}
      <div
        role="group"
        aria-label="Ver conversaciones"
        className={`-mx-4 mt-6 gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 ${selected ? 'hidden lg:flex' : 'flex'}`}
      >
        {conversationFilters.map((f) => {
          const active = f.key === filter.key
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={active}
              onClick={() => update({ estado: f.key, c: null })}
              className={`min-h-12 shrink-0 rounded-full border-2 px-5 text-base font-bold transition-colors ${
                active ? 'border-nogal bg-nogal text-marfil' : 'border-linea bg-white text-nogal hover:border-nogal'
              }`}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[24rem_1fr]">
        <div className={selected ? 'hidden lg:block' : ''}>
          <Inbox state={inbox.state} reload={inbox.reload} selected={selected} onSelect={(id) => update({ c: id })} hint={filter.hint} />
        </div>
        <section aria-label="Conversación" className={selected ? '' : 'hidden lg:block'}>
          {selected ? (
            <DetailView key={selected} id={selected} onBack={() => update({ c: null })} onChanged={inbox.reload} />
          ) : (
            <EmptyState>Elige una conversación de la lista para leerla.</EmptyState>
          )}
        </section>
      </div>
    </div>
  )
}
