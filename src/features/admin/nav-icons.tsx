import type { ReactNode } from 'react'

/** Iconos de línea para el menú del panel (trazo heredado del texto, 20×20). */
const paths: Record<string, ReactNode> = {
  resumen: (
    <>
      <rect x="3" y="3" width="6" height="7" rx="1.5" />
      <rect x="11" y="3" width="6" height="4" rx="1.5" />
      <rect x="11" y="9" width="6" height="8" rx="1.5" />
      <rect x="3" y="12" width="6" height="5" rx="1.5" />
    </>
  ),
  productos: (
    <>
      <path d="M3 6.5 10 3l7 3.5v7L10 17l-7-3.5z" />
      <path d="M3 6.5 10 10l7-3.5M10 10v7" />
    </>
  ),
  inventario: (
    <>
      <path d="M3 8h14v9H3zM5 4h10l2 4H3z" />
      <path d="M8 12h4" />
    </>
  ),
  produccion: (
    <>
      <path d="M4 16V9l4 2V8l4 2V5h4v11z" />
    </>
  ),
  cotizaciones: (
    <>
      <path d="M5 3h7l3 3v11H5z" />
      <path d="M12 3v3h3M8 10h4M8 13h4" />
    </>
  ),
  pedidos: (
    <>
      <path d="M3 5h2l1.5 8h8L17 7H6" />
      <circle cx="8" cy="16" r="1" />
      <circle cx="14" cy="16" r="1" />
    </>
  ),
  clientes: (
    <>
      <circle cx="10" cy="7" r="3" />
      <path d="M4 17c0-3 2.7-5 6-5s6 2 6 5" />
    </>
  ),
  conversaciones: <path d="M4 4h12v9H9l-4 3v-3H4z" />,
  citas: (
    <>
      <rect x="3.5" y="5" width="13" height="11.5" rx="1.5" />
      <path d="M3.5 9h13M7 3.5v3M13 3.5v3" />
    </>
  ),
  reportes: (
    <>
      <path d="M4 16V9M10 16V4M16 16v-5" />
    </>
  ),
}

export function NavIcon({ slug }: { slug: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="size-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[slug] ?? paths.resumen}
    </svg>
  )
}
