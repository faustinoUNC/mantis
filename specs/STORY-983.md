# STORY-983 — Reasignación: los restos del técnico saliente no son del nuevo

**Estado:** ✅ done · **Origen:** reporte de Fausti 2026-07-17 — tras desasignar y reasignar, al técnico nuevo se le habilita el presupuesto sin inspeccionar y ve el cartel "Presupuesto rechazado: Técnico desasignado — enviá uno nuevo".

## El problema

La desasignación (STORY-966) conserva a propósito el historial del saliente (avances, presupuestos rechazados, conformidades rechazadas). Pero NADA de lo que gatea o se muestra al técnico está scoped al técnico actual — el nuevo hereda los restos del anterior. Cuatro síntomas de la misma raíz:

1. **El presupuesto se habilita sin inspección propia.** El gate de UI (`hayInspeccion`) y el server-side de `enviarPresupuesto()` (STORY-943) cuentan CUALQUIER inspección de la gestión — la del saliente califica. La tabla `avances` ya tiene `tecnico_id` (se setea al registrar) pero ni el select del detalle ni el tipo lo exponen.
2. **Cartel "Presupuesto rechazado: Técnico desasignado".** `avanzar_etapa()` rechaza el presupuesto pendiente del saliente con ese motivo al desasignar; el form del técnico nuevo muestra el rechazo de `presupuestos[0]` sin mirar de quién fue. `presupuestos` NO tenía columna de autor.
3. **Mismo cartel en conformidad.** Las conformidades "subida" del saliente también se rechazan con 'Técnico desasignado' — el técnico nuevo vería "Rechazada: Técnico desasignado — subí una nueva" al terminar SU obra. `conformidades` tampoco tenía autor.
4. **Se puede terminar la obra sin avances propios.** El gate "al menos una nota de avance" (STORY-936, UI + `subirConformidad()`) cuenta los avances del saliente. Bonus: la card "Inspección del técnico" que el gestor lee al evaluar el presupuesto NUEVO mezclaba las inspecciones del saliente.

## La solución

**Todo lo que gatea o se le atribuye al técnico se filtra por el técnico actual.** Hechos históricos siguen intactos (historial/timeline muestra todo, patrón STORY-966).

1. **Migración `story_983_autoria_presupuestos_conformidades`**: `tecnico_id uuid references tecnicos` en `presupuestos` y `conformidades` (patrón de `avances`). Backfill: filas posteriores a la última desasignación de su gestión (o de gestiones nunca desasignadas) → técnico actual; las anteriores quedan `null` (= de un técnico anterior, no atribuibles — y el cartel no se muestra, que es lo correcto).
2. **Inserts con autor**: `enviarPresupuesto()` y `subirConformidad()` graban `tecnico_id`.
3. **Gates scoped** (UI + server): inspección obligatoria → inspección DEL técnico actual; "al menos un avance para terminar" → avance DEL técnico actual.
4. **Carteles de rechazo scoped**: el técnico solo ve el rechazo de SU último presupuesto / SU última conformidad. La card del gestor "Inspección del técnico" muestra solo las del asignado actual.

## Criterios de aceptación

1. Desasignar un técnico con inspección + presupuesto cargados, asignar otro, que acepte: NO ve cartel rojo, el form de presupuesto está bloqueado hasta registrar SU inspección (UI y server), y tras registrarla presupuesta normal.
2. El flujo normal (sin desasignación) no cambia: rechazo del gestor → el técnico ve el cartel con el motivo; inspección propia habilita; terminar obra exige avance propio.
3. El gestor, al evaluar el presupuesto del técnico nuevo, ve solo la inspección de ese técnico (el historial de abajo conserva todo).
4. `tsc` + `eslint` verdes.

## Dev Agent Record

- **Migración:** `story_983_autoria_presupuestos_conformidades` — columnas + backfill por último evento de desasignación (`detalle ? 'tecnico_saliente'`).
- **Archivos:** `features/gestiones/types.ts` (`tecnico_id` en `Presupuesto`, `Avance`, `Conformidad`), `features/gestiones/service.ts` (selects del detalle + gates + inserts), `components/gestiones/detalle.client.tsx` (gates y carteles scoped).
- **Verificación:** `tsc` + `eslint` verdes. E2E local 2026-07-17: gestión con inspección+presupuesto del técnico 1 → desasignado → técnico 2 aceptó → sin cartel rojo, presupuesto bloqueado hasta su propia inspección; flujo normal de rechazo del gestor intacto.
