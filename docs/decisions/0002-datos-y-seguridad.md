# ADR 0002 · Datos, autenticación y seguridad

- **Fecha:** 2026-10-17
- **Estado:** aceptada

## Contexto

La plataforma maneja precios, costos, inventario, clientes y pagos. Los errores de inventario y los
comprobantes de pago falsos son problemas reales de Woodland. Hay poco tiempo, pero las reglas
críticas no pueden depender de que la interfaz "se porte bien".

## Decisiones

1. **Supabase PostgreSQL como fuente de verdad**, con migraciones SQL versionadas en
   `supabase/migrations`.
2. **Reglas críticas en la base de datos**: movimientos de inventario atómicos e idempotentes, saldos
   sin negativos (CHECK), historial y auditoría de solo inserción, transiciones de pedidos y estado de
   pago protegidos por triggers. Así se cumplen aunque falle el frontend o el backend.
3. **Privilegios mínimos**: se revocan todos los permisos por defecto de Supabase sobre `public` y se
   conceden tabla por tabla. Las tablas nuevas no son accesibles hasta que una migración lo declare.
4. **RLS por rol** con funciones `app.is_staff()` / `app.is_admin()` (esquema `app`, no expuesto).
   Los costos y el precio conversado van en una tabla aparte para no depender de permisos por columna.
5. **Clientes sin cuenta**: sus solicitudes entran por el Worker con la clave de servicio, que valida y
   calcula importes. El público no tiene permisos de escritura.
6. **Personal con Supabase Auth (correo y contraseña)**, sin registro público; altas manuales y roles
   `admin` / `workshop` en `staff_members`.
7. **El Worker verifica la sesión** (`auth.getClaims`) y lee el rol con el JWT del usuario (RLS).
   El frontend solo usa Supabase para iniciar y cerrar sesión; los datos los pide a `/api`.
8. **Pruebas de base de datos con PGlite** (PostgreSQL en WASM) y un shim de Supabase, dentro de
   `npm run test`: no requieren Docker ni una base externa.

## Alternativas descartadas

- Lógica de inventario en el Worker con varias consultas: riesgo de condiciones de carrera.
- Escrituras del panel directo a Supabase desde el navegador: reglas repartidas entre cliente y base.
- Permisos por columna para ocultar costos: más frágil que separar la tabla.

## Consecuencias

- Toda migración nueva debe incluir sus `grant` y políticas; las pruebas de `supabase/tests` deben
  ampliarse con cada tabla.
- PGlite usa PostgreSQL 18 y Supabase 17: evitar sintaxis exclusiva de 18. Antes de producción,
  aplicar las migraciones también en una base Supabase de pruebas.
- Las pruebas no cubren concurrencia real (PGlite es una sola conexión); la protección depende del
  bloqueo `FOR UPDATE` y de las restricciones, que son estándar de PostgreSQL.
