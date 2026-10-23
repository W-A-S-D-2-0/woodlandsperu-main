/**
 * Plazos estimados de entrega según la cantidad. Fuente: Canvas Tech de ventas (29/09/2026): "2-3 tablas
 * ~2 días; 20-30 ~1 semana; 150+ ~3 semanas, principalmente por curado y acabado". Se muestran SIN
 * stock real, a propósito (decisión de Brigitte tras el caso Antamina).
 *
 * PENDIENTE: Woodland no definió los tramos intermedios (4 a 19 y 31 a 149). Hasta que los defina,
 * esos tramos muestran "por confirmar" y nunca un plazo inventado.
 */
export interface DeliveryBand {
  from: number
  /** Cantidad máxima del tramo (inclusive). */
  to: number
  /** Texto del plazo; null = por confirmar con el equipo. */
  estimate: string | null
}

export const deliveryBands: readonly DeliveryBand[] = [
  { from: 1, to: 3, estimate: 'Unos 2 días' },
  { from: 4, to: 19, estimate: null },
  { from: 20, to: 30, estimate: 'Aproximadamente 1 semana' },
  { from: 31, to: 149, estimate: null },
  { from: 150, to: Number.POSITIVE_INFINITY, estimate: 'Unas 3 semanas, por el curado y el acabado' },
]

export const deliveryNote = 'Plazos estimados y sujetos a confirmación por nuestro equipo.'
export const deliveryUnknown = 'Plazo por confirmar con nuestro equipo'
