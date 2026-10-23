/**
 * WhatsApp Cloud API (Meta): verificación del webhook, firma de los eventos y envío de texto.
 * Todo queda inactivo mientras no existan los secretos WHATSAPP_* (el webhook responde 503).
 */

export interface IncomingWhatsAppMessage {
  /** Id del mensaje en WhatsApp (wamid): sirve para no procesar dos veces un reintento. */
  id: string
  /** Teléfono del cliente, solo dígitos. */
  from: string
  name?: string
  /** Texto, o null si no es texto (imagen, audio, documento…). */
  text: string | null
  type: string
}

const encoder = new TextEncoder()

const toHex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')

/** Comprueba X-Hub-Signature-256 (HMAC-SHA256 del cuerpo crudo con el secreto de la app de Meta). */
export async function verifySignature(appSecret: string, rawBody: string, header: string | undefined): Promise<boolean> {
  if (!header?.startsWith('sha256=')) return false
  const expected = header.slice('sha256='.length).toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(expected)) return false
  const key = await crypto.subtle.importKey('raw', encoder.encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const actual = toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody)))
  // Comparación sin cortocircuito.
  let diff = actual.length ^ expected.length
  for (let i = 0; i < actual.length; i += 1) diff |= actual.charCodeAt(i) ^ (expected.charCodeAt(i) || 0)
  return diff === 0
}

interface WebhookPayload {
  entry?: {
    changes?: {
      value?: {
        contacts?: { wa_id?: string; profile?: { name?: string } }[]
        messages?: { id?: string; from?: string; type?: string; text?: { body?: string } }[]
      }
    }[]
  }[]
}

/** Extrae los mensajes entrantes del evento de Meta. Ignora estados de entrega y datos incompletos. */
export function parseWebhook(payload: unknown): IncomingWhatsAppMessage[] {
  const found: IncomingWhatsAppMessage[] = []
  for (const entry of (payload as WebhookPayload)?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const names = new Map((change.value?.contacts ?? []).map((c) => [c.wa_id ?? '', c.profile?.name]))
      for (const m of change.value?.messages ?? []) {
        if (!m.id || !m.from) continue
        const from = m.from.replace(/\D/g, '')
        if (!from) continue
        found.push({
          id: m.id,
          from,
          name: names.get(m.from) ?? undefined,
          type: m.type ?? 'unknown',
          text: m.type === 'text' && m.text?.body?.trim() ? m.text.body.trim().slice(0, 4000) : null,
        })
      }
    }
  }
  return found
}

export interface WhatsAppConfig {
  accessToken: string
  phoneNumberId: string
}

export function readWhatsAppConfig(env: Env): WhatsAppConfig | null {
  const accessToken = env.WHATSAPP_ACCESS_TOKEN?.trim()
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID?.trim()
  return accessToken && phoneNumberId ? { accessToken, phoneNumberId } : null
}

export class WhatsAppSendError extends Error {}

/** Envía un mensaje de texto. WhatsApp solo deja escribir libremente dentro de las 24 h del último mensaje del cliente. */
export async function sendWhatsAppText(config: WhatsAppConfig, to: string, body: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const response = await fetchImpl(`https://graph.facebook.com/v21.0/${encodeURIComponent(config.phoneNumberId)}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.accessToken}` },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body, preview_url: false } }),
  })
  if (!response.ok) throw new WhatsAppSendError(`whatsapp: ${response.status}`)
}
