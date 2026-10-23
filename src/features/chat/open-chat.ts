/** Abre el chat desde cualquier parte de la web, opcionalmente enviando ya un primer mensaje. */
export const OPEN_CHAT_EVENT = 'woodland:open-chat'

export function openChat(message?: string) {
  window.dispatchEvent(new CustomEvent<string | undefined>(OPEN_CHAT_EVENT, { detail: message }))
}
