# Cómo continuar el proyecto (traspaso entre sesiones)

Última actualización: 2026-10-17 (rediseño visual sin commit; ver 3b), después del commit `5508633` (rama `main`, publicada en
https://github.com/Pedrivizz/woodlandsperu).

## 1. Contexto en 30 segundos

- **Hackathon Transforma+ MIPYME 2026**, equipo WASD. Cliente: **Corporación Wood Land Peru S.A.C.**
  (Woodland Perú), tablas artesanales de teca. Reto: aumentar ventas con transformación digital e IA.
- Plataforma con dos aplicaciones **separadas** en un mismo proyecto:
  - **Web pública** (`/`): landing de 8 capítulos ("De la semilla a tu mesa"), catálogo, grabado vivo,
    cotización, seguimiento de pedido, chat con el asistente. `index.html` → `src/main.tsx`.
  - **Sistema interno** (`/panel`): solo personal de Woodland, con login. `panel/index.html` →
    `src/panel/main.tsx`. La landing no tiene enlaces ni código del panel (lo pidió el usuario).
- Stack: React 19 + Vite 8 + TypeScript + Tailwind 4 + React Router 8 · Cloudflare Workers + Hono ·
  Supabase (PostgreSQL, Auth, RLS) · Zod 4 · Vitest + PGlite para probar la base sin Docker.
- Lee también: `CLAUDE.md`, `README.md`, `docs/architecture/README.md`, `docs/architecture/data-model.md`,
  `docs/context/cliente-woodland.md` (lo que dijo el cliente: pitch, canvas y audios).

## 2. Reglas que el usuario fijó (no romper)

- Trabajar por fases. **No desplegar**, no pagos reales ni contratar servicios sin autorización explícita.
  **No aplicar migraciones a la base remota sin su OK** y **commit solo cuando lo pida** (a veces dice
  "sin commits"). Antes de un cambio grande, avisar.
- **Las claves nunca se pegan en el chat.** Van en `.dev.vars` (Worker) y `.env.local` (solo URL y clave
  publicable de Supabase); ambos están en `.gitignore`. Si el usuario comparte una contraseña por error,
  avisarle que la cambie. No iniciar sesión con credenciales que pase por el chat.
- **No inventar datos** de Woodland (precios, plazos, certificaciones, cifras). Los textos vienen de
  entrevistas o de su Instagram. El asistente solo sabe lo de `src/content/assistant-knowledge.ts`.
- **La web no muestra stock** (decisión de Brigitte tras el caso Antamina): se muestran plazos estimados
  por cantidad (`src/content/delivery.ts`; faltan los tramos 4–19 y 31–149), precio escalonado y tope de
  100 unidades por línea (`WEB_ORDER_MAX_UNITS`); por encima se deriva a WhatsApp.
- **El asistente atiende solo (decisión del usuario, 2026-10-17)**: el dueño/administración NO conversa con los
  clientes desde el panel. La IA responde siempre, con lo que sabe (`assistant-knowledge.ts`, catálogo, plazos,
  el camino de una compra) y con hasta 40 mensajes de memoria de la conversación. Cuando algo necesita a la empresa
  (a medida, logo, reclamo, más de 100 unidades, pidió una persona) lo **anota como seguimiento** (`flag_for_team`,
  estado `needs_human` = "Por revisar") y sigue respondiendo; nunca dice "te paso con una persona". En el panel,
  Conversaciones es solo de lectura: se supervisa, se marca como revisada o se cierra. Se quitaron las rutas
  `/reply` y `/take`; las funciones SQL `staff_reply` y `take_conversation` siguen en la base sin uso (limpiarlas
  requiere una migración con OK). Gemini reintenta una vez ante 429/500/503 antes de caer al modo guiado.
- **Pago por Yape/Plin, sin pasarela (decisión del usuario, 2026-10-18)**: no se usan APIs de pago ni la IA de pago
  (Gemini cuesta; el chat funciona en modo guiado sin clave). El número y el titular van en `src/content/payment.ts`
  (`yapePlin`; cargados el 2026-10-18 con los datos que entregó el usuario; no inventar ni cambiar sin su OK). Se muestran en la
  confirmación de la cotización (/cotizar) y en el chat (al registrar una cotización y al preguntar cómo pagar). El pago
  lo confirma el equipo a mano con el código COT; el asistente nunca dice que un pago se confirmó. Falta, si se quiere,
  mostrar un QR (agregar la imagen en `public/images/pago/`) y registrar el pago en el panel.
- **El chat es la puerta principal (2026-10-20, decisión del usuario)**: ya no existen las páginas /catalogo, /corporativo ni /cotizar
  (ni el carrito). Sus rutas viejas redirigen al inicio y abren el chat. Todos los botones de la web llaman a
  `openChat(mensaje?)` (`src/features/chat/open-chat.ts`; el widget escucha el evento). Nav pública: Inicio, Nosotros y un
  botón «Chatea con nosotros». El pedido/cotización paso a paso **sin IA** vive en `worker/services/guided-flow.ts`: el estado se
  reconstruye del historial (cada pregunta termina con una marca fija, `FOOTER`), así que no hay tabla nueva. Si el flujo está en marcha,
  sigue por él aunque haya Gemini; si no, Gemini conversa y, si falla o tarda más de 10 s, responde el modo guiado. Pedidos con logo,
  piezas a medida o más de 100 unidades se anotan para el equipo / quedan como cotización. Productos sin precio publicado → cotización.
  Pendiente: el script de la demo (`scripts/demo/grabar-demo.mjs`) aún visita /catalogo y /cotizar; hay que rehacer esas escenas con el chat.
- **Pedido por chat que reserva stock solo (2026-10-18)**: cuando el cliente confirma con un sí claro, el asistente
  llama a `create_order` → `PublicData.submitOrder` → `create_direct_order` (canal `web_chat`, cliente confirmado,
  `confirm`) que crea el pedido, calcula precios en la base y **reserva el stock** (`apply_inventory_movement`). Si no
  alcanza (23514) se reintenta sin confirmar (queda "pendiente de confirmación") y si falla todo, cae a cotización. Sin
  migraciones. Límites: solo productos con variante y precio, máx. 100 unidades en total, un pedido por conversación
  (se reconoce por el código PED-… en las respuestas del asistente), nunca se habla de stock. La conversación queda
  "Por revisar" para que el equipo **verifique el pago por Yape/Plin**; el pedido NO nace pagado. Riesgo conocido: una
  reserva sin pago ocupa stock hasta que el equipo cancele el pedido en el panel. **Requiere el asistente con IA**
  (GEMINI_API_KEY); en modo guiado (sin clave) el chat manda a /cotizar, que genera una cotización.
- **Precios**: `catalog_price` está en null (a cotizar) hasta que Woodland confirme cuál es el público.
- **INVENTARIO.xlsx es confidencial**: nunca se versiona (`.data/` y `*.xlsx` están en `.gitignore`).
- Responder en español, directo. Nada de pantallas simuladas: lo no hecho usa `PendingModule`.
- Red de la sede: si `registry.npmjs.org` falla, instalar con
  `npm_config_registry=https://registry.yarnpkg.com npm install ...`.
- Windows: en PowerShell usar `npm.cmd` / `npx.cmd`. Python no está instalado.

## 3. Qué está hecho (verificado: `npm run check` pasa, 33 archivos y **350 pruebas**)

| Área | Estado |
| --- | --- |
| API pública | `GET /api/catalog` (sin stock), `POST /api/quotes`, `POST /api/orders/status`, con Zod y límite por IP |
| API del panel | Resumen, productos, inventario, cotizaciones, pedidos, clientes, venta directa, conversaciones, **reportes** (`GET /api/admin/reports?from&to`) |
| Panel (`src/features/admin/`) | Resumen con accesos rápidos, Productos, Inventario, **Producción** (celular, para Alex), Cotizaciones, Pedidos, **Nueva venta**, Clientes, **Conversaciones**, **Reportes**. Menú con iconos y estados por color |
| Web pública | Landing de 8 capítulos con fotos reales, catálogo con precio por cantidad, grabado vivo (5 posiciones, esquina inferior derecha por defecto) conectado a la cotización, empresas con vista previa del logo, seguimiento de pedido, chat flotante |
| Base de datos | 8 migraciones (001–008) aplicadas en Supabase `aafesgaxhnvwmbjrfrex` (organización W.A.S.D), inventario cargado, RLS y pruebas |
| Chat y asistente | Chat web con Gemini (`gemini-flash-latest`) y contexto de Woodland; modo guiado sin IA si no hay clave; el asistente atiende solo y anota seguimientos para el equipo (sin chat humano) |
| WhatsApp | **Código listo e inactivo** (webhook con firma HMAC, idempotente, envío desde el panel) |
| Reportes (Fase 8) | Indicadores por rango de días de Lima: consultas, derivaciones, cotizaciones (por estado/canal, conversión), pedidos, ventas confirmadas, ticket promedio, lo más vendido, bajo mínimo y sin stock. Cálculo en `worker/services/reports.ts` (sin migraciones). Exportación unidireccional a Google Sheets: CSV (Resumen, Cotizaciones, Pedidos) y, si el Worker tiene los secretos `GOOGLE_*`, botón «Enviar a Google Sheets» (`POST /api/admin/reports/export`, `worker/integrations/google-sheets.ts`: JWT RS256 con WebCrypto, vacía y reescribe las tres pestañas) |

Migraciones (`supabase/migrations/`): `…130000` roles y auditoría · `…130100` catálogo · `…130200` ventas ·
`…130300` inventario · `…130400` RLS · `…140000` flujo comercial · `…150000` venta directa
(`create_direct_order`) · `…160000` conversaciones (`record_conversation_message`, `request_handoff`,
`link_conversation_quote`, `staff_reply`, `take_conversation`, `set_conversation_status`).
Las aplicadas se registran en `supabase_migrations.schema_migrations`. Nunca editar una ya aplicada.

### Cómo se aplica una migración a la nube (el `supabase db push` se cuelga en esta red)

SQL Editor del proyecto → pegar el SQL → Run → registrar la versión:
`insert into supabase_migrations.schema_migrations (version, name) values ('<versión>', '<nombre>') on conflict do nothing;`
Verificar tablas, RLS y permisos con consultas a `pg_class`, `pg_policies` y `has_function_privilege`.

### Piezas clave

- `worker/services/assistant.ts`: reglas del asistente que **no dependen del modelo**. Solo puede derivar a
  una persona o registrar una cotización con las mismas reglas del formulario público; no confirma pedidos,
  no cobra, no dice stock. `wantsHuman` deriva por palabras clave sin gastar IA.
- `worker/services/chat.ts`: un turno de conversación. Si falla Gemini, ese turno se responde en modo guiado;
  si falla todo, se deriva a una persona (el cliente nunca se queda sin respuesta).
- `worker/integrations/gemini.ts`: API REST. Modelo por defecto `gemini-flash-latest` (alias vigente);
  `gemini-2.5-flash` ya no está disponible para cuentas nuevas. Tiempo límite 25 s, razonamiento `low`.
- `worker/integrations/whatsapp.ts` y `worker/routes/whatsapp.ts`: verificación, firma y envío.
- `src/features/admin/use-admin-api.ts`: las recargas conservan los datos anteriores (no borran lo que se escribe).
- `scripts/import-inventory.ts`: importador del Excel (ya ejecutado por el usuario).
- Los mensajes de conversación **no se pueden editar ni borrar** (tabla de solo inserción).

## 3b. Rediseño visual de la web pública (2026-10-17, segunda sesión)

Pedido del usuario: la web se veía simple (paleta y animaciones). Cambios hechos, verificados con
`npm run check` (350 pruebas):

- **Paleta** (`src/styles/index.css`): el verde `bosque` pasó a **`nogal`** (madera oscura cálida) en todo el proyecto;
  `madera` es ahora el cobre del logo. Tokens nuevos: `brasa` y `ambar` (solo sobre fondos oscuros), `arena`, `selva`
  (verde, sin uso aún). Referencias: la página de Canva de Woodland (cobre, madera oscura, arena) y la demo de otro equipo
  (woodland-peru-demo.vercel.app, solo como inspiración visual; no se copió nada).
- **Portada y cierre** sobre `.surface-warm` con brasas (`components/ui/Embers.tsx`, también en el footer), titular con
  brillo cobre (`.text-shimmer`) y anillos que respiran y giran (`.ring-breathe`, `.spin-slow`). Todo se apaga con
  `prefers-reduced-motion`.
- **Capítulo 2 (semilla)** ya no empieza vacío: el contenido está visible desde el primer pixel; recorrido fijo de 210vh.
- **Capítulo 3 (oficio)**: cortina que arranca de inmediato, zoom que se asienta, marco cobre y borde de brasa; 190vh.
- **Capítulo 4 unificado** (`features/engraving/PersonalizeChapter.tsx`): pestañas "Para ti" (grabado vivo) y "Para tu
  empresa" (logo). Ambos paneles quedan montados para no perder lo escrito. El grabado tiene un frente naranja que se
  enfría a oscuro.
- **Franja de trabajos grabados** (`EngravedWorksStrip`, datos en `src/content/engraved-works.ts`, fotos en
  `public/images/trabajos/`). Permiso de las marcas confirmado por el equipo (El Quincho, FPF, Alexim,
  Tambo, etc.).
- **Superficie de la tabla del grabado**: foto real de la página de Canva de Woodland
  (`public/images/landing/tabla-grabado.jpg`, recorte aclarado y ampliado 2×; Canva solo publica hasta 960×1280).
  **Reemplazar por el original en alta resolución.**
- **Colecciones**: las cuatro tarjetas ya tienen foto (Cocina: Moshaco de Canva; Personalizadas: grabado real).
- **Logo**: `public/images/brand/logo-mark.png` (anillos, de Canva) en el encabezado, el footer y el favicon
  (`public/favicon.png`). Falta el vector oficial (SVG) y la versión en blanco para fondos oscuros.
- **Footer rehecho** (filo cobre, brasas, columnas Explorar / Síguenos, botón Volver arriba). Sin datos de contacto
  inventados.
- Revisado en celular (375 px): se corrigió un desborde horizontal en Colecciones. /catalogo, /cotizar, /corporativo y
  /nosotros sin desborde.
- **Portada con video** (`features/home/chapters/HeroMedia.tsx`): `public/videos/tablas-estudio.mp4` (495 KB, 720×1280, 12 s;
  reel de Woodland entregado por el equipo, grabado de pantalla de Instagram, se recorta la franja superior con
  `scale-[1.13]`). Se pausa fuera de pantalla y con `prefers-reduced-motion` se muestra `landing/tabla-teca-taller.jpg`.
  **Pedir a Woodland el original sin la barra de Instagram y en mayor resolución.** Foto pequeña: `landing/detalle-mano-cabuya.jpg`.
- **Botón del chat** (`hooks/useBackdropTone.ts`): cambia a brasa sobre fondos oscuros y a nogal sobre claros.
- **Instagram de Woodland** (visto con la sesión del usuario): la bio enlaza WhatsApp 51948467431, un "CATÁLOGO 2025" en
  Google Drive y un Linktree. El catálogo 2025 aún no se abrió; puede traer medidas y precios reales (no usarlos sin validar).
- **Páginas internas con el mismo estilo** (Catálogo, Cotizar, Corporativo, Nosotros): `PageIntro` ahora es una portada cálida con anillos y brasas; botones y campos en cobre; tarjetas del catálogo con elevación; Cotizar y Corporativo con la columna "Cómo funciona" (`QuoteAside`); Corporativo cierra con la franja de trabajos grabados. **Nosotros ya no es `PendingModule`**: usa solo textos y fotos ya publicados (origen 2006, atributos, oficio, compromiso). Falta el equipo (sin textos ni fotos de personas aprobados).

Imágenes **no usadas** a propósito: las pequeñas (≈390 px) y las que parecen generadas con IA (miel con higos,
sándwich, tablas con aguacate, papas); confirmar con Woodland si son reales antes de usarlas como producto.

**Año del capítulo 2 (2026-10-18: el usuario volvió a pedir 2019 y quedó en 2019 en la web y en el asistente; antes se había devuelto a 2006):** el usuario pidió 2019, pero el Instagram de Woodland dice "un sueño sembrado en 2006" (publicación DLBRs2RP220); se devolvió a **2006** con la frase original. Si Woodland confirma otro año (p. ej. el del registro de plantaciones, que en una etiqueta aparece con "2019"), cambiarlo en `home.ts` y en `assistant-knowledge.ts`. La página /nosotros sigue con `PendingModule` (historia de Woodland: falta contenido aprobado).

## 4. Cómo correrlo en local

1. `npm install`, luego copiar `.dev.vars.example` a `.dev.vars` y `.env.local` y llenarlos (el usuario
   pone las claves; ver `.dev.vars.example`). Variables: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
   `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY`, opcional `GEMINI_MODEL`, y las `WHATSAPP_*`.
2. `npm run dev` → http://localhost:5173 (web) y http://localhost:5173/panel (panel).
3. Admin existente: `anyelobill31@gmail.com` (rol `admin`). Un usuario nuevo se crea en Supabase →
   Authentication → Add user (Auto Confirm) y luego
   `insert into public.staff_members (user_id, role, full_name) select id, 'admin', '<nombre>' from auth.users where email = '<correo>';`
4. Si el servidor de desarrollo deja la página en blanco o da "fetch failed" tras muchos cambios, reiniciarlo.
5. Datos de prueba que quedaron en la base: varias conversaciones del chat y las cotizaciones COT-000002 y
   COT-000003 (cliente "Carlos Prueba"). No se pueden borrar los mensajes; las cotizaciones sí.

## 5. Qué falta (en orden sugerido)

1. **Panel revisado en pantalla (2026-10-17)**, en escritorio y celular. Confirmado de punta a punta: una
   respuesta desde Conversaciones llega al chat web del cliente. Se pulió: Resumen agrupado ("Por atender" /
   "Actividad"), cotizaciones con total "Por definir" mientras falten precios (la lista trae `pendingPrices`),
   inventario más compacto con aviso "Sin stock", la bandeja se refresca al responder/tomar/cerrar y el hilo ya
   no mueve la página. Pendiente menor: el nombre del admin en la base es "Nombre Apellido" (cambiar en
   `staff_members.full_name`) y el Resumen muestra el contacto en vez de la empresa (viene de `get_admin_dashboard`;
   cambiarlo requiere migración).
2. **WhatsApp (Fase 6)**: Woodland debe crear el **WhatsApp Business dedicado**. Luego: secretos
   `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`;
   registrar `https://<dominio>/api/whatsapp/webhook` en Meta; completar `contact.whatsapp` en
   `src/content/site.ts` para que la web derive al número. Responder fuera de las 24 h del último mensaje
   del cliente no es posible.
3. **Avisos al equipo**: notificar cuando hay una derivación y alerta de stock bajo al celular.
4. **Cotización como enlace y mensaje de WhatsApp listo** (pedido por el cliente).
5. **Logo del cliente subido** (Supabase Storage; requiere migración nueva).
6. **Pagos (Fase 5)**: Mercado Pago en sandbox, webhooks; 50% de adelanto en corporativos. El estado de pago
   ya está protegido en la base. Decidir cuándo se descuenta el stock (pago o despacho).
7. **Despliegue** (preparado, NO ejecutado; guía paso a paso en `docs/DESPLIEGUE.md`: API en Cloudflare, landing y panel como dos proyectos de Vercel): `npx wrangler secret put` de cada secreto en Cloudflare, el límite del chat
   (`CHAT_RATE_LIMITER`) ya está en `wrangler.jsonc`, y considerar Cloudflare Access sobre `/panel`.
8. **Fase 8: Google Sheets directo ya está en el código; falta conectarlo (lo hace Woodland).** Sin secretos el botón
   no aparece y queda el CSV. Pasos:
   1. En [Google Cloud Console](https://console.cloud.google.com) crear (o elegir) un proyecto y activar **Google Sheets API**.
   2. *IAM y administración › Cuentas de servicio › Crear*; copiar su correo (`…@….iam.gserviceaccount.com`).
   3. En esa cuenta: *Claves › Agregar clave › JSON*. Se descarga un archivo: **no se comparte por chat ni se sube al repo**.
   4. Crear la hoja de cálculo en Google Sheets y **compartirla como Editor con el correo de la cuenta de servicio**.
      El Id de la hoja es lo que va entre `/d/` y `/edit` de su URL.
   5. Local, en `.dev.vars` (ver `.dev.vars.example`): `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SHEETS_REPORT_ID` y
      `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (campo `private_key` del JSON, en una línea con los `
` literales).
      En Cloudflare: `npx wrangler secret put` de cada uno (los tres son secretos).
   6. Reiniciar el Worker, abrir Reportes y pulsar «Enviar a Google Sheets». Crea las pestañas Resumen, Cotizaciones y
      Pedidos si faltan y las **vacía y reescribe** en cada envío (solo de ida; no editar a mano esas pestañas).
   Si Google responde 403/404 el panel pide revisar que la hoja esté compartida con ese correo. Pruebas con fetch
   simulado en `worker/integrations/google-sheets.test.ts` y `worker/routes/panel.test.ts`; sin probar contra Google real.
   Fase 7: landing definitiva con las fotos originales.
9. **Rotar la clave secreta de Supabase** (se mostró en el chat una vez) y cambiar la contraseña del admin
   (es débil y se compartió en el chat).

## 6. Preguntas abiertas para Woodland

- Precio público: ¿catálogo o "conversado"? Rangos y precios reales por cantidad.
- Plazos de los tramos 4–19 y 31–149 unidades.
- Número de WhatsApp Business; tipo de comprobante (factura, boleta o ambas).
- Límites de revisión humana (monto y cantidad) y vigencia de cotizaciones (`business_settings`, hoy null ⇒
  se revisa todo).
- ¿El grabado tiene costo adicional? Tipos de letra reales y cuántos caracteres caben.
- Validar garantía de por vida y mantenimiento anual, y el permiso de uso de las personas en las fotos.
- Unidad de las medidas (¿cm?), medidas faltantes (Chunky, Serving Board) y si se mantiene el Excel en paralelo.
- Cifras que no coinciden entre documentos: exactitud de inventario (50% vs 60%) y tiempo de cotizar
  (1 hora vs 20 min).

## 7. Prompt para pegar en la nueva sesión

> Continúa el proyecto Woodland Perú. Lee primero `CLAUDE.md`, `docs/CONTINUAR.md` y
> `docs/context/cliente-woodland.md`. Corre `npm run check` para confirmar que todo pasa. Respeta las reglas
> de la sección 2: no pegues claves en el chat, no apliques migraciones a Supabase ni hagas commits sin mi
> OK, y no inventes datos de Woodland. Empieza por el punto 1 de la sección 5 (ver y pulir el panel en
> pantalla) y trabaja por etapas verificables.

## 8. Pago por Yape desde el chat (2026-10-22)

Decisión del usuario: Teca pide primero los datos del cliente (nombre, correo, celular y dirección), y al crear el
pedido pide el pago inmediato al Yape de Alex (`src/content/payment.ts`). El cliente sube la captura con el clip del
chat; al recibirla, el pedido queda **pagado, confirmado y en producción** y Teca le responde «recibimos tu pago».

- Flujo guiado (`worker/services/guided-flow.ts`): nombre → persona/empresa → tablas → celular, correo y dirección (en un solo mensaje, al concretar el pedido) → confirmar. Decisión del usuario (2026-10-24): al empezar solo se pide el nombre.
  Ya no hay pasos «contacto» ni «indicaciones»; la dirección va a `orders.shipping_address`.
- Captura: `POST /api/chat/payment-proof` (multipart: `token` + `file`; JPG/PNG/WebP ≤ 5 MB, se revisan los bytes).
  Servicio: `worker/services/payment-proof.ts`. Se guarda en el bucket privado `payment-proofs`.
- Base: migración `20261022100000_pago_yape_chat.sql` (tabla `order_payments`, bucket, función
  `record_chat_payment`, política de lectura para el panel). **Pendiente de aplicar a la nube** (hace falta el OK del
  usuario). Sin ella, subir la captura responde el aviso de error y deja el caso anotado para el equipo.
- Panel: el detalle del pedido muestra el pago y un enlace «Ver captura» (URL firmada de 1 hora).
- Riesgo conocido: el pago se da por recibido con cualquier imagen válida; no se compara con la app de Yape. El pedido
  lleva una nota interna «verificar en la app de Yape». Mejora posible: revisar la captura (monto, fecha, código) o
  dejar el pago en «pendiente» hasta que el equipo lo valide.

## 9. Dudas de personalización: vista previa y WhatsApp de Brigitte (2026-10-23)

Decisión del usuario: Teca atiende las dudas de grabado (nombre en el centro, arriba a la derecha, «no me gusta»…)
mostrando la tabla con el texto en distintas posiciones, y si ninguna convence ofrece un botón al WhatsApp de
Brigitte (948 467 431, `brigitte` en `src/content/site.ts`) con un mensaje corto ya escrito.

- Las «imágenes generadas» no usan IA: el chat dibuja la tabla con el texto en cada posición (`EngravingBoard`).
  Es instantáneo, gratis y no inventa nada. Sirve para cualquier modelo (usa la foto de tabla limpia de la web).
- `worker/services/engraving-help.ts`: reglas por palabras clave (sin IA). Va antes de Gemini y también dentro del
  pedido paso a paso (una duda en el paso del grabado no se toma como el texto a grabar). Recomienda primero las
  esquinas y el centro al final (según la dueña casi nadie lo pide). Tras una ronda de recomendaciones, si sigue sin
  convencerse, deja solo el botón de Brigitte.
- Marcas en el texto de Teca: `[[vista|…]]` y `[[whatsapp|…]]` (`src/features/engraving/preview-marker.ts`).
- Un enlace de WhatsApp no puede adjuntar imágenes: el mensaje nombra la posición pedida y las recomendadas. Decisión
  del usuario: el mensaje NO lleva ningún vínculo. La página `/grabado` (vistas por dirección) queda disponible pero
  ya no se enlaza desde el mensaje.
- Al elegir una posición, Teca la confirma y le dice cómo dejarla anotada en el pedido (escribirla junto al texto en la
  pregunta del grabado). El pedido paso a paso aún no tiene un paso propio de «posición».
- Vista por modelo: cada tabla se dibuja con su silueta y proporción oficial (`src/content/board-shapes.ts`):
  Moshaco con canal, Ya Vuelta redonda, Sacha Paleta con mango, Bosques Amazónicos y Huambrilla alargadas, Ñañito con
  costados boleados. Sin modelo conocido se usa la tabla genérica. Son siluetas de referencia sobre la textura real de
  la teca; cuando Woodland entregue fotos limpias de cada modelo conviene cambiarlas por esas.

- Saludo (2026-10-24): el primer mensaje de Teca pide el nombre (`src/content/chat-greeting.ts`). El chat avisa `greeted` y el servidor guarda el saludo como primer mensaje de la conversación; si el cliente responde con su nombre, Teca lo saluda y el pedido no lo vuelve a preguntar (`nameFromGreeting`). Si responde con otra cosa, se atiende y el pedido pedirá el nombre.

## 10. Alarma de stock bajo (2026-10-24)

La base abre la alerta sola cuando lo disponible llega al mínimo de la variante (`app.sync_stock_alert`). El panel la vigila solo: `LowStockAlarm` (en `AdminLayout`, todas las pantallas y los dos roles) consulta `/inventory` cada 30 s, muestra un aviso arriba y hace sonar una sirena (Web Audio, sin archivos) y una voz que dice el producto y cuántas unidades quedan. Suena una vez por variante mientras siga baja (se recuerda en el navegador); «Repetir alarma» la vuelve a sonar; hay un interruptor «Alarma con sonido / en silencio». El navegador bloquea el sonido hasta que se toca la página: el aviso lo indica con «Activar sonido». Pendiente a futuro: avisar fuera del panel (WhatsApp o correo) y proponer la orden de producción.

Datos de prueba en producción (2026-10-23): las 8 variantes se llevaron a 100 con «Ajuste (+)» (motivo «Stock inicial de 100 unidades…»), mínimo 30 en todas, y Moshaco Large se bajó a 30 con «Ajuste (−)» para simular la alarma.

- Conversación nueva tras terminar (2026-10-23): al cancelar, registrar una cotización o confirmar el pago, el chat deja la conversación como está y, si el cliente escribe «Hola» o toca un botón, abre otra (token nuevo → fila nueva en Conversaciones, con su hora de inicio). Un pedido que espera su pago NO cuenta como terminado (la captura se sube en esa conversación). Texto al cancelar: «Listo, cancelé el pedido. No dudes en volver a escribirnos.». La bandeja «Todas» se ordena por la última actividad; el nombre que dio el cliente queda como nombre de la conversación. Las conversaciones anteriores no se cierran solas (queda abierto: cerrar al terminar necesitaría una función nueva en la base).

## 11. Citas con la administración y pedido en una tarjeta (2026-10-28)

- **Agendar cita**: el chat siempre tiene el botón «📅 Agendar cita» (y junto al WhatsApp de Brigitte). El cliente elige día y hora, deja nombre y celular (`AppointmentCard`); `POST /api/chat/appointments` guarda la cita (tabla `appointments`, migración `20261028100000_citas.sql`) y deja constancia en la conversación. Brigitte la ve en el panel, módulo **Citas** (pendientes / atendidas / canceladas) y en el resumen («Citas pendientes»). Una sola cita pendiente por hora (índice único). **Horarios provisionales** en `shared/config/appointments.ts` (lun–vie 9–12 y 15–17 h, sáb 9–12 h, 14 días, 2 h de antelación; hora de Lima): Brigitte debe confirmarlos. La migración NO está aplicada en la base remota: hace falta autorización.
- **Pedido en una tarjeta** (`OrderCard`): al pedir, la pregunta de modelos se contesta con una tarjeta (modelos con foto y precio, `select` de cantidad, casilla de grabado). Manda un solo mensaje («Quiero 2 unidades de Moshaco Large. Grabado: «Ana»» / «… Sin grabado.») que el pedido paso a paso entiende (`parsePrefill`): con grabado muestra la vista previa y «Continuar»; después pide los datos y el pago.
