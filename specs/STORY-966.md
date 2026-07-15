# STORY-966 — Desasignar técnico a mitad del flujo: reasignación, abandono y baja bloqueada

**Estado:** ✅ done · **Origen:** cards Trello #12 (sin reasignación tras aceptar) + #13 (baja de técnico con gestión en curso) + mitad "abandono del técnico" de la #22, unificadas en la card #93. Diseño salido del party mode 2026-07-14 (Mary/John/Winston/Sally + Amelia) con decisiones de Fausti.

## El problema

Hoy el vínculo técnico↔gestión no se puede deshacer a mitad del flujo:

1. **Sin reasignación tras aceptación.** `cancelarSolicitudAsignacion` solo sirve mientras el técnico no respondió. El único retroceso modelado es `presupuesto → asignacion`. Si el técnico aceptó y se enferma/abandona en ejecución o conformidad, la gestión queda atada a él para siempre.
2. **Baja de técnico a ciegas.** `cambiarEstadoTecnico(id, false)` desactiva y desloguea sin mirar si tiene gestiones vivas → gestiones huérfanas (técnico asignado que no puede operar) sin aviso ni salida. Encima la UI de /tecnicos traga el `ActionResult` (mismo bug de silencio que STORY-924 encontró en personas).
3. **El abandono del técnico no existe como concepto.** No se registra, no vuelve la gestión a asignación, no queda en las métricas del técnico.
4. **Bug latente de métricas (ya existe hoy):** cuellos de botella, tiempo de ciclo y desvío de plazo asumen que cada etapa se visita UNA vez. El retroceso `presupuesto→asignacion` existente ya duplica tiempos; con más retrocesos el error escala. Y el set de etapas terminales está hardcodeado como literales en ~6 lugares.

## Decisión (Fausti, con la sala)

1. **Primitivo único "desasignar técnico"**: nuevas transiciones `{en_ejecucion, conformidad} → asignacion` en `avanzar_etapa()` (la de `presupuesto` ya existe), con **retroceso total** — el nuevo técnico hace su propia evaluación, presupuesto, ejecución y rendición. El retroceso total es además lo que mantiene honestas las métricas por técnico: todo lo que se mide del técnico final es obra del técnico final.
2. **Qué se limpia y qué se conserva.** Se limpia: `tecnico_id`, `asignacion_aceptada`, presupuestos `enviado`/`aprobado` (→ `rechazado`, motivo "Técnico desasignado"), conformidades `subida` (→ `rechazada`), rendición (`materiales_total`, `materiales_fotos_paths`) y `costo_final`. Se conserva: **todo el historial** — eventos, avances/fotos del saliente, los archivos del bucket (solo se limpian columnas). El evento de transición congela `{motivo, imputado: gestor|tecnico, tecnico_saliente, materiales_total_saliente}` — hechos congelados: las métricas de abandono leen el evento, nunca el `tecnico_id` actual (que se pisa).
3. **Abandono = desasignación imputada al técnico.** Caso border: NO hay UI self-service del técnico en v1 — en la práctica siempre hay un llamado; lo ejecuta el gestor con un checkbox "lo abandonó el técnico". La plata que el saliente ya gastó en materiales queda FUERA del sistema (arreglo offline); el snapshot del total rendido queda en el evento por si hay discusión.
4. **Marca de urgencia explícita** (nada de estado derivado): columna `gestiones.desasignada_en` — se setea al desasignar, se limpia cuando un técnico ACEPTA. El tablero muestra badge "Reasignar" en la tarjeta.
5. **Baja de técnico = bloqueo duro** si tiene gestiones en etapas operativas (`asignacion` con solicitud, `presupuesto`, `en_ejecucion`, `conformidad`): mensaje con número y direcciones, primero reasignar o cancelar (doctrina STORY-924: "una advertencia con 'continuar igual' es un bloqueo que aprendió a mentir"). **No** bloquea con gestiones en cobro/liquidación (el técnico ya no opera ahí; el comprobante le llega por email) — confirmado por Fausti como caso border.
6. **Métricas**: el chip **"Cancela" del picker de asignación se REEMPLAZA por "Abandonó"** (decisión de Fausti mid-implementación: la cancelación muchas veces no es culpa del técnico — el dato justo para elegir técnico es el abandono, que sí es imputable). `StatsTecnico` pierde `pctCancelacion`/`nTerminadas` (quedaban sin uso) y gana `abandonos` (conteo desde eventos congelados). Fix del doble conteo: cuellos, ciclo y desvío de plazo toman la **última visita completa** de cada etapa. Set `ETAPAS_TERMINALES` centralizado en `types.ts`.

## Implementación

### Migración (`story_966_desasignar_tecnico`)

- `gestiones` + columna `desasignada_en timestamptz`.
- `avanzar_etapa()`: whitelist `{presupuesto, en_ejecucion, conformidad} → asignacion` (reemplaza la línea de presupuesto); motivo obligatorio para ese retroceso; limpieza total (punto 2) dentro de la misma tx; enriquece el `detalle` del evento con `tecnico_saliente` y `materiales_total_saliente`; setea `desasignada_en = now()`. Permisos: misma matriz (admin o gestor owner — el técnico no se auto-desasigna).
- `responder_asignacion()`: al aceptar, `desasignada_en = null`.

### Código

- **`features/gestiones/types.ts`**: `ETAPAS_TERMINALES` exportado; `GestionResumen.desasignada_en`; `StatsTecnico.abandonos`.
- **`features/gestiones/service.ts`**: `desasignarTecnico(gestionId, motivo, abandonoTecnico)` → rpc `avanzar_etapa(..., 'asignacion', {motivo, imputado})` + borrado de notificaciones del saliente sobre esa gestión (patrón responderAsignacion/rechazo — evita 404 desde la campanita); `estadisticasTecnicos` suma `abandonos` desde `eventos_gestion` (admin client, `detalle->>tecnico_saliente` + `imputado='tecnico'`); `SELECT_RESUMEN` + `normalizarFila` con `desasignada_en`.
- **`features/tecnicos/service.ts`**: `cambiarEstadoTecnico(id, false)` cuenta con admin client las gestiones del técnico en etapas operativas → si hay, bloquea con número + direcciones.
- **`components/tecnicos/tecnicos.client.tsx`**: deja de tragar el `ActionResult` — muestra el error del bloqueo.
- **`components/gestiones/detalle.client.tsx`**: card `DesasignarTecnico` (gestor owner, etapas presupuesto/en_ejecucion/conformidad con técnico aceptado): motivo obligatorio + checkbox "El técnico abandonó el trabajo"; se elimina el botón suelto "← Volver a Asignación" de `EvaluacionPresupuesto` (un solo camino); `Actividad` muestra "Técnico desasignado" con motivo e imputación; picker de técnicos con chip "Abandonó".
- **`components/gestiones/tablero.client.tsx`**: badge "Reasignar" (tono urgente) cuando `desasignada_en` y etapa `asignacion`.
- **`features/metricas/service.ts` + `components/metricas/panel-metricas.client.tsx`**: `ETAPAS_TERMINALES` en lugar de literales; `cuellos` y `ejecucionPorGestion` con última visita completa por etapa.

## Criterios de aceptación

1. Con técnico aceptado en presupuesto/ejecución/conformidad, el gestor owner puede desasignarlo con motivo; la gestión vuelve a Asignación con badge "Reasignar" en el tablero; presupuesto rechazado, rendición limpia; avances y eventos del saliente siguen visibles en Actividad.
2. El técnico saliente deja de ver la gestión y no le quedan notificaciones rotas; el nuevo técnico arranca de cero (inspección → presupuesto → …).
3. Con el checkbox de abandono, el evento queda imputado al técnico y su chip "Abandonó" del picker lo cuenta; sin checkbox, no.
4. Inhabilitar un técnico con gestiones operativas se bloquea mostrando cuántas y cuáles; sin gestiones operativas (o solo en cobro/liquidación) se inhabilita normal.
5. Una gestión que pasó dos veces por una etapa cuenta UNA sola vez (última visita) en cuellos/ciclo/desvío de plazo; el funnel no cambia.
6. `tsc` + `eslint` verdes; `grep` de literales `"finalizado".*"cancelada"` reemplazados por `ETAPAS_TERMINALES` en métricas/servicios.

## Dev Agent Record

- **Migración:** `story_966_desasignar_tecnico` aplicada — columna `gestiones.desasignada_en`; `avanzar_etapa()` con retroceso `{presupuesto, en_ejecucion, conformidad} → asignacion` (motivo obligatorio, limpieza total, detalle enriquecido con `tecnico_saliente`/`materiales_total_saliente`); `responder_asignacion()` limpia `desasignada_en` al aceptar.
- **Archivos:** `features/gestiones/types.ts` (`ETAPAS_TERMINALES`, `desasignada_en`, `StatsTecnico` con `abandonos` + `desvioPlazoPct`/`nPlazo`, sin `pctCancelacion`/`nTerminadas`), `features/gestiones/ejecucion.ts` (nuevo — `ultimaEjecucionDias`, módulo puro compartido client/server), `features/gestiones/service.ts` (`desasignarTecnico` + borrado de notificaciones del saliente; `estadisticasTecnicos` con abandonos por evento y cumplimiento de plazo; selects con `desasignada_en`), `features/tecnicos/service.ts` (baja bloqueada con número + direcciones), `features/metricas/service.ts` (abandonos con nombre; `ETAPAS_TERMINALES`), `components/gestiones/detalle.client.tsx` (card `DesasignarTecnico`; fuera el botón suelto "Volver a Asignación"; picker con chips "Presupuesto"/"Plazo"/"Abandonó" — nombres consistentes con Informes, pedido de Fausti mid-implementación; Actividad "Técnico desasignado"; badge "Reasignar técnico"), `components/gestiones/tablero.client.tsx` (badge "Reasignar"), `components/tecnicos/tecnicos.client.tsx` (error visible), `components/metricas/panel-metricas.client.tsx` (última visita en cuellos/ejecución; "Se pasaron del plazo"→"Cumplimiento de plazo"; abandonos en la línea del ranking).
- **Verificación:** `tsc`+`eslint` verdes. E2E local (2026-07-14, Playwright + Supabase MCP) sobre `[PRUEBA STORY-966]`: desasignación desde En ejecución con checkbox de abandono → gestión en Asignación con badge "Reasignar" (tablero + detalle), `tecnico_id` null, presupuesto `rechazado` ("Técnico desasignado"), rendición limpia, avances conservados, evento con `{motivo, imputado: tecnico, tecnico_saliente}`; picker mostró "Abandonó 1" y el ranking de Informes "· 1 abandono"; baja de Tecnico Uno bloqueada ("tiene 12 gestiones en curso (…)") con el error visible en la fila; reasignado y aceptado → etapa Presupuesto y `desasignada_en` limpia.
