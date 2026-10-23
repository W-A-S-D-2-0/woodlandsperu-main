/**
 * Graba el video de la demo de Woodland Perú manejando un navegador real (Playwright), con subtítulos
 * sobre la pantalla y capturas de cada escena.
 *
 *   npm run demo                      → landing + chat (+ panel si hay credenciales)
 *   npm run demo -- --sin-panel       → solo la parte pública
 *   npm run demo -- --login-manual    → abre una ventana: TÚ inicias sesión en el panel y luego graba solo
 *   npm run demo -- --solo-panel --login-manual   → graba únicamente el panel (docs/demo/salida/woodland-demo-panel.*)
 *   npm run demo -- --unir            → une woodland-demo.mp4 (público) + woodland-demo-panel.mp4 en woodland-demo-completo.mp4
 *
 * Variables (se ponen en la terminal, NUNCA en el chat ni en el repositorio):
 *   DEMO_URL              dirección de la web (por defecto http://localhost:5173)
 *   DEMO_PANEL_URL        dirección del panel (por defecto DEMO_URL + /panel)
 *   DEMO_PANEL_EMAIL      correo del personal para la parte del panel
 *   DEMO_PANEL_PASSWORD   contraseña de ese usuario
 *
 * Salida: docs/demo/salida/woodland-demo.webm (+ .mp4) y docs/demo/capturas/*.png
 * Cuidado: el chat envía mensajes reales, así que quedan conversaciones de prueba en la base a la que apunte la web.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ffmpegPath from 'ffmpeg-static'
import { chromium } from 'playwright'

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..')
const args = new Set(process.argv.slice(2))
const BASE = (process.env.DEMO_URL ?? 'http://localhost:5173').replace(/\/$/, '')
const PANEL = (process.env.DEMO_PANEL_URL ?? `${BASE}/panel`).replace(/\/$/, '')
const EMAIL = process.env.DEMO_PANEL_EMAIL
const PASSWORD = process.env.DEMO_PANEL_PASSWORD
const loginManual = args.has('--login-manual')
const soloPanel = args.has('--solo-panel')
const withPanel = !args.has('--sin-panel') && (Boolean(EMAIL && PASSWORD) || loginManual)
const suffix = soloPanel ? '-panel' : ''

const outDir = resolve(root, 'docs/demo/salida')
const shotsDir = resolve(root, 'docs/demo/capturas')
mkdirSync(outDir, { recursive: true })
mkdirSync(shotsDir, { recursive: true })
const tmpVideos = resolve(outDir, '_tmp')
rmSync(tmpVideos, { recursive: true, force: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

if (args.has('--unir')) {
  const publico = resolve(outDir, 'woodland-demo.mp4')
  const panel = resolve(outDir, 'woodland-demo-panel.mp4')
  const completo = resolve(outDir, 'woodland-demo-completo.mp4')
  if (!existsSync(publico) || !existsSync(panel)) throw new Error('Faltan woodland-demo.mp4 y woodland-demo-panel.mp4 en docs/demo/salida.')
  // El video público termina con el subtítulo de cierre; se recorta para que el cierre salga una sola vez, al final.
  const info = spawnSync(ffmpegPath, ['-i', publico], { encoding: 'utf8' }).stderr
  const m = info.match(/Duration: (\d+):(\d+):(\d+\.\d+)/)
  const total = m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0
  const cut = Math.max(1, total - 4.2)
  const r = spawnSync(
    ffmpegPath,
    ['-y', '-i', publico, '-i', panel, '-filter_complex', `[0:v]trim=end=${cut},setpts=PTS-STARTPTS[a];[1:v]setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1:a=0[v]`, '-map', '[v]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-movflags', '+faststart', completo],
    { stdio: 'ignore' },
  )
  console.log(r.status === 0 ? `Video completo: ${completo}` : 'No se pudo unir los videos.')
  process.exit(r.status === 0 ? 0 : 1)
}

// --- Subtítulos sobre la pantalla (sobreviven a las navegaciones) --------------------------------
const captionScript = () => {
  const render = () => {
    const text = sessionStorage.getItem('__cap')
    let el = document.getElementById('demo-caption')
    if (!text) return el?.remove()
    if (!el) {
      el = document.createElement('div')
      el.id = 'demo-caption'
      el.style.cssText =
        'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);max-width:78%;padding:12px 24px;border-radius:14px;' +
        'background:rgba(29,22,16,.92);color:#faf6ef;font:600 21px Manrope,system-ui,sans-serif;line-height:1.35;text-align:center;' +
        'z-index:2147483647;pointer-events:none;box-shadow:0 10px 34px rgba(0,0,0,.4)'
      document.documentElement.appendChild(el)
    }
    el.textContent = text
  }
  window.__cap = (text) => {
    sessionStorage.setItem('__cap', text || '')
    render()
  }
  document.addEventListener('DOMContentLoaded', render)
}

let shotN = soloPanel ? 6 : 0
async function shot(page, name) {
  shotN += 1
  await page.screenshot({ path: resolve(shotsDir, `${String(shotN).padStart(2, '0')}-${name}.png`) })
}
const say = (page, text) => page.evaluate((t) => window.__cap?.(t), text)

async function open(page, url, caption, settle = 1800) {
  await page.goto(url, { waitUntil: 'load' })
  await say(page, caption)
  await sleep(settle)
}

/** Desplaza la página poco a poco, cambiando el subtítulo según el avance. */
async function scrollStory(page, beats) {
  const total = await page.evaluate(() => document.scrollingElement.scrollHeight - window.innerHeight)
  const steps = 26
  let beat = 0
  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps
    while (beat < beats.length && ratio >= beats[beat][0]) await say(page, beats[beat++][1])
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'smooth' }), Math.round(total * ratio))
    await sleep(1000)
  }
}

async function typeInto(locator, text) {
  await locator.click()
  await locator.pressSequentially(text, { delay: 55 })
}

/** Espera a que el asistente termine de responder: el texto del chat deja de cambiar. */
async function waitChatSettled(page, startedWith) {
  const list = page.getByLabel('Conversación')
  let last = startedWith
  let stableFor = 0
  const t0 = Date.now()
  while (Date.now() - t0 < 70_000) {
    await sleep(1000)
    const now = (await list.innerText()).length
    if (now === last) stableFor += 1
    else {
      stableFor = 0
      last = now
    }
    if (last !== startedWith && stableFor >= 4) return
  }
}

async function chatTurn(page, text) {
  const box = page.getByPlaceholder('Escribe tu mensaje…')
  const before = (await page.getByLabel('Conversación').innerText()).length
  await typeInto(box, text)
  await sleep(500)
  await page.keyboard.press('Enter')
  await waitChatSettled(page, before)
  await sleep(1500)
}

/** Chromium de Playwright si está instalado; si no, el Edge o el Chrome del equipo (sin descargar nada). */
async function launchBrowser(headless) {
  for (const channel of [undefined, 'msedge', 'chrome']) {
    try {
      return await chromium.launch({ headless, ...(channel ? { channel } : {}) })
    } catch {
      // se prueba la siguiente opción
    }
  }
  throw new Error('No se pudo abrir una ventana: instala Chromium con "npx playwright install chromium" o usa Edge/Chrome.')
}

// --- Inicio de sesión manual (opcional) ----------------------------------------------------------
// Se abre una ventana VISIBLE; la persona escribe sus credenciales ahí. Nada de eso se graba ni pasa por el
// script: solo se conserva la sesión en memoria para el recorrido grabado (que va en otra ventana invisible).
// La sesión se guarda un momento en docs/demo/salida/_sesion.json (ignorada por git) para no repetir el login si
// una grabación falla; se borra al terminar bien.
const sessionFile = resolve(outDir, '_sesion.json')
let storageState = withPanel && loginManual && existsSync(sessionFile) ? sessionFile : undefined
if (withPanel && loginManual && !storageState) {
  const loginBrowser = await launchBrowser(false)
  const loginContext = await loginBrowser.newContext({ viewport: { width: 1100, height: 720 } })
  const loginPage = await loginContext.newPage()
  await loginPage.goto(PANEL)
  console.log('\n>>> Inicia sesión en la ventana que se abrió (tienes 5 minutos). Después se graba solo.\n')
  await loginPage.waitForURL((u) => !u.pathname.includes('/ingresar'), { timeout: 300_000 })
  await loginPage.waitForSelector('text=Cerrar sesión', { timeout: 60_000 })
  await loginContext.storageState({ path: sessionFile })
  storageState = sessionFile
  await loginBrowser.close()
}

// --- Recorrido -----------------------------------------------------------------------------------
const browser = await launchBrowser(true)
const context = await browser.newContext({
  storageState,
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: tmpVideos, size: { width: 1280, height: 720 } },
  locale: 'es-PE',
  timezoneId: 'America/Lima',
})
await context.addInitScript(captionScript)
const page = await context.newPage()
page.setDefaultTimeout(20_000)

try {
  if (!soloPanel) {
  // 1. Portada y recorrido de la historia
  await open(page, `${BASE}/`, 'Woodland Perú: tablas de teca, de la semilla a tu mesa', 3000)
  await shot(page, 'landing-portada')
  await scrollStory(page, [
    [0.05, 'La web cuenta la historia: teca sembrada en bosques propios de San Martín'],
    [0.3, 'Cada tabla se trabaja a mano por maestros artesanos'],
    [0.5, 'El cliente puede ver su grabado antes de pedir'],
    [0.75, 'Y sigue su pedido desde que lo recibimos hasta que llega'],
    [0.95, 'Todo en una experiencia pensada para vender más'],
  ])
  await shot(page, 'landing-cierre')

  // 2. Catálogo y cotización
  await open(page, `${BASE}/catalogo`, 'Catálogo con modelos reales, plazos estimados y precio por cantidad', 3500)
  await shot(page, 'catalogo')
  await open(page, `${BASE}/cotizar`, 'Solicitud de cotización: el cliente elige modelo, cantidad y grabado', 3500)
  await shot(page, 'cotizar')

  // 3. Chat con el asistente
  await open(page, `${BASE}/`, 'El asistente atiende solo, a cualquier hora', 2500)
  await page.getByRole('button', { name: /Chatea con nosotros/ }).click()
  await sleep(1200)
  await say(page, 'El cliente escribe como lo haría por WhatsApp…')
  await chatTurn(page, 'Hola, quiero 3 tablas Super Grill XL con el nombre Don Pepe grabado')
  await shot(page, 'chat-consulta')
  await say(page, 'El asistente conoce el catálogo, los plazos y el proceso de compra')
  await sleep(1500)
  await say(page, 'Y explica cómo pagar por Yape o Plin, sin pasarelas ni costos extra')
  await chatTurn(page, '¿Cuánto demoran y cómo puedo pagar?')
  await shot(page, 'chat-pago')
  await sleep(2000)
  }

  // 4. Panel del negocio
  if (withPanel) {
    await open(page, PANEL, 'Panel del negocio: acceso solo para el equipo', 2500)
    if (page.url().includes('/ingresar')) {
      if (!EMAIL || !PASSWORD) throw new Error('El panel pidió iniciar sesión: usa --login-manual o define DEMO_PANEL_EMAIL y DEMO_PANEL_PASSWORD.')
      await page.getByLabel('Correo').fill(EMAIL)
      await page.getByLabel('Contraseña').fill(PASSWORD)
      await shot(page, 'panel-login')
      await page.getByRole('button', { name: 'Ingresar' }).click()
      await page.waitForURL((u) => !u.pathname.includes('/ingresar'), { timeout: 30_000 })
    }
    await say(page, 'Resumen: lo que espera una acción del equipo')
    await sleep(3500)
    await shot(page, 'panel-resumen')

    await open(page, `${PANEL}/conversaciones`, 'Conversaciones: el asistente atiende y el equipo supervisa lo que quedó por revisar', 3000)
    const firstChat = page.locator('ul button').first()
    if (await firstChat.count()) await firstChat.click()
    await sleep(3500)
    await shot(page, 'panel-conversaciones')

    await open(page, `${PANEL}/cotizaciones`, 'Cotizaciones: el equipo fija los precios pendientes y las envía', 3500)
    await shot(page, 'panel-cotizaciones')

    await open(page, `${PANEL}/pedidos`, 'Pedidos: del chat o de ventas directas, con su estado de producción y pago', 3500)
    await shot(page, 'panel-pedidos')

    await open(page, `${PANEL}/inventario`, 'Inventario: el stock se reserva y descuenta solo con cada pedido', 3000)
    const detail = page.getByRole('button', { name: 'Detalle' }).first()
    if (await detail.count()) await detail.click()
    await sleep(3500)
    await shot(page, 'panel-inventario')

    await open(page, `${PANEL}/reportes`, 'Reportes: ventas, ticket promedio, conversión y exportación a Google Sheets', 4000)
    await shot(page, 'panel-reportes')
    await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'smooth' }))
    await sleep(3500)
  }

  await say(page, 'Woodland Perú: más ventas, menos trabajo manual')
  await sleep(3500)
} finally {
  await context.close()
  await browser.close()
}

// --- Archivos de salida --------------------------------------------------------------------------
const recorded = readdirSync(tmpVideos).find((f) => f.endsWith('.webm'))
if (!recorded) throw new Error('Playwright no generó el video.')
const webm = resolve(outDir, `woodland-demo${suffix}.webm`)
renameSync(resolve(tmpVideos, recorded), webm)
rmSync(tmpVideos, { recursive: true, force: true })

const mp4 = resolve(outDir, `woodland-demo${suffix}.mp4`)
if (ffmpegPath && existsSync(ffmpegPath)) {
  const r = spawnSync(ffmpegPath, ['-y', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-movflags', '+faststart', mp4], { stdio: 'ignore' })
  console.log(r.status === 0 ? `MP4: ${mp4}` : 'No se pudo convertir a MP4; usa el .webm.')
}
rmSync(sessionFile, { force: true })
console.log(`Video: ${webm}`)
console.log(`Capturas: ${shotsDir}`)
console.log(withPanel ? 'Incluye el panel.' : 'Sin panel (define DEMO_PANEL_EMAIL y DEMO_PANEL_PASSWORD para incluirlo).')
