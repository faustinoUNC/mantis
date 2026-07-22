# STORY-1037 — Se aprueba lo que se envió: bloquear "Aprobar y ejecutar" si cambiaste quién paga o el fee después de enviar (v1.0)

**Estado:** 🔨 en prueba · **Origen:** reporte de Fausti (2026-07-22) — en la etapa Presupuesto se puede enviar el presupuesto con una distribución de pago (p. ej. compartido inquilino/propietario) y después, por accidente, cambiar el Select "Paga" a solo inquilino o solo propietario y aprobar igual. La gestión se ejecuta con una responsabilidad de pago distinta a la que se le mandó por email al pagador. Error silencioso, sin ninguna barrera.

## Problema

El invariante de STORY-935 es "el pagador aprueba lo que recibió". Tiene un agujero en la UI: `mailEnviado` **nunca degrada a false** (`detalle.client.tsx:994-998`). Una vez enviado el presupuesto, "Aprobar y ejecutar" solo se bloquea por `!mailEnviado || !pagador || pctInvalido` (`detalle.client.tsx:1155`). Nadie mira si los términos en pantalla siguen siendo los que se enviaron. Entonces el gestor puede:

1. Enviar el presupuesto con `pagador = "compartido"` 50/50 (mail al inquilino y al propietario).
2. Cambiar el Select "Paga" a `"inquilino"` (o el % compartido, o el fee) — `mailEnviado` sigue en `true`.
3. Clic en "Aprobar y ejecutar" → ejecuta con **inquilino como único responsable** de algo pactado a medias.

El envío persiste los **tres** términos que van en el email/PDF en la tabla `gestiones` — `cargo_admin` (`finanzas/service.ts:579`), `pagador` y `pagador_pct_inquilino` (`finanzas/service.ts:580-588`) — antes de marcar `presupuesto_enviado_en` (`finanzas/service.ts:630-634`). O sea: "lo enviado" ya está en la base y es comparable contra lo que muestra la pantalla. El total del email incluye el fee, así que cambiar el fee después de enviar rompe el mismo invariante que cambiar el pagador.

En el server, `resolverPresupuesto` al aprobar **re-escribe** `pagador/pct/cargo_admin` con lo que le manda el cliente (`service.ts:1186-1197`) — que es justo el vector del bug — aunque esos valores **ya están anclados desde el envío**. La re-escritura es redundante y peligrosa.

## Alcance

1. **Server — la aprobación usa lo enviado, no lo que manda el cliente (arreglo de raíz)** (`resolverPresupuesto`, `codigo/features/gestiones/service.ts`):
   - La query que ya corre al aprobar (`service.ts:1142-1146`) suma `pagador, pagador_pct_inquilino, cargo_admin`. Las validaciones (pagador presente, % válido, legajo vigente, fee ≥ 0) pasan a evaluar **los valores persistidos** (`g.*`), no `opciones.*`.
   - Se **elimina la re-escritura** de `pagador/pct/cargo_admin` (`service.ts:1186-1197`): ya quedaron anclados en el envío. Aprobar solo mueve la etapa a `en_ejecucion`.
   - El evento `presupuesto_aprobado` registra los valores persistidos.
   - `opciones.pagador / pct_inquilino / cargo_admin` dejan de usarse en la rama `aprobar` → se quitan de la firma (queda `{ motivo? }`) y del llamador. Resultado: es **estructuralmente imposible** aprobar términos distintos a los enviados.

2. **Cliente — bloqueo por divergencia + aviso** (`EvaluacionPresupuesto`, `detalle.client.tsx`):
   - Se computa `terminosCambiados` = presupuesto ya enviado **y** algún término en pantalla difiere del persistido: `pagador !== gestion.pagador`, o (compartido) `pctInquilino !== gestion.pagador_pct_inquilino`, o `cargoAdminNum !== Number(gestion.cargo_admin ?? 0)`.
   - "Aprobar y ejecutar" se deshabilita también con `terminosCambiados`, con mensaje: *"Cambiaste los términos después de enviar — reenviá el presupuesto para poder aprobar."* Editar sigue permitido; lo que se obliga es reenviar antes de aprobar. `EnvioDocumento` ya está arriba y `yaEnviado` se recalcula; al reenviar se re-persiste y `terminosCambiados` vuelve a `false`.
   - Esto también resuelve el corner case de "no estoy de acuerdo con la distribución, sí con el presupuesto": el gestor cambia "Paga", reenvía y aprueba, **sin rechazar** al técnico.

## Fuera de alcance

- **El rechazo NO se toca.** Sigue igual: form inline con motivo obligatorio → `resolverPresupuesto(..., false, { motivo })`, deja el presupuesto `rechazado` y el técnico manda uno nuevo. (Se evaluó enriquecer el copy / agregar un modal; se descartó por Regla #0 — el flujo de editar+reenviar ya cubre el corner case y no hace falta guía extra.)
- No se toca `avanzar_etapa` ni el modelo de datos: el arreglo es cliente (gate de habilitación) + server (aprobar con lo persistido).
- No se agrega un estado/registro nuevo de "re-presupuesto": el circuito actual ya alcanza.
- Ampliación de presupuesto (STORY-1017): mismo patrón espejo, pero fuera de alcance salvo que se pida.
- Vista del técnico: sin cambios.

## Criterios de aceptación

1. Enviar compartido 50/50, cambiar el Select "Paga" a inquilino y **no** poder aprobar: el botón queda deshabilitado con el mensaje de reenviar. Reenviar → se habilita.
2. Igual para: cambiar el % del compartido, y cambiar el fee, después de enviar.
3. Forzando el server action con términos distintos a los enviados (bypass de UI), la gestión se aprueba con los **valores enviados**, no con los inyectados (evento `presupuesto_aprobado` con los persistidos).
4. Flujo feliz sin tocar nada tras enviar: aprueba y ejecuta normal, con los mismos términos.
5. Regresión del rechazo: con motivo obligatorio marca `rechazado` y el técnico puede enviar uno nuevo, igual que hoy.
6. `tsc`/eslint verdes; consola sin errores.

## Dev Agent Record

- **Commit:** `ccb924b` (2026-07-22).
- **Archivos:** `codigo/features/gestiones/service.ts` (`resolverPresupuesto`: al aprobar lee `pagador/pagador_pct_inquilino/cargo_admin` ya persistidos y valida sobre esos; se eliminó la re-escritura desde el cliente; firma de `opciones` reducida a `{ motivo? }`); `codigo/components/gestiones/detalle.client.tsx` (`EvaluacionPresupuesto`: `terminosCambiados`, gate del botón "Aprobar y ejecutar", aviso de reenvío, llamada `resolverPresupuesto(..., true)` sin términos). `types.ts` sin cambios (la firma de opciones es inline en el service).
- **Verificación:** `tsc --noEmit` y `eslint` verdes sobre los dos archivos. E2E navegador (admin, dev server) en la gestión #200 (presupuesto, compartido 50/50, ya enviada): estado inicial con "Aprobar y ejecutar" habilitado (términos = enviados); cambiar "Paga" a Inquilino → botón deshabilitado + aviso "Cambiaste los términos después de enviar — reenviá el presupuesto para poder aprobar"; volver a Compartido 50 → se re-habilita y el aviso desaparece; cambiar el fee (50000→60000) → deshabilitado + aviso; cambiar el % (50→40) → deshabilitado + aviso. Sin escrituras en la base durante la prueba (solo estado local). Consola sin errores. Criterio 3 (bypass de UI) queda cubierto estructuralmente: el server ya no acepta términos del cliente al aprobar.
