import { Link } from 'react-router'
import { brand, publicNav } from '../../content/site'
import { ButtonLink } from '../ui/ButtonLink'
import { Container } from '../ui/Container'
import { Embers } from '../ui/Embers'
import { Wordmark } from '../ui/Wordmark'

const currentYear = new Date().getFullYear()

function scrollToTop() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
}

export function SiteFooter() {
  return (
    <footer className="relative isolate overflow-hidden bg-nogal-800 text-beige">
      {/* Filo cobre en el borde superior y brasas que suben desde el pie. */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-madera to-transparent" />
      <Embers />
      <img
        src="/images/brand/logo-mark.png"
        alt=""
        width={230}
        height={215}
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -bottom-20 -z-10 w-80 opacity-[0.06] select-none"
      />

      <Container className="grid gap-12 py-16 md:grid-cols-[1.6fr_1fr_1fr]">
        <div>
          <Wordmark tone="light" />
          <p className="mt-6 max-w-sm font-display text-3xl leading-tight text-marfil">{brand.slogan}</p>
          <p className="mt-3 max-w-sm text-sm text-beige/80">{brand.tagline}</p>
          <div className="mt-7">
            <ButtonLink chat="Quiero hacer un pedido" variant="light" arrow>
              Hacer mi pedido
            </ButtonLink>
          </div>
        </div>

        <nav aria-label="Pie de página">
          <p className="text-xs font-semibold tracking-[0.22em] text-ambar uppercase">Explorar</p>
          <ul className="mt-5 grid gap-1 text-sm">
            {publicNav.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  viewTransition
                  className="group inline-flex min-h-9 items-center gap-2 text-beige/85 transition-colors hover:text-ambar"
                >
                  <span aria-hidden="true" className="h-px w-3 bg-madera transition-[width] duration-300 ease-suave group-hover:w-6" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="text-xs font-semibold tracking-[0.22em] text-ambar uppercase">Síguenos</p>
          <a
            href={brand.instagram.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-5 inline-flex min-h-11 items-center gap-3 rounded-full border border-beige/25 py-1 pr-5 pl-1 text-sm text-beige/90 transition-[border-color,color] duration-300 hover:border-ambar hover:text-ambar"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-madera-700 text-marfil transition-colors duration-300 group-hover:bg-brasa group-hover:text-nogal-800">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" />
              </svg>
            </span>
            {brand.instagram.handle}
            <span className="sr-only">(se abre en una pestaña nueva)</span>
          </a>
        </div>
      </Container>

      <div className="border-t border-beige/15">
        <Container className="flex flex-col items-start justify-between gap-3 py-5 text-xs text-beige/70 sm:flex-row sm:items-center">
          <p>
            © {currentYear} {brand.legalName}
          </p>
          <button
            type="button"
            onClick={scrollToTop}
            className="inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-beige/85 transition-colors hover:text-ambar"
          >
            Volver arriba
            <span aria-hidden="true">↑</span>
          </button>
        </Container>
      </div>
    </footer>
  )
}
