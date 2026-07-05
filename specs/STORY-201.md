# Story 2.1: ABM de propietarios

Status: done
Versión: 1.0.0

## Story

Como gestor (mantenimiento o administrativo) o administrador,
quiero administrar propietarios con sus datos de contacto,
para vincularlos a propiedades y enviarles documentación por email.

## Acceptance Criteria

1. **Given** `/cartera/propietarios` (accesible para admin y ambos gestores; NO técnico), **When** se crea/edita un propietario (nombre, email obligatorio validado, teléfono, CUIT opcional), **Then** queda disponible para vincular a propiedades.
2. **And** baja lógica únicamente (campo `activo`); sin delete.
3. **And** el técnico no puede acceder ni leer (RLS por rol).

## Tasks / Subtasks

- [ ] Migración `propietarios` (id, nombre, email, telefono, cuit, activo, creado_en) + RLS staff-only (los 3 roles de gestión, no técnico)
- [ ] `features/cartera/{types,service}.ts` — CRUD propietarios (ActionResult)
- [ ] Sección `/cartera` con layout multi-rol (guard `exigirAlguno`) + página propietarios con el patrón mantenedor (tabla + form + edición inline)
- [ ] Nav "Cartera" para admin y gestores

## Dev Notes

- Email obligatorio: es el canal de facturas y resúmenes de obras (PRD §2). Regex simple + type=email.
- RLS: select/insert/update para `rol_actual() in ('administrador','gestor_mantenimiento','gestor_administrativo')`; sin policy para técnico ni delete.
- Reusar patrón visual de empleados (design contract: table).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#story-21] · [Source: specs/PRD.md#3]

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code, 2026-07-05)

### Completion Notes List

- E2E: alta de Roberto Díaz por Carla (gestora) ✓. RLS staff-only por migración crear_cartera.
- Files: features/cartera/{types,service}.ts · components/cartera/{personas.client,tabs.client}.tsx · app/cartera/{layout,propietarios/page}.tsx · guard exigirAlguno · NAV_POR_ROL con Cartera

### File List

(ver notas)
