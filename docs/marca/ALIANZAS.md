# Alianzas (pestaña «Alianzas» de la web)

Lista de aliados dada por el equipo el 2026-10-21. Contenido en `src/content/alliances.ts`; página en `src/features/alliances/`.
Regla: no se inventan datos. Lo que no se pudo verificar queda sin descripción o sin logo.

## Empresas

| Aliado | Qué se muestra | Fuente |
| --- | --- | --- |
| Tambo | «Cadena de tiendas de conveniencia»; logo; foto de su tabla grabada | tambo.pe (logo, sello); prensa (peru-retail, libero.pe) |
| Tramarsa | «Operaciones marítimas y portuarias»; logo | tramarsa.com.pe (logo SVG y título del sitio) |
| Redondos | «Pollo, pavo, cerdo y productos preparados»; logo (blanco, 144 px: es pequeño) | redondos.com.pe |
| Tisur | «Terminal Internacional del Sur, puerto de Matarani»; logo blanco | tisur.com.pe |
| Alexim | «Logística internacional de carga»; logo blanco; foto de su tabla grabada | alexim.com (logo) |
| Promune | Solo el nombre | No se encontró nada fiable: confirmar con Woodland qué es y pedir su logo |

## Restaurantes y parrilleros

Ya no se muestran fotos de tablas en esta sección (decisión del usuario, 2026-10-21).

- **Grillman Perú** (embajador de la marca): logo entregado por el usuario.
- **Giacomo Bocchio** (chef): foto entregada por el usuario. «Bocchio» es la grafía de la prensa.
- **Otorongo’s Grill**: logo de su sitio oficial (otorongosgrill.com.pe), que lo describe como fabricante de parrillas de acero inoxidable con catering BBQ y talleres.
- **Alemana Haus**: logo (blanco) del sitio de Salchichería Alemana Haus (salchicheriahaus.mesa247.pe); restaurante de la marca Salchichería Alemana, en San Isidro.
- **Recutecu**: logo = imagen principal del canal de YouTube (@RecutecuParrillero), entregada por el usuario (2026-10-21).
- **El Quincho**: logo («El Quincho · Costumbres Argentinas») entregado por el usuario.

## Pendiente (para Woodland)

- ~~Confirmar que cada aliado acepta que se muestre su logo~~ — confirmado por el equipo (2026-10-22): se cuenta con los permisos.
- Instagram de los restaurantes; logo y descripción de Promune; logos a color de Tisur, Redondos y Alexim.
- Fotos reales de la alianza (evento, entrega de tablas) para reemplazar los espacios solo con nombre.

## El asistente también las conoce

Teca responde «¿quiénes trabajan con Woodland?» y «¿quién es X?» con la misma lista de `alliances.ts` (`alliesReply` en `worker/services/assistant.ts`): nombres y rubros tal como están en la web, sin añadir nada.
