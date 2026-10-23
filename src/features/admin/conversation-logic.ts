import type { ConversationChannel, ConversationStatus, MessageRole } from '../../../shared/api/panel-contracts'
import type { StatusTone } from './panel-logic'

/** Textos y reglas de presentación de las conversaciones. Sin React: se prueban solos. */

export const conversationStatusLabels: Record<ConversationStatus, string> = {
  // El asistente atiende siempre. "Por revisar" = el equipo debe mirar algo (contactar, logo, a medida…).
  needs_human: 'Por revisar',
  with_human: 'Revisada por el equipo',
  open: 'Atendida por el asistente',
  closed: 'Cerrada',
}

export const conversationChannelLabels: Record<ConversationChannel, string> = {
  web_chat: 'Chat web',
  whatsapp: 'WhatsApp',
}

export const messageRoleLabels: Record<MessageRole, string> = {
  customer: 'Cliente',
  assistant: 'Asistente',
  staff: 'Equipo',
  system: 'Sistema',
}

export function conversationTone(status: ConversationStatus): StatusTone {
  if (status === 'needs_human') return 'warn'
  if (status === 'with_human') return 'info'
  if (status === 'open') return 'good'
  return 'muted'
}

/** Filtros de la bandeja, en el orden en que se muestran. `null` = todas. */
export const conversationFilters: { key: string; status: ConversationStatus | null; label: string }[] = [
  { key: 'esperan', status: 'needs_human', label: 'Por revisar' },
  { key: 'asistente', status: 'open', label: 'Atendidas por el asistente' },
  { key: 'cerradas', status: 'closed', label: 'Cerradas' },
  { key: 'todas', status: null, label: 'Todas' },
]

export function contactLabel(item: { contactName: string | null; contactPhone: string | null }): string {
  return item.contactName ?? item.contactPhone ?? 'Visitante de la web'
}

/** Recorta un mensaje para la lista sin cortar a media palabra. */
export function preview(text: string | null | undefined, max = 90): string {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

/** "hace 5 min", "hace 3 h", "hace 2 d" a partir de una fecha ISO. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000))
  if (minutes < 1) return 'ahora'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  return `hace ${Math.floor(hours / 24)} d`
}
