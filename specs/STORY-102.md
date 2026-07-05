# Story 1.2: Login y acceso por rol

Status: done
Versión: 1.0.0

## Story

Como empleado o técnico,
quiero ingresar con email y contraseña y caer en el panel de mi rol,
para trabajar solo con lo que me compete.

## Acceptance Criteria

1. **Given** un usuario existente con rol asignado (administrador | gestor_mantenimiento | gestor_administrativo | tecnico), **When** hace login en `/`, **Then** es redirigido al panel de su rol (`/admin`, `/gestion`, `/administracion`, `/tecnico`).
2. **And** la tabla `usuarios` tiene RLS activo desde su primera migración, con políticas: cada usuario lee su propia fila; el administrador lee/escribe todas.
3. **And** un usuario logueado que intenta entrar al panel de otro rol es redirigido al suyo (chequeo server-side en el layout, no solo UI).
4. **Given** un inquilino o propietario, **When** se intenta cualquier acceso, **Then** es imposible: no existen en `auth.users` (FR2 — no hay signup público de empleados).
5. **And** credenciales inválidas muestran error claro en el formulario sin recargar la página.

## Tasks / Subtasks

- [ ] Task 1: Migración `usuarios` + RLS (AC: 2)
  - [ ] Enum `rol_usuario` (4 roles) + tabla `public.usuarios` (id → auth.users cascade, nombre, email unique, rol, esta_activo default true, creado_en)
  - [ ] Función `public.rol_actual()` — SECURITY DEFINER con `set search_path = ''`, devuelve SOLO el rol del propio `auth.uid()` si `esta_activo` (segura por diseño: no expone datos ajenos)
  - [ ] RLS: select propia fila (`TO authenticated USING id = auth.uid()`); admin ALL con USING + WITH CHECK vía `rol_actual()`
  - [ ] Aplicar vía MCP `apply_migration` (remoto directo — decisión del proyecto) y correr `get_advisors` security
- [ ] Task 2: Sesión y login (AC: 1, 5)
  - [ ] `middleware.ts` con el patrón `updateSession` de `@supabase/ssr` (refresh de cookies)
  - [ ] `features/auth/types.ts` + `service.ts` (`'use server'`): `obtenerUsuarioActual()` (user + fila de usuarios), `cerrarSesion()`
  - [ ] Login form client component: `signInWithPassword` con browser client (única excepción permitida: auth.*) → `router.replace('/panel')`; error inline con estilo del design system
  - [ ] `app/panel/page.tsx` (server): lee rol y redirige al panel correspondiente; sin sesión → `/`
- [ ] Task 3: Paneles por rol (AC: 1, 3)
  - [ ] Route groups `app/admin/`, `app/gestion/`, `app/administracion/`, `app/tecnico/` — cada layout verifica sesión + rol server-side (via `obtenerUsuarioActual()`), si no corresponde → redirect a `/panel`
  - [ ] Página placeholder por panel (heading + Badge del rol) usando el design system
- [ ] Task 4: Seed admin + verificación E2E (AC: 1, 5)
  - [ ] Crear usuario admin de prueba y su fila en `usuarios`
  - [ ] Playwright: login OK → cae en `/admin`; credenciales malas → error; acceso cruzado de rol → redirect

## Dev Notes

- **Regla #0**: sin claim custom en JWT (requeriría configurar el Custom Access Token Hook en el dashboard — más partes móviles). El rol se lee de `usuarios` vía `rol_actual()` en políticas y `obtenerUsuarioActual()` en la app. Si alguna vez hace falta el claim, se agrega sin romper nada. ⚠️ Esto ajusta ARQUITECTURA.md §8 ("claim de rol en JWT vía trigger" — los triggers ya no puéden setear claims; el patrón vigente es hook o lookup).
- **Seguridad (skill supabase)**: NUNCA rol en `user_metadata` (editable por el usuario); `rol_actual()` es SECURITY DEFINER pero solo devuelve el rol del caller (`auth.uid()`) → no es vector de fuga; policies con `TO authenticated` + predicado (nunca solo el rol Postgres); UPDATE del admin con `USING` **y** `WITH CHECK`.
- **Workflow remoto**: cambios de schema vía MCP `apply_migration` directo al proyecto `ejwokycbyjtlxwusbhtt` (decisión: sin stack local). Después de cada DDL: `get_advisors(security)`.
- **Patrón de clients** (CLAUDE.md §3): browser client SOLO para `signInWithPassword`/`signOut`; toda lectura de `usuarios` por server action.
- Env ya configurado en `codigo/.env.local` (URL + publishable key).

### Project Structure Notes

```
codigo/
├── middleware.ts                     (updateSession @supabase/ssr)
├── app/
│   ├── page.tsx                      (login — pasa a usar LoginForm client)
│   ├── panel/page.tsx                (router por rol)
│   ├── admin/ | gestion/ | administracion/ | tecnico/
│   │   ├── layout.tsx                (guard server-side por rol)
│   │   └── page.tsx                  (placeholder)
├── components/auth/login-form.client.tsx
└── features/auth/{types.ts, service.ts}
```

### References

- [Source: specs/ARQUITECTURA.md#2, #8] · [Source: _bmad-output/planning-artifacts/epics.md#story-12]
- [Source: skill supabase — security checklist: user_metadata, TO authenticated, USING+WITH CHECK, SECURITY DEFINER]
- [Source: https://supabase.com/docs/guides/auth/server-side/nextjs] (patrón middleware updateSession)

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code, 2026-07-05)

### Debug Log References

- Migraciones remotas aplicadas vía MCP: `crear_usuarios_y_roles`, `restringir_ejecucion_rol_actual`
- `get_advisors(security)`: 1 WARN restante e intencional (`rol_actual()` ejecutable por authenticated — solo devuelve el rol del propio caller; necesaria para las policies)
- `npm run build` limpio; E2E Playwright contra el remoto: error inline con credenciales malas ✓, login → `/panel` → `/admin` ✓, `/tecnico` con rol admin → redirect a `/admin` ✓, Salir → `/` ✓
- Falsa alarma visual: el header parecía claro en la preview del screenshot; el sampling de píxeles confirmó `rgb(21,33,27)` (tinta) — render correcto

### Completion Notes List

- Sin claim JWT custom (Regla #0): rol vía `public.rol_actual()` (SECURITY DEFINER, `search_path=''`, revocada para anon/public) + `obtenerUsuarioActual()`. ARQUITECTURA.md §8 queda ajustada por esta story.
- Usuario admin real creado vía Admin API: fauspieroni@gmail.com (rol administrador, id 435973f2-…). Contraseña inicial comunicada a Fausti — cambiarla desde el dashboard cuando quiera.
- Service role key en `codigo/.env.local` (gitignoreado).
- `usuarios.esta_activo` ya filtra en `rol_actual()` y `obtenerUsuarioActual()` — la Story 1.4 solo agrega el bloqueo realtime + revocación de sesión.

### File List

- supabase (remoto): enum `rol_usuario`, tabla `usuarios` + RLS (5 policies), función `rol_actual()`
- codigo/middleware.ts (updateSession @supabase/ssr)
- codigo/features/auth/{types.ts, service.ts, guard.ts}
- codigo/components/auth/login-form.client.tsx
- codigo/components/paneles/panel-shell.tsx
- codigo/app/page.tsx (login real) · app/panel/page.tsx (router por rol)
- codigo/app/{admin,gestion,administracion,tecnico}/{layout.tsx, page.tsx}
