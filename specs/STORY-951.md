# STORY-951 — Sin 404 desde la campanita tras rechazar una asignación (v1.0)

**Estado:** ✅ done · **Origen:** card Trello #71: *"Cuando rechacé un incidente
asignado a mi perfil de técnico, si toco la campanita de notificaciones y
selecciono la notificación relacionada con ese incidente rechazado, ocurre el
error 404"* (+ hipótesis de Fausti en la card: "se intenta redireccionar a una
página inexistente ya que el técnico al rechazarla pierde la instancia" — confirmada).

## Causa raíz

Al rechazar, el RPC `responder_asignacion` pone `tecnico_id = NULL` y la policy
`ver_gestiones` deja de mostrarle la gestión al técnico. Pero la notificación
**"Nueva solicitud de trabajo"** (`asignacion_solicitada`) que recibió al ser
asignado queda en su campanita apuntando a `/gestiones/[id]`; al abrirla,
`obtenerGestion` devuelve null por RLS y la página hace `notFound()` → 404.

## Fix (el simple: sacar el link muerto, no tocar la página ni el RPC)

En `responderAsignacion` (`features/gestiones/service.ts`), cuando `acepta === false`
y el RPC terminó OK, se **borran las notificaciones del técnico sobre esa gestión**
(`usuario_id = auth.uid()` del caller + `gestion_id`). Va con admin client porque
la RLS de `notificaciones` no tiene policy de DELETE (solo SELECT/UPDATE propios)
— el filtro por `usuario_id` del caller mantiene el alcance: solo borra lo suyo.
La notificación al gestor ("El técnico rechazó la asignación") no se toca.

Sin migración, sin cambios de RPC, sin tocar la página de detalle: la ruta
`/gestiones/[id]` sigue devolviendo 404 para ids realmente inexistentes.

## Criterios de aceptación

1. Técnico con una gestión asignada recibe "Nueva solicitud de trabajo"; al
   RECHAZARLA, esa notificación desaparece de su campanita (y de la lista de
   no leídas) — no queda ningún link a la gestión rechazada.
2. Si ACEPTA, la notificación sigue y su link abre el detalle normalmente.
3. Las notificaciones del gestor sobre el rechazo no se ven afectadas.
4. Las notificaciones del técnico sobre OTRAS gestiones no se tocan.
5. `tsc`/eslint verdes.

## Dev Agent Record

- **Archivos:** `codigo/features/gestiones/service.ts` (`responderAsignacion`).
- **Commit:** (hash en el commit de cierre)
- **Verificación:** `tsc` + eslint verdes. E2E con Playwright como técnica demo
  (Andrea Roldán): la campanita mostraba "Nueva solicitud de trabajo" de la
  gestión del placard; se rechazó la asignación desde el detalle → redirect a
  /tecnico OK, la notificación desapareció de la campanita y de la DB (0 filas
  para esa gestión), sus otras 2 notificaciones quedaron intactas y el gestor
  recibió "El técnico rechazó la asignación".
