import { parseReceiptReading, type ReceiptReading } from '../services/payment-receipt'

/**
 * Lee una captura de Yape o Plin con Gemini (visión). Usa la misma clave del asistente (GEMINI_API_KEY, secreto del
 * Worker). Devuelve null si no hay clave o la IA no responde: entonces el pago queda para revisión del equipo.
 */
/** Lector de constancias: el Flash-Lite es más rápido y suele tener cupo cuando el Flash está saturado. */
const DEFAULT_MODEL = 'gemini-flash-lite-latest'
const FALLBACK_MODEL = 'gemini-flash-latest'
const TIMEOUT_MS = 15_000
/** Google a veces responde 429/500/503 por alta demanda: se reintenta antes de dejar la captura para revisión del equipo. */
const RETRY_STATUSES = new Set([429, 500, 503])
const RETRIES = 1
const RETRY_DELAY_MS = 1_500

const INSTRUCTIONS = `Eres un lector de constancias de pago de Perú. Mira la imagen y responde SOLO con un JSON, sin texto adicional:
{"is_receipt": boolean, "app": "yape" | "plin" | "other", "amount": number | null, "recipient_tail": string | null, "operation_code": string | null, "message": string | null}
Reglas:
- is_receipt es true solo si la imagen es una constancia de una transferencia hecha por Yape (pantalla «¡Yapeaste!», logo morado de Yape) o por Plin (logo de Plin, también desde una app bancaria como Interbank, BBVA, BCP o Scotiabank).
- app es "yape" si es de Yape, "plin" si es de Plin; "other" si no es ninguna de las dos.
- amount es el monto pagado en soles, solo el número (por ejemplo 26.70).
- recipient_tail son los últimos 3 dígitos del celular de destino que se ven en la constancia (por ejemplo "938"); null si no se ven.
- operation_code es el número de operación; null si no se ve.
- message es el texto del mensaje, concepto o descripción que el pagador escribió junto al pago (por ejemplo «PED-000123»); null si la constancia no muestra ninguno.
No inventes datos: si algo no se ve con claridad, usa null.`

function base64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(binary)
}

/** Crea el lector de capturas del turno; null si no hay clave de IA. */
export type ReceiptReaderFactory = (env: Env) => ReceiptReader | null
export const defaultReceiptReader: ReceiptReaderFactory = (env) => createReceiptReader({ apiKey: env.GEMINI_API_KEY })

export type ReceiptReader = (image: { bytes: Uint8Array; contentType: string }) => Promise<ReceiptReading | null>

export function createReceiptReader(options: { apiKey?: string; model?: string; fetchImpl?: typeof fetch; retryDelayMs?: number }): ReceiptReader | null {
  const apiKey = options.apiKey?.trim()
  if (!apiKey) return null
  // Si el primer modelo está saturado, se prueba el siguiente: leer la captura no debe depender de uno solo.
  const models = [options.model?.trim() || DEFAULT_MODEL, FALLBACK_MODEL]
  const doFetch = options.fetchImpl ?? fetch
  return async (image) => {
    const body = JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: INSTRUCTIONS }, { inlineData: { mimeType: image.contentType, data: base64(image.bytes) } }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 2000, responseMimeType: 'application/json' },
    })
    for (const model of models) {
      try {
        const call = () =>
          doFetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
            signal: AbortSignal.timeout(TIMEOUT_MS),
            body,
          })
        let response = await call()
        for (let retry = 0; retry < RETRIES && RETRY_STATUSES.has(response.status); retry++) {
          await new Promise((resolve) => setTimeout(resolve, options.retryDelayMs ?? RETRY_DELAY_MS))
          response = await call()
        }
        if (!response.ok) continue
        const json = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
        const text = (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('')
        const reading = parseReceiptReading(text)
        if (reading) return reading
      } catch {
        // Tiempo agotado o red: se prueba con el siguiente modelo.
      }
    }
    return null
  }
}
