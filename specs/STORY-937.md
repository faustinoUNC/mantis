# STORY-937 — Desvío de presupuesto medido sobre materiales, ponderado por plata (v1.0)

**Estado:** ✅ done (commit `6719252`) · **Origen:** Fausti (2026-07-12), tras auditar el cálculo. Decisiones: (1) la métrica refleja **solo materiales** — la mano de obra quedó fija por diseño (STORY-934) y hoy diluye el porcentaje; (2) el promedio pasa a ser **ponderado por plata** (Σ reales / Σ presupuestados − 1), así una obra chica con +50% no pesa lo mismo que una grande con +2% y el número responde "si le doy $X de materiales, ¿cuánto cuesta de verdad?".

## Objetivo

Que el "Desvío" del scorecard de asignación y el "Cumplimiento de presupuesto" de Informes midan lo único que realmente puede desviarse: **materiales reales vs. materiales presupuestados**.

## Alcance y decisiones

### A. Fórmula nueva (idéntica en los dos lugares)

- Por técnico: `desvío % = (Σ materiales reales / Σ materiales presupuestados − 1) × 100`, sobre las obras que califican.
- **Materiales reales** por obra: `materiales_total` (rendición STORY-934) si existe; si no (gestiones viejas), fallback derivado `costo_final − mano de obra aprobada` (válido porque la mano de obra es fija por diseño).
- Califica la obra si: presupuesto aprobado con `monto_materiales > 0` y materiales reales ≥ 0 (un derivado negativo es dato sucio → se saltea).
- `n` sigue siendo la cantidad de obras contadas.

### B. Dónde cambia

- `features/gestiones/service.ts` → `estadisticasTecnicos()`: query suma `materiales_total`; el cálculo de `desvios` pasa a acumular Σ reales / Σ presupuestados. Comentario de `StatsTecnico.desvioPct` actualizado.
- `features/metricas/service.ts`: `FilaMetrica` gana `materialesTotal`, `matPresupuestada` y `moPresupuestada` (el select ya trae los montos del presupuesto; falta `materiales_total`).
- `components/metricas/panel-metricas.client.tsx` → memo `desvio`: misma fórmula ponderada por técnico. Título de la card queda; la ayuda **explica de dónde sale** (pedido de Fausti): materiales rendidos vs. presupuestados en $, con ejemplo ("+20% = cada $100 presupuestados terminaron costando $120") y aclaración de que la mano de obra no entra y las obras grandes pesan más.
- `components/gestiones/detalle.client.tsx` → ayuda del chip "Desvío" del scorecard: misma explicación con ejemplo, versión corta.

### C. Lo que NO cambia

- El umbral visual del chip (alerta > 10%) y la rampa/orden de la card de Informes.
- El desvío por obra que ve el gestor en Conformidad (ya era de materiales puros).
- Deuda que sigue (documentada en STORY-932): el desvío no distingue imprevistos legítimos con ticket de mala cotización — el gestor no aprueba gastos individuales desde STORY-934; su control es el costo final en la conformidad.

## Criterios de aceptación

1. Scorecard e Informes muestran el mismo desvío por técnico, calculado sobre materiales y ponderado por plata.
2. Gestión con rendición usa `materiales_total`; gestión vieja sin rendición usa `costo_final − mano de obra aprobada`; derivado negativo o sin presupuesto aprobado no cuenta.
3. Verificación numérica: el valor de la UI coincide con el cálculo a mano (SQL) para al menos un técnico con obras mixtas (con y sin rendición).
4. `tsc` + eslint + `next build` verdes.

## Dev Agent Record
- **Estado:** ✅ done (2026-07-12). Commit `6719252` en main, deploy automático en Vercel. Sin migración.
- **Archivos:**
  - `features/gestiones/service.ts` — `estadisticasTecnicos`: `materiales_total` en la query; `desvioPct` = Σ reales / Σ presupuestados − 1 (reales = rendición, fallback `costo_final − mano de obra`; saltea sin aprobado, materiales ≤ 0 o derivado negativo).
  - `features/gestiones/types.ts` — comentario de `StatsTecnico.desvioPct`.
  - `features/metricas/service.ts` — `FilaMetrica` + select: `materialesTotal`, `matPresupuestada`, `moPresupuestada`.
  - `components/metricas/panel-metricas.client.tsx` — memo `desvio` con la fórmula nueva; ayuda de la card.
  - `components/gestiones/detalle.client.tsx` — ayuda del chip "Desvío" del scorecard.
- **Verificación:** `tsc`, eslint y `next build` verdes. Numérica (AC 3): SQL a mano (`Σ coalesce(materiales_total, costo_final − mo) / Σ monto_materiales − 1` por técnico) vs. card "Cumplimiento de presupuesto" en el Inicio del admin: mismo orden de 8 técnicos (Andrea Roldán +57,2% → Tecnico Uno +14,5%), n total 71 en ambos, eje consistente. Datos reales mixtos (con y sin rendición) — el fallback quedó ejercitado.
