# STORY-1040 — El técnico entrante ve solo su tenencia del timeline (aislamiento por asignación, filtrado en el server) (v1.0)

**Estado:** 🔨 en prueba · **Origen:** pedido de Fausti (2026-07-23): "si se desasigna un técnico y se asigna uno nuevo, el nuevo puede ver absolutamente todo el timeline del técnico viejo; el nuevo debe ver solo lo suyo y nada más; el admin o cualquier rol de la inmobiliaria sí ve todo completo." Diseño cerrado en party mode (arquitecto/dev/UX/seguridad/edge-cases/pragmática).

## Problema

Cuando una gestión se reasigna (técnico viejo desasignado → técnico nuevo asignado), el técnico nuevo entra al mismo detalle `/gestiones/[id]` y en la línea de tiempo **Actividad** ve **todo el historial del técnico anterior**: sus inspecciones, notas, mediciones, fotos y eventos. Eso es información de otro contratista que no le incumbe (privacidad/prolijidad entre técnicos), y hoy no está aislada.

Dos causas de raíz:

1. **No hay un límite persistido de "desde cuándo empieza la tenencia del técnico actual".** `gestiones.tecnico_id` solo refleja al técnico **actual** (se pisa en cada reasignación) y **no existe tabla histórica de asignaciones**; el único registro es el event log (`eventos_gestion`). Reconstruir la ventana de cada técnico leyendo ese log en runtime (buscar `asignacion_aceptada`/desasignaciones y segmentar) es **exactamente "derivar estados en runtime"** que la Regla #2 del proyecto prohíbe — frágil ante rechazos, cancelaciones y reasignaciones al mismo técnico.
2. **El poco filtrado que existe hoy es cosmético en el cliente.** STORY-1029 oculta la contabilidad del adelanto del saliente, pero lo hace en el componente React (`Actividad`, prop `esTecnico`) y **el array completo de eventos igual viaja al browser** (la propia STORY-1029 lo dice: "es presentación, no es un secreto de seguridad"). Para un requerimiento de privacidad entre técnicos eso no alcanza: el filtro tiene que estar **en el server** (`obtenerGestion`), antes de devolver los datos.

## Decisión de diseño

- **Anclaje persistido, no derivado (Regla #2).** Columna nueva `gestiones.tenencia_desde timestamptz`, seteada en `asignarTecnico()` cada vez que se (re)asigna un técnico. Es el único lugar que asigna un `tecnico_id` nuevo; el RPC `responder_asignacion` y `avanzar_etapa` (desasignación) **no se tocan**.
- **Ventana pura desde la asignación (Regla #0).** El técnico ve items del timeline con `creado_en >= tenencia_desde` y **nada antes** — decisión explícita de Fausti ("solo lo suyo y nada más"): esto oculta al técnico anterior **y también** los eventos pre-asignación del gestor (relevamiento, presupuesto). No se hace excepción por eventos de la inmobiliaria.
- **Filtrado server-side.** Se filtra en `obtenerGestion()` (`features/gestiones/service.ts`) antes de devolver, no en el componente. La inmobiliaria (administrador, gestor_mantenimiento, gestor_administrativo) recibe **todo sin filtro**, como hoy.

## Alcance

1. **DB — migración** (vía `mcp__supabase apply_migration`, proyecto `ejwokycbyjtlxwusbhtt`):
   - `alter table gestiones add column tenencia_desde timestamptz;`
   - **Backfill** por gestión: el `creado_en` de la **última desasignación** (evento `tipo = "transicion"` con `a_etapa = "asignacion"` y `detalle->>'tecnico_saliente'` no nulo) si existe; si no existe ninguna, `gestiones.creado_en`. Así las gestiones ya reasignadas quedan aisladas en el acto y las que nunca tuvieron reasignación siguen mostrando todo (sin regresión).
   - RLS: sin cambios (columna del lado del server action; el filtro es aplicativo).
2. **`asignarTecnico(gestionId, tecnicoId)`** (`service.ts`): agregar `tenencia_desde: new Date().toISOString()` al `update` que setea `tecnico_id`. (Este es el único punto que introduce un técnico nuevo; cubre primera asignación y reasignaciones.)
3. **`obtenerGestion(id)`** (`service.ts`): si `actual.rol === "tecnico"`, filtrar server-side **antes de devolver** los tres orígenes del timeline por `creado_en >= gestion.tenencia_desde`:
   - `eventos` (`eventos_gestion`),
   - `avances` (mediciones/notas),
   - `conformidades`.
   Si `tenencia_desde` fuera null (defensivo, no debería tras el backfill), no filtrar (fail-open a comportamiento actual).
4. **Cliente** (`detalle.client.tsx`): el aislamiento por técnico deja de depender del componente. El filtrado STORY-1029 de contabilidad de adelantos del saliente **se mantiene como belt-and-suspenders** (la mayoría de esos eventos ya caen antes del boundary, pero cubre el borde de un `adelanto_materiales` dentro de la ventana).

## Fuera de alcance

- No se toca el RPC `responder_asignacion` ni `avanzar_etapa`/`desasignarTecnico`.
- No se crea tabla histórica de asignaciones (el anclaje `tenencia_desde` alcanza; Regla #0).
- Auditoría global (`auditoria.client.tsx`, rol staff) no cambia — ve todo.
- La vista de la inmobiliaria (admin/gestores) no cambia: timeline completo.
- Sin excepción para eventos pre-asignación del gestor (se decidió ventana pura).

## Criterios de aceptación

1. **Reasignación aísla al entrante:** gestión con un técnico A desasignado y un técnico B asignado después. B entra al detalle y en Actividad ve **solo** eventos/avances/conformidades con `creado_en >= tenencia_desde` (su "te asignaron" en adelante); **no** ve inspecciones, notas, mediciones, fotos ni eventos de A, ni los eventos pre-asignación del gestor.
2. **Filtro en el server:** el payload que recibe el técnico (server action `obtenerGestion`) **ya viene sin** los items del técnico anterior — verificable en el network/response, no solo en el render.
3. **Inmobiliaria ve todo:** admin, gestor_mantenimiento y gestor_administrativo ven el timeline completo (A + B + gestor), como hoy.
4. **Reasignación al mismo técnico:** si a B lo rechazan y lo reasignan, `tenencia_desde` se actualiza al último ingreso; B ve desde ahí.
5. **Sin regresión en gestiones existentes:** una gestión sin reasignaciones (backfill = `creado_en`) sigue mostrándole todo al técnico actual; STORY-1029 (adelanto del saliente) sigue oculto para el rol técnico.
6. `tsc`/eslint verdes.

## Dev Agent Record

- **Commit:** `7b1bb29` (2026-07-23); migración `story_1040_tenencia_desde_tecnico` aplicada en Supabase (`ejwokycbyjtlxwusbhtt`).
- **Archivos:**
  - Migración `story_1040_tenencia_desde_tecnico`: `alter table gestiones add column tenencia_desde timestamptz` + backfill (última desasignación o `creado_en`). Backfill sobre 215 gestiones: 22 con boundary de reasignación, 193 en creación, 0 nulls.
  - `codigo/features/gestiones/service.ts`: `asignarTecnico` agrega `tenencia_desde: new Date().toISOString()` al update; `obtenerGestion` trae `tenencia_desde` y, para `rol === "tecnico"`, filtra server-side `eventos`/`avances`/`conformidades` por `creado_en >= tenencia_desde` (helper `enTenencia`, comparación por `Date.getTime()`; fail-open si null). Se filtra ANTES de `nombrarSalientes` (no se resuelven nombres de eventos ocultos).
- **Verificación:**
  - `tsc --noEmit` y `eslint` verdes.
  - Datos reales: gestión reasignada con 37 eventos → el técnico actual ve 8 (su tenencia), oculta 29 del anterior. Backfill consistente (22 reasignadas / 193 sin, 0 nulls).
  - "Sin otra puerta": el único camino del técnico a los eventos es `obtenerGestion`; `RefrescoVivo` (realtime) solo hace `router.refresh()` sin cargar payload → refetch filtrado; finanzas/métricas/auditoría/cartera son solo-staff.
  - Pendiente: E2E navegador con usuario técnico de prueba.
