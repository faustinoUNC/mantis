# Story 2.3: ABM de propiedades

Status: done
Versión: 1.0.0

## Story

Como gestor o administrador,
quiero administrar las propiedades de la cartera,
para que toda gestión de mantenimiento quede anclada a una propiedad.

## Acceptance Criteria

1. **Given** `/cartera/propiedades`, **When** se crea/edita una propiedad (dirección obligatoria, tipo opcional, propietario vinculado obligatorio), **Then** el listado la muestra con su propietario y su estado de ocupación (Ocupada/Libre según legajo vigente — placeholder "—" hasta STORY-204).
2. **And** el listado permite buscar por dirección (filtro client-side simple).
3. **And** baja lógica; no se puede vincular a propietario inactivo.

## Tasks / Subtasks

- [ ] Migración `propiedades` (id, direccion, tipo, propietario_id FK, activa, creado_en) + RLS staff-only
- [ ] CRUD en features/cartera + página con búsqueda y select de propietario (solo activos)

## Dev Notes

- `tipo` texto libre corto (Depto, Casa, Local…) — sin mantenedor de tipos en v1 (Regla #0).
- FK a propietarios ON DELETE RESTRICT (no hay delete igualmente).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#story-23]

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code, 2026-07-05)

### Completion Notes List

- E2E: alta de "Av. Colón 1234, 2° B" (Depto, Roberto Díaz) ✓; búsqueda client-side; badge Ocupada/Libre desde legajos.
- Files: components/cartera/propiedades.client.tsx · app/cartera/propiedades/page.tsx

### File List

(ver notas)
