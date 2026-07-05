# Story 3.1: Alta manual de técnico

Status: done
Versión: 1.1.0

## Story

Como administrador o gestor de mantenimiento,
quiero dar de alta un técnico con sus especialidades y documentación,
para incorporarlo directamente a la red de la inmobiliaria.

## Acceptance Criteria

1. **Given** `/tecnicos` (sección compartida admin + gestor de mantenimiento; NO gestor administrativo ni técnico), **When** se crea un técnico (nombre, email, contraseña, teléfono, especialidades ≥1, documentación: DNI/matrícula (v1.1.0: sin seguro — recorte de alcance)), **Then** queda `aprobado` + activo, puede loguearse y cae en `/tecnico`.
2. **And** si alguna especialidad elegida tiene `requiere_matricula`, el archivo de matrícula es obligatorio (validado server-side).
3. **And** el listado muestra técnicos con especialidades y estado; admin y gestor de mantenimiento pueden inhabilitar/habilitar técnicos (mismo efecto realtime que STORY-104).

## Tasks / Subtasks

- [ ] Migración: tabla `tecnicos` (id→usuarios/auth, telefono, dni, estado pendiente|aprobado|rechazado, motivo_rechazo, doc_dni_path, doc_matricula_path) + `tecnico_especialidades` (M2M) + RLS (staff mantenimiento lee/edita; técnico lee su fila) + bucket privado `documentacion-tecnicos`
- [ ] `features/tecnicos/{types,service}.ts`: crearTecnicoManual (rol-check admin|gestor_mantenimiento + Admin API + upload docs + validación matrícula), listarTecnicos, cambiarEstadoTecnico (usa admin client con rol-check — la policy de usuarios es admin-only)
- [ ] UI `/tecnicos`: listado + form alta manual (checkboxes de especialidades, inputs file)

## Dev Notes

- **Modelo de acceso**: `tecnicos.id = auth.users.id`. La fila en `usuarios` (rol tecnico) se crea SOLO cuando está aprobado — un pendiente/rechazado no tiene usuarios row → no pasa ningún guard.
- Docs en bucket privado `documentacion-tecnicos` path `{tecnicoId}/{tipo}.{ext}`; subida server-side con admin client (sin policies de anon); lectura staff vía signed URLs.
- Emails (bienvenida/rechazo) llegan con la Épica 5 — acá solo el flujo.

### References

- [Source: epics.md#story-31] · [Source: STORY-105] (requiere_matricula) · [Source: patrón Admin API de STORY-103]

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code, 2026-07-05)

### Completion Notes List

- Alta manual comparte form/service con el enrolamiento (altaTecnico). Toggle inhabilitar (patrón 104, permitido también a gestor_mantenimiento vía admin client con rol-check). Sin seguro (v1.1.0).

### File List

(migración crear_tecnicos_y_agenda + quitar_doc_seguro · features/tecnicos · components/tecnicos · app/tecnicos, app/enrolamiento, app/tecnico/agenda)
