# Story 3.2: Auto-enrolamiento de técnico

Status: done
Versión: 1.0.0

## Story

Como técnico nuevo,
quiero registrarme desde el celular cargando mi documentación,
para postularme a trabajar con la inmobiliaria.

## Acceptance Criteria

1. **Given** la página pública `/enrolamiento` (mobile-first, linkeada desde el login), **When** el técnico completa datos, especialidades y sube su documentación (matrícula obligatoria si aplica), **Then** queda una solicitud `pendiente` y NO puede acceder al sistema.
2. **When** el técnico pendiente intenta loguearse, **Then** ve "Tu solicitud está en evaluación" (no el mensaje de cuenta inhabilitada).
3. **And** el módulo `/tecnicos` muestra contador de solicitudes pendientes (la notificación push llega con la Épica 5).

## Tasks / Subtasks

- [ ] Service `enrolarTecnico` (server action SIN sesión): admin client crea auth user + fila tecnicos estado=pendiente + docs al bucket; SIN fila en usuarios
- [ ] Página pública `/enrolamiento` con el estilo editorial del login (design contract), pantalla de éxito "solicitud enviada"
- [ ] Login: distinguir estado — sesión sin usuarios row → consultar tecnicos: pendiente→"en evaluación", rechazado→motivo, si no→inhabilitada

## Dev Notes

- Anti-abuso v1: validaciones de campos + email único (Regla #0: sin captcha por ahora — canal interno de la inmobiliaria).
- RLS tecnicos: policy select `id = auth.uid()` permite al técnico pendiente (sin rol) leer su propio estado en el login.

### References

- [Source: epics.md#story-32] (AC ajustada: contador local, no notificación) · [Source: STORY-301] (modelo)

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code, 2026-07-05)

### Completion Notes List

- E2E completo: validación de matrícula obligatoria (Gas) rechaza sin archivo ✓; con archivo → solicitud enviada ✓; login pendiente → 'Tu solicitud está en evaluación' (mensaje diferenciado) ✓. Técnico de prueba: miguel@mantis.test.

### File List

(migración crear_tecnicos_y_agenda + quitar_doc_seguro · features/tecnicos · components/tecnicos · app/tecnicos, app/enrolamiento, app/tecnico/agenda)
