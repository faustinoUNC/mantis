# Story 4.07: Conformidad firmada y validación

Status: done
Versión: 1.0.0

> Implementada junto al núcleo del funnel (ver STORY-401 y epics.md story 4.07). Esta spec registra el resultado.

## Resultado

El técnico sube foto de conformidad (en_ejecucion→conformidad, transición propia del técnico en avanzar_etapa); el gestor aprueba fijando costo final (default = presupuesto aprobado) → Facturación, o rechaza con motivo (resubir).

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code, 2026-07-05)

### Completion Notes List

- E2E: conformidad subida y aprobada con costo final $53.000; historial completo de eventos en el timeline.

### File List

features/gestiones/{types,service}.ts · components/gestiones/{tablero,detalle,mis-trabajos}.client.tsx · app/gestiones/[id] · migraciones crear_funnel + avanzar_etapa_tecnico_conformidad + staff_mant_lee_usuarios_tecnicos
