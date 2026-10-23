import { Hono } from 'hono'
import type { HealthResponse } from '../../shared/api/contracts'
import { parseAppEnv } from '../../shared/config/app-env'
import type { AppBindings } from '../types'

/** Verificación de vida del Worker. No expone configuración ni secretos. */
export const healthRoutes = new Hono<AppBindings>().get('/', (c) =>
  c.json<HealthResponse>({
    status: 'ok',
    service: 'woodland-api',
    environment: parseAppEnv(c.env.APP_ENV),
    timestamp: new Date().toISOString(),
  }),
)
