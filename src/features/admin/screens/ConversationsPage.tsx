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
  conversationStatusLabels,
  conversationTone,
  messageRoleLabels,
  preview,
  timeAgo,
} from '../conversation-logic'
import { formatDateTime, quoteStatusLabels } from '../panel-logic'
import { adminImage, useAdminAction, useAdminQuery, type QueryState } from '../use-admin-api'
import { Badge, EmptyState, Notice, PageHeader, primaryButton, QueryView, secondaryButton } from '../ui'

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
  assistant: 'mr-auto bg-beige/70',
  staff: 'ml-auto bg-nogal text-marfil',
  system: 'mx-auto bg-transparent text-xs text-carbon-600',
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
    <ol ref={listRef} className="grid max-h-[28rem] gap-3 overflow-y-auto rounded-2xl border border-linea bg-marfil p-4" aria-label="Mensajes">
      {conversation.messages.map((m) => (
        <li key={m.id} className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${bubble[m.role] ?? bubble.system}`}>
          <p className={`text-[0.7rem] font-semibold tracking-[0.08em] uppercase ${m.role === 'staff' ? 'text-marfil/70' : 'text-carbon-600'}`}>
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
  )
}

function Actions({ conversation, onChanged, onDeleted }: { conversation: ConversationDetail; onChanged: () => void; onDeleted: () => void }) {
  const { run, pending, error } = useAdminAction()
  const [confirming, setConfirming] = useState(false)
  const exec = async (status: 'open' | 'closed') => {
    if (await run('POST', `/conversations/${conversation.id}/status`, { status })) onChanged()
  }
  const remove = async () => {
    if (await run('POST', `/conversations/${conversation.id}/delete`)) onDeleted()
  }
  const { status } = conversation
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-3">
        {status === 'needs_human' && (
          <button type="button" className={primaryButton} disabled={pending} onClick={() => void exec('open')}>
            Marcar como revisada
          </button>
        )}
        {status !== 'closed' && (
          <button type="button" className={secondaryButton} disabled={pending} onClick={() => void exec('closed')}>
            Cerrar
          </button>
        )}
        {confirming ? (
          <>
            <button type="button" className={primaryButton} disabled={pending} onClick={() => void remove()}>
              Sí, eliminar definitivamente
            </button>
            <button type="button" className={secondaryButton} disabled={pending} onClick={() => setConfirming(false)}>
              No, conservar
            </button>
          </>
        ) : (
          <button type="button" className={secondaryButton} disabled={pending} onClick={() => setConfirming(true)}>
            Eliminar chat
          </button>
        )}
      </div>
      {error && <Notice>{error}</Notice>}
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
  // Lo que cambia la conversación (responder, tomarla, cerrarla) también cambia la bandeja.
  const reload = () => {
    reloadDetail()
    onChanged()
  }

  return (
    <QueryView state={state} onRetry={reload}>
      {(c) => (
        <div className="grid gap-5">
          <div>
            <button type="button" className="mb-2 inline-flex min-h-11 items-center text-sm font-medium text-madera-700 hover:underline lg:hidden" onClick={onBack}>
              ← Bandeja
            </button>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-2xl text-nogal">{c.customer?.companyName ?? c.customer?.fullName ?? contactLabel(c)}</h2>
                <p className="mt-1 text-sm text-carbon-600">
                  {conversationChannelLabels[c.channel]}
                  {c.contactPhone && c.contactName ? ` · ${c.contactPhone}` : ''}
                </p>
              </div>
              <Badge tone={conversationTone(c.status)}>{conversationStatusLabels[c.status]}</Badge>
            </div>
            {c.handoffReason && c.status === 'needs_human' && (
              <p className="mt-3 rounded-lg border border-madera bg-madera/10 px-3 py-2 text-sm">
                <strong>Motivo del seguimiento:</strong> {c.handoffReason}
              </p>
            )}
            <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              {c.customer && (
                <Link to={`/clientes/${c.customer.id}`} className="font-medium text-madera-700 hover:underline">
                  Ver cliente →
                </Link>
              )}
              {c.quote && (
                <Link to={`/cotizaciones/${c.quote.id}`} className="font-medium text-madera-700 hover:underline">
                  Cotización {c.quote.code} ({quoteStatusLabels[c.quote.status]}) →
                </Link>
              )}
            </p>
          </div>

          <Notice kind="info">
            El asistente atiende solo esta conversación, con lo que sabe de Woodland. Aquí la supervisas: no se responde desde el panel.
            {c.status === 'needs_human' && ' Está marcada para que revises el motivo y, si hace falta, contactes al cliente por sus datos.'}
          </Notice>
          <Actions conversation={c} onChanged={reload} onDeleted={onDeleted} />
          <Thread conversation={c} />
        </div>
      )}
    </QueryView>
  )
}

function Inbox({
  state,
  reload,
  selected,
  onSelect,
}: {
  state: QueryState<ListResponse<ConversationListItem>>
  reload: () => void
  selected: string | null
  onSelect: (id: string) => void
}) {
  return (
    <QueryView state={state} onRetry={reload}>
      {({ items }) =>
        items.length === 0 ? (
          <EmptyState>No hay conversaciones en esta bandeja.</EmptyState>
        ) : (
          <ul className="grid gap-2">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  aria-current={selected === item.id ? 'true' : undefined}
                  className={`grid w-full gap-1 rounded-2xl border p-4 text-left transition-colors ${
                    selected === item.id ? 'border-nogal bg-white' : 'border-linea bg-white/60 hover:bg-white'
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-nogal">{contactLabel(item)}</span>
                    <span className="shrink-0 text-xs text-carbon-600">{timeAgo(item.lastMessageAt)}</span>
                  </span>
                  <span className="truncate text-sm text-carbon-600">{preview(item.lastMessage?.body) || 'Sin mensajes'}</span>
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge tone={conversationTone(item.status)}>{conversationStatusLabels[item.status]}</Badge>
                    <span className="text-xs text-carbon-600">{conversationChannelLabels[item.channel]}</span>
                    {item.quoteId && <Badge tone="info">Con cotización</Badge>}
                    <span className="text-xs text-carbon-600">· Inició {formatDateTime(item.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )
      }
    </QueryView>
  )
}

export function ConversationsPage() {
  useDocumentTitle('Conversaciones')
  const [params, setParams] = useSearchParams()
  const selected = params.get('c')
  const filter = conversationFilters.find((f) => f.key === params.get('estado')) ?? conversationFilters[0]!
  // La bandeja vive aquí para refrescarla cuando se responde, se toma o se cierra una conversación.
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
      <PageHeader title="Conversaciones" intro="Lo que el asistente atiende por sí solo en el chat web y WhatsApp. Aquí lo supervisas y ves qué dejó marcado para el equipo." />
      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Bandeja">
        {conversationFilters.map((f) => {
          const active = f.key === filter.key
          return (
            <button
              key={f.label}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => update({ estado: f.key, c: null })}
              className={`min-h-11 rounded-full border px-4 text-sm font-medium transition-colors ${
                active ? 'border-nogal bg-nogal text-marfil' : 'border-nogal/30 text-nogal hover:bg-nogal/5'
              }`}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[22rem_1fr]">
        <div className={selected ? 'hidden lg:block' : ''}>
          <Inbox state={inbox.state} reload={inbox.reload} selected={selected} onSelect={(id) => update({ c: id })} />
        </div>
        <section aria-label="Conversación" className={selected ? '' : 'hidden lg:block'}>
          {selected ? (
            <DetailView key={selected} id={selected} onBack={() => update({ c: null })} onChanged={inbox.reload} />
          ) : (
            <EmptyState>Elige una conversación de la bandeja para leerla.</EmptyState>
          )}
        </section>
      </div>
    </div>
  )
}
