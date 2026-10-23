import { defineConfig } from 'vitest/config'

// Configuración separada de vite.config.ts para no levantar el runtime de Cloudflare
// en las pruebas unitarias de lógica (frontend, worker y reglas compartidas).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'worker/**/*.test.ts', 'shared/**/*.test.ts', 'supabase/tests/**/*.test.ts', 'scripts/**/*.test.ts'],
    // Las pruebas de base de datos cargan PostgreSQL (PGlite) y todas las migraciones.
    testTimeout: 30_000,
  },
})
