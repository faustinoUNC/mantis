# STORY-964 — Rendición del técnico: un solo total real de la obra; los gastos imprevistos son evidencia, no un renglón que se re-suma

**Estado:** ✅ done · **Origen:** Fausti (2026-07-14, card Trello #88): "Si cargo un costo adicional en una gestión ya iniciada, no veo que impacte en el monto total a cobrar." Al analizarlo, el gasto **sí** impacta (STORY-961 lo suma); el problema real que Fausti detecta es que **pedirle al técnico el 'total gastado en materiales, sin los imprevistos' es poco intuitivo y produce un desvío irreal**.

## El problema (ejemplo de Fausti)

Presupuesto de materiales = 10. El técnico carga un imprevisto de 5 (con ticket). Hoy le pedimos "total gastado en materiales **sin** los imprevistos" → pone 10. Resultado: en Conformidad el desvío de materiales figura **0%**, cuando en realidad gastó 15 sobre un presupuesto de 10 → el desvío real es **+50%**. Además, si el técnico se confunde y mete los 5 dentro de su total (pone 15), el sistema los **cuenta dos veces** (`15 + 5 + mano_obra`). El diseño depende de una resta mental frágil.

## Decisión (Fausti) — un solo total real

El técnico rinde **un único número: el total real gastado en la obra, TODO incluido** (materiales + lo que haya sido imprevisto). Los `gastos_imprevistos` cargados durante la ejecución dejan de sumarse aparte y pasan a ser lo que siempre debieron ser: el **desglose con ticket que justifica** por qué el total superó el presupuesto (alerta temprana + evidencia documentada).

- **Fórmula nueva:** `costo_final = total_gastado_obra + mano_de_obra`. Sin `+ Σ gastos` (los gastos ya están dentro del total) → **doble conteo imposible**.
- **Desvío real:** `total_gastado_obra − materiales_presupuestados`. En el ejemplo: 15 − 10 = **+50%**.
- **Robustez:** el total rendido no puede ser menor que los imprevistos ya cargados con ticket (`total_gastado_obra ≥ Σ gastos_imprevistos`); si no, hay una inconsistencia. Se conservan los controles anti-inflado existentes: avance obligatorio + foto de **todos** los comprobantes, y el gestor ve el desvío antes de aprobar.

La columna `gestiones.materiales_total` conserva su nombre (Regla #0, sin migración) pero su **semántica pasa a "total gastado en la obra, imprevistos incluidos"**.

## Supersede de STORY-961 (decisión #1)

STORY-961 definió que el técnico rinde "materiales **sin** los imprevistos" y que los gastos se **suman aparte** al costo final. Esta story **revierte esa decisión**: el técnico rinde el total con los imprevistos adentro y los gastos **no** se re-suman. Se mantiene todo lo demás de STORY-961 (costo final calculado no editable server-side, aprobación de conformidad separada del cobro).

## Implementación

- **`codigo/components/gestiones/detalle.client.tsx`**
  - `AccionConformidadTecnico` (input :959-968): label → **"Total gastado en la obra ($) — todo lo que gastaste, incluidos los gastos imprevistos"**. Si hay imprevistos cargados, mostrar debajo el detalle ("Ya cargaste $X en gastos imprevistos con ticket — incluilos en este total") y validar client-side `total ≥ Σ imprevistos` con mensaje claro.
  - `AccionConformidadGestor` (:1019): `costoFinal = baseMateriales + manoObra` (quitar `+ totalGastos`). El desvío (:1020) ya queda real. Desglose (:1097-1117): reemplazar los renglones "Materiales rendidos + Gastos imprevistos + Mano de obra" por **"Total gastado en la obra (rendido)"** (con sub-línea informativa "incluye $Y de imprevistos con ticket") + **"Mano de obra (presupuesto aprobado)"** = **"Costo final"**. El bloque de desvío (:1063-1086) relabela "Gastado real (rendido)" → "Gastado real en la obra".
- **`codigo/features/gestiones/service.ts`**
  - `resolverConformidad` (:1069-1071): `costoFinal = (rendido ?? matPresupuestados) + manoObra`. Ya no se suma `gastos`. (Se puede dejar de traer `gastos_imprevistos(monto)` para el cálculo; se mantiene la carga de gastos para mostrarlos como evidencia.)
  - `subirConformidad` / rendición (:940-995): validación server `total_gastado ≥ Σ gastos_imprevistos` antes de guardar (rechazo con mensaje si no).
- **`codigo/features/finanzas/service.ts`**
  - `registrarLiquidacion` (:508-513): `materiales_total + manoObra` (quitar `+ gastos`). Fallback `costo_final` para viejas sin rendición se mantiene.
- **`codigo/components/gestiones/finanzas.client.tsx`** (etapa liquidación, ~:211-215): sacar el renglón "Gastos imprevistos" del desglose "A liquidar al técnico" (ya está dentro del total).
- **`codigo/features/finanzas/pdf.tsx`** (:45): la línea de materiales ahora refleja el total de obra rendido; ajustar el label si dice "materiales" para que lea "gastado en la obra".
- **Métricas** (`features/metricas/service.ts`, `panel-metricas.client.tsx`): el desvío ya se computa sobre `materiales_total` vs presupuestado; con la nueva semántica queda real sin cambio de fórmula. Solo revisar labels si nombran "materiales".

Sin migración. Nota de datos: gestiones aprobadas **antes** de esta story conservan su `costo_final`/`materiales_total` con la semántica vieja (no se hace backfill); en el entorno de prueba conviene resetear datos para ver el flujo nuevo limpio.

## Criterios de aceptación

1. El técnico ve **un solo campo**: "Total gastado en la obra (todo, incluidos los imprevistos)". No se le pide restar nada.
2. Con el ejemplo (presupuesto 10, imprevisto 5, total rendido 15): costo final = 15 + mano de obra; el desvío en Conformidad muestra **+50%** (no 0%); el total a cobrar y la liquidación usan 15 + mano de obra (el imprevisto **no** se suma dos veces).
3. Si el técnico intenta rendir un total **menor** que los imprevistos ya cargados, se bloquea con mensaje claro (client y server).
4. El desglose de Conformidad muestra el total gastado con la sub-línea de cuánto de eso son imprevistos con ticket, + mano de obra = costo final. No hay renglón que sume los imprevistos por segunda vez.
5. La liquidación al técnico y el cobro al pagador dan el mismo número que el costo final (+ fee en el cobro), sin doble conteo.
6. `tsc` + `eslint` verdes.

## Dev Agent Record

- **Archivos:** `codigo/components/gestiones/detalle.client.tsx` (`AccionConformidadTecnico`, `AccionConformidadGestor`), `codigo/features/gestiones/service.ts` (`resolverConformidad`, rendición de `subirConformidad`), `codigo/features/finanzas/service.ts` (`registrarLiquidacion`), `codigo/components/gestiones/finanzas.client.tsx`, `codigo/features/finanzas/pdf.tsx`.
- **Verificación:** `tsc --noEmit` + `eslint` verdes. E2E local (2026-07-14) sobre `[PRUEBA FAUSTI] Rendición de materiales`: materiales presupuestados $50.000, imprevisto $25.000, total rendido $75.000 (validación `total < Σ imprevistos` bloqueó correctamente antes de eso). Conformidad: desvío +$25.000 (+50%), costo final $155.000 = $75.000 + $80.000 mano de obra (sin doble conteo). Al aprobar, el server recalculó el mismo valor y Cobro mostró $155.000.
- **Commit:** `226e167` (junto con STORY-962/963). Card Trello #88 movida a "En prueba".
