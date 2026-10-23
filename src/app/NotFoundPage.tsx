import { ButtonLink } from '../components/ui/ButtonLink'
import { Container } from '../components/ui/Container'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

interface NotFoundPageProps {
  homeTo?: string
}

export function NotFoundPage({ homeTo = '/' }: NotFoundPageProps) {
  useDocumentTitle('Página no encontrada')

  return (
    <Container className="py-24">
      <p className="text-xs font-semibold tracking-[0.22em] text-madera-700 uppercase">Error 404</p>
      <h1 className="mt-4 text-4xl sm:text-5xl">No encontramos esta página</h1>
      <p className="mt-4 max-w-md text-carbon-600">Es posible que el enlace haya cambiado o que la página ya no exista.</p>
      <ButtonLink to={homeTo} className="mt-8">
        Volver al inicio
      </ButtonLink>
    </Container>
  )
}
