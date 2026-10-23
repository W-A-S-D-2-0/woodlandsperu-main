import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// https://developers.cloudflare.com/workers/vite-plugin/
export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  environments: {
    client: {
      build: {
        rollupOptions: {
          // Dos aplicaciones independientes: la web pública y el sistema interno (/panel).
          input: {
            main: fileURLToPath(new URL('./index.html', import.meta.url)),
            panel: fileURLToPath(new URL('./panel/index.html', import.meta.url)),
          },
        },
      },
    },
  },
})
