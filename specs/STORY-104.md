# Story 1.4: Bloqueo y habilitación en tiempo real

Status: done
Versión: 1.0.0

## Story

Como administrador,
quiero inhabilitar a cualquier empleado o técnico con efecto inmediato,
para cortar el acceso ante cualquier problema.

## Acceptance Criteria

1. **Given** un usuario activo con sesión abierta, **When** el admin lo inhabilita desde `/admin/empleados`, **Then** en segundos el usuario queda fuera (expulsado del panel sin recargar) y sus refresh tokens quedan revocados.
2. **And** al intentar loguearse de nuevo ve "Tu cuenta está inhabilitada".
3. **When** el admin lo rehabilita, **Then** puede volver a ingresar normalmente.
4. **And** el admin no puede inhabilitarse a sí mismo.

## Tasks / Subtasks

- [ ] Task 1: Backend (AC: 1, 3, 4)
  - [ ] Migración: agregar `usuarios` a la publicación `supabase_realtime`
  - [ ] `cambiarEstadoEmpleado(id, activo)`: exigirAdmin + rechazo si `id === actual.id` + update `esta_activo` + al inhabilitar, revocar sesiones vía GoTrue Admin API (`POST /auth/v1/admin/users/{id}/logout`)
- [ ] Task 2: Cliente (AC: 1, 2)
  - [ ] `BloqueoWatcher` (client, montado en PanelShell): suscripción realtime a UPDATE de la propia fila de `usuarios`; si `esta_activo=false` → signOut + redirect `/?e=inhabilitado`
  - [ ] Login: mostrar aviso si `?e=inhabilitado`; además, si hay sesión pero el usuario está inactivo, `/panel` cierra sesión y redirige con ese flag (cubre el caso sin websocket)
- [ ] Task 3: UI + verificación (AC: todos)
  - [ ] Botón Inhabilitar/Habilitar + badge de estado en la tabla de empleados
  - [ ] E2E: bloquear un empleado con sesión abierta en otra pestaña → expulsado en segundos; re-login → mensaje; rehabilitar → entra

## Dev Notes

- `obtenerUsuarioActual()` ya filtra inactivos (STORY-102) → los guards de layout expulsan en cualquier navegación; el realtime es la capa "en segundos" y la revocación de tokens la capa dura.
- Realtime respeta RLS: el usuario puede suscribirse solo a su propia fila (policy select propia ✓).
- GoTrue Admin logout: supabase-js no lo expone por id — fetch directo al endpoint con service key (server-side only).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#story-14] · [Source: specs/ARQUITECTURA.md#4] (bloqueo realtime)

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code, 2026-07-05)

### Debug Log References

- E2E verificado: con la sesión de Carla abierta en /gestion, `esta_activo=false` → **expulsada a /?e=inhabilitado en segundos** (realtime); re-login → "Tu cuenta está inhabilitada"; rehabilitada → entra normal.

### Completion Notes List

- Migración `realtime_usuarios` (publicación supabase_realtime). El aviso de inhabilitada también aparece si hay sesión válida sin usuario activo (cubre el caso sin websocket) — los RSC no pueden hacer signOut (cookies), por eso el login muestra el aviso en vez de forzar cierre.
- Revocación de refresh tokens vía GoTrue Admin API (fetch directo, supabase-js no lo expone por id) — solo cuando se inhabilita desde el service.
- El admin no puede inhabilitarse a sí mismo (chequeo en service).

### File List

- supabase (remoto): migración realtime_usuarios
- codigo/features/empleados/service.ts (cambiarEstadoEmpleado)
- codigo/components/paneles/bloqueo-watcher.client.tsx · panel-shell.tsx (mount)
- codigo/app/page.tsx (aviso inhabilitada) · components/empleados/empleados.client.tsx (toggle + badge estado)
