import { createApp } from './app'
import { isPanelPath, servePanel } from './panel'

const app = createApp()

export default {
  fetch(request, env, ctx) {
    // /panel: sistema interno (app separada de la landing). Todo lo demás que llega aquí es /api.
    // El Worker solo de API (wrangler.api.jsonc) no tiene assets: el panel se sirve desde su propio hosting.
    if (env.ASSETS && isPanelPath(new URL(request.url).pathname)) return servePanel(request, env.ASSETS)
    return app.fetch(request, env, ctx)
  },
} satisfies ExportedHandler<Env>
