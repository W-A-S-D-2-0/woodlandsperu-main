/**
 * Módulos del panel administrativo. Es la única fuente para la navegación lateral
 * y para las rutas del panel (/panel/<slug>). Cada módulo indica en qué fase se implementa.
 */
import type { StaffRole } from '../../../shared/api/contracts'

export interface AdminModule {
  slug: string
  /** Roles que ven el módulo. La API y RLS lo vuelven a exigir. */
  roles: readonly StaffRole[]
  label: string
  phase: string
  description: string
  planned: readonly string[]
}

export const adminModules: readonly AdminModule[] = [
  {
    slug: 'productos',
    roles: ['admin'],
    label: 'Productos',
    phase: 'Fase 2–3',
    description: 'Catálogo interno con productos, variantes, medidas y precios autorizados.',
    planned: ['Crear y editar productos', 'Activar y desactivar', 'Gestionar variantes y SKU', 'Actualizar precios y escalas por volumen'],
  },
  {
    slug: 'inventario',
    roles: ['admin', 'workshop'],
    label: 'Inventario',
    phase: 'Fase 3',
    description: 'Stock interno por variante con movimientos atómicos. Nunca visible para el público.',
    planned: ['Stock físico, reservado y disponible', 'Entradas por producción y ajustes', 'Historial de movimientos', 'Mínimos y alertas de reposición'],
  },
  {
    slug: 'produccion',
    roles: ['admin', 'workshop'],
    label: 'Producción',
    phase: 'Fase 3',
    description: 'Registro rápido de las tablas terminadas en el taller, pensado para el celular.',
    planned: ['Anotar producción con botones grandes', 'Confirmación en dos toques', 'Reintentos sin duplicar'],
  },
  {
    slug: 'cotizaciones',
    roles: ['admin'],
    label: 'Cotizaciones',
    phase: 'Fase 3',
    description: 'Solicitudes de clientes particulares y corporativos, con cálculo de importes en el servidor.',
    planned: ['Revisar cantidades y personalización', 'Aprobar o ajustar propuestas', 'Derivar pedidos sobre el límite comercial', 'Convertir en pedido'],
  },
  {
    slug: 'pedidos',
    roles: ['admin', 'workshop'],
    label: 'Pedidos',
    phase: 'Fase 3 y 5',
    description: 'Seguimiento de pedidos y de su estado de pago confirmado por el proveedor.',
    planned: ['Estados del pedido', 'Pagos verificados por Mercado Pago', 'Reserva y salida de stock', 'Confirmación de entrega'],
  },
  {
    slug: 'clientes',
    roles: ['admin'],
    label: 'Clientes',
    phase: 'Fase 2–3',
    description: 'Historial de cada cliente, sus solicitudes y observaciones del equipo.',
    planned: ['Particulares y empresas', 'Historial de pedidos y cotizaciones', 'Observaciones internas'],
  },
  {
    slug: 'conversaciones',
    roles: ['admin'],
    label: 'Conversaciones',
    phase: 'Fase 4 y 6',
    description: 'Chat web y WhatsApp atendidos por el asistente comercial, con derivación a una persona.',
    planned: ['Registro de conversaciones', 'Conversaciones derivadas a humano', 'Cotizaciones originadas por el asistente'],
  },
  {
    slug: 'citas',
    roles: ['admin'],
    label: 'Citas',
    phase: 'Fase 4',
    description: 'Citas que los clientes agendan en el chat para hablar con la administración.',
    planned: ['Día, hora y celular de cada cita', 'Marcar como atendida o cancelada'],
  },
  {
    slug: 'reportes',
    roles: ['admin'],
    label: 'Reportes',
    phase: 'Fase 8',
    description: 'Indicadores comerciales por rango de fechas y exportación unidireccional a Google Sheets (CSV).',
    planned: ['Consultas, cotizaciones y pedidos', 'Ventas y ticket promedio', 'Productos bajo mínimo', 'Exportación a Google Sheets'],
  },
]

/** Módulos que el rol puede ver. */
export function modulesFor(role: StaffRole): AdminModule[] {
  return adminModules.filter((m) => m.roles.includes(role))
}

export function findAdminModule(slug: string | undefined): AdminModule | undefined {
  return adminModules.find((adminModule) => adminModule.slug === slug)
}
