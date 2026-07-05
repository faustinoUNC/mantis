# Story 4.04: Asignación de técnico con disponibilidad visible

Status: done
Versión: 1.0.0

> Implementada junto al núcleo del funnel (ver STORY-401 y epics.md story 4.04). Esta spec registra el resultado.

## Resultado

El gestor elige técnico filtrado por especialidad (aprobados + activos) viendo sus franjas ANTES de asignar; el técnico acepta (→ Presupuesto vía responder_asignacion, atómico) o rechaza con motivo (vuelve a Asignación, tecnico_id null, evento).

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code, 2026-07-05)

### Completion Notes List

- E2E: Miguel (Gas) apareció con su franja Lunes 09–18; aceptación movió la gestión a Presupuesto.
- Fix de RLS: policy staff_mant_lee_usuarios_tecnicos (el gestor no podía ver esta_activo de los técnicos).

### File List

features/gestiones/{types,service}.ts · components/gestiones/{tablero,detalle,mis-trabajos}.client.tsx · app/gestiones/[id] · migraciones crear_funnel + avanzar_etapa_tecnico_conformidad + staff_mant_lee_usuarios_tecnicos
