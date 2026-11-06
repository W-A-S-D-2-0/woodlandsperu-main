import { useLocation } from 'react-router'
import { contact } from '../../content/site'
import { pageWhatsappMessage, whatsappUrl } from '../../lib/whatsapp'

/** Globo de conversación con un teléfono: se reconoce como «escribir por WhatsApp» sin copiar el logotipo. */
function WhatsappIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 20.5l1.3-4.1A8.5 8.5 0 1 1 8 19.4z" />
      <path d="M9.2 8.6c.2-.5.5-.6.8-.6h.5c.2 0 .4.1.5.4l.6 1.5c.1.2 0 .5-.1.6l-.5.6c.6 1.1 1.4 1.9 2.5 2.5l.6-.5c.2-.2.4-.2.6-.1l1.5.6c.3.1.4.3.4.5v.5c0 .3-.1.6-.6.8-.7.3-1.6.3-2.8-.3a8.4 8.4 0 0 1-3.7-3.7c-.6-1.2-.6-2.1-.3-2.8z" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Enlace al WhatsApp de Woodland con un mensaje ya escrito según la página. Null si no hay número configurado. */
function useWhatsappHref(): string | null {
  const { pathname } = useLocation()
  return whatsappUrl(contact.whatsapp, pageWhatsappMessage(pathname))
}

/**
 * Botón «Escríbenos por WhatsApp»: abre el WhatsApp de Woodland en otra pestaña con el mensaje listo para enviar.
 * Va dentro del chat de Teca, no en el encabezado (pedido del 5 de noviembre de 2026).
 */
export function WhatsappButton({ className = '', label = 'Escríbenos por WhatsApp', onClick }: { className?: string; label?: string; onClick?: () => void }) {
  const href = useWhatsappHref()
  if (!href) return null
  return (
    <a href={href} target="_blank" rel="noreferrer" onClick={onClick} className={className}>
      <WhatsappIcon />
      {label}
      <span className="sr-only"> (se abre en WhatsApp)</span>
    </a>
  )
}
