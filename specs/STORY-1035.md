# STORY-1035 — Archivar exige la calificación del técnico (+ recordatorio en el tablero) (v1.0)

**Estado:** 🔨 en prueba · **Origen:** reporte de Fausti (2026-07-22) — se pueden archivar gestiones finalizadas sin calificar al técnico, y esa métrica es central para el sistema (informes de calidad, stats de asignación STORY-915).

## Problema

`archivarGestion()` solo valida `etapa = 'finalizado'` — nada impide archivar una gestión cuyo técnico nunca fue calificado. Archivada, la gestión sale del tablero y la calificación queda olvidada para siempre: hoy hay 32 finalizadas sin calificar en la base. Las métricas de calidad (promedio ⭐ del técnico, informes) se nutren de ese dato.

Además nada en el tablero recuerda la deuda: la card en Finalizado se ve igual con o sin calificación.

## Alcance

1. **Guard server-side en `archivarGestion()`** (`codigo/features/gestiones/service.ts`): al archivar (no al desarchivar), si la gestión tiene `tecnico_id` y no tiene fila en `calificaciones` → `{ ok: false }` con mensaje claro. Va con el cliente de sesión: la RLS de `calificaciones` ya deja leer a los tres roles que pueden archivar (admin, gestor owner, administrativo — verificado en DB 2026-07-22).
2. **Recordatorio en la card del tablero**: `SELECT_RESUMEN` suma el embed `calificaciones(estrellas)`; `GestionResumen` gana `calificacion_pendiente` (finalizada + con técnico + sin calificación) y `TarjetaGestion` muestra un badge ámbar "Falta calificar" en la columna Finalizado.
3. **Detalle** (`ArchivarGestion` en `detalle.client.tsx`): con calificación pendiente, el botón "Archivar gestión" se deshabilita y el texto explica que primero hay que calificar (el form de calificación ya está en la misma pantalla para el gestor owner/admin).

## Fuera de alcance

- Gestiones canceladas: no se califican y no se archivan (el guard de etapa ya las excluye) — sin cambios.
- Finalizadas SIN técnico (hoy no existe ninguna): se pueden archivar — no hay a quién calificar.
- No se fuerza la calificación en la transición a Finalizado (frenaría el funnel); el candado va solo en el archivado, que es el punto de no retorno visual.
- El técnico no ve nada de esto (su RLS no lee `calificaciones` y su vista no usa el badge).

## Criterios de aceptación

1. Archivar una finalizada con técnico sin calificar falla con mensaje claro; tras calificar, archiva normal.
2. Desarchivar sigue funcionando siempre.
3. La card en Finalizado sin calificación muestra el badge "Falta calificar"; con calificación (o sin técnico) no.
4. En el detalle, el botón Archivar aparece deshabilitado con la explicación mientras falte la calificación.
5. Regresión: tablero, Archivo y detalle cargan igual que antes; `tsc`/eslint verdes.

## Dev Agent Record

- **Commit:** _(pendiente)_
- **Archivos:** `codigo/features/gestiones/service.ts` (guard en `archivarGestion()` + embed `calificaciones(estrellas)` en `SELECT_RESUMEN` + `calificacion_pendiente` en `normalizarFila`); `codigo/features/gestiones/types.ts` (`GestionResumen.calificacion_pendiente`); `codigo/components/gestiones/tablero.client.tsx` (badge "Falta calificar"); `codigo/components/gestiones/detalle.client.tsx` (`ArchivarGestion`: botón deshabilitado + explicación).
- **Verificación:** `tsc` y eslint verdes. E2E navegador (admin, dev server): el tablero muestra el badge "Falta calificar" exactamente en las 32 finalizadas sin calificación (y en ninguna otra columna); en el detalle de la #8 el botón Archivar aparece deshabilitado con la explicación; guard server-side probado invocando el server action con el botón forzado por JS en la #11 → respuesta "Falta calificar al técnico — calificalo y después archivá." y `archivada_en` sigue null en DB; flujo feliz en la #8: calificar ⭐5 → botón se habilita → archivar OK → desarchivar OK. Consola sin errores.
