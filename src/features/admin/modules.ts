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
    label: 'Stock',
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

/**
 * Secciones del menú: agrupan los módulos para que el menú tenga pocas opciones.
 * "hoy" es el inicio de administración (ruta raíz); el resto se abre en su primer módulo visible.
 */
export interface AdminSectionDef {
  slug: string
  label: string
  /** Etiqueta corta para la barra inferior del celular. */
  shortLabel: string
  modules: readonly string[]
}

export const adminSections: readonly AdminSectionDef[] = [
  { slug: 'hoy', label: 'Hoy', shortLabel: 'Hoy', modules: [] },
  { slug: 'taller', label: 'Taller y stock', shortLabel: 'Taller', modules: ['produccion', 'inventario'] },
  { slug: 'ventas', label: 'Ventas', shortLabel: 'Ventas', modules: ['pedidos', 'cotizaciones'] },
  { slug: 'clientes', label: 'Clientes y chats', shortLabel: 'Clientes', modules: ['clientes', 'conversaciones', 'citas'] },
  { slug: 'mas', label: 'Productos y reportes', shortLabel: 'Más', modules: ['productos', 'reportes'] },
]

export interface AdminSection {
  slug: string
  label: string
  shortLabel: string
  /** Ruta a la que lleva el menú. */
  to: string
  /** Módulos visibles para el rol, en orden (las pestañas de la sección). */
  modules: AdminModule[]
}

/** Orden del menú: administración empieza por Hoy y Ventas; el taller, por su trabajo. */
const sectionOrder: Record<StaffRole, readonly string[]> = {
  admin: ['hoy', 'ventas', 'clientes', 'taller', 'mas'],
  workshop: ['taller', 'ventas'],
}

/** Secciones que ve el rol. Una sección con un solo módulo toma el nombre del módulo (el taller ve "Pedidos", no "Ventas"). */
export function sectionsFor(role: StaffRole): AdminSection[] {
  const visible = modulesFor(role)
  return sectionOrder[role].flatMap((slug) => {
    const def = adminSections.find((s) => s.slug === slug)
    if (!def) return []
    if (def.slug === 'hoy') return [{ slug: def.slug, label: def.label, shortLabel: def.shortLabel, to: '/', modules: [] }]
    const modules = def.modules.flatMap((m) => visible.filter((v) => v.slug === m))
    const [head] = modules
    if (!head) return []
    const single = modules.length === 1 ? head.label : null
    return [{ slug: def.slug, label: single ?? def.label, shortLabel: single ?? def.shortLabel, to: `/${head.slug}`, modules }]
  })
}

/** Sección de una ruta del panel (relativa a /panel): "/pedidos/nueva" → ventas; "/" → hoy. */
export function sectionForPath(pathname: string, role: StaffRole): AdminSection | undefined {
  const first = pathname.split('/').filter(Boolean)[0] ?? ''
  const sections = sectionsFor(role)
  if (first === '') return sections.find((s) => s.slug === 'hoy')
  return sections.find((s) => s.modules.some((m) => m.slug === first))
}

export function findAdminModule(slug: string | undefined): AdminModule | undefined {
  return adminModules.find((adminModule) => adminModule.slug === slug)
}
