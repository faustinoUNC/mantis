# STORY-924 — Bugs: 404 al rechazar asignación, teléfonos solo numéricos y validación de gestiones abiertas en bajas de cartera (v1.0)

**Estado:** 🚧 en desarrollo · **Fecha:** 2026-07-09
**Origen:** Fausti — 4 reportes: (1) 404 al ver el detalle de una solicitud de técnico; (2) 404 al rechazar una asignación como técnico; (3) los inputs de teléfono aceptan cualquier carácter; (4) desactivar un inquilino/propietario y cerrar un legajo no validan gestiones abiertas. Los puntos de validación se debatieron en **party mode** (Mary · John · Winston · Sally) por su lógica de negocio, dado el modelo "Administración" (STORY-922).

## Diagnóstico

### (1) 404 en detalle de solicitud de técnico — SIN cambio de código
Causa: el rename `dni`→`cuil` (STORY-923) dejó transitoriamente el `.select` de `obtenerTecnico` (`features/tecnicos/service.ts:260`) pidiendo la columna `dni`, ya inexistente → PostgREST error → `null` → `notFound()` en `app/tecnicos/[id]/page.tsx:20`. El árbol actual ya está alineado a `cuil` y la query se verificó OK contra la base (devuelve la solicitud pendiente con embed de especialidades). Requiere reiniciar el dev server si estaba corriendo código viejo. Se verifica E2E, no se toca código.

### (2) 404 al rechazar una asignación como técnico
Causa: el RPC `responder_asignacion` pone `tecnico_id = null` al rechazar; la policy RLS `ver_gestiones` exige `tecnico_id = auth.uid()` para el técnico → la fila deja de ser visible para él. Como `refrescarTablero(gestionId)` revalida `/gestiones/[id]`, Next re-renderiza la ruta actual, `obtenerGestion` devuelve `null` y `app/gestiones/[id]/page.tsx:20` dispara `notFound()`.

**Fix:** al rechazar, no revalidar el detalle (solo los tableros): `refrescarTablero(acepta ? gestionId : undefined)`. En el cliente (`AccionResponderAsignacion`), tras el rechazo exitoso, `router.push("/tecnico")` — el técnico vuelve a su home. No se usa `redirect()` en la server action porque `useAccion.correr` espera un `ActionResult` (recibiría `undefined` y rompería).

**Barrido de patrón:** es la única acción del sistema donde el propio actor se quita la visibilidad RLS de la fila que está viendo (aprobar/rechazar técnico conserva la fila para staff; reasignar gestor lo hace solo el admin, que ve todo).

### (3) Teléfonos solo numéricos
Tres inputs de teléfono, todos texto libre sin `inputMode` ni sanitización: `components/tecnicos/form-tecnico.client.tsx` (alta manual + enrolamiento público), `components/cartera/personas.client.tsx` (ABM propietarios/inquilinos) y `components/cartera/alta-administracion.client.tsx` (wizard STORY-922).

**Fix (patrón CUIL de STORY-923):** nuevo `shared/utils/telefono.ts` con `normalizarTelefono` (solo dígitos). Cliente: `inputMode="numeric"` + sanitización en `onChange` (no se puede tipear un no-dígito). Server: se guarda normalizado en `guardarPersona`, `resolverPersona` (cartera) y el alta de técnicos. Sin constraint en DB (Regla #0, igual que CUIL).

### (4) Validación de gestiones abiertas en bajas — resolución del party mode

**Decisión: BLOQUEO DURO con mensaje accionable** (no advertencia con "continuar igual"): un estado inconsistente permitido es deuda; el desvío honesto es **cancelar** la gestión (queda en `eventos_gestion`) y recién entonces dar la baja.

Semántica de "gestión abierta" (etapas no terminales = todo salvo `finalizado` y `cancelada`):
- **Inquilino** → gestiones no terminales cuyo `legajo_id` pertenezca a **cualquiera** de sus legajos (el `legajo_id` es snapshot al crear la gestión — un legajo ya cerrado puede tener una gestión viva). Además, un inquilino con **legajo vigente no se desactiva**: primero se cierra el legajo (cadena coherente: desactivar ⇐ sin legajo vigente ⇐ cerrar legajo ⇐ sin gestiones abiertas).
- **Propietario** → gestiones no terminales en **cualquiera de sus propiedades** (vía `propiedad_id`; incluye las de propiedad desocupada, donde `legajo_id` es null y el pagador es él).
- **Cerrar legajo** → gestiones no terminales con ese `legajo_id`. Las gestiones de la propiedad sin legajo asociado NO bloquean el cierre (no son del inquilino).
- **Propiedad** (`cambiarEstadoPropiedad`, hoy sin UI) → mismo check por `propiedad_id`; mismo helper, cierra el mismo agujero.

Detalles técnicos del debate:
- La validación vive en la **server action** (no trigger — Regla #0). El conteo de gestiones usa el **admin client** (defensa en profundidad estilo `datosResumen`): la RLS limita al gestor de mantenimiento a SUS gestiones — con el session client no vería las gestiones abiertas de otro gestor y la validación tendría un agujero. Los datos de cartera (legajos/propiedades) se leen con el session client (RLS staff-only).
- Race check→update aceptada explícitamente (staff chico, sin constraint DB).
- Reactivar no valida nada.
- Bug de silencio detectado en el debate: `personas.client.tsx` **ignora** el `ActionResult` de `cambiarEstadoPersona` — el error nuevo debe mostrarse (la fila muestra el mensaje; `legajos.client.tsx` ya muestra errores).

## Alcance
- `features/gestiones/service.ts` — `responderAsignacion` no revalida el detalle al rechazar.
- `components/gestiones/detalle.client.tsx` — `AccionResponderAsignacion` navega a `/tecnico` tras rechazo exitoso.
- `shared/utils/telefono.ts` — nuevo, `normalizarTelefono`.
- `components/tecnicos/form-tecnico.client.tsx`, `components/cartera/personas.client.tsx`, `components/cartera/alta-administracion.client.tsx` — inputs de teléfono numéricos.
- `features/cartera/service.ts` — normalización de teléfono; helper de gestiones abiertas; validaciones en `cambiarEstadoPersona`, `cerrarLegajo`, `cambiarEstadoPropiedad`.
- `features/tecnicos/service.ts` — teléfono normalizado en el alta.
- `components/cartera/personas.client.tsx` — mostrar el error de `cambiarEstadoPersona`.

## Criterios de aceptación
1. El detalle de una solicitud pendiente de técnico carga sin 404 (verificación E2E; el fix vino con STORY-923).
2. El técnico rechaza una asignación con motivo y aterriza en `/tecnico` sin 404; la gestión vuelve a verse en el tablero del gestor sin técnico.
3. En los tres formularios, el input de teléfono no admite caracteres no numéricos y el dato se guarda solo con dígitos.
4. Desactivar un inquilino con legajo vigente o con gestiones abiertas falla con mensaje claro visible en la fila; ídem propietario con gestiones abiertas en sus propiedades.
5. Cerrar un legajo con gestiones abiertas falla con mensaje claro; cancelando/finalizando esas gestiones, el cierre pasa.
6. `tsc` verde, eslint verde, `next build` OK.

## Dev Agent Record
- **Commit:** _(pendiente — Fausti revisa en local)_
- **Archivos:** `features/gestiones/service.ts` (rechazo no revalida el detalle) · `components/gestiones/detalle.client.tsx` (router.push a `/tecnico` tras rechazo) · `shared/utils/telefono.ts` (nuevo) · `components/tecnicos/form-tecnico.client.tsx`, `components/cartera/personas.client.tsx`, `components/cartera/alta-administracion.client.tsx` (inputs numéricos) · `features/cartera/service.ts` (normalización + `contarGestionesAbiertas` + validaciones en `cambiarEstadoPersona`/`cerrarLegajo`/`cambiarEstadoPropiedad`) · `features/tecnicos/service.ts` (teléfono normalizado) · `components/cartera/personas.client.tsx` (error visible en la fila).
- **Verificación:** `tsc` verde · eslint verde · `next build` OK · E2E con Playwright sobre la base real: detalle de solicitud pendiente carga (Federico Ibáñez, sin 404); teléfono tipeado `abc351-660 22.17xy` → `3516602217`; desactivar a María Ledesma bloqueado ("legajo vigente"); desactivar a Silvia Barrionuevo bloqueado ("2 gestión(es) abierta(s) en sus propiedades"); cerrar legajo de Av. Rafael Núñez 4520 bloqueado ("1 gestión(es) abierta(s)"); rechazo de "El calefon no anda" como tecnicouno → aterriza en `/tecnico` sin 404, `tecnico_id` null y evento `asignacion_rechazada` con motivo en el log. ⚠️ Efecto colateral de la prueba: esa gestión quedó de vuelta en Asignación sin técnico — reasignarla si hace falta.
