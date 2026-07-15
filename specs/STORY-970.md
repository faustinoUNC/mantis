# STORY-970 — Card #93: el contador "Rechaza" cuenta de verdad + el presupuesto nuevo exige su propio envío

**Estado:** ✅ done · **Origen:** card Trello #93, errores 1, 7 y 8 de la ronda de prueba 2026-07-15.

## Los problemas

1. **"La métrica de rechazos no se incrementa."** El chip "Rechaza" del picker de asignación (`estadisticasTecnicos`) calcula `rechazadas/respondidas` sobre las **gestiones actualmente asignadas** al técnico (`asignacion_aceptada === false` filtrando por `tecnico_id`) — pero `responder_asignacion()` pone `tecnico_id = null` al rechazar, así que la gestión rechazada sale del conjunto en el mismo acto: el contador no puede incrementar NUNCA. Mismo bug conceptual que los abandonos resolvieron en STORY-966: los hechos históricos no pueden leerse del estado vivo, se leen de los eventos.
2. **Botón "Reenviar al propietario por mail"** cuando un segundo técnico (post-desasignación) genera un presupuesto nuevo — debería decir "Enviar".
3. **Se puede aprobar el presupuesto nuevo sin enviarlo** al pagador. La misma raíz que el punto 2: el gate (`resolverPresupuesto`) y el label leen `gestiones.presupuesto_enviado_en`, que quedó seteado por el envío del presupuesto del técnico ANTERIOR y sobrevive al retroceso de la desasignación.

## La solución

1. **Rechazos desde eventos**: `estadisticasTecnicos` suma una consulta a `eventos_gestion` (`tipo in (asignacion_aceptada, asignacion_rechazada)`, `actor_id in ids` — el actor de la respuesta ES el técnico: `responder_asignacion` valida `tecnico_id = auth.uid()`). `pctRechazoAsig = rechazos / (aceptas + rechazos)` y `nAsig = aceptas + rechazos`. Histórico completo, inmune al pisado de `tecnico_id`.
2. **Migración `story_970_reset_envio_presupuesto_al_desasignar`**: el retroceso de `avanzar_etapa()` (desasignación) también pone `presupuesto_enviado_en = null` — el presupuesto del nuevo técnico exige su propio envío (gate) y el botón vuelve a decir "Enviar". Data fix incluido: se lo anula en las gestiones que hoy están en `asignacion` con `desasignada_en` seteado (desasignadas antes del fix).

## Criterios de aceptación

1. Técnico rechaza una asignación → al reabrir el picker, su "Rechaza" % subió (y `nAsig` cuenta la respuesta).
2. Tras desasignar y reasignar, el nuevo presupuesto muestra "Enviar al pagador por mail" (no "Reenviar") y aprobar sin enviarlo da el error de siempre ("Enviá el presupuesto al pagador por email antes de aprobar").
3. El flujo normal (sin desasignación) no cambia: enviado una vez, el botón dice "Reenviar" y se puede aprobar.
4. `tsc` + `eslint` verdes.

## Dev Agent Record

- **Migración:** `story_970_reset_envio_presupuesto_al_desasignar` — `avanzar_etapa()` con `presupuesto_enviado_en = null` en el retroceso + data fix de las desasignadas pendientes.
- **Archivos:** `features/gestiones/service.ts` (`estadisticasTecnicos`: respuestas desde eventos).
- **Verificación:** `tsc`+`eslint` verdes. E2E local 2026-07-15: técnico rechazó la asignación de "Prueba de inquilinos" → el picker pasó de "Rechaza s/d" a mostrar el % con la respuesta contada; `presupuesto_enviado_en` de la gestión desasignada quedó null por el data fix.
