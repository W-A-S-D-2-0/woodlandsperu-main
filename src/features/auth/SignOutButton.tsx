import { useRef, useState } from 'react'
import { primaryButtonClass, secondaryButtonClass } from './AuthNotice'

/** Botón «Cerrar sesión» que antes pregunta «¿Deseas cerrar sesión?». */
export function SignOutButton({ onConfirm, className }: { onConfirm: () => Promise<void> | void; className: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [pending, setPending] = useState(false)

  return (
    <>
      <button type="button" className={className} onClick={() => dialog.current?.showModal()}>
        Cerrar sesión
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="sign-out-title"
        className="m-auto w-[calc(100%-2.5rem)] max-w-sm rounded-2xl border border-linea bg-marfil p-6 text-carbon backdrop:bg-carbon/40"
      >
        <h2 id="sign-out-title" className="text-xl">
          ¿Deseas cerrar sesión?
        </h2>
        <p className="mt-2 text-sm text-carbon-600">Tendrás que volver a ingresar con tu correo y contraseña.</p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" className={secondaryButtonClass} onClick={() => dialog.current?.close()}>
            No, quedarme
          </button>
          <button
            type="button"
            className={primaryButtonClass}
            disabled={pending}
            onClick={async () => {
              setPending(true)
              await onConfirm()
              setPending(false)
              dialog.current?.close()
            }}
          >
            Sí, cerrar sesión
          </button>
        </div>
      </dialog>
    </>
  )
}
