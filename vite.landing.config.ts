import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

/**
 * Build de la web pública para su propio despliegue (Vercel): solo la landing, sin el panel y sin el
 * Worker. La API vive en otro lugar (Cloudflare Worker); el hosting reenvía /api hacia allá.
 * Uso: npm run build:landing → dist-landing/
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist-landing',
    emptyOutDir: true,
    rollupOptions: { input: fileURLToPath(new URL('./index.html', import.meta.url)) },
  },
})
