# STORY-1003 — Bug: el desvío de la rendición compara materiales contra el presupuesto total (v1.0)

**Estado:** 🧪 implementada y verificada E2E, sin commitear · **Origen:** detectado en vivo en la reunión con Andres Garcia (Fathom 2026-07-18, min 05:12: "esto está mal, la puta madre... debería ser un desvío de 10.000") y reportado por Fausti con la gestión "Prueba Desvio" (9 de Julio 2450): presupuesto $50.000 de materiales + $39.999,94 de mano de obra, rendición de $60.000 en materiales → la caja de Conformidad mostró **−$29.999,94 (−33%)** cuando el desvío real es **+$10.000 (+20%)**.

## Causa raíz

En `AccionConformidadGestor` (`components/gestiones/detalle.client.tsx`), un comentario afirma que lo rendido por el técnico ("Total gastado en la obra") incluye la mano de obra, y la fórmula lo sigue: `desvío = rendido − (materiales presupuestados + mano de obra)`. **Ese comentario es falso**: en toda la semántica operativa del sistema `materiales_total` es SOLO materiales — el costo final (STORY-964) y la liquidación (STORY-946) le suman la mano de obra aparte, y la métrica de Informes (STORY-937) ya mide el desvío "SOLO sobre materiales". Resultado: cuando la mano de obra es grande, el desvío da negativo aunque el técnico haya gastado de más.

El mismo equívoco vive en los **labels**: el input del técnico dice "Total gastado en la obra ($) — todo lo que gastaste" (invita a incluir la mano de obra, corrompiendo el dato en el origen) y las cajas de Conformidad/Cobro/Liquidación dicen "Total gastado en la obra (rendido)".

## Alcance

1. **Fórmula** (`AccionConformidadGestor`): `desvío = rendido − materiales presupuestados`; porcentaje sobre los materiales presupuestados (con guard `> 0`). La fila "Presupuesto total (materiales + mano de obra)" de la caja de rendición pasa a "Materiales presupuestados" y "Gastado real en la obra" a "Gastado real en materiales" — la comparación queda homogénea y el presupuesto completo ya se ve en la caja de costo final de abajo. Se corrige el comentario falso.
2. **Input del técnico** (form de rendición, mismo archivo): label → "Total final gastado en materiales ($) — sin contar tu mano de obra". Es el pedido explícito de Fausti: que el input pida el TOTAL FINAL gastado en materiales, sin ambigüedad.
3. **Labels coherentes** en las cajas que muestran lo rendido: "Total gastado en la obra (rendido)" → "Gastado en materiales (rendido)" en el detalle (caja de costo final, Conformidad) y en Cobro/Liquidación (`finanzas.client.tsx`).

## Fuera de alcance

- Datos históricos: no se recalcula nada persistido (el desvío es presentación; `materiales_total` guardado ya era solo materiales para los técnicos que cargaron bien).
- La métrica de Informes (STORY-937) — ya estaba correcta.

## Criterios de aceptación

1. Gestión "Prueba Desvio" (mat. presupuestados $50.000, rendido $60.000): la caja de Conformidad muestra Materiales presupuestados $50.000, Gastado real en materiales $60.000 y desvío **+$10.000 (+20%)** en ámbar.
2. Rendición por debajo de lo presupuestado → desvío negativo en esmeralda (regresión del signo).
3. Presupuesto aprobado con materiales $0 → sin fila de desvío (no divide por cero).
4. El técnico ve el input "Total final gastado en materiales ($) — sin contar tu mano de obra"; costo final y liquidación siguen calculando igual (rendido + mano de obra), `tsc`/eslint verdes.

## Dev Agent Record

- **Commit:** _pendiente (espera OK de Fausti)_
- **Archivos:** `codigo/components/gestiones/detalle.client.tsx` (fórmula del desvío + caja de rendición + label del input del técnico + label de la caja de costo final; se eliminó `presupuestoTotal` y el comentario falso), `codigo/components/gestiones/finanzas.client.tsx` (label en Cobro/Liquidación).
- **Verificación:** `tsc`/eslint verdes. E2E navegador (Admin, gestión "Prueba Desvio" — 9 de Julio 2450, en Conformidad): la caja pasó de mostrar −$ 29.999,94 (−33%) a **Materiales presupuestados $ 50.000 · Gastado real en materiales $ 60.000 · Desvío +$ 10.000 (+20%)** (el desvío de 10 mil exacto del ejemplo de la reunión); la caja de costo final sigue correcta ($ 60.000 + $ 39.999,94 = $ 99.999,94). Captura: `story-1003-desvio-corregido.png`.
