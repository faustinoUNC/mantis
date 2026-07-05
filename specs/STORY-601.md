# Story 6.1 (+6.2/6.3): Inbox Gmail + botón IA

Status: done
Versión: 1.3.0

> Cubre las stories 6.1 (ingesta), 6.2 (mail→gestión/descarte) y 6.3 (botón IA) de epics.md.

## Story

Como gestor de mantenimiento,
quiero que los reportes que llegan a la casilla exclusiva aparezcan en un inbox del panel y convertirlos en gestión (a mano o con IA) o descartarlos con motivo,
para que ningún reclamo quede sin destino.

## Acceptance Criteria

1. **Given** la casilla `ausitesis@gmail.com` conectada por OAuth, **When** el gestor abre `/inbox` (o toca "Actualizar"), **Then** los mails no leídos se ingestan a `inbox_reportes` (idempotente por `gmail_message_id` + se marcan leídos en Gmail) con canal='email', y los gestores reciben notificación in-app.
2. **And** cada reporte pendiente ofrece: **Crear con IA**, **Crear manual** (form prefilled con el texto del mail) y **Descartar** (motivo obligatorio, auditable — quién y por qué). Cero mails sin destino: todo termina `gestionado` o `descartado`.
3. **When** se usa el botón IA, **Then** Claude (tool use `crear_gestion`) sintetiza el reporte, clasifica **especialidad SOLO del catálogo del mantenedor**, sugiere urgencia y causa, e intenta matchear la **propiedad** por la dirección; si la matchea, crea la gestión en "Ingresado" (100% editable, vinculada al reporte); si no, pide creación manual — **nunca falla silenciosamente**.
4. **And** el reporte gestionado muestra el link a su gestión.

## Dev Notes

- **Desviación consciente de ARQUITECTURA §5**: sin Vercel Cron — el plan Hobby limita crons a 1/día. La ingesta es **sync-on-view** (al abrir /inbox + botón Actualizar), que cumple el flujo real (el gestor mira el inbox para trabajar). Migrable a cron/push sin tocar aguas abajo.
- Gmail API: refresh token → access token por request; `users.messages.list q="in:inbox is:unread"` + `get format=full` (decodificar text/plain base64url; fallback snippet) + `modify removeLabelIds UNREAD`.
- IA: Anthropic Messages API por fetch (modelo `claude-sonnet-5`), `tool_choice` forzado a `crear_gestion` con enums de especialidades activas y propiedades activas (id+dirección) en el prompt. Reusa `crearGestion` del funnel (ownership, evento, email al inquilino incluidos).
- RLS `inbox_reportes`: staff de mantenimiento select/update; insert solo service role (la ingesta corre server-side). Trigger de notificación a gestores activos al insertar.

### References

- [Source: epics.md#epic-6] · [Source: PRD §4] · [Source: STORY-401 crearGestion]

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code, 2026-07-05)

### Completion Notes List

- **E2E completo y real**: envié un reporte falso de inquilina (chispas en un enchufe, mencionando la dirección) a la casilla vía Resend → apareció en /inbox (sync trajo 20 no-leídos, idempotente) → botón "✦ Crear con IA" → **Claude clasificó Electricidad + Urgente + matcheó Av. Colón 1234 2°B** → gestión creada en Ingresado, vinculada al reporte, con redirect al detalle.
- Modelo IA: claude-sonnet-5 con tool_choice forzado a crear_gestion (enums de especialidades y propiedades activas). Si no matchea propiedad → pide creación manual (nunca falla silencioso).
- Sync-on-view en vez de cron (Vercel Hobby limita crons a 1/día) — documentado como desviación de ARQUITECTURA §5; migrable a cron/push sin tocar aguas abajo.
- Los 19 mails históricos de prueba quedaron descartados con motivo — inbox con cero pendientes sin destino.
- v1.3.0 (pedido Fausti): **sondeo automático cada 1 minuto** — pg_cron + pg_net (Supabase) → POST /api/cron/inbox con CRON_SECRET; núcleo de sync extraído a features/inbox/sync.ts (sin sesión) y compartido con el server action. Verificado: job 'sondeo-inbox' activo, primera corrida succeeded, endpoint 401 sin secreto. La ingesta ahora es automática: las notificaciones a gestores llegan sin abrir el inbox.
- v1.2.0 (bug real de Fausti): el sync usaba `is:unread`, pero los mails que uno se manda a sí mismo (o abre en Gmail antes de sincronizar) nacen LEÍDOS → no entraban. Ahora la query no filtra por leído; la idempotencia es puramente por `unique(gmail_message_id)` con pre-chequeo en DB (se dejó de marcar leído en Gmail — innecesario).
- v1.1.0 (pedido Fausti): el sync filtra `subject:mantenimiento` — la casilla es compartida (Gmail personal + esquema plus-addressing), así solo se ingesta lo que sigue la convención del canal. Aviso visible en el header del inbox.
- v1.0.1: el sync excluye `-from:onboarding@resend.dev` — con el esquema de emails de prueba `ausitesis+nombre@gmail.com` los correos del sistema caen en la misma casilla y no deben ingestarse como reportes.
- OAuth: proyecto Google "mantis" publicado; refresh token en .env.local + Vercel (GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN/INBOX).

### File List

- Migración crear_inbox_reportes (tabla + RLS staff-mant + trigger notificar_inbox)
- features/inbox/service.ts (sincronizarInbox, listarInbox, descartarReporte, crearDesdeReporte, crearGestionConIA)
- components/inbox/inbox.client.tsx · app/inbox/{layout,page}.tsx · navs (Inbox)
