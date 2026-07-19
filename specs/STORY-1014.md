# STORY-1014 — Desasignar técnico con adelanto: el adelanto del saliente no se hereda (v1.0)

**Estado:** ✅ done · **Origen:** card Trello #134 (Rami, 2026-07-19, https://trello.com/c/xzTLpRhl) + comentario de Fausti sobre el dinero ya entregado. Diseño salido de party mode (13ª sesión) y refinado con Fausti: se adopta el patrón "monto opcional en el momento de la salida" del cargo por cancelación (STORY-967), sin heredar su circuito de cobro.

## Problema

El adelanto de materiales es una columna escalar de la gestión (`gestiones.adelanto_materiales`, STORY-977) **sin dimensión de técnico**, y la desasignación (STORY-966/983) limpia presupuestos, conformidades, rendición y costo final pero **nunca la toca** (STORY-977 lo dejó explícitamente fuera de alcance "hasta que aparezca un caso real" — apareció). Consecuencias al desasignar un técnico que recibió adelanto:

1. El adelanto del nuevo técnico **se suma** al del saliente (`registrarAdelantoMateriales` acumula sobre lo que haya).
2. En la liquidación, al técnico **entrante** se le descuenta plata que nunca recibió (cobra de menos o aparece un "sobrante" falso).
3. El panel "Pendiente de liquidar" (`finanzas/consultas.ts`) arrastra el adelanto viejo.
4. La plata entregada al saliente pierde todo registro operativo: nadie ve cuánto quedó en su mano.

**Principio rector (party):** el adelanto es plata en la mano del TÉCNICO, no plata de la gestión. Toda salida del técnico congela su adelanto en el evento y resetea la columna. La recuperación de esa plata es un asunto humano inmobiliaria↔técnico: el sistema da constancia y visibilidad, no cobranza.

## Alcance

1. **Freeze + reset en `avanzar_etapa()`** (RPC Postgres, transiciones `{presupuesto,en_ejecucion,conformidad} → asignacion`): si la gestión tiene `adelanto_materiales`, el detalle del evento congela `adelanto_saliente` (mismo patrón que `materiales_total_saliente`) y el UPDATE de limpieza suma `adelanto_materiales = null`. Con eso el entrante arranca en cero y liquidación + panel quedan bien **sin tocar ninguna query** (todos leen la misma columna). El SQL completo del RPC queda **versionado en el repo** (`scripts/avanzar_etapa.sql`) — hasta hoy vivía solo en Supabase.

2. **Aviso + devolución opcional en el modal de desasignar** (`components/gestiones/detalle.client.tsx`, `DesasignarTecnico`): si hay adelanto, aparece una caja ámbar (tokens `urgente-*` del contract): "Este técnico recibió $X en adelantos. Queda registrado en el historial — la devolución o el ajuste se arregla con el técnico por fuera del sistema", con un campo numérico **opcional** "Devolución / ajuste en el acto" (efectivo que devuelve ahí mismo, o valor acordado de materiales que quedan en la obra). `desasignarTecnico` valida el monto (0 < devolución ≤ adelanto) y lo pasa en `p_detalle` como `devolucion_adelanto`; el RPC lo congela junto al resto. Sin adelanto, el modal queda exactamente como hoy.

3. **Constancia permanente en el detalle** (`detalle.client.tsx`, card de datos): las desasignaciones con `adelanto_saliente` en sus eventos se muestran como línea fija — "El técnico saliente {nombre} recibió $X en adelantos (— devolvió/ajustó $Y —) quedan $Z a resolver". Se lee de `gestion.eventos` (display-only, no es estado derivado de máquina: es constancia). El historial/auditoría también lo dice: `detalleLegible` (features/gestiones/eventos.ts) gana `adelanto_saliente` y `devolucion_adelanto`.

## Fuera de alcance (decisiones conscientes)

- **Seguimiento de deuda**: sin tabla de deudas, sin "marcar como resuelto", sin flujo de devolución posterior, sin lista global "adelantos a recuperar". Si algún día hace falta, los eventos tienen todo para construirlo.
- **Cancelación con adelanto**: en una gestión cancelada la columna conserva su valor (plata invertida, visible). No se resetea: no viene técnico nuevo.
- Tabla de adelantos por técnico (STORY-933 sigue descartada — Regla #0).

## Criterios de aceptación

1. Desasignar un técnico con adelanto: el evento congela `adelanto_saliente` (+ `devolucion_adelanto` si se cargó) y `gestiones.adelanto_materiales` queda NULL.
2. El adelanto cargado al técnico nuevo arranca de cero (no suma el del saliente) y su liquidación descuenta SOLO su propio adelanto.
3. El panel "Pendiente de liquidar" ya no resta el adelanto del saliente.
4. Modal: con adelanto muestra la caja ámbar con el monto y acepta devolución opcional (rechaza devolución > adelanto); sin adelanto no muestra nada nuevo.
5. El detalle muestra la constancia permanente con el neto, y el historial lee "Adelanto al saliente: $X".
6. Regresión: desasignar sin adelanto sigue igual (motivo, imputado, limpieza STORY-966/983); cancelación con y sin cargo intactas; `tsc`/eslint verdes.

## Dev Agent Record

- **Commit:** _(pendiente)_
- **Archivos:** `scripts/avanzar_etapa.sql` (RPC completo versionado por primera vez — freeze de `adelanto_saliente` + `adelanto_materiales = null` en el retroceso; migración `story_1014_adelanto_saliente_congelado_y_reset` aplicada), `codigo/features/gestiones/service.ts` (`desasignarTecnico` acepta `devolucionAdelanto` opcional, valida 0 < devolución ≤ adelanto y la manda en `p_detalle`), `codigo/components/gestiones/detalle.client.tsx` (caja ámbar con monto + campo opcional en el modal; constancia permanente en `DatosGestion` leída de `gestion.eventos`), `codigo/features/gestiones/eventos.ts` (`detalleLegible` lee `adelanto_saliente` y `devolucion_adelanto`), `specs/README.md`.
- **Verificación:** `tsc`/eslint verdes. E2E navegador (Admin, gestión #110 `[DEMO]` en ejecución con adelanto $150.000 de Raúl Medina): el modal mostró la caja ámbar con el monto; devolución $200.000 → bloqueada con "La devolución no puede superar el adelanto entregado" (la gestión no se movió); devolución $50.000 + motivo → gestión en Asignación, técnico "Sin asignar", el Dato "Adelanto de materiales" desapareció (columna NULL verificada por SQL), evento congeló `{adelanto_saliente: 150000, devolucion_adelanto: 50000, tecnico_saliente}`, constancia permanente "Raúl Medina recibió $ 150.000 … devolvió/ajustó $ 50.000 — quedan $ 100.000 a resolver" y Actividad "Saliente: Raúl Medina · Adelanto al saliente: $ 150.000 · Devuelto/ajustado en el acto: $ 50.000".