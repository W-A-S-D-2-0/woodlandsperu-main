/**
 * Google Sheets API con cuenta de servicio: JWT RS256 firmado con WebCrypto (sin dependencias),
 * token OAuth y reescritura de hojas. Exportación de una sola vía: vacía y vuelve a escribir cada pestaña.
 * Queda inactiva mientras no existan los secretos GOOGLE_* (el panel oculta el botón).
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SHEETS_URL = 'https://sheets.googleapis.com/v4/spreadsheets'
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const TIMEOUT_MS = 15_000

export type SheetCell = string | number | null

export interface SheetTab {
  title: string
  rows: readonly (readonly SheetCell[])[]
}

export interface GoogleSheetsConfig {
  serviceAccountEmail: string
  /** Clave privada PKCS#8 en PEM (la del JSON de la cuenta de servicio). */
  privateKey: string
  spreadsheetId: string
}

export class GoogleSheetsError extends Error {
  /** Estado HTTP de Google, o null si falló antes (clave inválida, red). */
  status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.status = status
  }
}

export function readGoogleSheetsConfig(env: Env): GoogleSheetsConfig | null {
  const serviceAccountEmail = env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim()
  // En .env y en los secretos de Cloudflare los saltos de línea suelen llegar como "\n" literal.
  const privateKey = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim().replace(/\\n/g, '\n')
  const spreadsheetId = env.GOOGLE_SHEETS_REPORT_ID?.trim()
  return serviceAccountEmail && privateKey && spreadsheetId ? { serviceAccountEmail, privateKey, spreadsheetId } : null
}

export const spreadsheetUrl = (id: string) => `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}`

const encoder = new TextEncoder()

function base64Url(input: ArrayBuffer | string): string {
  const bytes = typeof input === 'string' ? encoder.encode(input) : new Uint8Array(input)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pemToDer(pem: string): ArrayBuffer {
  const body = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '')
  const binary = atob(body)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

/** JWT de la cuenta de servicio (RS256) que Google canjea por un token de acceso. */
export async function signServiceAccountJwt(config: GoogleSheetsConfig, nowSeconds = Math.floor(Date.now() / 1000)): Promise<string> {
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64Url(
    JSON.stringify({ iss: config.serviceAccountEmail, scope: SCOPE, aud: TOKEN_URL, iat: nowSeconds, exp: nowSeconds + 3600 }),
  )
  const unsigned = `${header}.${claims}`
  let signature: ArrayBuffer
  try {
    const key = await crypto.subtle.importKey('pkcs8', pemToDer(config.privateKey), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
    signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(unsigned))
  } catch {
    throw new GoogleSheetsError('La clave privada de la cuenta de servicio no es válida.')
  }
  return `${unsigned}.${base64Url(signature)}`
}

async function accessToken(config: GoogleSheetsConfig, fetchImpl: typeof fetch): Promise<string> {
  const assertion = await signServiceAccountJwt(config)
  const response = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })
  if (!response.ok) throw new GoogleSheetsError(`google token: ${response.status}`, response.status)
  const token = ((await response.json()) as { access_token?: string }).access_token
  if (!token) throw new GoogleSheetsError('google token: respuesta sin access_token')
  return token
}

/**
 * Reescribe las pestañas indicadas: crea las que falten, vacía las tres y escribe los valores.
 * Se escribe como texto/números (RAW): un nombre de cliente que empiece con "=" no se evalúa como fórmula.
 */
export async function writeSheets(config: GoogleSheetsConfig, tabs: readonly SheetTab[], fetchImpl: typeof fetch = fetch): Promise<void> {
  const token = await accessToken(config, fetchImpl)
  const base = `${SHEETS_URL}/${encodeURIComponent(config.spreadsheetId)}`

  const call = async (url: string, init: { method?: string; json?: unknown } = {}): Promise<unknown> => {
    const response = await fetchImpl(url, {
      method: init.method ?? 'GET',
      headers: { authorization: `Bearer ${token}`, ...(init.json === undefined ? {} : { 'content-type': 'application/json' }) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: init.json === undefined ? undefined : JSON.stringify(init.json),
    })
    if (!response.ok) throw new GoogleSheetsError(`google sheets: ${response.status}`, response.status)
    return response.json()
  }

  const meta = (await call(`${base}?fields=sheets.properties.title`)) as { sheets?: { properties?: { title?: string } }[] }
  const existing = new Set((meta.sheets ?? []).map((s) => s.properties?.title))
  const missing = tabs.filter((t) => !existing.has(t.title))
  if (missing.length > 0) {
    await call(`${base}:batchUpdate`, {
      method: 'POST',
      json: { requests: missing.map((t) => ({ addSheet: { properties: { title: t.title } } })) },
    })
  }

  await call(`${base}/values:batchClear`, { method: 'POST', json: { ranges: tabs.map((t) => quoteTitle(t.title)) } })
  await call(`${base}/values:batchUpdate`, {
    method: 'POST',
    json: {
      valueInputOption: 'RAW',
      data: tabs.map((t) => ({ range: `${quoteTitle(t.title)}!A1`, values: t.rows.map((row) => row.map((cell) => cell ?? '')) })),
    },
  })
}

/** Nombre de pestaña en notación A1 (entre comillas simples). */
const quoteTitle = (title: string) => `'${title.replace(/'/g, "''")}'`
