import { createApp } from './app'

const app = createApp()

// Todo lo que llega al Worker es /api. El panel de administración vive en su propio repositorio
// (woodlandperu-panel) y su propio hosting; la web pública la sirven los assets.
export default {
  fetch(request, env, ctx) {
    return app.fetch(request, env, ctx)
  },
} satisfies ExportedHandler<Env>
