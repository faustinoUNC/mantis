# STORY-971 — El técnico avisa que no puede continuar (y el gestor decide)

**Estado:** ✅ done · **Origen:** card Trello #93, error 2 de la ronda de prueba 2026-07-15 ("no existe un flujo de cancelación para el técnico").

## El problema

Después de aceptar, el técnico no tiene NINGUNA acción si no puede seguir con el trabajo (se lesionó, le queda grande, se muda): ni un botón para avisar, ni una indicación de qué hacer. La gestión queda colgada hasta que el gestor se entera por afuera.

## Decisión de diseño (Regla #0)

El técnico **no cancela ni se desasigna solo** — eso movería el funnel y las imputaciones (abandono, cargo) que son del gestor (STORY-966/967). Lo que falta es el **aviso formal dentro del sistema**: el técnico dice "no puedo continuar" con su motivo, el gestor recibe la notificación y usa las herramientas que ya existen (desasignar con o sin imputación de abandono, o cancelar). Sin etapas nuevas, sin estados nuevos: un evento + una notificación.

## La solución

1. **Server action `avisarNoPuedoContinuar(gestionId, motivo)`** (`features/gestiones/service.ts`): valida técnico asignado (helper existente) y etapa operativa post-aceptación (`presupuesto`/`en_ejecucion`/`conformidad`), inserta evento `tecnico_no_continua` con `{motivo}`.
2. **Fila en `matriz_notificaciones`** (`tecnico_no_continua` → destino `gestor`, título "El técnico avisó que no puede continuar") — el trigger outbox existente hace el resto (notificación + realtime).
3. **UI técnico** (`detalle.client.tsx`): en etapas operativas post-aceptación, un bloque discreto "¿No podés continuar con este trabajo?" → botón que abre motivo obligatorio + confirmación con el copy "Le avisamos al gestor — va a definir cómo sigue el trabajo". El evento aparece en Actividad con su motivo (`LABEL_EVENTO`).

## Criterios de aceptación

1. Técnico asignado en Presupuesto/En ejecución/Conformidad ve el bloque; en Asignación (todavía puede Rechazar) y en etapas de plata, no.
2. Enviar el aviso con motivo → el gestor owner recibe "El técnico avisó que no puede continuar" en la campanita (link a la gestión) y el evento queda en Actividad con el motivo.
3. Sin motivo no se envía. El aviso NO mueve la etapa ni toca la asignación.
4. `tsc` + `eslint` verdes.

## Dev Agent Record

- **Migración:** la fila de `matriz_notificaciones` viajó dentro de `story_970_reset_envio_presupuesto_al_desasignar` (misma tanda).
- **Archivos:** `features/gestiones/service.ts` (`avisarNoPuedoContinuar`), `components/gestiones/detalle.client.tsx` (bloque del técnico + `LABEL_EVENTO.tecnico_no_continua`).
- **Verificación:** `tsc`+`eslint` verdes. E2E local 2026-07-15: como técnico en una gestión en Presupuesto, aviso con motivo → notificación "El técnico avisó que no puede continuar" creada para el gestor con ruta a la gestión, evento en Actividad con el motivo, etapa intacta.
