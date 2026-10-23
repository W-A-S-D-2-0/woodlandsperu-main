# Catálogo oficial de Woodland Perú (fuente: Woodland)

Entregado por el usuario el 2026-10-21. Fuentes:

- **PDF «CATALOGO B2B»**: el que se envía a empresas que compran por cantidad (una sola página larga; trae textos e imágenes, **sin precios**).
- **Sitio de Canva** https://woodlandperu.my.canva.site/copia-de-eleva-tu-vida: mismos textos, **con medidas y precios**.

Las imágenes están en `docs/marca/imagenes-oficiales/` (`pdf-b2b/` 17 archivos, `canva/` 15 archivos; varias se repiten entre
las dos fuentes y se guardaron ambas). No están en `public/`: se copian allí solo las que se usen en la web.

> Regla del proyecto: no inventar datos de la empresa. Todo lo de abajo es texto de Woodland; lo marcado **(por confirmar)**
> es una deducción nuestra.

## Marca y propósito

- Lema: «Sostenibilidad hecha lujo» · «Sustainable Luxury» · «Elevate your tables» · «Elevate your life».
- «WOODLAND PERÚ | Lujo con origen y propósito».
- **15 años de reforestación** en San Martín, Amazonía peruana.
- Madera de teca premium de **sus propias plantaciones forestales**, con trazabilidad «desde la semilla» hasta la pieza final.
- «Woodland es la única empresa en Perú que tiene su propia Reforestadora» (@reforestadorafuturoverde). «Con cada compra nos ayudas a seguir sembrando».
- La teca tiene aceites naturales que la protegen del calor, la humedad y los microorganismos.
- Garantía de por vida con certificado; **mantenimiento gratuito al año**; resistentes a hongos, humedad y calor; repelentes al agua, grasas y manchas.
- Respaldo de **certificaciones de SERFOR** y procesos «food-friendly» de estándar internacional (texto del sitio).
- Los nombres de las tablas son palabras de la región de San Martín (homenaje al Oriente Peruano).
- Corporativo: regalos corporativos y menaje personalizado para restaurantes, hoteles y bares; proyectos a medida; «desde 10 unidades».
- Grabado personalizado («Distínguete / Stand Out»).
- Contacto: wa.me/51952969782 · redes «Woodland.group», «Woodland.peru» y «Reforestadorafuturoverde» (el PDF no indica la plataforma) · contacto comercial en el PDF: Brigitte Giraud (Ventas & UX).

## Colecciones, modelos, medidas y precios (Canva)

### Colección Parrilla y Cocina / The Master Series

| Modelo | Medida | Precio |
| --- | --- | --- |
| **Moshaco** — «la joya de la corona»; volumen, resistencia y estética imponente, para parrillero o cocinera | Large 65 × 46 × 4 cm | S/ 433.90 |
| | Medium 50 × 38 × 4 cm | S/ 378.90 |
| | Small 35 × 25 × 2 cm | S/ 197.00 |
| **Ya Vuelta** — redonda, «fusión de maderas, colores y texturas» para pizzas, piqueos, postres, panes, carnes | Circunferencia 40 × 1.5 cm | S/ 297.00 |
| **Sacha Paleta** («The Forest Paddle») — ergonomía, arte y resistencia | 52 × 30 × 2 cm (mango incluido) | S/ 335.90 |

### Colección Piqueo y Servir / The Social Series

| Modelo | Medida | Precio |
| --- | --- | --- |
| **Bosques Amazónicos** — presentación delicada y minimalista | 40 × 16 × 1.5 cm | S/ 190.00 |
| **Huambrilla** — para piqueos, quesos y embutidos | 53 × 20 × 1.5 cm | S/ 216.00 |
| **Ñañito** — servicio individual versátil | 30 × 18 × 1.5 cm (costados boleados) | S/ 178.00 |

## Comparación con el catálogo que hoy tiene el proyecto (base de datos)

Hoy: Super Grill (XL 65*46*4, L 50*38*4, Petit 35*25*2), Chunky (Estándar), Serving Board (Trapezoide 15*1.5, Rectangulo 60*17.5*1.5,
Petit Rectangulo 15*1.5), Serving (X Long 104*20*1.5, Small 53*20*1.5). **Todos con «A cotizar»** (sin precio publicado).

- **Moshaco = Super Grill** (coinciden las tres medidas) **(por confirmar)**: pasa de «A cotizar» a 433.90 / 378.90 / 197.00.
- **Huambrilla = Serving Small** (53*20*1.5) **(por confirmar)**: S/ 216.00.
- Nuevos en el catálogo oficial y no en la base: **Ya Vuelta, Sacha Paleta, Bosques Amazónicos, Ñañito**.
- En la base y **no** en el catálogo oficial: Chunky, Serving Board (3 medidas) y Serving X Long. **Decisión del usuario (2026-10-21): se mantienen publicados** junto al catálogo oficial, sin cambios (siguen «A cotizar»).
- Escrita (sin aplicar): `supabase/migrations/20261021100000_catalogo_oficial.sql`. Renombra sin borrar (los SKU no cambian), agrega los 4 modelos nuevos y las dos colecciones. Falta el OK del usuario para aplicarla a la nube (ver «Cómo se aplica una migración a la nube» en `docs/CONTINUAR.md`).

## Imágenes

Las dos fuentes traen fotos de ambiente; el nombre del modelo va **después** de su foto en el sitio, y así se rotularon.

| Archivo (`pdf-b2b/` y `canva/`) | Qué es |
| --- | --- |
| `07-moshaco-…`, `08-ya-vuelta-…`, `09-sacha-paleta`, `15/14-bosques-amazonicos`, `14/03-huambrilla`, `13-nanito` | Foto de cada modelo |
| `10-grabado…`, `11-grabado-…`, `12-grabado…` | Ejemplos de grabado (nombre en esquina, El Quincho, Alemana Haus, The Grillfather, cuchillos cruzados) |
| `01-tabla-con-coctel…`, `03-parrillero…` (solo PDF) | Fotos de uso (bar, parrilla) |
| `04-hombre-en-plantacion…`, `16/15-mujer-en-el-bosque…`, `05-bosque-de-teca-blanco-y-negro` (solo Canva) | Origen / bosque |
| `02` y `17` logos | Logo «WoodLand Peru · Sostenibilidad hecha lujo» (en el PDF, dos tamaños) |
| **`05-percha-de-ropa…` y `06-sillon-de-ratan…`** | **Ajenas a la marca**: son fotos de la plantilla de Canva (una percha con ropa y un sillón). No usarlas |

La mejor resolución disponible: foto del bosque con mujer 1599×1070 (Canva), foto del bar 1312×1199 (PDF); el resto son de ~500–800 px, bajas
para pantallas grandes. Conviene pedir los originales a Woodland para la web.
