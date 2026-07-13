# STORY-956 — El admin gestiona el correo y la contraseña de los empleados

**Estado:** ✅ done · **Origen:** card Trello #80 (Pendiente - Desarrollo): *"Permitir al admin gestionar el correo y el pass de los empleados"*. Depende de STORY-955 (reusa `/crear-contrasena` y el email de recovery por Resend).

## Alcance

- Solo `administrador`, desde `/admin/empleados` (gate `exigirAdmin` existente). Los técnicos siguen fuera (su email ya se edita en `/tecnicos/[id]`, STORY-948).
- **Correo**: el form de edición inline de la fila (hoy nombre + rol) suma el campo email. Si cambia, se actualiza primero `auth.users` (`updateUserById` con `email_confirm: true`) y después `usuarios`, con rollback del email en auth si falla la fila — mismo patrón de compensación que `editarDatosTecnico` (STORY-948). El empleado entra con el email nuevo de inmediato.
- **Contraseña**: botón "Restablecer contraseña" en la fila (con confirmación inline, patrón STORY-909). No se tipea ninguna contraseña: se le envía al empleado un email con el link a `/crear-contrasena` (recovery de STORY-955). La contraseña vieja sigue sirviendo hasta que setee la nueva (es un restablecimiento, no un bloqueo — para bloquear ya existe Inhabilitar).
- **Fuera de alcance**: cambiar el alta de empleados (sigue pidiendo contraseña inicial — útil para los usuarios de prueba) y cualquier gestión de contraseñas de técnicos (cubierta por `/recuperar-contrasena` de STORY-955).

## Implementación

- **`features/empleados/service.ts`**:
  - `editarEmpleado(id, { nombre, rol, email })`: valida email no vacío; si cambia, chequea contra `usuarios` (mensaje "Ya existe un usuario con ese correo."), `updateUserById` + update de `usuarios` con rollback (patrón STORY-948).
  - `restablecerContrasenaEmpleado(id)` (nueva): gate admin → busca el empleado → `linkCrearContrasena(email)` (helper de STORY-955) → `emailRecuperarContrasena` por Resend (tipo `restablecer_contrasena`).
- **`components/empleados/empleados.client.tsx`**: campo email en el form de edición; botón "Restablecer contraseña" con confirmación inline y feedback ("Link enviado a {email}").
- Sin migración.

## Criterios de aceptación

1. El admin edita el email de un empleado y este puede loguearse con el nuevo de inmediato (auth + `usuarios` en sync; rollback si falla la fila).
2. Email duplicado → error claro, sin dejar auth y `usuarios` desincronizados.
3. "Restablecer contraseña" envía el email con link a `/crear-contrasena`; el empleado setea una nueva y entra con ella.
4. La acción queda logueada en `emails_enviados` (tipo `restablecer_contrasena`).
5. Un `gestor_*` no puede ejecutar ninguna de las dos acciones.
6. `tsc` y `eslint` verdes.

## Dev Agent Record

- **Archivos:** `codigo/features/empleados/service.ts` (`editarEmpleado` con email + rollback, `restablecerContrasenaEmpleado` nueva), `codigo/components/empleados/empleados.client.tsx` (campo email en edición inline, botón "Contraseña" con confirmación + "Link enviado ✓", errores visibles en la edición). Sin migración.
- **Verificación:** `tsc` + `eslint` verdes. E2E en local contra la base real: alta de empleado de prueba → edición de email (auth.users y usuarios quedan en sync, verificado por SQL) → "Contraseña" → confirmación inline → email `restablecer_contrasena` enviado (Resend, logueado) → link de recovery → `/crear-contrasena` → login con email nuevo + contraseña nueva entra a su panel. Datos de prueba borrados al terminar.
