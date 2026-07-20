# STORY-1017 — Ampliación de presupuesto durante la obra: permiso del pagador ANTES de gastar de más (v1.0)

**Estado:** 🔨 implementada y verificada E2E — sin commitear (espera OK) · **Origen:** card Trello #123 (https://trello.com/c/hMneNkBA). Diseño salido de party mode (14ª sesión, con Fausti en la sala): la propuesta original de la card — re-aprobación del propietario **al cobrar** — fue descartada por el propio Fausti ("¿qué hacemos si dice que no, si la ejecución ya está hecha?"): con el costo final de fórmula cerrada (STORY-961), un rechazo post-obra no permite facturar otro monto — el candado era teatro. El permiso tiene que pedirse **antes de gastar**, que es cuando un "no" todavía es una decisión.

## Problema

El pagador aprueba un presupuesto (ej. $85.000) pero en plena obra surgen gastos no previstos. Hoy el técnico los gasta sin que nadie consulte al pagador y el sistema factura el costo final real (rendición + mano de obra, STORY-964) — el pagador se entera del número nuevo recién en la nota de cobro. Riesgo comercial: "yo nunca aprobé ese monto", sin ninguna constancia de autorización del excedente.

**Principio rector (party):** repetir UNA vez el circuito grande de aprobación a mitad de obra — NO revivir la aprobación gasto-por-gasto (saga STORY-932/933/965, demolida por Regla #0). El "no" del pagador no bloquea nada: la obra sigue con lo aprobado, se renegocia con otra ampliación, o se cancela (flujos existentes). Red de seguridad en Cobro: **aviso, no candado**.

## Alcance

1. **Tabla nueva `ampliaciones`** (id, gestion_id, tecnico_id autor, `monto > 0`, `motivo`, estado `enviada|aprobada|rechazada`, `motivo_rechazo`, `enviada_pagador_en`, creado_en) + RLS espejo de `presupuestos` (ver todos los roles con acceso a la gestión; inserta el técnico asignado en `en_ejecucion`; resuelve admin/gestor owner) + índice único parcial "una `enviada` por gestión". **Decisión de implementación:** NO son filas de `presupuestos` — 10+ lugares del código asumen "un solo aprobado por gestión" (PDFs, métricas, stats, liquidación, tablero) y contaminarlos era el riesgo real de regresión. Tabla chica y explícita (doctrina de la sala: adelantos, eventos_sistema).

2. **Circuito espejo del presupuesto inicial** (server actions):
   - `crearAmpliacion(gestionId, monto, motivo)` — técnico asignado, solo `en_ejecucion`, no en pausa (STORY-976). Evento `ampliacion_solicitada` {monto, motivo} → notifica al gestor (matriz) con copia de supervisión al admin (STORY-978).
   - `enviarAmpliacionEmail(gestionId, ampliacionId)` — gestor owner/admin. Email al **pagador** (sin PDF nuevo — la nota formal llega después como siempre): aprobado hasta ahora, ampliación solicitada con motivo, nuevo total si autoriza (obra + fee anclado). Marca `enviada_pagador_en` (gate) y emite `ampliacion_enviada_pagador`.
   - `resolverAmpliacion(ampliacionId, gestionId, aprobar, motivo?)` — gestor owner/admin. **Aprobar exige `enviada_pagador_en`** (espejo STORY-935: se registra la autorización de lo que el pagador recibió). Evento `ampliacion_aprobada|ampliacion_rechazada` → notifica al técnico. No mueve la etapa: la obra sigue en `en_ejecucion`.

3. **UI técnico** (detalle, etapa En ejecución, mobile-first): toggle "Pedir ampliación de presupuesto" → monto + motivo. Estado visible: enviada ("esperando respuesta"), aprobada, rechazada con motivo (mismo patrón del presupuesto rechazado).

4. **UI gestor** (detalle, etapa En ejecución): card con la ampliación enviada (monto, motivo, aprobado → nuevo total), botón "Enviar al pagador por email" y luego "Registrar autorización" (deshabilitado hasta el envío, con hint) / "Rechazar" con motivo (2 pasos).

5. **Aviso ámbar en Cobro** (`finanzas.client.tsx`, `facturacion_cobro`): si `costo_final` > autorizado (presupuesto aprobado + ampliaciones aprobadas del técnico actual), caja ámbar (tokens `urgente-*`): el costo final supera lo autorizado en $X — confirmar con el pagador antes de facturar. **Solo aviso: no bloquea la nota** (el candado post-obra quedó descartado por diseño).

6. **Robustez**: desasignar técnico (retroceso STORY-966) rechaza también sus ampliaciones (`enviada|aprobada` → `rechazada` "Técnico desasignado") en `avanzar_etapa()` — versionado en `scripts/avanzar_etapa.sql`; el autorizado del aviso ámbar solo suma ampliaciones del técnico ACTUAL (patrón STORY-983). Labels de eventos en `LABEL_EVENTO` (STORY-974). Realtime: `RefrescoVivo` sobre `ampliaciones` en el detalle.

## Fuera de alcance (decisiones conscientes)

- **Rechazo del pagador como flujo**: no se modela — la salida es humana (terminar con lo aprobado / otra ampliación / cancelar con los flujos existentes).
- **Candado en la nota de cobro**: descartado — un permiso pedido después de gastar no cambia ningún desenlace (resolución de la 14ª sesión).
- **Ampliación de mano de obra**: la ampliación es de gastos de obra (materiales); la mano de obra pactada no se renegocia por esta vía. La facturación ya captura el gasto real vía rendición (STORY-964) — la ampliación solo sube el techo AUTORIZADO.
- Umbral de desvío configurable, PDFs nuevos, etapa nueva del funnel.

## Criterios de aceptación

1. Técnico en ejecución carga ampliación (monto + motivo) → el gestor la ve al instante y le llega notificación (admin recibe copia de supervisión). Una sola `enviada` a la vez.
2. Gestor: no puede registrar la autorización sin antes enviar el email al pagador (UI + guard server). El email queda en `emails_enviados` y el pagador recibe los tres números.
3. Aprobar → el técnico ve "aprobada" + notificación; rechazar exige motivo y el técnico lo ve. La gestión no se mueve de En ejecución en ningún caso.
4. En Cobro: rendición > (aprobado + ampliaciones aprobadas) → caja ámbar con montos; la nota se puede emitir igual. Sin desvío (o desvío hacia abajo) → nada nuevo.
5. Desasignar al técnico con ampliación viva → queda `rechazada` ("Técnico desasignado"); el entrante puede crear la suya; el autorizado no arrastra ampliaciones del saliente.
6. Regresión: presupuesto inicial, adelanto, rendición, conformidad, cobro, liquidación y cancelación con cargo intactos; `tsc`/eslint verdes.

## Dev Agent Record

- **Commit:** _(pendiente — espera OK de Fausti)_
- **Archivos:** migraciones `story_1017_ampliaciones_presupuesto` (tabla + RLS + índice único parcial + 3 filas de matriz), `story_1017_avanzar_etapa_rechaza_ampliaciones` y `story_1017_realtime_ampliaciones` (publicación realtime); `scripts/avanzar_etapa.sql` (retroceso rechaza ampliaciones del saliente); `codigo/features/gestiones/types.ts` (interface `Ampliacion` + `GestionDetalle.ampliaciones`); `codigo/features/gestiones/service.ts` (`crearAmpliacion`, `resolverAmpliacion` con gate, `obtenerGestion` las trae); `codigo/features/finanzas/service.ts` (`enviarAmpliacionEmail` — email sin PDF, marca el gate, evento); `codigo/features/gestiones/eventos.ts` (labels `ampliacion_*`); `codigo/components/gestiones/detalle.client.tsx` (`AmpliacionTecnico` + `AmpliacionGestor` + RefrescoVivo de `ampliaciones`); `codigo/components/gestiones/finanzas.client.tsx` (caja ámbar en Cobro); `specs/README.md`, `tasks/PENDIENTES.md`.
- **Verificación:** `tsc --noEmit` + eslint verdes. **E2E navegador completo** (gestión #106 `[DEMO]`, técnico `tecnicodos` + gestor `gestorcomercialuno` + admin): (1) técnico pidió $30.000 con motivo → estado "esperando la autorización"; (2) gestor vio la card (aprobado $358.000 → nuevo total $388.000, motivo) con "Registrar autorización" DESHABILITADO y el hint del gate; (3) "Enviar al pagador por email" → `emails_enviados` fila `ampliacion`/`enviado` al propietario, `enviada_pagador_en` marcada, botón habilitado; (4) autorizó → `estado='aprobada'`, evento `ampliacion_aprobada`, notificaciones a gestor + copia de supervisión a los 5 admins + técnico ("Ampliación autorizada"); (5) técnico vio el verde "podés avanzar con el gasto extra" y la Actividad "Ampliación de presupuesto autorizada — Monto: $ 30.000"; (6) segunda ampliación $20.000 → rechazo con motivo → `estado='rechazada'` con el motivo persistido; (7) aviso ámbar en Cobro verificado con la gestión #95 (costo $1.016.000 vs autorizado $850.000 → "supera … en $ 166.000", sin bloquear la nota). Eventos con montos congelados en `eventos_gestion`.
