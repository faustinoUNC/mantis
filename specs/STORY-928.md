# STORY-928 — Auditoría: buscador unificado, dirección primero y logs más legibles (v1.0)

**Estado:** ✅ done · **Fecha:** 2026-07-09
**Origen:** Fausti — (1) faltó el buscador con "Buscar por" (STORY-927) en Auditoría; (2) la columna Gestión muestra la descripción como principal en vez de la **ubicación**, rompiendo la consistencia con el tablero y el Inicio; (3) "fijate si hay algo que podamos mejorar de los logs".

## Hallazgos de la revisión (mejoras incluidas)

1. **Tipos de evento sin label**: `presupuesto_enviado_pagador` (8 eventos reales) y `asignacion_cancelada` se muestran crudos. Se agregan al mapa.
2. **Transiciones ilegibles**: "en_ejecucion → conformidad" muestra los ids del enum. Pasan a los labels humanos de `ETAPAS` (+ "Cancelada", que está fuera del funnel).
3. **El `detalle` JSON no se muestra** y es la mitad del valor de auditoría: motivo de rechazos/cancelaciones, técnico solicitado, montos (presupuesto/cobro/liquidación), pagador, medio de cobro, nuevo gestor, ref. de factura. Se renderiza un resumen compacto y humano debajo del evento.
4. **Service con query duplicada**: `historialGlobal` consulta `eventos_gestion` DOS veces (una para el embed y otra solo para `actor_id`, mismas 200 filas). Se unifica en una sola query con `actor_id` en el select.
5. **Tope silencioso**: se muestran los últimos 200 eventos sin decirlo — se explicita en el subtítulo.

## Alcance
- `features/auditoria/service.ts` — una sola query (con `actor_id`); sin cambios de contrato.
- `components/auditoria/auditoria.client.tsx` — `FiltrosLista` con "Buscar por" (Dirección · Descripción · Persona) + Tipo de evento como `extra`; columna Gestión con **dirección** como link principal y descripción secundaria; labels de etapa humanos; resumen del `detalle`; labels faltantes; subtítulo con el tope de 200.

## Criterios de aceptación
1. Auditoría tiene el mismo buscador unificado que el resto (Todo por defecto, campos Dirección/Descripción/Persona) y conserva el filtro por tipo de evento.
2. La columna Gestión muestra la dirección arriba (link al detalle) y la descripción abajo en muted — igual jerarquía que las cards del tablero y el Inicio.
3. Las transiciones se leen "En ejecución → Conformidad" (labels humanos, incluida Cancelada).
4. Los eventos con `detalle` muestran su resumen (motivo, técnico, montos formateados es-AR, pagador, medio, gestor nuevo, factura).
5. `presupuesto_enviado_pagador` y `asignacion_cancelada` tienen label.
6. `tsc` verde, eslint verde, `next build` OK.

## Dev Agent Record
- **Commit:** _(este commit)_
- **Archivos:** `features/auditoria/service.ts` (una sola query con `actor_id`) · `components/auditoria/auditoria.client.tsx` (FiltrosLista con "Buscar por", dirección como link principal, etapas legibles, `resumenDetalle`, labels nuevos, subtítulo con tope 200).
- **Verificación:** `tsc` verde · eslint verde · `next build` OK · E2E Playwright como admin: "urquiza" por Dirección = 12 eventos / por Persona = 0, "tecnico uno" por Persona = 12; captura revisada (motivos entre comillas, "$ 632.000 · 13 días", "Liquidación técnico → Finalizado", "fact. …"). Nota: hizo falta `rm -rf .next` — quedó sucio por alternar `next build` y `next dev`.
