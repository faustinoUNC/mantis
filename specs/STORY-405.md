# Story 4.05: Inspección, presupuesto y decisión de pagador

Status: done
Versión: 1.0.0

> Implementada junto al núcleo del funnel (ver STORY-401 y epics.md story 4.05). Esta spec registra el resultado.

## Resultado

El técnico registra inspección (avances tipo inspeccion) y envía presupuesto (materiales + mano de obra + notas). El gestor aprueba confirmando pagador (default = sugerido por causa) → En ejecución; o rechaza con motivo; o vuelve a Asignación.

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code, 2026-07-05)

### Completion Notes List

- E2E: presupuesto $18.000+$35.000 aprobado con pagador propietario (sugerido por desgaste).

### File List

features/gestiones/{types,service}.ts · components/gestiones/{tablero,detalle,mis-trabajos}.client.tsx · app/gestiones/[id] · migraciones crear_funnel + avanzar_etapa_tecnico_conformidad + staff_mant_lee_usuarios_tecnicos
