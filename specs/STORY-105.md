# Story 1.5: Mantenedor de especialidades

Status: done
Versión: 1.0.0

## Story

Como administrador,
quiero gestionar las especialidades de mantenimiento,
para que gestiones y técnicos se clasifiquen con un catálogo único.

## Acceptance Criteria

1. **Given** el mantenedor `/admin/especialidades` (solo admin), **When** se corre el seed inicial, **Then** existen las 12 especialidades del research con su flag `requiere_matricula` (Gas: true).
2. **And** el admin puede crear, renombrar y **desactivar/reactivar** especialidades (nunca borrar — baja lógica, Regla #0).
3. **And** todos los roles autenticados pueden LEER especialidades activas (las usan gestiones y técnicos), pero solo el admin las administra.

## Tasks / Subtasks

- [ ] Task 1: Migración `especialidades` + seed (AC: 1, 3)
  - [ ] Tabla: id uuid, nombre unique, requiere_matricula bool default false, activa bool default true, creado_en
  - [ ] RLS: select para authenticated; insert/update solo admin (`rol_actual()`), sin policy de delete
  - [ ] Seed: Plomería, Gas (matrícula), Electricidad (matrícula), Albañilería, Pintura e impermeabilización, Carpintería, Herrería y cerrajería, Climatización, Techos y zinguería, Vidriería, Control de plagas, Otros
- [ ] Task 2: `features/especialidades/{types,service}.ts` (AC: 2)
  - [ ] listar (todas para admin; helper `listarActivas` para el resto), crear, editar (nombre + requiere_matricula), cambiarEstado
- [ ] Task 3: UI `/admin/especialidades` + verificación (AC: todos)
  - [ ] Tabla estilo empleados: nombre, badge "Requiere matrícula", estado, editar/desactivar
  - [ ] Build + E2E

## Dev Notes

- Mismo patrón visual y de código que empleados (reusar componentes ui). No usa Admin API → alcanza RLS (server client normal).
- Electricidad con `requiere_matricula=true`: en Argentina depende de la jurisdicción — se deja exigente por defecto (el admin puede destildarla).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#story-15] · [Source: domain research — taxonomía + flag requiere_matricula]

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code, 2026-07-05)

### Debug Log References

- Seed verificado E2E: 12 especialidades activas en /admin/especialidades, Gas y Electricidad con badge "Requiere matrícula".

### Completion Notes List

- Sin policy de delete (baja lógica). RLS alcanza — sin Admin API en este módulo.
- Advisors: sin hallazgos nuevos (solo el WARN intencional de rol_actual + recomendación de habilitar leaked password protection en Auth — pendiente de dashboard).

### File List

- supabase (remoto): migración crear_especialidades (+seed 12)
- codigo/features/especialidades/{types.ts, service.ts}
- codigo/components/especialidades/especialidades.client.tsx · app/admin/especialidades/page.tsx
