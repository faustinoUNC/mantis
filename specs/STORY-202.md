# Story 2.2: ABM de inquilinos

Status: done
Versión: 1.0.0

## Story

Como gestor o administrador,
quiero administrar inquilinos con sus datos de contacto,
para asociarlos a legajos y notificarlos por email.

## Acceptance Criteria

1. **Given** `/cartera/inquilinos`, **When** se crea/edita un inquilino (nombre, email obligatorio, teléfono, DNI opcional), **Then** queda disponible para asociar a un legajo.
2. **And** mismas reglas que propietarios: baja lógica, staff-only, sin acceso al sistema (jamás en auth.users — FR2).

## Tasks / Subtasks

- [ ] Migración `inquilinos` (id, nombre, email, telefono, dni, activo, creado_en) + RLS staff-only
- [ ] CRUD en `features/cartera/service.ts` + página `/cartera/inquilinos` (mismo patrón/componente genérico que propietarios)

## Dev Notes

- Propietarios e inquilinos comparten forma → componente `PersonasAbm` parametrizado (una sola UI, dos tablas). Regla #0: sin abstracción de DB, tablas separadas explícitas.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#story-22]

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code, 2026-07-05)

### Completion Notes List

- E2E: alta de Marta López ✓. Componente PersonasAbm compartido con propietarios (una UI, dos tablas).
- Files: app/cartera/inquilinos/page.tsx (resto compartido con 2.1)

### File List

(ver notas)
