import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { existsSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'

/**
 * Ajustes del build propio del panel, ya escritos los archivos:
 *  - el HTML vive en panel/index.html y en el despliegue debe quedar en la raíz;
 *  - robots.txt: el panel nunca se indexa (el de la landing permite indexar);
 *  - se quitan los videos de la landing, que el panel no usa.
 */
const panelOutput = (outDir: string): Plugin => ({
  name: 'panel-output',
  apply: 'build',
  closeBundle() {
    const out = fileURLToPath(new URL(`./${outDir}/`, import.meta.url))
    const html = `${out}panel/index.html`
    if (existsSync(html)) {
      renameSync(html, `${out}index.html`)
      rmSync(`${out}panel`, { recursive: true, force: true })
    }
    writeFileSync(`${out}robots.txt`, 'User-agent: *\nDisallow: /\n')
    rmSync(`${out}videos`, { recursive: true, force: true })
  },
})

/**
 * Build del sistema interno (panel) para su propio despliegue (Vercel): solo el panel, en la raíz del
 * dominio, sin la landing y sin el Worker. El hosting reenvía /api hacia el Worker.
 * Uso: npm run build:panel → dist-panel/
 */
export default defineConfig({
  plugins: [react(), tailwindcss(), panelOutput('dist-panel')],
  // Dentro del bundle el panel cuelga de "/" (no de /panel).
  define: { 'import.meta.env.VITE_PANEL_BASE': JSON.stringify('/') },
  build: {
    outDir: 'dist-panel',
    emptyOutDir: true,
    rollupOptions: { input: fileURLToPath(new URL('./panel/index.html', import.meta.url)) },
  },
})
