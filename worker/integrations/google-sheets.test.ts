import { describe, expect, it, vi } from 'vitest'
import { GoogleSheetsError, readGoogleSheetsConfig, signServiceAccountJwt, writeSheets, type GoogleSheetsConfig } from './google-sheets'
import { generateTestKeys as testKeys } from './test-keys'

const fromBase64Url = (value: string) => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
const decodeJson = (part: string) => JSON.parse(new TextDecoder().decode(fromBase64Url(part))) as Record<string, unknown>

const baseConfig = (privateKey: string): GoogleSheetsConfig => ({
  serviceAccountEmail: 'woodland@proyecto.iam.gserviceaccount.com',
  privateKey,
  spreadsheetId: 'hoja-123',
})

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('readGoogleSheetsConfig', () => {
  it('queda inactiva si falta cualquiera de los tres secretos', () => {
    const full = { GOOGLE_SERVICE_ACCOUNT_EMAIL: 'a@b.iam.gserviceaccount.com', GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: 'k', GOOGLE_SHEETS_REPORT_ID: 'id' }
    expect(readGoogleSheetsConfig(full as unknown as Env)).not.toBeNull()
    for (const key of Object.keys(full)) {
      expect(readGoogleSheetsConfig({ ...full, [key]: ' ' } as unknown as Env)).toBeNull()
    }
    expect(readGoogleSheetsConfig({} as Env)).toBeNull()
  })

  it('convierte los \\n literales de la clave en saltos de línea', () => {
    const env = { GOOGLE_SERVICE_ACCOUNT_EMAIL: 'a@b', GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: 'L1\\nL2', GOOGLE_SHEETS_REPORT_ID: 'id' }
    expect(readGoogleSheetsConfig(env as unknown as Env)?.privateKey).toBe('L1\nL2')
  })
})

describe('signServiceAccountJwt', () => {
  it('firma RS256 con los datos de la cuenta y la firma verifica con la clave pública', async () => {
    const { pem, publicKey } = await testKeys()
    const jwt = await signServiceAccountJwt(baseConfig(pem), 1_000)
    const [header, claims, signature] = jwt.split('.')
    expect(decodeJson(header!)).toEqual({ alg: 'RS256', typ: 'JWT' })
    expect(decodeJson(claims!)).toEqual({
      iss: 'woodland@proyecto.iam.gserviceaccount.com',
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      iat: 1_000,
      exp: 4_600,
    })
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, fromBase64Url(signature!), new TextEncoder().encode(`${header}.${claims}`))
    expect(valid).toBe(true)
  })

  it('rechaza una clave que no es PKCS#8 sin exponer su contenido', async () => {
    await expect(signServiceAccountJwt(baseConfig('no-es-una-clave'))).rejects.toThrow(GoogleSheetsError)
  })
})

describe('writeSheets', () => {
  const tabs = [
    { title: 'Resumen', rows: [['Indicador', 'Valor'], ['Pedidos', 3]] },
    { title: 'Pedidos', rows: [['Código'], ['=SUMA(1)'], [null]] },
  ]

  function fakeGoogle(existingTitles: string[]) {
    const calls: { url: string; method: string; body: unknown; auth: string | null }[] = []
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const headers = new Headers(init?.headers)
      const rawBody = init?.body
      calls.push({
        url,
        method: init?.method ?? 'GET',
        auth: headers.get('authorization'),
        body: typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody instanceof URLSearchParams ? Object.fromEntries(rawBody) : undefined,
      })
      if (url === 'https://oauth2.googleapis.com/token') return json({ access_token: 'tok-1' })
      if (url.includes('?fields=')) return json({ sheets: existingTitles.map((title) => ({ properties: { title } })) })
      return json({})
    })
    return { fetchImpl: fetchImpl as unknown as typeof fetch, calls }
  }

  it('canjea el JWT, crea las pestañas que faltan, vacía y reescribe (siempre como texto, sin fórmulas)', async () => {
    const { pem } = await testKeys()
    const { fetchImpl, calls } = fakeGoogle(['Resumen'])
    await writeSheets(baseConfig(pem), tabs, fetchImpl)

    expect(calls.map((c) => `${c.method} ${c.url.replace('https://sheets.googleapis.com/v4/spreadsheets/hoja-123', '')}`)).toEqual([
      'POST https://oauth2.googleapis.com/token',
      'GET ?fields=sheets.properties.title',
      'POST :batchUpdate',
      'POST /values:batchClear',
      'POST /values:batchUpdate',
    ])
    const [token, , add, clear, write] = calls
    expect(token!.body).toMatchObject({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer' })
    expect((token!.body as { assertion: string }).assertion.split('.')).toHaveLength(3)
    expect(calls.slice(1).every((c) => c.auth === 'Bearer tok-1')).toBe(true)
    expect(add!.body).toEqual({ requests: [{ addSheet: { properties: { title: 'Pedidos' } } }] })
    expect(clear!.body).toEqual({ ranges: ["'Resumen'", "'Pedidos'"] })
    expect(write!.body).toEqual({
      valueInputOption: 'RAW',
      data: [
        { range: "'Resumen'!A1", values: [['Indicador', 'Valor'], ['Pedidos', 3]] },
        { range: "'Pedidos'!A1", values: [['Código'], ['=SUMA(1)'], ['']] },
      ],
    })
  })

  it('no crea pestañas si ya existen todas', async () => {
    const { pem } = await testKeys()
    const { fetchImpl, calls } = fakeGoogle(['Resumen', 'Pedidos'])
    await writeSheets(baseConfig(pem), tabs, fetchImpl)
    expect(calls.some((c) => c.url.endsWith('hoja-123:batchUpdate'))).toBe(false)
  })

  it('informa el estado de Google cuando la hoja no está compartida', async () => {
    const { pem } = await testKeys()
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes('oauth2') ? json({ access_token: 't' }) : json({ error: 'forbidden' }, 403),
    ) as unknown as typeof fetch
    await expect(writeSheets(baseConfig(pem), tabs, fetchImpl)).rejects.toMatchObject({ status: 403 })
  })

  it('falla si Google rechaza las credenciales', async () => {
    const { pem } = await testKeys()
    const fetchImpl = vi.fn(async () => json({ error: 'invalid_grant' }, 400)) as unknown as typeof fetch
    await expect(writeSheets(baseConfig(pem), tabs, fetchImpl)).rejects.toMatchObject({ status: 400 })
  })
})
