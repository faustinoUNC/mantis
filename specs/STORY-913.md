# STORY-913 — El técnico ve sus gestiones finalizadas como historial (v1.0)

**Estado:** 🚧 en desarrollo · **Fecha:** 2026-07-08
**Origen:** Pedido de Fausti: el perfil técnico debe poder ver sus gestiones en etapa **finalizado**, a modo de **historial**, igual que ve las otras etapas del proceso.

## Objetivo

Que las gestiones **finalizadas** del técnico aparezcan en su home (`/tecnico` → `MisTrabajos`) como una etapa más — sección propia + opción en el selector de etapa — funcionando como historial. Hoy se excluían del todo.

## Decisión (Regla #0 + coherencia con STORY-911)

- Se aprovecha el modelo de etapas ya existente (`ETAPAS_TEC`, selector + hoja): se agrega **"Finalizado"** como etapa (tipo `historial`, sin CTA, última en el orden del funnel). Cero UI nueva: reusa `SeccionEtapa`, `SelectorEtapa` y la paginación "Mostrar más".
- Se deja de filtrar `etapa === "finalizado"` en el armado de secciones.
- La urgencia y la acción no aplican a finalizadas: card compacta (como seguimiento) con badge "Finalizado" y punto gris.

## Alcance

### `components/gestiones/mis-trabajos.client.tsx`
- `ETAPAS_TEC`: nueva def `{ id: "finalizado", label: "Finalizado", tipo: "historial", cta: null, match: etapa === "finalizado" }`, antes del catch-all "Otras". `TipoEtapa` suma `"historial"` (se renderiza como seguimiento: sin acento, punto gris, card compacta).
- Se elimina el `filter(g => g.etapa !== "finalizado")`: el agrupado ahora corre sobre **todas** las gestiones del técnico (RLS ya limita a las suyas).
- Resumen y empty-state:
  - "Requieren tu acción" cuenta solo accionables (sin cambio; finalizado no es accionable).
  - El fallback "Nada pendiente — todo en marcha" usa `hayActivas` (existe alguna no-finalizada).
  - El card "Estás al día" se muestra solo si el técnico **no tiene ninguna** gestión (antes: ninguna activa). Con solo finalizadas, ve su historial.

### Sin cambios en
- Servicios/tipos/RLS (`tableroGestiones` ya devolvía finalizadas; solo la UI las ocultaba).

## Criterios de aceptación
1. Las gestiones finalizadas del técnico aparecen en una sección "Finalizado" y como opción "Finalizado (N)" en el selector de etapa.
2. En "Todas" aparecen al final (después de las etapas activas); filtrando "Finalizado" se ve solo el historial, paginado con "Mostrar más".
3. No rompen el resumen ("requieren tu acción" sigue contando solo accionables) ni marcan urgencia/acción.
4. Un técnico con solo finalizadas ve su historial (no el card "Estás al día"); uno sin ninguna gestión sí ve "Estás al día".
5. `npx tsc --noEmit` verde y sin errores de eslint.

## Fuera de alcance
- Vista/pantalla de historial separada (se integra en el mismo home, como pidió Fausti).
- Orden cronológico especial dentro de Finalizado (usa el orden urgentes-primero → en finalizadas es indistinto; alcanza).

## Dev Agent Record
- **Commit:** 097ba82 (pusheado a main → auto-deploy)
- **Verificación (navegador real, 390px, técnico `tecnicouno` con 3 finalizadas):** el home muestra la sección "FINALIZADO · 3" con cards "Finalizado" (punto gris); el selector lista "Todas (3)" y "Finalizado (3)". No aparece "Estás al día" (tiene historial). `tsc`+`eslint` verdes.