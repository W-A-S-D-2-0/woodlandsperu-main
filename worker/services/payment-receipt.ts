/**
 * Lectura de la captura de pago. Una constancia de Yape o de Plin (desde la app de Yape o desde un banco, como la de
 * Interbank) muestra el monto, la fecha, el número de operación y, parcialmente, el celular de destino. Aquí se
 * decide si la captura sirve para el pedido; la lectura de la imagen la hace la IA (ver integrations/receipt-reader).
 */

export interface ReceiptReading {
  /** ¿Es una constancia de pago de Yape o de Plin? */
  isReceipt: boolean
  app: 'yape' | 'plin' | 'other'
  amount: number | null
  /** Últimos dígitos visibles del celular de destino («938» en «*** *** 938»). */
  recipientTail: string | null
  operationCode: string | null
}

export type ReceiptVerdict = 'ok' | 'not_receipt' | 'unreadable' | 'wrong_amount' | 'wrong_recipient'

/** Lee el JSON que devuelve la IA; null si no se puede entender. */
export function parseReceiptReading(text: string): ReceiptReading | null {
  const json = text.match(/\{[\s\S]*\}/)?.[0]
  if (!json) return null
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
  const app = raw.app === 'yape' || raw.app === 'plin' ? raw.app : 'other'
  const amount = typeof raw.amount === 'number' ? raw.amount : typeof raw.amount === 'string' ? Number(raw.amount.replace(/[^\d.]/g, '')) : NaN
  const tail = typeof raw.recipient_tail === 'string' ? raw.recipient_tail.replace(/\D/g, '').slice(-3) : ''
  const code = typeof raw.operation_code === 'string' ? raw.operation_code.replace(/\s+/g, '').slice(0, 40) : ''
  return {
    isReceipt: raw.is_receipt === true && app !== 'other',
    app,
    amount: Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null,
    recipientTail: tail.length === 3 ? tail : null,
    operationCode: code || null,
  }
}

/**
 * ¿La captura corresponde al pedido? Debe ser una constancia de Yape o Plin, con el monto exacto del pedido y, si se
 * alcanza a leer el destino, terminar en las mismas 3 cifras que el celular del negocio.
 */
export function judgeReceipt(reading: ReceiptReading, expected: { total: number; businessNumber: string | null }): ReceiptVerdict {
  if (!reading.isReceipt) return 'not_receipt'
  if (reading.amount === null) return 'unreadable'
  if (Math.abs(reading.amount - expected.total) > 0.009) return 'wrong_amount'
  const businessTail = expected.businessNumber?.replace(/\D/g, '').slice(-3)
  if (reading.recipientTail && businessTail && reading.recipientTail !== businessTail) return 'wrong_recipient'
  return 'ok'
}
