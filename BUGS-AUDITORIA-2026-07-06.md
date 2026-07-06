# Auditoría de bugs e inconsistencias — MANTIS 2

> **✅ RESUELTO (2026-07-06, STORY-906):** todos los hallazgos de este archivo
> fueron corregidos y verificados, salvo **INB-4** (decisión consciente para la
> casilla de prueba) y **BAJA-1** (pendiente para producción). Las dimensiones
> que faltaban (realtime y consistencia UI) se relanzaron: 7 hallazgos nuevos,
> todos corregidos. Detalle completo en `specs/STORY-906.md`.

**Fecha:** 2026-07-06
**Método:** Revisión multi-agente por dimensiones (seguridad/RLS, funnel, finanzas, realtime, inbox/cron, consistencia UI) + verificación adversarial de cada hallazgo. Los hallazgos de seguridad y funnel fueron verificados manualmente contra las policies (`pg_policies`) y funciones (`avanzar_etapa`, `responder_asignacion`) reales de la base remota `ejwokycbyjtlxwusbhtt`.

## Estado de la corrida

| Dimensión | Revisión | Verificación adversarial |
|---|---|---|
| Finanzas | ✅ | ✅ |
| Inbox / cron | ✅ | ✅ |
| Seguridad / RLS | ✅ | ⚠️ manual (agente cortado por límite de sesión) |
| Funnel | ✅ | ⚠️ manual/parcial |
| Realtime | ❌ no corrió (límite de sesión) | — |
| Consistencia UI | ❌ no corrió (límite de sesión) | — |

> **Nota de amenaza:** ningún hallazgo corrompe datos existentes ni es explotable desde afuera. Todos requieren un usuario del **staff ya autenticado** (admin / gestor / técnico). El riesgo real es inconsistencia operativa y violación de la regla de ownership, no fuga de datos a terceros.

---

## 🔴 ALTA — Seguridad de la base (RLS)

### SEC-1 · La etapa del funnel se puede cambiar por UPDATE directo, salteando `avanzar_etapa()`
- **Archivo / capa:** policies `editar_gestiones` y `administrativo_edita_gestiones` (tabla `gestiones`).
- **Qué pasa:** las policies de UPDATE son a nivel de fila, **sin restricción de columna**. `editar_gestiones` habilita a admin o al gestor dueño a actualizar cualquier columna (incluida `etapa`); `administrativo_edita_gestiones` habilita al `gestor_administrativo` a editar **cualquier columna de cualquier gestión** (su `USING`/`WITH CHECK` es solo `rol_actual() = 'gestor_administrativo'`, sin ownership).
- **Escenario:** un usuario del staff con la anon key + su sesión hace `PATCH /rest/v1/gestiones?id=eq.X` con `{"etapa":"finalizado"}` y salta todas las validaciones de `avanzar_etapa()` (matriz de transiciones, permisos por etapa, evento de historial). El invariante "transiciones solo por la función Postgres" es **app-only**, no está enforced en la DB.
- **Fix sugerido:** revocar UPDATE de `etapa` (y de columnas de finanzas/ownership) a los roles; dejar que solo las funciones `SECURITY DEFINER` toquen `etapa`. Acotar `administrativo_edita_gestiones` a las columnas de finanzas que realmente edita (o quitarla y canalizar todo por server actions con whitelist).

### SEC-2 · Finanzas no verifica ownership (usa admin client)
- **Archivo:** `codigo/features/finanzas/service.ts` (`exigirMantenimiento`, `exigirAdministrativo`).
- **Qué pasa:** estos guards chequean **solo el rol** y luego usan `createAdminClient()` (bypassa RLS). No validan que el gestor sea dueño de la gestión.
- **Escenario:** un `gestor_mantenimiento` llama `descargarPresupuestoPDF` / `enviarPresupuestoEmail` / `guardarCargoAdmin` con el id de una gestión de **otro** gestor → lee/envía sus documentos y le escribe el `cargo_admin`. Viola PRD §2.1 (cada gestor ve solo las suyas).
- **Fix sugerido:** agregar chequeo de ownership (gestor dueño o admin) antes de operar, o hacer el lookup con el cliente de sesión (RLS) para las lecturas.

---

## 🟠 ALTA — Finanzas (verificado adversarialmente)

### FIN-1 · El fee (`cargo_admin`) puede divergir entre lo aprobado y lo facturado
- **Archivos:** `features/gestiones/service.ts` (`resolverPresupuesto`) + `features/finanzas/service.ts` (`guardarCargoAdmin`, `emitirNotaCobro`).
- **Qué pasa:** el `cargo_admin` solo se persiste como **efecto secundario** de previsualizar o enviar el presupuesto. `resolverPresupuesto(aprobar)` no recibe ni ancla el fee, y el evento `presupuesto_aprobado` solo guarda `{pagador}`.
- **Escenarios:**
  1. El gestor tipea fee = 5000 en la evaluación (el total en pantalla lo incluye) y aprueba **directo** → `cargo_admin` queda en 0 en DB; la nota sale sin el fee que se mostró.
  2. Previsualiza con 5000 (se guarda), lo baja a 0 en el input y aprueba → la nota luego se emite con 5000 que el pagador nunca vio.
  3. En `facturacion_cobro` el administrativo cambia libremente el fee y `emitirNotaCobro` lo factura sin comparar contra lo aprobado. (Parcialmente **por diseño**: "corregible acá".)
- **Fix sugerido:** que `resolverPresupuesto` reciba y persista el `cargo_admin` en la aprobación, y que quede registrado en el evento `presupuesto_aprobado` (el total real aprobado). Dejar la edición en facturación como excepción explícita, idealmente con aviso de divergencia.

### FIN-2 · El presupuesto se emaila al pagador equivocado
- **Archivos:** `components/gestiones/detalle.client.tsx` (`EvaluacionPresupuesto`) + `features/finanzas/service.ts:84`.
- **Qué pasa:** el `<Select>` "Paga" de la evaluación es **estado local** que nunca viaja al server. `enviarPresupuestoEmail` no recibe pagador y `datosDocumento` resuelve `g.pagador ?? g.pagador_sugerido`, con `pagador = NULL` hasta que se aprueba.
- **Escenario:** `pagador_sugerido = propietario`; el gestor decide que paga el inquilino, lo selecciona y clickea "Enviar presupuesto" → **el email va al propietario**; luego aprueba con `pagador = inquilino` y la nota de cobro le llega a un inquilino que nunca recibió ni aprobó el presupuesto. Además la fila "Total al {pagador}" contradice al Select.
- **Fix sugerido:** persistir el pagador elegido (o pasarlo a `enviarPresupuestoEmail`) **antes** de enviar, o forzar aprobar-antes-de-enviar para que el pagador ya esté fijado.

---

## 🟠 ALTA — Inbox / Gmail (verificado adversarialmente)

### INB-1 · Vinculación reporte→gestión por adivinanza (condición de carrera)
- **Archivo:** `features/inbox/service.ts` (`crearDesdeReporte`).
- **Qué pasa:** tras `crearGestion()`, re-consulta `gestiones` por `gestor_id ORDER BY creado_en DESC LIMIT 1` para obtener el id. Si el mismo gestor crea dos gestiones casi simultáneas (dos pestañas, dos reportes, o una gestión normal mientras procesa el inbox), el reporte queda vinculado a la gestión equivocada de forma permanente.
- **Fix TRIVIAL:** `crearGestion` ya obtiene el id (`select('id').single()`) pero devuelve `data: undefined`. Devolver `{ gestionId: gestion.id }` elimina la carrera con una línea.

### INB-2 · Fallo silencioso total de la ingesta
- **Archivos:** `components/inbox/inbox.client.tsx:196` + `features/inbox/sync.ts` + `app/api/cron/inbox/route.ts`.
- **Qué pasa:** doble ceguera. (a) La UI: `sincronizar()` hace `await sincronizarInbox()` y **descarta el `ActionResult`** — si el refresh token fue revocado o Gmail rechaza, el spinner termina y no muestra nada; el usuario ve *"Inbox al día ✦"*. (b) El cron: el 502 de `route.ts` va a `net._http_response` (fire-and-forget de pg_cron) sin log ni alerta.
- **Escenario:** el token muere un viernes; los reportes de inquilinos se acumulan invisibles en Gmail indefinidamente.
- **Fix sugerido:** mostrar `r.error` en la UI (ya viaja hasta el cliente) + `console.error` en `sync.ts` para verlo en logs de Vercel. Idealmente, alerta al staff si N ciclos fallan.

### INB-3 · `maxResults=20` sin paginación y sin archivar
- **Archivo:** `features/inbox/sync.ts`.
- **Qué pasa:** `messages.list` trae solo los 20 más nuevos que matchean, sin loop con `nextPageToken`, y los mails ingestados nunca se archivan/etiquetan en Gmail. La ventana de 20 es sobre **todos** los matching de la casilla; los no-ingestados más viejos que esos 20 nunca vuelven a entrar.
- **Escenario:** combinado con INB-2 (token vencido), si se acumulan >20 sin ingestar, los más viejos se pierden para siempre.
- **Fix sugerido:** paginar con `nextPageToken` hasta agotar, o archivar/etiquetar los ya ingestados para que salgan de la ventana.

---

## 🟡 MEDIA

### FUN-1 · Gestión trabada en UI (esperando a un técnico que no responde)
- **Archivo:** `components/gestiones/detalle.client.tsx` (`AccionAsignar`, `AccionConformidadGestor`).
- **Qué pasa:** con `tecnico_id` seteado y `asignacion_aceptada = null`, el gestor/admin solo ven "Esperando respuesta de X…" sin botón para retirar la solicitud o reasignar. Si el técnico nunca responde o fue desactivado, la gestión queda trabada aunque el backend permita reasignar. Ídem en conformidad esperando al técnico.
- **Fix sugerido:** botón "Reasignar / cancelar solicitud" disponible para el gestor en esos estados.

### FUN-2 · `resolverPresupuesto` marca 'aprobado' antes de validar pagador
- **Archivo:** `features/gestiones/service.ts` (`resolverPresupuesto`).
- **Qué pasa:** el orden es `estado='aprobado'` → evento → recién ahí valida pagador → update pagador → `avanzarEtapa`. Si la server action se invoca sin pagador (la UI siempre lo manda, pero es invocable directo) o `avanzarEtapa` falla por carrera, queda un presupuesto 'aprobado' + evento logueado con estado inconsistente. No es atómico.
- **Fix sugerido:** validar todo **antes** de escribir; envolver en una función Postgres transaccional como el resto del funnel.

### FUN-3 · "Volver a Asignación" no limpia estado previo
- **Archivos:** `features/gestiones/service.ts` (transición `presupuesto→asignacion`) + `detalle.client.tsx` (`EvaluacionPresupuesto`).
- **Qué pasa:** la transición no limpia `tecnico_id`, `asignacion_aceptada` ni los presupuestos en estado 'enviado'. Un presupuesto viejo de un técnico anterior queda evaluable; el técnico ya-aceptado ve una card vacía.
- **Fix sugerido:** al volver a asignación, resetear `asignacion_aceptada`/`tecnico_id` y descartar presupuestos 'enviado' pendientes.

### MET-1 · `montoPorCobrar` excluye el fee
- **Archivo:** `features/metricas/service.ts`.
- **Qué pasa:** `montoPorCobrar` suma solo `costo_final`, pero lo que se factura es `costo_final + cargo_admin` (y `cobradoMes` sí suma ambos). El dashboard subestima lo cobrable.
- **Fix sugerido:** sumar `cargo_admin` en `montoPorCobrar`.

### MET-2 · `inicioMes` en timezone del servidor (UTC)
- **Archivo:** `features/metricas/service.ts`.
- **Qué pasa:** `new Date(y, m, 1).toISOString()` usa la zona del runtime; en Vercel (UTC) el mes "arranca" a las 21:00 AR del último día del mes anterior. Un cobro del 31/07 22:30 AR cuenta en agosto.
- **Fix sugerido:** calcular el inicio de mes en huso America/Argentina.

### FIN-3 · "Vista previa" muta `cargo_admin` en DB (acción de solo lectura con efecto)
- **Archivo:** `features/finanzas/service.ts` (`descargarPresupuestoPDF`, `descargarDocumento`).
- **Qué pasa:** previsualizar llama `guardarCargoAdmin` antes de generar → una acción de "ver el PDF" escribe en la base. El último preview "gana". (Relacionado con FIN-1.)
- **Fix sugerido:** no persistir en el preview; persistir solo al enviar/aprobar.

### SEC-3 · `enrolarTecnico` / `especialidadesParaRegistro` públicos con service role sin rate limit
- **Archivo:** `features/tecnicos/service.ts`.
- **Qué pasa:** `enrolarTecnico` es un server action **sin sesión** (registro público) que, con service role, crea un `auth.users`, inserta filas y sube hasta 2 archivos de 8MB al bucket. Sin límite de tasa → abuso posible (creación masiva de usuarios/archivos).
- **Fix sugerido:** rate limit / captcha / verificación de email en el registro público.

### INB-4 · Filtro `subject:mantenimiento` demasiado estricto
- **Archivo:** `features/inbox/sync.ts`.
- **Qué pasa:** exige la palabra exacta en el asunto. Se escapan los casos reales del inquilino ("Pérdida de agua en el baño", "URGENTE caldera"), asuntos vacíos y typos.
- **Nota:** era una decisión consciente para la casilla compartida de prueba. En producción con casilla exclusiva, revisar/relajar.

### INB-5 · `crearDesdeReporte` sin guard `estado='pendiente'`
- **Archivo:** `features/inbox/service.ts`.
- **Qué pasa:** `descartarReporte` protege con `.eq('estado','pendiente')` pero el UPDATE de `crearDesdeReporte` no. Con Realtime refrescando el inbox de admin y gestor a la vez, si ambos aprietan "Crear gestión" sobre el mismo reporte, se crean **dos gestiones** para un reporte.
- **Fix sugerido:** condicionar el update a `estado='pendiente'` y abortar `crearGestion` si ya no lo está.

---

## ⚪ BAJA

- **BAJA-1 · `CRON_SECRET` en texto plano en `cron.job`** — el secreto está embebido literal en el comando del job `sondeo-inbox`; cualquier lectura del schema `cron` lo expone. Considerar Vault/settings.
- **BAJA-2 · `emitirNotaCobro` ignora el error del update de `nota_emitida_en`** — posible doble emisión si el update falla silenciosamente.
- **BAJA-3 · Formato de montos inconsistente UI vs PDF** — el PDF usa `minimumFractionDigits: 2` sin `maximumFractionDigits` (default 3): un fee `1000.999` se imprime "$ 1.000,999". La UI no fija decimales.
- **BAJA-4 · Montos negativos sin validar** — `enviarPresupuesto` (materiales/mano de obra) y `resolverConformidad` (`costo_final`) no validan signo/rango en el server.
- **BAJA-5 · `resolver*` no verifican que el `id` del registro pertenezca a la `gestionId`** — se reciben por separado y nunca se cruzan.
- **BAJA-6 · Rechazos múltiples dejan filas huérfanas** — sin unique parcial en `presupuestos(gestion_id) where estado='enviado'`, quedan filas 'enviado'/'subida' huérfanas; el técnico no ve el motivo del rechazo del presupuesto.
- **BAJA-7 · `gestor_administrativo` ve card de acción vacía** en etapas ingresado→conformidad (renderiza el encabezado "<Etapa> — acción" con cuerpo vacío en vez de "solo lectura").

---

## Pendiente de completar

- Relanzar las dimensiones **realtime** y **consistencia de UI** (no corrieron por límite de sesión; se libera 5:50 AR).
- Completar la **verificación adversarial** de los hallazgos de funnel (marcados como verificación manual/parcial).
- Reejecutable con: `Workflow({scriptPath: ".../auditoria-mantis-wf_7a57de84-98c.js", resumeFromRunId: "wf_7a57de84-98c"})`.
