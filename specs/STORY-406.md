# Story 4.06: Registro de avances del técnico

Status: done
Versión: 1.0.0

> Implementada junto al núcleo del funnel (ver STORY-401 y epics.md story 4.06). Esta spec registra el resultado.

## Resultado

Avances con nota + foto opcional (bucket privado gestiones, signed URLs), tipo inspeccion/avance automático según etapa. Form con capture=environment para cámara en mobile.

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code, 2026-07-05)

### Completion Notes List

- E2E: inspección y avance registrados y visibles en el detalle.

### File List

features/gestiones/{types,service}.ts · components/gestiones/{tablero,detalle,mis-trabajos}.client.tsx · app/gestiones/[id] · migraciones crear_funnel + avanzar_etapa_tecnico_conformidad + staff_mant_lee_usuarios_tecnicos
