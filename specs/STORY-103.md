# Story 1.3: ABM de empleados con asignación de rol

Status: done
Versión: 1.1.0

## Story

Como administrador,
quiero dar de alta empleados y asignarles rol desde el mantenedor de empleados,
para controlar quién hace qué en el sistema.

## Acceptance Criteria

1. **Given** el admin en `/admin/empleados` (visible solo para admin), **When** crea un empleado con nombre, email, contraseña inicial y rol, **Then** el empleado puede loguearse y cae en el panel de su rol.
2. **And** el admin ve el listado completo (nombre, email, rol, estado) y puede **editar nombre y rol**.
3. **Given** un usuario no-admin, **When** intenta acceder a `/admin/empleados` o invocar los server actions, **Then** es rechazado server-side (guard de layout + chequeo de rol en el service — el service usa Admin API, NO puede confiar solo en RLS).
4. **And** el panel tiene navegación (Inicio / Empleados) siguiendo el design contract.

## Tasks / Subtasks

- [ ] Task 1: `features/empleados/{types,service}.ts` (AC: 1, 2, 3)
  - [ ] `crearEmpleado({nombre,email,password,rol})`: PRIMERO verifica `obtenerUsuarioActual()?.rol === 'administrador'` (crítico: usa `createAdminClient()` que bypasea RLS) → `auth.admin.createUser` (email_confirm) → insert fila `usuarios`; rollback del auth user si falla el insert
  - [ ] `listarEmpleados()` y `editarEmpleado(id,{nombre,rol})` con el server client normal (RLS admin ya lo permite)
  - [ ] Retornar `ActionResult` `{ok, error?}` — patrón del original
- [ ] Task 2: UI `/admin/empleados` (AC: 1, 2, 4)
  - [ ] Tabla con Card + badges de rol; formulario "Nuevo empleado" (client component, server actions)
  - [ ] Edición inline simple (nombre/rol) — sin modales complejos (Regla #0)
  - [ ] Nav en PanelShell: ítems por rol (`NAV_POR_ROL`), estilo contract (links muted, activo foreground)
- [ ] Task 3: Verificación E2E (AC: 1, 3)
  - [ ] Crear empleado gestor de mantenimiento de prueba → login → cae en `/gestion`
  - [ ] Build + Playwright

## Dev Notes

- **Seguridad crítica**: los services que usan `createAdminClient()` DEBEN verificar el rol del caller primero — RLS no aplica al service role. Patrón: `const actual = await obtenerUsuarioActual(); if (actual?.rol !== "administrador") return {ok:false,...}`.
- Sin "debe cambiar contraseña" ni invitaciones por email en v1 (Regla #0): el admin define la contraseña inicial y la comunica.
- La baja/inhabilitación NO va acá — es STORY-104 (esta story solo alta y edición).
- Design contract: tabla sobre Card, badges de rol tono neutro, botón primario esmeralda único por pantalla.
- No crear tablas nuevas (usuarios ya existe de STORY-102).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#story-13] · [Source: specs/STORY-102.md] (RLS y rol_actual)
- [Source: DESIGN.md#components] (tabla, badges, nav)

## Spec Change Log

- **v1.1.0 (2026-07-15)** — Refresco en vivo del listado: `/admin/empleados` monta `<RefrescoVivo tabla="usuarios" />` (mismo patrón que Técnicos, STORY-957). Motivo: `revalidatePath` solo refresca a la sesión que ejecutó la acción — otra sesión con la lista abierta no veía altas/ediciones/inhabilitaciones hasta recargar a mano. Sin cambios de DB: `usuarios` ya estaba en la publication `supabase_realtime` y la policy `admin_lee_todo` entrega los eventos al admin (la página es solo-admin). Trade-offs asumidos (Regla #0, mismos que Técnicos): la suscripción es a toda la tabla `usuarios`, así que actividad de técnicos también refresca (sin cambio visible, debounced); y si un evento ajeno reacomoda filtro/paginación mientras se edita inline, la fila en edición puede desmontarse y perder lo tipeado (ventana angosta, riesgo ya aceptado en STORY-957).

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code, 2026-07-05)

### Debug Log References

- Build limpio; E2E Playwright: alta de "Carla Gestora" (gestor_mantenimiento) desde /admin/empleados → login de Carla → cae en /gestion ✓

### Completion Notes List

- `crearEmpleado` verifica rol admin ANTES de usar Admin API (bypasea RLS) + rollback del auth user si falla el insert de la fila.
- Nav por rol agregada a PanelShell (`NAV_POR_ROL`). Select y table agregados al design contract antes de usarse.
- Usuario de prueba real: carla@mantis.test (gestor_mantenimiento).

### File List

- codigo/features/empleados/{types.ts, service.ts}
- codigo/components/empleados/empleados.client.tsx · components/ui/select.tsx
- codigo/app/admin/empleados/page.tsx · features/auth/types.ts (NAV_POR_ROL) · components/paneles/panel-shell.tsx (nav)
