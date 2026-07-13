# STORY-958 — Un técnico rechazado puede volver a enviar la solicitud (v2.0)

**Estado:** ✅ done · **Origen:** Fausti (2026-07-13): probó rechazar una solicitud y el reintento del técnico chocaba con *"ya hay un técnico con ese CUIT"*. Decisión (opción A del análisis): *el reintento pisa la rechazada* — para los casos reales de rechazo corregible (matrícula olvidada, foto ilegible).

## Alcance

- Extiende la limpieza de solicitudes reemplazables de STORY-955 (pendientes sin verificar) a las **rechazadas**: si un registro nuevo choca por email/CUIL/teléfono contra una solicitud `rechazado`, la vieja se borra y el registro sigue. La solicitud nueva arranca de cero: verifica email → el staff la evalúa de nuevo (la ve como solicitud nueva).
- **Guard-rail innegociable**: solo se pisa una rechazada **sin fila en `usuarios`** (nunca fue aprobada). Un técnico que alguna vez tuvo acceso tiene historial colgando (`gestiones` SET NULL, `avances` RESTRICT, `calificaciones`) y NO se borra jamás — para esos sigue rigiendo el duplicado.
- En la misma pasada se borran los residuos de la solicitud pisada: **notificaciones** del staff que apuntan a `/tecnicos/{id}` (evita 404 desde la campanita, criterio STORY-951) y **archivos del bucket** (DNI/matrículas viejos).
- El **email de rechazo** ahora invita a reintentar: "Podés corregir lo indicado y volver a enviar la solicitud" + botón a `/registro-tecnico`.
- Consecuencia asumida (decisión explícita): el staff no ve que es un reintento ni el motivo del rechazo anterior (queda rastro solo en `emails_enviados`). Un insistente lo frena el rate limit del registro (10/hora) y la re-evaluación humana.

## Implementación

- **`features/tecnicos/service.ts`** (`altaTecnico`): la búsqueda de reemplazables pasa de "pendiente sin verificar" a `and(estado.eq.pendiente,email_verificado.eq.false),estado.eq.rechazado` (condiciones constantes — el valor del usuario solo entra por `.eq(campo, valor)`, sin riesgo de inyección v1.1). Antes de borrar: se excluye todo id con fila en `usuarios`, se borran sus docs del storage y sus notificaciones por ruta. El delete del auth user cascadea `tecnicos` y `tecnico_especialidades`.
- **`features/email/service.ts`** (`emailResultadoTecnico` rechazado): cuerpo + CTA "Volver a enviar la solicitud" → `${baseUrl()}/registro-tecnico`.
- Sin migración.

## Criterios de aceptación

1. Rechazada una solicitud, el mismo técnico puede volver a registrarse con el mismo email/CUIL/teléfono; la vieja desaparece (con sus notificaciones y archivos) y la nueva sigue el flujo completo (verificación → evaluación).
2. Una rechazada que alguna vez fue aprobada (tiene fila en `usuarios`) NO se pisa: el registro se rechaza por duplicado como antes.
3. El email de rechazo trae el link para reintentar.
4. Los reemplazos de pendientes-sin-verificar (STORY-955) ahora también limpian storage y notificaciones.
5. `tsc`/eslint verdes.

## Cambios v2.0 (2026-07-13) — el reintento REABRE la solicitud (no la pisa)

Al probar la v1 Fausti detectó dos problemas: (1) la rechazada **desaparecía** de `/tecnicos` cuando el técnico reintentaba (hueco visible hasta la verificación, ahora en vivo por STORY-957) — la inmobiliaria debe poder seguir viéndolas siempre; (2) los reintentos parecían no recibir el mail de verificación — todos salieron `enviado` (Resend OK), pero Gmail agrupa los mails idénticos en un hilo y el link de cada mail anterior moría con el pisado. Rediseño (opción B elegida):

- **El reintento de una rechazada reabre la MISMA fila** (mismo id y usuario de auth): datos/documentos nuevos (storage viejo reemplazado), `estado → pendiente`, `email_verificado → false`, y **conserva `motivo_rechazo`** como historial. Si cambió el email, se actualiza en auth (`updateUserById`). Especialidades reemplazadas. Las notificaciones viejas del staff ya no quedan 404 (misma ruta).
- **El token de verificación se conserva SOLO si el email no cambió** (v2.1, hallazgo del review de seguridad): con el mismo email, los links de todos los mails anteriores del hilo siguen vivos — abrir un mail viejo ya no es un callejón sin salida. Si el reintento trae un email distinto, se emite token fresco: la casilla nueva solo se verifica desde la casilla nueva, y los links que fueron a la anterior mueren. El asunto del mail además lleva el nombre ("Verificá tu correo, {nombre}") para desagrupar entre técnicos en la casilla compartida. Riesgo residual asumido: un tercero podría reintentar con el CUIL de una rechazada ajena y su propio email — igual que siempre pudo enviar una solicitud con datos ajenos: el control del flujo es la evaluación humana de la documentación (DNI) antes de aprobar.
- **El staff la ve en todo momento**: `listarTecnicos` muestra también pendientes sin verificar **con `motivo_rechazo`** (badge "Reintento — esperando verificación"); las solicitudes nuevas sin verificar siguen ocultas (decisión STORY-955). El detalle muestra "Reintento — rechazo anterior: {motivo}" y habilita Aprobar/Rechazar recién con el email verificado.
- El **pisado con borrado** queda solo para huérfanas pendiente-sin-verificar y para el alta manual del staff que choca con una rechazada. El guard de `usuarios` (jamás tocar un ex-aprobado) sigue idéntico.
- Tipos: `TecnicoResumen.email_verificado` nuevo (y expuesto en `obtenerTecnico`).

Verificación v2.0 E2E: rechazada → reintento por el form → misma fila reabierta (id y token idénticos, motivo conservado) → visible como "Reintento — esperando verificación" con evaluación bloqueada → el link del token VIEJO verifica → notifica al staff (trigger) → "Pendiente de evaluación" con el aviso del rechazo anterior.

## Dev Agent Record

- **Archivos:** `codigo/features/tecnicos/service.ts` (`altaTecnico`: reemplazables + guard de `usuarios` + limpieza de storage/notificaciones), `codigo/features/email/service.ts` (CTA de reintento en el rechazo).
- **Verificación:** `tsc` + `eslint` verdes. E2E en local: solicitud rechazada → re-registro con el mismo CUIL pasa, la vieja desaparece con sus notificaciones; rechazada con fila en `usuarios` (simulada) → sigue bloqueando por duplicado.
