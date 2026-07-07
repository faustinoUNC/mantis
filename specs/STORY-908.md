# STORY-908 — Notificación realtime al recibir una solicitud de técnico (v1.0)

**Estado:** 🚧 en desarrollo · **Fecha:** 2026-07-07
**Origen:** Bug reportado por Fausti (Trello Mantis, card #3): "cuando un técnico manda la solicitud para registrarse, en la campana de notificaciones del dashboard debería mostrarse **en tiempo real** una notificación indicando este evento". Hoy no aparece nada.
**Épica relacionada:** 5 (Notificaciones realtime) + 3 (Enrolamiento de técnicos).

## Causa raíz (verificada)

El auto-enrolamiento (`enrolarTecnico` → `altaTecnico(form, "pendiente")`, `features/tecnicos/service.ts`) inserta una fila en `public.tecnicos` con `estado='pendiente'`, pero **es un flujo aparte del outbox de notificaciones**: no toca `eventos_gestion`, y `public.tecnicos` **no tenía ningún trigger** de notificación. Resultado: cero filas en `notificaciones`, cero realtime, campana vacía.

El sistema ya tiene el patrón exacto a reusar: el trigger `notificar_inbox` sobre `inbox_reportes` notifica **por rol a todo el staff** (`gestor_mantenimiento` + `administrador` activos) insertando en `notificaciones` **sin `gestion_id`**. La tabla `notificaciones` ya está en la publicación `supabase_realtime` y la campana (`components/paneles/campana.client.tsx`) ya escucha por `usuario_id`. No hace falta tocar TS ni el frontend.

## Objetivo

Que al llegar una solicitud de enrolamiento, cada gestor comercial y administrador activo reciba en el acto una notificación en la campana — reusando el outbox existente, sin duplicar lógica.

## Alcance

### DB (una migración, aplicada vía Supabase MCP)
- **Migración `notificar_solicitud_tecnico`**: función + trigger clonando el molde de `notificar_inbox`.
  - `public.notificar_solicitud_tecnico()` — `SECURITY DEFINER`, `SET search_path TO ''`. Inserta en `public.notificaciones (usuario_id, titulo, cuerpo)` un registro por cada `usuarios` con `rol in ('gestor_mantenimiento','administrador') and esta_activo`. Título fijo **"Nueva solicitud de técnico"**, cuerpo `new.nombre`. Deja `gestion_id` NULL (soportado por el schema y por la campana, que solo linkea a `/gestiones/{id}` cuando hay `gestion_id`).
  - Trigger `trg_notificar_solicitud_tecnico` — `AFTER INSERT ON public.tecnicos FOR EACH ROW WHEN (new.estado = 'pendiente')`. La cláusula `WHEN` es clave: el alta manual de staff crea técnicos con `estado='aprobado'` y **no** debe notificar; solo el enrolamiento (`pendiente`) dispara.

### Sin cambios en
- Código TS (`service.ts`, campana, notificaciones): el realtime y la campana ya funcionan tal cual.

## Criterios de aceptación

1. Un técnico se auto-enrola desde `/registro-tecnico` → cada gestor comercial y administrador activo ve, sin recargar, una notificación "Nueva solicitud de técnico — {nombre}" en la campana.
2. El alta manual de un técnico ya aprobado (desde Técnicos, `estado='aprobado'`) **no** genera notificación.
3. La notificación no rompe la campana (sin `gestion_id` = sin link, solo texto), igual que las de inbox.

## Fuera de alcance (Regla #0)
- Link de la notificación a la pantalla de solicitudes: la campana solo linkea gestiones; se deja sin link como las de inbox. Si se quiere, es otra story.
- Notificar por email el enrolamiento: no lo pidió el bug.
- Excluir a un actor: el enrolamiento corre sin sesión (no hay `actor_id`), todo el staff recibe — igual que `notificar_inbox`.

## Dev Agent Record
- **Commit:** 61d5492 (pusheado a main → auto-deploy)
- **Migración aplicada:** `notificar_solicitud_tecnico` (función `public.notificar_solicitud_tecnico()` + trigger `trg_notificar_solicitud_tecnico AFTER INSERT ON public.tecnicos WHEN (new.estado='pendiente')`).
- **Sin cambios de código** (reuso del outbox + campana existentes).
- **Verificación (tests transaccionales auto-revertidos contra la DB de prod):**
  - Insert de técnico `estado='pendiente'` → **2 notificaciones** creadas (una por cada staff activo: administrador + gestor comercial), título "Nueva solicitud de técnico", cuerpo = nombre del técnico. ✅
  - Insert de técnico `estado='aprobado'` (alta manual de staff) → **0 notificaciones** (la cláusula `WHEN` no dispara). ✅
  - Ninguno de los dos tests dejó datos (se abortó la transacción con `raise exception`).
  - El path realtime→campana no se tocó (ya probado con inbox/gestiones); la tabla `notificaciones` está en la publicación `supabase_realtime` y la campana escucha por `usuario_id`.
