# Story 2.4: Legajos — historial de ocupación por inquilino

Status: done
Versión: 1.0.0

## Story

Como gestor,
quiero abrir y cerrar legajos que vinculan propiedad + inquilino por período,
para que el historial de obras quede asentado por ocupación (y exportable después).

## Acceptance Criteria

1. **Given** una propiedad con propietario, **When** se abre un legajo (inquilino + fecha de inicio), **Then** queda como legajo vigente — **solo puede haber UNO vigente por propiedad** (constraint en DB, no solo UI).
2. **When** se cierra el legajo (fecha de fin), **Then** pasa a histórico y se puede abrir uno nuevo con otro inquilino.
3. **And** el detalle de la propiedad (`/cartera/propiedades/[id]`) muestra legajo vigente + históricos.
4. **And** el listado de propiedades muestra Ocupada/Libre según legajo vigente.

## Tasks / Subtasks

- [ ] Migración `legajos` (id, propiedad_id FK, inquilino_id FK, fecha_inicio, fecha_fin null, creado_en) + **unique partial index** (propiedad_id where fecha_fin is null) + RLS staff-only
- [ ] Service: abrirLegajo (valida inquilino activo), cerrarLegajo, legajosDePropiedad; listado de propiedades con join de ocupación
- [ ] Página detalle de propiedad: datos + legajo vigente destacado + históricos + acciones abrir/cerrar

## Dev Notes

- El unique partial index es LA garantía del modelo (violación → error claro "ya hay un legajo vigente").
- Cerrar legajo pide fecha_fin ≥ fecha_inicio (check en DB).
- Las gestiones de mantenimiento (Épica 4) se vincularán al legajo vigente — este modelo es prerequisito.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#story-24] · [Source: specs/PRD.md#3-legajos]

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code, 2026-07-05)

### Completion Notes List

- E2E completo: abrir legajo (Marta) → Vigente → propiedad "Ocupada" en listado → intento de segundo legajo rechazado por `un_legajo_vigente_por_propiedad` (verificado por SQL directo) → cerrar → "Propiedad libre" + histórico.
- Files: components/cartera/legajos.client.tsx · app/cartera/propiedades/[id]/page.tsx · migración crear_cartera (4 tablas + RLS + unique partial index + check fechas)

### File List

(ver notas)
