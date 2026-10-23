import '@fontsource-variable/fraunces'
import '@fontsource-variable/manrope'
import '../styles/index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { panelRouter } from './router'

/**
 * Sistema interno de Woodland (panel). Es una aplicación separada de la web pública:
 * tiene su propio HTML (/panel/index.html) y su propio código, que la landing nunca carga.
 */
const root = document.getElementById('root')
if (!root) throw new Error('No se encontró el elemento #root')

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={panelRouter} />
  </StrictMode>,
)
