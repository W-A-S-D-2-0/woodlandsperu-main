# Fotografías de la web

La portada tiene cinco espacios para fotos (`src/content/home.ts` → `landingImages`). Cada foto aparece
una sola vez:

| Clave | Dónde aparece | Qué foto buscamos | Formato |
| --- | --- | --- | --- |
| `hero` | Primera pantalla, foto principal del collage | Tabla de parrilla en uso, con comida real y luz natural | Vertical 5:6, mín. 1200 px de alto |
| `heroDetail` | Primera pantalla, foto pequeña superpuesta | Detalle de una tabla (kit, presentación o veta) | Cuadrada, mín. 600 px |
| `serving` | Colecciones · Presentación (tarjeta alta) | Tabla de presentación servida | Vertical o cuadrada, mín. 1200 px |
| `grill` | Colecciones · Parrilla | Carne servida sobre una tabla | Horizontal 4:3, mín. 1000 px |
| `origin` | "Conocemos el producto desde la semilla" (y fondo desenfocado del cierre) | Plantación, taller o madera en proceso | Horizontal 4:3, mín. 1200 px |

Mientras una clave sea `null` se muestra un espacio rotulado "Fotografía pendiente".

## Fotos provisionales actuales (demo de la hackathon)

Woodland autorizó usar las fotos de su Instagram. Sin sesión, Instagram solo entrega una versión de
640 px por publicación, así que estas imágenes se ven suaves en pantallas de alta densidad y deben
reemplazarse por los originales. El diseño muestra cada foto como máximo a ~1,2 veces su tamaño
real para que no se pixele (salvo el fondo del cierre, desenfocado a propósito).

**Pendiente con Woodland:** confirmar que estas fotos muestran sus tablas reales y no son montajes o
imágenes generadas.

| Archivo en `public/images/landing/` | Origen | Tamaño | Tratamiento |
| --- | --- | --- | --- |
| `parrilla-corte-provisional.jpg` (YA NO SE USA; la portada usa `tabla-teca-taller.jpg`, tabla real de Canva) | instagram.com/woodland.peru/p/Ddnb14mEWhZ | 352×416, 37,0 KB | Recorte de la zona derecha (sin logo ni texto) |
| `kit-hotel-bar-provisional.jpg` (YA NO SE USA; `heroDetail` usa `detalle-grabado-woodland.jpg`, recorte de una foto entregada por el equipo) | instagram.com/woodland.peru/reel/Dd4_yUDRWae | 361×280, 22,1 KB | Recorte inferior de la portada del reel (sin título ni ícono de reproducción) |
| `hero-piqueo-provisional.jpg` → `serving` | instagram.com/woodland.peru/p/DeaG8R_D4rC | 640×639, 56,5 KB | Sin cambios |
| `mesa-compartir-provisional.jpg` → `grill` | instagram.com/woodland.peru/reel/DdKwV9ixBFP | 360×268, 31,4 KB | Recorte inferior de la portada del reel (sin botella de marca ni ícono) |
| `origen-madera-provisional.jpg` → `origin` | instagram.com/woodland.peru/p/DMBN8VAPOtD | 533×400, 13,4 KB | Recorte de la zona inferior (sin logo, marco ni texto) |

De las portadas de reels solo se usan zonas sin el ícono de reproducción incrustado. Descartadas: las
publicaciones cuyo contenido útil está cubierto por texto, marcas de terceros o nombres de clientes
grabados.

Los textos de la portada también provienen de las publicaciones de Woodland (teca de San Martín,
2006, acabado sin lacas, garantía de por vida y mantenimiento anual). Cada dato indica su publicación
de origen en `src/content/home.ts` y la empresa debe validar la redacción final.

## Requisitos

- **Originales de Woodland**, enviados por la empresa (WhatsApp como documento, Drive o correo), no
  capturas ni descargas de Instagram: Instagram sin sesión solo entrega versiones de 640 px, con el
  ícono de reproducción incrustado en los reels.
- **Autorización de uso** de Woodland para la web y la presentación de la hackathon.
- Sin textos, logos ni marcos superpuestos (el diseño de la web ya pone el texto).
- Sin marcas de terceros visibles (botellas, logos de clientes grabados) ni nombres de personas.
- Sin imágenes generadas con IA ni montajes presentados como producto real.

## Cómo agregarlas

1. Exporta en WebP (calidad ~80) en dos tamaños, por ejemplo `hero-800.webp` y `hero-1600.webp`.
2. Guárdalas en `public/images/landing/`.
3. Completa la entrada en `src/content/home.ts`:

```ts
hero: {
  src: '/images/landing/hero-1600.webp',
  srcSet: '/images/landing/hero-800.webp 800w, /images/landing/hero-1600.webp 1600w',
  alt: 'Tabla Super Grill con cortes de carne recién servidos', // describe la foto real
  width: 1600,
  height: 2000,
},
```

La foto del `hero` se carga con prioridad y entra con una animación de cortina; la de `origin` se
carga en diferido al hacer scroll.

## Cambio de uso (capítulos 1 a 3 de la nueva portada)

Ver `docs/design/landing-brief.md`. Con los capítulos nuevos: `hero` y `heroDetail` van en la portada; `origin` (veta) y `serving` (tabla terminada) forman la cortina del capítulo "La veta"; la tarjeta "Presentación" de Colecciones quedó sin foto (espacio rotulado) y el cierre ya no usa fondo con foto. El capítulo "La semilla" muestra un aviso "Video pendiente" hasta recibir el video del bosque.

## Fotos propias entregadas (2026-10-17)

| Archivo | Dónde se usa | Qué muestra |
| --- | --- | --- |
| `plantacion-teca.jpg` (1280×1040) | Capítulo 2 · La semilla, de fondo con velo oscuro | Trabajador con desbrozadora en la plantación de teca |
| `artesano-fresando.jpg` (960×1280) | Capítulo 3 · base de la cortina | Artesano fresando el canal de una tabla |
| `tablas-taller.jpg` (1280×720) | Capítulo 3 · lo que se descubre | Tablas terminadas apiladas en el taller |

Confirmar con Woodland el permiso de uso de las personas que aparecen. Con estas fotos, el aviso de
"Video pendiente" del capítulo 2 se retiró; un video sigue siendo opcional.

## Fotos añadidas en la segunda sesión (2026-10-17)

Entregadas por el equipo o bajadas de la página de Canva de Woodland (woodlandperu.my.canva.site). Confirmar permiso de uso.

| Archivo | Uso | Nota |
| --- | --- | --- |
| `landing/tabla-grabado.jpg` | Superficie del grabado y del logo | Recorte de Canva, aclarado y ampliado 2×; pedir original |
| `landing/cocina-moshaco.jpg` | Colecciones · Cocina | 799×533 de Canva |
| `trabajos/*.jpg` (11) | Franja de trabajos grabados y tarjeta Personalizadas | 960×1280; Tambo viene de una captura de pantalla (739 px de ancho) |
| `brand/logo-mark.png` | Encabezado, footer, favicon | De Canva (425×307 con transparencia); falta el vector |
