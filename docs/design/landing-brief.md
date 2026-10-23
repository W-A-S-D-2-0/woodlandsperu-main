# Brief de la nueva web pública · "De la semilla a tu mesa"

Estado: **propuesta para aprobar** (2026-10-17). Decisiones del equipo hasta ahora: concepto
"De la semilla a tu mesa", incluir personalizador de grabado, catálogo y cotización reales,
seguimiento de pedido y sección de empresas con logo, y aportar fotos y video propios.
No es una réplica de la demo `woodland-peru-demo.vercel.app`: toma de ella solo la idea del
personalizador y de la sección para empresas.

Reglas que se mantienen: nada de datos inventados (precios, plazos, garantías, clientes) y
textos solo de las entrevistas o del Instagram de Woodland, con su origen anotado.

## Idea y frase para contar

> "Es la web donde escribes tu nombre y ves cómo nace tu tabla, desde la semilla de teca
> hasta tu mesa."

## Gramática

**Capítulos** (escenas distintas, no un solo vuelo continuo). Cada capítulo se comporta distinto
al hacer scroll, para que el visitante siga avanzando a ver qué hace el siguiente.

## Recorrido y curva de emociones

| # | Capítulo | Qué siente la persona | Recurso | Qué lo provoca |
|---|---|---|---|---|
| 1 | Portada | Deseo, calidez | Capas con profundidad (foto de tabla, grano, vapor de parrilla) | Titular "Sostenibilidad hecha lujo." y una tabla grande que se mueve distinto que el fondo |
| 2 | La semilla | Calma, asombro | Fijo + texto que se arma (pin) | Foto o video del bosque en San Martín; 2006, "un sueño sembrado para reforestar" |
| 3 | La veta | Cercanía | Revelado con cortina (reveal) | Macro de la madera que se descubre y se convierte en la tabla |
| 4 | **El grabado (pico)** | **Emoción, "es mía"** | **Movimiento propio: grabado vivo** | Escribes tu nombre y se quema sobre la tabla, trazo a trazo |
| 5 | Elige tu tabla | Confianza, orden | Recorrido lateral (pan) | Catálogo real: medidas, "a cotizar", disponibilidad |
| 6 | Para tu empresa | Ambición | Interacción con puntero | Tu logo sobre la tabla (vista previa) |
| 7 | Cómo se hace y seguimiento | Tranquilidad | Línea de tiempo vertical | Pasos reales del proceso y consulta de pedido con código |
| 8 | Cierre | Resolución, ganas de pedir | Cierre que se queda | Tu grabado queda en la tabla y se convierte en la cotización |

Dos capítulos seguidos nunca usan el mismo recurso. El pico es el capítulo 4 y tiene el mayor
espacio de scroll; el 3 es más silencioso que él.

## Movimiento propio ("grabado vivo")

El texto que la persona escribe se graba sobre la foto real de la tabla con un efecto de
quemado progresivo (oscurece la veta y avanza por el trazo). Lo distinto de la demo: **lo
grabado viaja al sistema**. Al pulsar "Pedir esta tabla" pasa a la cotización como
personalización de la variante elegida, sin reescribirlo, y el equipo lo ve en el panel.

## Lo que se conecta al sistema (ya existe)

- Catálogo, disponibilidad y precios publicados: `GET /api/catalog`.
- Cotización: `POST /api/quotes` (carrito y formulario ya hechos).
- Seguimiento: `POST /api/orders/status` (falta la pantalla).

## Lo que necesita decisión o aprobación

- **Subir el logo**: guardar archivos requiere Supabase Storage, una migración nueva y su
  política de acceso. Hasta que se apruebe, la vista previa del logo se queda en el navegador
  y no se envía el archivo.
- **Texto de garantía, mantenimiento y plazos**: pendientes de que Woodland los valide.
- **Precios**: siguen "a cotizar" hasta que la empresa decida cuál publicar.

## Material que debe aportar el equipo

Guardar los originales en `public/images/landing/originales/` (sin recortes ni filtros).
Indicar de qué publicación o sesión vienen y si hay permiso de uso.

| Prioridad | Qué | Para qué capítulo | Formato recomendado |
|---|---|---|---|
| Alta | 1 foto vertical y 1 horizontal de una tabla terminada, vista cenital y sobre fondo limpio o mesa | 1 y 4 (base del grabado) | JPG/PNG de al menos 2400 px, lado largo |
| Alta | Una foto de la tabla de cada línea del catálogo (Super Grill, Serving Board, Serving, etc.) | 5 | al menos 1600 px |
| Alta | Video del bosque de teca o de la plantación (10 a 20 s, sin audio) | 2 | MP4 1080p o más |
| Media | Video del taller: corte, lijado, aceite (10 a 20 s) | 7 | MP4 1080p o más |
| Media | Macro de la veta y un nudo | 3 | 2400 px |
| Media | Foto con la mesa servida y personas | 1 y 8 | 2000 px |
| Baja | Logo de Woodland en SVG o PNG con fondo transparente | encabezado y cierre | SVG |

## Orden de construcción propuesto

1. Capítulos 1 a 3 (portada, semilla, veta) con el material recibido.
2. Capítulo 4 (grabado vivo) y su conexión a la cotización.
3. Capítulo 5 (catálogo en recorrido lateral) y 8 (cierre).
4. Capítulo 6 (empresas) y 7 (proceso y seguimiento).
5. Revisión en móvil, sin animaciones (movimiento reducido) y accesibilidad.
