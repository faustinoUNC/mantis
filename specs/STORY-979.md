# STORY-979 — Identidad consistente de empleados: id + "Nombre (Rol)" donde se mezclan roles

**Estado:** ✅ done · **Origen:** inconsistencias detectadas por Fausti en la ronda de prueba de STORY-978 (la copia "Gestor: Ramiro Zarate" parecía el actor; el filtro de gestor del kanban no distingue a dos usuarios con el mismo nombre) + party mode 2026-07-16 (sesión a puertas cerradas).

## El problema

Con usuarios de distintos roles que comparten nombre (Ramiro Zarate admin y Ramiro Zarate gestor comercial), dos lugares del sistema quedaron ambiguos:

1. **El filtro de gestor del kanban compara por STRING de nombre** (`tablero.client.tsx`): los dos Ramiros colapsan en una sola opción, y "Admin" parece una categoría cuando es un usuario. Es el único lugar del sistema que identifica empleados por nombre en vez de por id.
2. **La copia de supervisión dice "Gestor: {nombre}"**: el rótulo choca con los roles visibles ("Gestor Comercial"/"Gestor Financiero") y deja la duda de si es el dueño de la gestión o quien ejecutó la acción (eso lo muestra la Auditoría).

## El criterio (party mode 2026-07-16 — vale para todo el sistema de acá en adelante)

- **Identidad = `usuario.id`, nunca el nombre.** Todo filtro/comparación por id.
- **Presentación = "Nombre (Rol)"** con los labels de `NOMBRE_ROL` (ya centralizados en `features/auth/types.ts`, los usa la Auditoría desde STORY-974) **solo donde la lista o el texto puede mezclar usuarios de más de un rol**. Donde el contexto ya fija el rol (campanita del gestor, vista del técnico, ranking de técnicos), nombre pelado — sin ruido.
- **"Responsable" = dueño del funnel (`gestor_id`); "actor" = quién hizo la acción.** La notificación habla del responsable; la Auditoría, del actor. Cada palabra un significado.
- Las tarjetas del kanban NO cambian (nombre solo): el filtro y el detalle desambiguan.

Racional de negocio: precisión donde se supervisa (admin), simpleza donde se trabaja (gestores/técnico). Se descartó rol-en-todos-lados (burocratiza) y prohibir gestiones del admin (el PRD deja operar al dueño a propósito).

## La solución

1. **Migración `story_979_responsable_con_rol`:**
   - `notificar_evento()`: el cuerpo de la copia de supervisión pasa de `"Gestor: {nombre} — {desc}"` a `"Responsable: {nombre} ({rol}) — {desc}"`, con el rol resuelto por un `case` de 3 valores (comentado: fuente = `NOMBRE_ROL`).
   - Prefijos ya emitidos: `"Gestor: "` → `"Responsable: "` en `notificaciones.cuerpo` (sin rol retroactivo — consistencia plena hacia adelante, prefijo hacia atrás).
2. **Filtro del kanban por id** (`tablero.client.tsx` + `types.ts` + `service.ts`): `SELECT_RESUMEN`/`SELECT_DETALLE` suman `gestor_id` y el `rol` del embed de usuarios; el select de gestor usa `gestor_id` como value y muestra `"Nombre (Rol)"` vía `NOMBRE_ROL`.

## Criterios de aceptación

1. El filtro del admin lista "Ramiro Zarate (Administrador)" y "Ramiro Zarate (Gestor Comercial)" como opciones separadas, y cada una muestra solo las gestiones de ese usuario.
2. La copia de supervisión nueva dice "Responsable: {nombre} ({rol}) — {descripción}"; las viejas quedan con "Responsable: " como prefijo.
3. La campanita del gestor y las vistas del técnico no cambian ni un píxel.
4. `tsc` + `eslint` verdes; el tablero carga igual para gestor y técnico (el embed de rol puede venir null bajo su RLS y no rompe nada).

## Dev Agent Record

- **Migración:** `story_979_responsable_con_rol` (aplicada 2026-07-16): `notificar_evento()` arma la copia con `"Responsable: {nombre} ({rol}) — {desc}"` (case de 3 roles comentado con la fuente `NOMBRE_ROL`) + update de prefijos viejos `"Gestor: "` → `"Responsable: "` (0 filas sin migrar al cierre).
- **Archivos:** `features/gestiones/types.ts` (`gestor_id`/`gestor_rol` en `GestionResumen`), `features/gestiones/service.ts` (`SELECT_RESUMEN` con `gestor_id` y `rol` en el embed — `SELECT_DETALLE` solo suma el `rol`: `obtenerGestion` ya traía `gestor_id`), `components/gestiones/tablero.client.tsx` (filtro por id con etiqueta "Nombre (Rol)").
- **Verificación:** `tsc` + `eslint` verdes. E2E real (Playwright, 2026-07-16, logueado como admin): el select del tablero lista "Ramiro Zarate (Administrador)" y "Ramiro Zarate (Gestor Comercial)" separados; filtrar por el admin da 2 gestiones y por el gestor 3 — cuadra exacto contra DB (sus otras 2 están canceladas, que no son columna del kanban por diseño de STORY-914). Campanita del admin: las nuevas dicen "Responsable: Valentina Suárez (Gestor Comercial) — {desc}" (evento sintético, limpiado por id — lección de la 978 aplicada), las viejas quedaron "Responsable: {nombre} — {desc}" sin rol como se decidió, y "Obra lista para cobrar" en el título.
