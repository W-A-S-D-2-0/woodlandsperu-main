import { useLocation } from 'react-router'
import { ButtonLink } from '../../components/ui/ButtonLink'
import { Container } from '../../components/ui/Container'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { EngravingBoard } from './EngravingBoard'
import { parseShareParams, positionLabel } from './preview-marker'

/**
 * Las vistas del grabado que el cliente vio en el chat, en una página: el enlace viaja en el mensaje de WhatsApp para que
 * Brigitte vea lo mismo que él. Todo sale de la dirección; no guarda nada ni pide datos.
 */
export function EngravingSharePage() {
  const { search } = useLocation()
  const view = parseShareParams(search)
  useDocumentTitle('Vista previa del grabado')

  if (!view) {
    return (
      <Container className="py-24">
        <h1 className="text-4xl sm:text-5xl">Este enlace no tiene una vista válida</h1>
        <p className="mt-4 max-w-md text-carbon-600">Pídele a Teca que te muestre de nuevo cómo queda tu grabado.</p>
        <ButtonLink to="/" chat className="mt-8">
          Hablar con Teca
        </ButtonLink>
      </Container>
    )
  }

  return (
    <Container className="py-16 sm:py-24">
      <meta name="robots" content="noindex" />
      <p className="text-xs font-semibold tracking-[0.22em] text-madera-700 uppercase">Vista previa del grabado</p>
      <h1 className="mt-4 text-4xl sm:text-5xl">
        «{view.line1}»{view.line2 && <span className="text-carbon-600"> · «{view.line2}»</span>}
      </h1>
      {view.model && <p className="mt-3 text-carbon-600">Tabla {view.model}</p>}
      <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {view.positions.map((position) => (
          <li key={position} className="grid gap-2">
            <EngravingBoard line1={view.line1} line2={view.line2} font={view.font} position={position} model={view.model} />
            <p className="text-sm font-semibold text-nogal">{positionLabel(position)}</p>
          </li>
        ))}
      </ul>
      <p className="mt-8 max-w-xl text-sm text-carbon-600">Imágenes de referencia. El grabado final lo confirma el equipo de Woodland antes de producir.</p>
    </Container>
  )
}
