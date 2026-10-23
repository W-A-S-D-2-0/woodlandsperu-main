/**
 * Dirección de la web pública, para los enlaces «Ir a la web pública» del panel. En local la web y el
 * panel comparten servidor (la web está en "/"); si el panel se despliega aparte, se define
 * VITE_PUBLIC_SITE_URL (valor público, p. ej. https://woodlandperu.com).
 */
export const PUBLIC_SITE_URL = import.meta.env.VITE_PUBLIC_SITE_URL?.trim() || '/'
