# Story 5.1 (+5.2/5.3): Notificaciones realtime y emails de estado

Status: done
Versión: 1.2.0

> Cubre las stories 5.1 (outbox), 5.2 (centro realtime) y 5.3 (emails de estado) de epics.md — un solo sistema cohesivo.

## Story

Como usuario del sistema,
quiero enterarme al instante cuando me toca accionar (y que el inquilino reciba emails de estado),
para que la gestión nunca quede frenada esperando que alguien mire.

## Acceptance Criteria

1. **Given** la tabla `matriz_notificaciones` (evento→destino, editable por datos), **When** se inserta un evento en `eventos_gestion`, **Then** un trigger crea las filas de `notificaciones` para los destinatarios EN LA MISMA transacción (outbox — si falla, falla la transición) y nunca notifica al propio actor.
2. **And** el usuario logueado ve badge + campana con no-leídas en < 2 segundos (Realtime filtrado por RLS a las propias) y al reconectar/montar recupera las no-leídas por fetch; puede marcarlas leídas.
3. **And** el inquilino del legajo recibe email en: gestión creada / técnico aceptó / conformidad aprobada — vía Resend desde `features/email/service.ts` con log en `emails_enviados` (fallos logueados como `fallido`, nunca rompen el flujo).
4. **(v1.2)** **Given** una solicitud de enrolamiento pendiente, **When** el staff la aprueba o la rechaza, **Then** el técnico recibe un email con el resultado (el de rechazo incluye el motivo), por el mismo canal y con el mismo log — salda la deuda registrada en STORY-303.

## Dev Notes

- Destinos de la matriz: `gestor` (owner), `tecnico` (asignado), `administrativos` (todos los gestor_administrativo activos), `nuevo_gestor` (tras reasignación). Seed de 11 reglas.
- Trigger SECURITY DEFINER (lee usuarios/gestiones sin RLS). `notificaciones` en la publicación realtime; RLS select/update propias.
- **Desviación consciente de CLAUDE.md §3**: Resend por **fetch directo** con plantilla HTML simple (sin React Email ni SDK — Regla #0: menos dependencias). El punto único de salida y el log en `emails_enviados` se mantienen.
- Resend sin dominio verificado solo entrega al dueño de la cuenta — los envíos a terceros quedarán logueados como fallidos hasta verificar dominio (pendiente de Fausti).
- Los lookups del email (gestión→legajo→inquilino) usan admin client: el flujo que dispara ya validó el acceso (ej. el técnico que aceptó no puede leer inquilinos por RLS).

### References

- [Source: epics.md#epic-5] · [Source: ARQUITECTURA §4] · [Source: PRD §8]

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code, 2026-07-05)

### Completion Notes List

- Outbox verificado: trigger notificar_evento crea filas en la transacción del evento; matriz de 12 reglas seedeada; nunca notifica al actor.
- **Realtime verificado EN VIVO**: badge subió 2→3 sin recargar al insertar un evento. GOTCHA CLAVE: el socket entraba como `anon` (realtime.subscription.claims_role) y RLS no entregaba nada — fix: `supabase.realtime.setAuth(session.access_token)` ANTES de suscribirse (aplicado también a BloqueoWatcher).
- Bug corregido: la Campana estaba dentro del <form> de Salir y su botón sin type disparaba el logout — movida afuera + type="button".
- **Email entregado real**: reporte_recibido a ausitesis@gmail.com (dueño de la cuenta Resend) estado=enviado; el intento a otro destinatario quedó logueado como fallido con el error de Resend (dominio sin verificar) SIN romper el flujo. Hooks: creada / técnico aceptó / conformidad aprobada.
- Pendiente de Fausti: verificar dominio en resend.com/domains para enviar a inquilinos/propietarios reales (y cambiar REMITENTE en features/email/service.ts).
- **Patch v1.2 (2026-07-09):** emails de resultado de enrolamiento al técnico (bug reportado por Fausti: aprobado/rechazado solo se enteraba al reintentar login). `emailResultadoTecnico()` en features/email/service.ts (tipos `tecnico_aprobado` / `tecnico_rechazado`, sin gestion_id), llamado desde `aprobarTecnico`/`rechazarTecnico` DESPUÉS del update exitoso — un fallo de email nunca rompe la aprobación.
- **Patch v1.1 (2026-07-07):** saludo por nombre en el cuerpo de TODOS los emails ("Hola, {nombre}:"). Motivo (Fausti): con la casilla de prueba compartida no se distinguía para quién era cada mail. `plantilla()` recibe el nombre y lo omite si no hay uno real ("—"/vacío). Alimentado por `destinatarioNombre` en los 3 documentos de finanzas (presupuesto/nota/comprobante) y por el nombre del inquilino en los emails de estado. De paso: `campana.client.tsx` usa `useId()` en vez de `Math.random()` en render (fix de pureza que rompía el lint).

### File List

- Migración crear_notificaciones (matriz + notificaciones + emails_enviados + trigger + realtime)
- features/email/service.ts · features/notificaciones/service.ts
- components/paneles/campana.client.tsx · bloqueo-watcher.client.tsx (setAuth) · panel-shell.tsx
- features/gestiones/service.ts (hooks de email)
