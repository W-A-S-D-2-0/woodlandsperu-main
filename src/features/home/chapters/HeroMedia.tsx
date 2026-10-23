import { useEffect, useRef } from 'react'
import type { LandingImage } from '../../../content/home'

/**
 * Medio principal de la portada: un video corto de tablas en estudio (sin sonido, en bucle).
 * El video ya viene recortado a 9:14 (sin la barra de Instagram ni los nombres de los modelos) y con las tablas centradas. Se pausa cuando sale de pantalla (ahorra
 * batería y datos) y, con "reducir movimiento", no se reproduce: se muestra la foto fija.
 */
export function HeroMedia({ fallback }: { fallback: LandingImage | null }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) void video.play().catch(() => undefined)
      else video.pause()
    })
    observer.observe(video)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="relative aspect-[9/14] w-full overflow-hidden rounded-2xl bg-beige shadow-[0_40px_80px_-30px_rgb(224_138_60/0.35)] ring-1 ring-ambar/20">
      <video
        ref={videoRef}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover motion-reduce:hidden"
        src="/videos/tablas-estudio.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      />
      {fallback && (
        <img
          src={fallback.src}
          alt={fallback.alt}
          width={fallback.width}
          height={fallback.height}
          className="absolute inset-0 hidden h-full w-full object-cover motion-reduce:block"
        />
      )}
    </div>
  )
}
