# Story 8.1: Auditoría — timeline por gestión y historial global

Status: done
Versión: 1.0.0

## Story

Como administrador,
quiero ver quién hizo qué y cuándo — global y por gestión,
para tener trazabilidad completa y evidencia ante conflictos.

## Acceptance Criteria

1. **Given** `/admin/auditoria` (solo admin), **Then** ve el historial global de eventos de negocio (evento, gestión con dirección, actor con nombre, timestamp), más reciente primero, con filtro por tipo de evento y búsqueda por texto.
2. **And** cada evento linkea a su gestión (el timeline por gestión ya existe desde la Épica 4).
3. **And** los timestamps son fehacientes (los del event log — evidencia de plazos legales 24h/10d, domain research).

## Dev Notes

- Fuente única: `eventos_gestion` (las transiciones y acciones de negocio ya quedan todas ahí — no se inventa otra tabla). Nombres de actor: join a `usuarios` con admin client tras verificar rol admin (los actores técnicos figuran en usuarios).
- Paginación simple: últimos 200 eventos + filtros client-side (Regla #0 — se pagina de verdad cuando haga falta).

### References

- [Source: epics.md#story-81] · [Source: PRD §11]

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code, 2026-07-05)

### Completion Notes List

- E2E: /admin/auditoria con 28+ transiciones y eventos de finanzas, actores con nombre (Carla, Miguel, Fausti), filtros por tipo y búsqueda, link a cada gestión.
- Files: features/auditoria/service.ts · components/auditoria/auditoria.client.tsx · app/admin/auditoria/page.tsx · nav admin

### File List

(ver notas)
