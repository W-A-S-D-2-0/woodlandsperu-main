/** Enlaces de WhatsApp. El número es un dato de la empresa (content/site.ts): sin número, no hay enlace. */

/** Deja solo dígitos del número con código de país (p. ej. 51987654321). Null si no parece válido. */
export function normalizeWhatsappNumber(raw: string | null | undefined): string | null {
  const digits = (raw ?? '').replace(/\D/g, '')
  return digits.length >= 8 && digits.length <= 15 ? digits : null
}

/** https://wa.me/<número>?text=<mensaje>. Null si no hay número configurado. */
export function whatsappUrl(number: string | null | undefined, message: string): string | null {
  const normalized = normalizeWhatsappNumber(number)
  if (!normalized) return null
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message.slice(0, 1000))}`
}
