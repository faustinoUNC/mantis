# STORY-967 — Cancelación con cargo: cobrar la cancelación tardía por el circuito de cobro existente

**Estado:** ✅ done · **Origen:** card Trello #22 (mitad "cargo económico"), unificada en la card #93. Diseño del party mode 2026-07-14; Fausti definió cargo **opcional y libre** (si no corresponde, no se cobra nada; si corresponde, la inmobiliaria pone el valor).

## El problema

Cancelar una gestión existe desde STORY-914 (estado terminal `cancelada`, motivo obligatorio, gestor owner/admin, solo etapas operativas — "antes de que entre plata"). Pero el negocio real tiene un caso más: el responsable cancela cuando el técnico **ya aceptó** (quizás ya inspeccionó, presupuestó o empezó) y la inmobiliaria quiere cobrar un cargo por ese trabajo en vano. Hoy no hay forma: la cancelación siempre es gratis.

## Decisión (Fausti, con la sala)

1. **Antes de la aceptación del técnico** (etapas `ingresado`/`asignacion`): cancelar sigue igual — gratis, directo a `cancelada`.
2. **Después de la aceptación** (etapas `presupuesto`/`en_ejecucion`/`conformidad`): al cancelar aparece un campo **"Cargo por cancelación" opcional y libre**. Vacío o 0 → gratis, directo a `cancelada` (hoy). Mayor a 0 → la gestión pasa a **Cobro** marcada como cancelación, el administrativo cobra el cargo con el circuito existente (mismos medios de pago, mismos snapshots `cobrado_monto`/`cobrado_fee` — el cargo es 100% de la inmobiliaria) y la gestión **cierra en `cancelada`**. Una sola verdad terminal: toda cancelación muere en `cancelada`; el cargo cobrado aparece en Ingresos (hechos congelados) y la gestión cuenta como cancelación en el funnel. "No es un flujo nuevo, es el mismo peaje con otro cartel."
3. Sin nota de cobro PDF para cancelaciones en v1 (la nota está pensada para trabajo + fee); el comprobante es el cobro registrado. Tampoco hay liquidación al técnico: se salta.
4. El `tecnico_id` NO se toca al cancelar (historial + el % "Cancela" de sus stats ya cuenta canceladas estando asignado, igual que hoy).

## Implementación

### Migración (`story_967_cancelacion_con_cargo`)

- `gestiones` + columna `cargo_cancelacion numeric` (null = cancelación sin cargo).
- `avanzar_etapa()` whitelist: `{presupuesto, en_ejecucion, conformidad} → facturacion_cobro` SOLO con `detalle->>'cancelacion' = 'true'` (y motivo obligatorio); `facturacion_cobro → cancelada` SOLO si la gestión tiene `cargo_cancelacion` (cierra el cobro de una cancelación; permisos de esa rama: administrativo/admin, como toda etapa de plata).

### Código

- **`features/gestiones/service.ts`**: `cancelarGestion(gestionId, motivo, cargo?)` — con cargo > 0 setea `cargo_cancelacion` (cliente de sesión, RLS gestor owner) y avanza a `facturacion_cobro` con `{cancelacion: true, motivo}`; sin cargo, camino actual.
- **`features/finanzas/service.ts`**: `registrarCobro` detecta `cargo_cancelacion` → total = cargo, `cobrado_fee` = cargo (es todo de la casa), y al final avanza a `cancelada` (motivo "Cargo por cancelación cobrado") en vez de `liquidacion_tecnico`.
- **`features/metricas/service.ts`**: `FilaMetrica.cargoCancelacion`; "monto por cobrar" (tile + card Cobranza del panel) usa `cargo_cancelacion` cuando existe.
- **`components/gestiones/detalle.client.tsx`**: el modal de `CancelarGestion` suma el input de cargo (solo si el técnico ya aceptó) con el copy "si se cobra un cargo, la gestión pasa por Cobro antes de cerrar"; en Cobro, badge/aviso de que es una cancelación.
- **`components/gestiones/finanzas.client.tsx`**: en `facturacion_cobro` con `cargo_cancelacion` muestra solo "Cargo por cancelación: $X" + form de cobro (sin nota, sin desglose trabajo+fee).

## Criterios de aceptación

1. Cancelar en `ingresado`/`asignacion`: igual que hoy (sin campo de cargo, directo a `cancelada`).
2. Cancelar post-aceptación sin cargo: igual que hoy.
3. Cancelar post-aceptación con cargo $X: la gestión aparece en la columna Cobro marcada como cancelación; el administrativo la cobra (medios combinados incluidos) y queda `cancelada` con `cobrado_monto = cobrado_fee = X`; nunca pasa por liquidación.
4. Ingresos del panel de informes suma el cargo cobrado en el mes del cobro; el funnel la cuenta como cancelada; "monto por cobrar" muestra $X mientras está en Cobro.
5. No se puede llegar a `facturacion_cobro → cancelada` en una gestión sin `cargo_cancelacion`, ni a `facturacion_cobro` desde etapas operativas sin la marca de cancelación.
6. `tsc` + `eslint` verdes.

## Dev Agent Record

- **Migración:** `story_967_cancelacion_con_cargo` aplicada — columna `gestiones.cargo_cancelacion`; `avanzar_etapa()` con `{presupuesto, en_ejecucion} → facturacion_cobro` gated por `detalle->>'cancelacion'` + motivo, y `facturacion_cobro → cancelada` solo con `cargo_cancelacion` seteado.
- **Archivos:** `features/gestiones/service.ts` (`cancelarGestion(gestionId, motivo, cargo?)` — marca el cargo con guard de etapa y lo revierte si el avance falla), `features/finanzas/service.ts` (`registrarCobro` detecta cargo → total = fee = cargo y cierra en `cancelada`), `features/metricas/service.ts` (`FilaMetrica.cargoCancelacion`; "monto por cobrar" usa el cargo), `components/gestiones/detalle.client.tsx` (input de cargo opcional post-aceptación; badge "Cancelación — cobro del cargo pendiente"; Actividad "Cancelación con cargo — pasó a Cobro" con `Cargo: $X`; label "Cancelada" en la Acción), `components/gestiones/finanzas.client.tsx` (vista de cobro simplificada sin nota ni desglose; CTA "Registrar cobro → Cancelada"), `components/metricas/panel-metricas.client.tsx` (card Cobranza usa el cargo).
- **Verificación:** `tsc`+`eslint` verdes. E2E local (2026-07-14, Playwright + Supabase MCP) sobre `[PRUEBA STORY-967]`: cancelada desde En ejecución con cargo $20.000 → pasó a Cobro con badge y evento con motivo+cargo; como admin, la Acción mostró solo "Cargo por cancelación a cobrar: $ 20.000"; al registrar el cobro (transferencia) la gestión cerró en `cancelada` con `cobrado_monto = cobrado_fee = 20000`, `cobrado_en` seteado y sin pasar por liquidación (`liq_pagada_en` null).
