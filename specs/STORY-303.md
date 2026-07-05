# Story 3.3: Evaluación de solicitudes de técnicos

Status: done
Versión: 1.0.0

## Story

Como administrador o gestor de mantenimiento,
quiero revisar la documentación y aprobar o rechazar solicitudes,
para controlar la calidad de la red de técnicos.

## Acceptance Criteria

1. **Given** una solicitud pendiente en `/tecnicos` (pendientes primero, con contador), **When** el evaluador abre el detalle, **Then** ve datos, especialidades y la documentación (signed URLs del bucket privado).
2. **When** aprueba, **Then** se crea la fila en `usuarios` (rol tecnico, activo) y el técnico puede loguearse → `/tecnico`.
3. **When** rechaza (motivo obligatorio), **Then** el técnico al intentar loguearse ve el rechazo con su motivo; la solicitud queda archivada (estado rechazado).

## Tasks / Subtasks

- [ ] Service: aprobarTecnico (rol-check + insert usuarios vía admin client), rechazarTecnico (motivo), obtenerTecnico con signed URLs (1h)
- [ ] UI detalle de solicitud con docs + acciones aprobar / rechazar con motivo
- [ ] E2E del ciclo: enrolar → pendiente → aprobar → login técnico ok; y camino rechazo

## Dev Notes

- Emails de resultado → Épica 5 (registrado como deuda en la story original).
- Aprobar es idempotente-safe: upsert de usuarios por id.

### References

- [Source: epics.md#story-33]

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code, 2026-07-05)

### Completion Notes List

- E2E: contador '1 solicitud pendiente' ✓, detalle con Matrícula por signed URL ✓, aprobar → upsert usuarios (rol tecnico) → Miguel loguea y cae en /tecnico ✓. Camino rechazo implementado (motivo obligatorio, mensaje en login), no E2E.

### File List

(migración crear_tecnicos_y_agenda + quitar_doc_seguro · features/tecnicos · components/tecnicos · app/tecnicos, app/enrolamiento, app/tecnico/agenda)
