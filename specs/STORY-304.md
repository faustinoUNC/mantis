# Story 3.4: Agenda de disponibilidad del técnico

Status: done
Versión: 1.0.0

## Story

Como técnico,
quiero cargar mis franjas de disponibilidad desde el celular,
para recibir asignaciones solo cuando puedo trabajar.

## Acceptance Criteria

1. **Given** el técnico logueado en `/tecnico/agenda` (mobile-first), **When** agrega/borra franjas semanales (día + desde + hasta), **Then** su agenda refleja el cambio al instante.
2. **And** hora_hasta > hora_desde (check en DB) y máximo simple: sin solapamientos exactos duplicados (unique).
3. **And** staff de mantenimiento puede LEER la agenda de cualquier técnico (la usará la asignación en Épica 4).
4. **And** targets táctiles ≥44px, agrupada por día, acción de borrar directa (NFR2).

## Tasks / Subtasks

- [ ] Migración `franjas_disponibilidad` (tecnico_id, dia_semana 0-6, hora_desde, hora_hasta, unique(tecnico_id,dia_semana,hora_desde), check horas) + RLS (técnico CRUD propio; staff mantenimiento select)
- [ ] Service: misFranjas, agregarFranja, borrarFranja
- [ ] UI `/tecnico/agenda` mobile-first (selector día + horas, lista por día, delete por franja) + nav técnico

## Dev Notes

- Modelo semanal recurrente (patrón del MANTIS original simplificado — sin fases ni excepciones por fecha en v1).
- Franja se borra con delete real (no baja lógica — es configuración personal, sin historial que preservar).

### References

- [Source: epics.md#story-34] · [Source: MANTIS original franjas_disponibilidad — simplificado]

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code, 2026-07-05)

### Completion Notes List

- E2E: franja Lunes 09:00–18:00 agregada y visible agrupada por día ✓, mobile 390px con targets 44px. Constraint unique + check horas en DB.

### File List

(migración crear_tecnicos_y_agenda + quitar_doc_seguro · features/tecnicos · components/tecnicos · app/tecnicos, app/enrolamiento, app/tecnico/agenda)
