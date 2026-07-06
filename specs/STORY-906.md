# STORY-906 — Correcciones de la auditoría multi-agente (v1.0)

**Estado:** ✅ done · **Fecha:** 2026-07-06
**Origen:** `BUGS-AUDITORIA-2026-07-06.md` (auditoría multi-agente por dimensiones + verificación adversarial) + 2 dimensiones relanzadas en esta story (realtime y consistencia UI).

## Objetivo

Cerrar todos los bugs confirmados por la auditoría sin agregar complejidad:
la etapa del funnel pasa a estar protegida EN LA BASE, las finanzas quedan
ancladas a lo aprobado, el inbox deja de fallar en silencio y la UI muestra
el mismo estado en lista y detalle.

## Alcance (qué se corrigió)

### Seguridad / DB (migraciones `proteger_etapa_y_funnel` + `fix_proteger_gestiones_invoker`)
- **SEC-1** — Trigger invoker `proteger_gestiones_update` sobre `gestiones`:
  - `etapa` solo cambia vía funciones SECURITY DEFINER (`avanzar_etapa`, `responder_asignacion`); el UPDATE directo de una sesión (`authenticated`) lanza `etapa_solo_por_funcion`.
  - `gestor_id` solo lo cambia el administrador.
  - El `gestor_administrativo` solo puede editar columnas de finanzas (`cargo_admin`, `cobrado_en`, `medio_cobro`, `liq_*`, `nota_emitida_en`).
  - ⚠️ Lección: el trigger NO puede ser SECURITY DEFINER (adentro `current_user` es el owner y el guard nunca aplica). Verificado E2E con sesiones reales.
- **SEC-2** — `finanzas/service.ts`: `exigirMantenimiento(gestionId)` valida ownership (el gestor solo opera SUS gestiones) antes de usar admin client.
- **SEC-3** — Rate limit en memoria del registro público `enrolarTecnico` (10/hora por instancia).
- **BAJA-6** — Índice único parcial `presupuestos(gestion_id) where estado='enviado'`.

### Funnel
- **FUN-1** — Botón "Cancelar y elegir otro técnico" cuando la solicitud no fue respondida (`cancelarSolicitudAsignacion`, guard contra aceptación concurrente). Evento `asignacion_cancelada`.
- **FUN-2** — `resolverPresupuesto` valida todo ANTES de escribir y condiciona el update a `estado='enviado'` + `gestion_id` (sin dobles resoluciones ni estados a medias).
- **FUN-3** — "Volver a Asignación" (dentro de `avanzar_etapa`, atómico): limpia `tecnico_id`/`asignacion_aceptada` y rechaza presupuestos 'enviado' con motivo "La gestión volvió a asignación".

### Finanzas
- **FIN-1** — El fee (`cargo_admin`) se persiste EN LA APROBACIÓN (`resolverPresupuesto` lo recibe y lo ancla; queda en el evento `presupuesto_aprobado`).
- **FIN-2** — El pagador elegido en el Select viaja al server: `enviarPresupuestoEmail(gestionId, cargoAdmin, pagador)` persiste ambos antes de mandar el email; el PDF de vista previa usa el pagador elegido; la fila "Total al {pagador}" refleja el Select.
- **FIN-3** — La vista previa NUNCA escribe en la base (el fee tipeado viaja como override a `datosDocumento`); solo enviar/emitir/aprobar persisten.
- **BAJA-2** — Error del update de `nota_emitida_en` logueado (no más silencio).
- **BAJA-3** — Montos con `maximumFractionDigits: 2` en PDF y UI.
- **BAJA-4** — Validación server de montos ≥ 0 (presupuesto, costo final, fee).
- **BAJA-5** — `resolverPresupuesto`/`resolverConformidad` cruzan `id` ↔ `gestion_id`.

### Inbox / Gmail
- **INB-1** — `crearGestion` devuelve `{ gestionId }`; `crearDesdeReporte` vincula con el id real (sin adivinar por fecha).
- **INB-5** — `crearDesdeReporte` reclama el reporte (`estado='pendiente'` condicional) ANTES de crear; si falla la creación lo devuelve a pendiente. Dos clicks concurrentes → una sola gestión.
- **INB-2** — La UI del inbox muestra el error de sincronización (banner); `sync.ts` loguea con `console.error` (visible en Vercel).
- **INB-3** — Paginación completa de Gmail (`nextPageToken`, tope 1000) + chequeo de existentes en tandas de 200.
- **INB-4** — NO tocado (decisión consciente: filtro `subject:mantenimiento` para la casilla compartida de prueba; revisar en producción).

### Realtime (dimensión relanzada)
- **RT-1/2** — `campana.client.tsx`: en cada `SUBSCRIBED` (mount y reconexiones) refetchea `misNotificaciones()` — nada se pierde con el websocket caído ni en la ventana inicial.
- **RT-3** — `RefrescoVivo` acepta `filtro` (ej. `gestion_id=eq.X`); el detalle ya no se refresca por actividad de otras gestiones. Además refetch al re-suscribir tras una reconexión.

### Consistencia UI (dimensión relanzada)
- **UI-1/2** — `GestionResumen` expone `presupuesto_pendiente` y `conformidad_rechazada`; los CTA de "Mis trabajos" del técnico coinciden con el detalle ("Cargar presupuesto" solo si no envió; nuevo "Resubir conformidad").
- **UI-3 / BAJA-7** — Card de acción sin cuerpo: mensajes de contexto para el administrativo en etapas tempranas y para gestor/técnico en etapas financieras.
- **UI-4** — `cargoAdmin`/`pagador`/`enviado` se resincronizan cuando el refresh vivo trae datos nuevos de otro usuario (ajuste durante render, sin pisar valores con estado stale).
- **BAJA-6 (UI)** — El técnico ve el motivo del rechazo del presupuesto antes de armar el nuevo.

### Métricas
- **MET-1** — `montoPorCobrar` incluye el fee (consistente con `cobradoMes`).
- **MET-2** — `inicioMes` calculado en `America/Argentina/Buenos_Aires` (antes UTC del server).

### No corregido (documentado)
- **BAJA-1** — `CRON_SECRET` literal en `cron.job`: riesgo bajo (requiere leer el schema `cron`), pendiente para producción (Vault).

## Dev Agent Record
- **Verificación:** typecheck + lint + build OK. SEC-1/FUN-3 verificados E2E contra la base real con sesiones de gestor y administrativo (PATCH directo de `etapa` → `etapa_solo_por_funcion`; columnas no-finanzas del administrativo → `sin_permiso`; RPC `avanzar_etapa` y updates legítimos pasan; volver-a-asignación limpia técnico y rechaza el presupuesto).
- **Commit:** (ver git) — "Correcciones de auditoría: etapa protegida en DB, finanzas ancladas, inbox sin fallos silenciosos (STORY-906)".
