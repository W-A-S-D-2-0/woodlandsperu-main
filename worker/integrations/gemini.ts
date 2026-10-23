import { toolDeclarations, type AssistantModel, type HistoryMessage, type ModelCall, type ModelOutput } from '../services/assistant'

/**
 * Adaptador de Google Gemini (API REST). La clave es un secreto del Worker (GEMINI_API_KEY):
 * nunca llega al navegador. Sin clave, el asistente funciona en modo guiado.
 */

/** Alias que Google mantiene apuntando al Flash vigente (los modelos fijos se retiran: gemini-2.5-flash ya no está disponible para cuentas nuevas). */
const DEFAULT_MODEL = 'gemini-flash-latest'
// Un cliente no espera más: pasado este tiempo se responde en modo guiado.
const TIMEOUT_MS = 10_000
/** Google a veces responde 429/503 por alta demanda: se reintenta una vez antes de usar el modo guiado. */
const RETRY_STATUSES = new Set([429, 500, 503])
const RETRY_DELAY_MS = 1_200

interface GeminiPart {
  text?: string
  functionCall?: { name?: string; args?: Record<string, unknown> }
}

/** Gemini espera turnos user/model; el equipo cuenta como "model" y los turnos seguidos se unen. */
export function toGeminiContents(history: HistoryMessage[]) {
  const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = []
  for (const message of history) {
    const role = message.role === 'customer' ? 'user' : 'model'
    const last = contents.at(-1)
    if (last && last.role === role) last.parts.push({ text: message.body })
    else contents.push({ role, parts: [{ text: message.body }] })
  }
  // Debe empezar con un turno del usuario.
  while (contents[0]?.role === 'model') contents.shift()
  return contents
}

export function parseGeminiResponse(json: unknown): ModelOutput {
  const parts = ((json as { candidates?: { content?: { parts?: GeminiPart[] } }[] })?.candidates?.[0]?.content?.parts ?? []) as GeminiPart[]
  const text = parts
    .map((p) => p.text ?? '')
    .join('')
    .trim()
  const raw = parts.find((p) => p.functionCall?.name)?.functionCall
  let call: ModelCall | undefined
  if (raw?.name === 'flag_for_team') call = { name: 'flag_for_team', args: { reason: raw.args?.reason } }
  else if (raw?.name === 'create_quote_request') call = { name: 'create_quote_request', args: raw.args ?? {} }
  else if (raw?.name === 'create_order') call = { name: 'create_order', args: raw.args ?? {} }
  return call ? { text, call } : { text }
}

export function createGeminiModel(options: { apiKey: string; model?: string; fetchImpl?: typeof fetch; retryDelayMs?: number }): AssistantModel {
  const model = options.model?.trim() || DEFAULT_MODEL
  const doFetch = options.fetchImpl ?? fetch
  return {
    async generate({ system, history }) {
      const body = JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: toGeminiContents(history),
        tools: [{ functionDeclarations: toolDeclarations }],
        // Respuestas de chat: poco razonamiento interno para contestar rápido (los modelos Gemini 3 lo aceptan).
        generationConfig: { temperature: 0.3, maxOutputTokens: 1500, thinkingConfig: { thinkingLevel: 'low' } },
      })
      const call = () =>
        doFetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': options.apiKey },
          signal: AbortSignal.timeout(TIMEOUT_MS),
          body,
        })
      let response = await call()
      if (RETRY_STATUSES.has(response.status)) {
        await new Promise((resolve) => setTimeout(resolve, options.retryDelayMs ?? RETRY_DELAY_MS))
        response = await call()
      }
      if (!response.ok) throw new Error(`gemini: ${response.status}`)
      return parseGeminiResponse(await response.json())
    },
  }
}
