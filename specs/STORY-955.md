# STORY-955 — Verificación de email en el registro de técnico + contraseña por link al aprobar + "olvidé mi contraseña"

**Estado:** ✅ done · **Origen:** card Trello #78 (Pendiente - Desarrollo): *"Desarrollar validación estándar por email al registrar técnico. Ídem para cuando el técnico quiere cambiar pass. (Ver si se puede hacer usando el mail ausitesis+nombreTecnico@gmail.com...)"* + decisión de Fausti (2026-07-13): la solicitud solo llega al staff después de verificar el email, y al aprobar se envía un link para crear la contraseña.

## Decisiones

- **Todos los emails salen por Resend** (canal existente en `features/email/service.ts`, con log en `emails_enviados`), nunca por el SMTP de Supabase. Por eso los alias `ausitesis+nombre@gmail.com` funcionan: el hack `destinoEntregable()` ya los normaliza. Respuesta a la duda de la card: **sí se puede**.
- Los links de recovery se generan con `admin.auth.admin.generateLink({ type: "recovery" })` y se usa el **`hashed_token`** de `properties` (NO el `action_link`) apuntando a una página propia que hace `verifyOtp` — así no dependemos de la allowlist de redirects de Supabase ni de sus templates.
- La verificación de email del registro es **propia** (token uuid en `tecnicos`), no la de Supabase (`email_confirm` queda en `true` como siempre; lo que gatea es nuestra columna). Menos piezas de Supabase Auth involucradas = más simple.

## Flujo nuevo

1. **Registro público** (`/registro-tecnico`): ya **no pide contraseña**. Al enviar se crea el usuario de auth **sin password** (no puede loguearse), la fila en `tecnicos` con `email_verificado = false` y `token_verificacion` (uuid), y se manda email "Verificá tu correo" con link a `/registro-tecnico/verificar?token=...`. Pantalla de éxito: "Te mandamos un correo para verificar tu dirección".
2. **Verificación** (`/registro-tecnico/verificar`, pública): token válido → `email_verificado = true` → el trigger de DB notifica al staff (la solicitud "nace" recién acá) → pantalla "Correo verificado, tu solicitud quedó en evaluación". Si ya estaba verificado, misma pantalla (idempotente). Token inválido → error con link para registrarse.
3. **Staff**: `/tecnicos` NO muestra solicitudes pendientes sin email verificado.
4. **Aprobar**: además de habilitar el acceso, se genera link de recovery y el email de aprobación pasa a incluir el botón **"Crear tu contraseña"** → `/crear-contrasena?token_hash=...`.
5. **Crear contraseña** (`/crear-contrasena`, pública): `verifyOtp({ type: "recovery", token_hash })` en el browser (cliente browser solo para `auth.*`, permitido por ARQUITECTURA) → form de contraseña nueva (mín. 8) → `updateUser({ password })` → redirect a `/panel`. Link vencido/ya usado → mensaje + link a `/recuperar-contrasena`.
6. **"¿Olvidaste tu contraseña?"** (link en el login → `/recuperar-contrasena`, pública): form de email → server action que SIEMPRE responde éxito (anti-enumeración) y, si el usuario existe, manda email con link a la misma `/crear-contrasena`. Sirve para **cualquier** usuario (técnicos y empleados) y también cubre "el técnico quiere cambiar su pass" y los links de aprobación vencidos (pide uno nuevo).
7. **Alta manual de técnico** (staff): tampoco pide contraseña; nace `email_verificado = true` (el staff responde por el dato) y se le envía directamente el email de bienvenida con el link "Crear tu contraseña" (hoy el alta manual no manda ningún email).
8. **Reintento de registro**: si alguien se registra con un email/CUIL/teléfono que choca contra una solicitud `pendiente` y **sin verificar** (caso típico: se tipeó mal su propio email y ese registro quedó huérfano), la solicitud vieja se borra (auth + fila) y el registro nuevo sigue. Contra solicitudes verificadas/aprobadas/rechazadas se rechaza como siempre (`duplicadoPersona`).

## Implementación

- **Migración `story_955_verificacion_email`** (vía MCP): `tecnicos` + `email_verificado boolean not null default false` y `token_verificacion uuid`; backfill `email_verificado = true` para todas las filas existentes; el trigger `trg_notificar_solicitud_tecnico` pasa de AFTER INSERT a AFTER UPDATE OF `email_verificado` (`when old.email_verificado = false and new.email_verificado = true and new.estado = 'pendiente'`), misma función `notificar_solicitud_tecnico()`.
- **`shared/utils/base-url.ts`** (nuevo): `baseUrl()` = `NEXT_PUBLIC_APP_URL` → `https://${VERCEL_PROJECT_PRODUCTION_URL}` (env automática de Vercel) → `http://localhost:3000`. Los emails con link la usan.
- **`features/email/service.ts`**: `plantilla()` y `enviarEmail()` ganan CTA opcional (botón esmeralda con href escapado). Nuevos: `emailVerificacionTecnico` (tipo `verificacion_email`) y `emailRecuperarContrasena` (tipo `recuperar_contrasena`). `emailResultadoTecnico` aprobado incorpora el CTA "Crear tu contraseña" (recibe el link del caller).
- **`features/tecnicos/service.ts`**:
  - `altaTecnico`: sin password; `createUser({ email, email_confirm: true })`; limpieza previa de solicitud pendiente-sin-verificar que choque; inserta `email_verificado`/`token_verificacion` según la vía; enrolamiento → manda email de verificación; alta manual → genera recovery link y manda email de bienvenida con CTA.
  - `verificarEmailTecnico(token)` (nueva, pública): marca `email_verificado = true` por token.
  - `aprobarTecnico`: genera recovery link y lo pasa al email de aprobación.
  - `listarTecnicos`: excluye `pendiente` con `email_verificado = false`.
  - Helper `linkCrearContrasena(email)`: `generateLink recovery` → `/crear-contrasena?token_hash=...`.
- **`features/auth/service.ts`**: `recuperarContrasena(email)` — rate limit en memoria (mismo patrón que `enrolarTecnico`), `generateLink recovery` con admin client, email por Resend; siempre `{ ok: true }`.
- **UI**: `form-tecnico.client.tsx` sin campo contraseña (ambos modos); `enrolamiento.client.tsx` copy de "verificá tu correo"; `app/registro-tecnico/verificar/page.tsx`, `app/crear-contrasena/page.tsx` (+ client), `app/recuperar-contrasena/page.tsx` (+ client) — estilo editorial de login/registro; link "¿Olvidaste tu contraseña?" en el login.

## Criterios de aceptación

1. Registro público sin campo contraseña; al enviarlo llega (a la casilla de prueba) el email de verificación con link.
2. La solicitud NO aparece en `/tecnicos` ni notifica al staff hasta que se abre el link; después de abrirlo, aparece y notifica (realtime).
3. El link de verificación es idempotente; un token inválido muestra error sin romper.
4. Un técnico pendiente/rechazado no puede loguearse (no tiene contraseña).
5. Al aprobar, llega el email con "Crear tu contraseña"; el link permite setear una (mín. 8) y entra directo a su panel.
6. El alta manual del staff no pide contraseña y dispara el mismo email de bienvenida con link.
7. `/recuperar-contrasena` responde igual exista o no el email; si existe, llega el link y permite cambiar la contraseña (técnico o empleado).
8. Link de recovery vencido → mensaje claro con salida a `/recuperar-contrasena`.
9. Re-registro con datos de una solicitud pendiente sin verificar la reemplaza; contra una verificada sigue rechazando por duplicado.
10. Todos los emails quedan logueados en `emails_enviados`; `tsc` y `eslint` verdes.

## Cambios v1.1 (2026-07-13)

La limpieza de solicitudes huérfanas armaba un `.or()` de PostgREST interpolando el email crudo del form público — un email con metacaracteres (`,`, paréntesis) podía inyectar filtros y borrar solicitudes pendientes ajenas (hallazgo del review de seguridad del commit). Ahora son queries `.eq()` separadas por campo (email/cuil/teléfono) unidas por id en JS. Commit f1c7318; reintento re-verificado E2E.

## Dev Agent Record

- **Migración:** `story_955_verificacion_email` aplicada (columnas `email_verificado` + `token_verificacion` en `tecnicos`, backfill de existentes a `true`, trigger `trg_notificar_solicitud_tecnico` pasa de AFTER INSERT a AFTER UPDATE OF `email_verificado`).
- **Archivos:** `codigo/features/tecnicos/service.ts` (alta sin password + limpieza de solicitudes huérfanas + `verificarEmailTecnico` + link en aprobación + filtro de no verificadas en `listarTecnicos`), `codigo/features/auth/recovery.ts` (nuevo, `linkCrearContrasena` — SIN "use server" a propósito: emite credenciales), `codigo/features/auth/service.ts` (`recuperarContrasena` con rate limit y anti-enumeración), `codigo/features/email/service.ts` (CTA en plantilla + `emailVerificacionTecnico` + `emailRecuperarContrasena` + CTA en aprobado), `codigo/shared/utils/base-url.ts` (nuevo), `codigo/components/tecnicos/form-tecnico.client.tsx` (sin campo contraseña), `codigo/components/tecnicos/enrolamiento.client.tsx` (copy "verificá tu correo"), `codigo/components/auth/login-form.client.tsx` (link olvidaste), `codigo/components/auth/crear-contrasena.client.tsx` + `codigo/components/auth/recuperar-contrasena.client.tsx` (nuevos), `codigo/app/registro-tecnico/verificar/page.tsx` + `codigo/app/crear-contrasena/page.tsx` + `codigo/app/recuperar-contrasena/page.tsx` (nuevas, públicas).
- **Verificación:** `tsc` + `eslint` verdes. E2E completo en local contra la base real: registro sin password → email `verificacion_email` enviado (Resend) → solicitud invisible en `/tecnicos` y 0 notificaciones → link de verificación → visible + 4 notificaciones al staff + idempotente al segundo clic → aprobación → email `tecnico_aprobado` con CTA → `/crear-contrasena` (verifyOtp + updateUser) → entra directo a `/tecnico` → logout → login con la contraseña nueva OK → `/recuperar-contrasena` responde neutro y loguea `recuperar_contrasena` enviado. Datos de prueba borrados al terminar.
- **Nota de deploy:** los links absolutos usan `VERCEL_PROJECT_PRODUCTION_URL` (env automática de Vercel). Si algún link de email apuntara mal en prod, setear `NEXT_PUBLIC_APP_URL=https://mantis-blue-three.vercel.app` en Vercel y redeployar.
