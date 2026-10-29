/** Abre el chat desde cualquier parte de la web, opcionalmente enviando ya un primer mensaje. */
export const OPEN_CHAT_EVENT = 'woodland:open-chat'

export function openChat(message?: string) {
  window.dispatchEvent(new CustomEvent<string | undefined>(OPEN_CHAT_EVENT, { detail: message }))
}

/** Un modelo del catálogo que se quiere pedir: el chat abre su tarjeta de pedido (cantidad y grabado) ya con ese modelo. */
export const ORDER_MODEL_EVENT = 'woodland:order-model'

export interface OrderModel {
  product: string
  variant: string
  dimensions: string | null
  /** «S/ 100.00» o «precio por confirmar». */
  price: string
}

export function startOrder(model: OrderModel) {
  window.dispatchEvent(new CustomEvent<OrderModel>(ORDER_MODEL_EVENT, { detail: model }))
}

/** El chat lleva a «Para ti» con un modelo y una cantidad ya elegidos: la sección los muestra y los usa al pedir. */
export const SELECT_MODEL_EVENT = 'woodland:select-model'

export interface SelectedModel {
  product: string
  variant: string
  quantity: number
}

export function selectModel(selection: SelectedModel) {
  window.dispatchEvent(new CustomEvent<SelectedModel>(SELECT_MODEL_EVENT, { detail: selection }))
}
