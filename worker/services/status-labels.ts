import type { OrderStatus, PaymentStatus, QuoteStatus } from '../../shared/api/panel-contracts'

/**
 * Nombres de cada estado en las hojas de reportes que arma la API. Son los mismos que muestra el panel
 * (repositorio woodlandperu-panel, src/features/admin/panel-logic.ts): si cambian allá, se cambian aquí.
 */

export const quoteStatusLabels: Record<QuoteStatus, string> = {
  submitted: 'Recibida',
  under_review: 'En revisión',
  sent: 'Enviada al cliente',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  expired: 'Vencida',
  converted: 'Convertida en pedido',
  cancelled: 'Cancelada',
}

export const orderStatusLabels: Record<OrderStatus, string> = {
  pending_confirmation: 'Por confirmar',
  confirmed: 'Confirmado',
  in_production: 'En el taller',
  ready: 'Listo',
  shipped: 'Despachado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  unpaid: 'Sin pago',
  pending: 'Pago pendiente',
  paid: 'Pagado',
  failed: 'Pago fallido',
  refunded: 'Reembolsado',
  partially_refunded: 'Reembolso parcial',
  charged_back: 'Contracargo',
}

export const channelLabels: Record<string, string> = {
  web: 'Web',
  web_chat: 'Chat web',
  whatsapp: 'WhatsApp',
  admin: 'Equipo',
}
