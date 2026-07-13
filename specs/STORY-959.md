# STORY-959 — El técnico gestiona su contacto y su contraseña desde el perfil

**Estado:** ✅ done · **Origen:** Fausti (2026-07-13): *"la inmobiliaria no debería poder cambiar datos de contacto del técnico [...] implementemos que el técnico pueda hacerlo desde dentro de la app"* + pedido previo de cambio de contraseña in-app (opción elegida: contraseña actual + nueva, sin pasar por email).

## Alcance

- **Dueño de cada dato**: el contacto (email, teléfono) es del técnico — se edita SOLO desde `/tecnico/perfil`. La identidad y lo evaluable (nombre, CUIL, especialidades, documentación) sigue siendo de la inmobiliaria (STORY-948, que se recorta: su edición pierde email y teléfono; el detalle del staff los sigue MOSTRANDO, solo lectura).
- **Perfil del técnico** (`/tecnico/perfil`, mobile-first):
  1. **Contacto editable**: email + teléfono con edición inline. Server action con sesión de técnico: valida no-vacíos y duplicados (`duplicadoPersona` excluyéndose), actualiza `auth.users` primero si cambió el email (con rollback — patrón STORY-948) y sincroniza `tecnicos` + `usuarios`.
  2. **Cambiar contraseña**: contraseña actual + nueva (mín. 8), 100% en el browser (`auth.*` permitido): re-autentica con `signInWithPassword` para verificar la actual y recién ahí `updateUser({ password })`. Sin emails de por medio (para eso ya está "¿Olvidaste tu contraseña?" en el login).
  3. El texto "Para actualizar tus datos, contactá a la inmobiliaria" pasa a nombrar solo lo que sí es de la inmobiliaria.
- **Riesgo asumido** (Regla #0): si el técnico se tipea mal el email nuevo, lo corrige él mismo desde el perfil (sigue logueado y lo ve). La inmobiliaria ya no tiene botón para eso.

## Implementación

- **`features/tecnicos/service.ts`**:
  - `actualizarMiContacto({ email, telefono })` (nueva): gate = `obtenerUsuarioActual()` con rol `tecnico` (solo aprobados y activos tienen fila en `usuarios`). Duplicados, update de auth con compensación, `tecnicos` y `usuarios.email` en sync.
  - `editarDatosTecnico` recortada a `{ nombre, cuil }`: desaparecen el update de email en auth y su rollback; dup check solo por CUIL; `usuarios` sincroniza solo el nombre.
- **`components/tecnicos/datos-tecnico.client.tsx`**: el form de edición del staff queda con nombre + CUIL (la vista de solo lectura sigue mostrando todo).
- **`components/tecnicos/perfil-tecnico.client.tsx`** (nuevo): `ContactoPerfil` (filas Correo/Teléfono con "Editar" inline) y `CambiarContrasena` (form actual + nueva con re-auth). Targets ≥44px.
- **`app/tecnico/perfil/page.tsx`**: usa los componentes nuevos + texto actualizado.

## Criterios de aceptación

1. El técnico edita su email y teléfono desde el perfil; entra con el email nuevo de inmediato y los duplicados se rechazan con el mensaje estándar.
2. El técnico cambia su contraseña con la actual + nueva; con la actual incorrecta se rechaza sin tocar nada; con la nueva entra en el próximo login.
3. El staff ya no puede editar email/teléfono de un técnico (ni por UI ni llamando la action con esos campos); nombre y CUIL siguen editables.
4. `tsc`/eslint verdes.

## Dev Agent Record

- **Archivos:** `codigo/features/tecnicos/service.ts` (`actualizarMiContacto` nueva, `editarDatosTecnico` recortada), `codigo/components/tecnicos/perfil-tecnico.client.tsx` (nuevo), `codigo/components/tecnicos/datos-tecnico.client.tsx` (solo nombre + CUIL), `codigo/app/tecnico/perfil/page.tsx`. Sin migración.
- **Verificación:** `tsc` + `eslint` verdes. E2E en local como técnico real: edición de teléfono y de email (login con el email nuevo OK, duplicado rechazado), cambio de contraseña (actual incorrecta rechazada; con la nueva entra), y detalle del staff sin campos de contacto en la edición.
