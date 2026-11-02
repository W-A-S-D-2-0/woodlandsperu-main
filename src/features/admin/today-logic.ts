/** Pantalla «Hoy»: qué tiene que hacer el equipo, en frases simples. Sin React: se prueba sola. */

export interface TodayInput {
  lowStock: number
  quotesPending: number
  ordersToConfirm: number
  /** null mientras carga: no se muestra ni como tarea ni como «en orden». */
  ordersToCollect: number | null
  conversationsWaiting: number | null
  appointmentsPending: number | null
}

export interface TodayTask {
  id: string
  /** alert = problema que conviene resolver primero; warn = algo pendiente. */
  tone: 'alert' | 'warn'
  /** Icono del menú que la representa. */
  icon: string
  title: string
  detail: string
  action: string
  to: string
}

interface TaskDef {
  id: string
  count: (input: TodayInput) => number | null
  tone: TodayTask['tone']
  icon: string
  title: (n: number) => string
  detail: string
  action: string
  to: string
  /** Lo que se dice cuando no hay nada pendiente. */
  calm: string
}

const one = (n: number, singular: string, plural: string) => (n === 1 ? singular : plural.replace('{n}', String(n)))

// En orden de urgencia: primero lo que frena una venta o la producción.
const defs: TaskDef[] = [
  {
    id: 'stock',
    count: (i) => i.lowStock,
    tone: 'alert',
    icon: 'inventario',
    title: (n) => one(n, '1 tabla llegó a su mínimo', '{n} tablas llegaron a su mínimo'),
    detail: 'Conviene producir antes de que se agoten.',
    action: 'Ver stock',
    to: '/inventario',
    calm: 'Stock sobre el mínimo',
  },
  {
    id: 'cobrar',
    count: (i) => i.ordersToCollect,
    tone: 'warn',
    icon: 'ventas',
    title: (n) => one(n, '1 pedido espera confirmar el pago', '{n} pedidos esperan confirmar el pago'),
    detail: 'Revisa en tu app de Yape que el dinero llegó.',
    action: 'Ver pedidos',
    to: '/pedidos?ver=cobrar',
    calm: 'Pagos al día',
  },
  {
    id: 'confirmar',
    count: (i) => i.ordersToConfirm,
    tone: 'warn',
    icon: 'pedidos',
    title: (n) => one(n, '1 pedido por confirmar', '{n} pedidos por confirmar'),
    detail: 'Al confirmarlo se apartan las tablas del stock.',
    action: 'Confirmar',
    to: '/pedidos?ver=confirmar',
    calm: 'Sin pedidos por confirmar',
  },
  {
    id: 'cotizaciones',
    count: (i) => i.quotesPending,
    tone: 'warn',
    icon: 'cotizaciones',
    title: (n) => one(n, '1 cotización espera tu respuesta', '{n} cotizaciones esperan tu respuesta'),
    detail: 'Revisa lo que pidieron, ponle precio a lo que falte y envíala.',
    action: 'Responder',
    to: '/cotizaciones?ver=responder',
    calm: 'Cotizaciones respondidas',
  },
  {
    id: 'chats',
    count: (i) => i.conversationsWaiting,
    tone: 'warn',
    icon: 'conversaciones',
    title: (n) => one(n, '1 chat para leer', '{n} chats para leer'),
    detail: 'El asistente atendió solo, pero dejó algo marcado para el equipo.',
    action: 'Leer chats',
    to: '/conversaciones?estado=esperan',
    calm: 'Chats revisados',
  },
  {
    id: 'citas',
    count: (i) => i.appointmentsPending,
    tone: 'warn',
    icon: 'citas',
    title: (n) => one(n, '1 cita por atender', '{n} citas por atender'),
    detail: 'Clientes que esperan tu llamada.',
    action: 'Ver citas',
    to: '/citas',
    calm: 'Sin citas pendientes',
  },
]

/** Tareas pendientes (lo urgente primero) y lo que está en orden. Lo que aún carga no aparece en ninguna lista. */
export function todayTasks(input: TodayInput): { tasks: TodayTask[]; calm: string[] } {
  const tasks: TodayTask[] = []
  const calm: string[] = []
  for (const def of defs) {
    const n = def.count(input)
    if (n === null) continue
    if (n > 0) tasks.push({ id: def.id, tone: def.tone, icon: def.icon, title: def.title(n), detail: def.detail, action: def.action, to: def.to })
    else calm.push(def.calm)
  }
  return { tasks, calm }
}

const limaHour = new Intl.DateTimeFormat('es-PE', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Lima' })
const limaDay = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Lima' })

/** Saludo según la hora de Lima. */
export function greeting(now: Date): string {
  const hour = Number(limaHour.format(now))
  if (hour < 12) return 'Buenos días'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

/** «Lunes, 2 de noviembre» (hora de Lima). */
export function todayLabel(now: Date): string {
  const text = limaDay.format(now)
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Primer nombre para el saludo: «Brigitte Giraud» → «Brigitte». */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? ''
}
