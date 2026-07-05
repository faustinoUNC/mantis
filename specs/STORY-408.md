# Story 4.08: Reasignación de gestor responsable (solo admin)

Status: done
Versión: 1.0.0

> Implementada junto al núcleo del funnel (ver STORY-401 y epics.md story 4.08). Esta spec registra el resultado.

## Resultado

Card de reasignación visible solo para admin en el detalle; cambia gestor_id vía service con rol-check + evento gestor_reasignado (de→a). El gestor anterior deja de ver la gestión (RLS por ownership).

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code, 2026-07-05)

### Completion Notes List

- Implementada con rol-check en service (RLS de update también lo permite solo a admin). Ownership del tablero verificada por diseño (policy ver_gestiones).

### File List

features/gestiones/{types,service}.ts · components/gestiones/{tablero,detalle,mis-trabajos}.client.tsx · app/gestiones/[id] · migraciones crear_funnel + avanzar_etapa_tecnico_conformidad + staff_mant_lee_usuarios_tecnicos
