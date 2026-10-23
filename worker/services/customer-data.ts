/** Los datos de quien compra, leídos de un solo mensaje. */
export interface CustomerData {
  name?: string
  email?: string
  phone?: string
  address?: string
}

/**
 * Lee los datos del cliente de un solo mensaje: «Ana Pérez, ana@correo.com, 987654321, Jr. Lima 123, Tarapoto».
 * Acepta también líneas con etiqueta («Nombre: …»). Lo que no encuentra queda sin llenar y el flujo lo pide aparte.
 */
export function parseCustomerData(raw: string): CustomerData {
  let rest = raw
  const email = rest.match(/[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+/)?.[0]
  if (email) rest = rest.replace(email, ' ')
  const mobile = rest.match(/(?:\+?51[\s-]?)?9\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/)?.[0]
  const phone = mobile ?? rest.match(/\+?\d[\d\s()-]{5,}\d/)?.[0]
  if (phone) rest = rest.replace(phone, ' ')
  const digits = phone?.replace(/[\s()-]/g, '')

  const out: CustomerData = {}
  if (email) out.email = email.slice(0, 254)
  if (digits && /^\+?[0-9]{7,15}$/.test(digits)) out.phone = digits

  const label = /^(nombre completo|nombre|direcci[oó]n|dir|correo|e-?mail|celular|tel[eé]fono|tel|cel)\s*:?\s*/i
  const segments = rest
    .split(/[\n,;|]+/)
    .map((x) => x.trim())
    .filter(Boolean)
  const addressParts: string[] = []
  for (const [index, segment] of segments.entries()) {
    const tag = segment.match(label)?.[1]?.toLowerCase() ?? ''
    const value = segment.replace(label, '').trim()
    if (!value) continue
    if (/^nombre/.test(tag)) out.name = value.slice(0, 160)
    else if (/^dir/.test(tag)) addressParts.push(value)
    else if (index === 0 && !out.name && !tag && /\p{L}/u.test(value) && !/\d/.test(value)) out.name = value.replace(/^(me llamo|mi nombre es|soy)\s+/i, '').slice(0, 160)
    else if (value.length > 1 && !/^(correo|celular|tel[eé]fono)$/i.test(value)) addressParts.push(value)
  }
  const address = addressParts.join(', ')
  if (address.length >= 6 && /\p{L}/u.test(address)) out.address = address.slice(0, 300)
  return out
}
