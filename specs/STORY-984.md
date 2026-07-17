# STORY-984 — Cumplimiento de plazo honesto: piso de 1 día y solo obras terminadas

**Estado:** ✅ done · **Origen:** reporte de Fausti 2026-07-17 (card Trello #106) — investigación BMAD confirmó ambos casos con datos reales: `_bmad-output/implementation-artifacts/investigations/metrica-cumplimiento-plazo-investigation.md`.

## El problema

La métrica de cumplimiento de plazo (card de Informes, STORY-921/966, y stats del picker de técnicos) compara los días reales de la última ejecución completa contra el `plazo_dias` del presupuesto aprobado. Dos defectos, mismo origen (`ultimaEjecucionDias` en `features/gestiones/ejecucion.ts` + sus dos consumidores):

1. **Sin piso de 1 día.** Los días reales son fraccionales: una obra de 2 horas computa 0.08 días → desvío de −98% contra un plazo de 5. Pero el técnico jamás puede comprometer menos de 1 día (el form exige `min="1"`), así que compararlo con fracciones es injusto por diseño y diluye el promedio. En la base hoy: 21 de 117 ejecuciones medidas dan < 1 día.
2. **Cualquier salida de `en_ejecucion` cuenta como obra terminada.** El helper cierra la visita sin mirar el destino: la cancelación sin cargo (→ `cancelada`), la cancelación CON cargo (→ `facturacion_cobro`) y la desasignación (→ `asignacion`) computan ejecuciones cortadas como cumplimiento estelar. `cancelarGestion` no anula `tecnico_id` ni el presupuesto aprobado, así que la cancelada pasa todos los guards. La desasignación además le imputa la visita parcial del saliente al técnico ENTRANTE (hasta que este cierre su propia ejecución). En la base hoy: 4 de 117 salidas son anormales.

## La solución (Regla #0: mínima)

Helper nuevo en `features/gestiones/ejecucion.ts`, compartido por los dos consumidores — **sin tocar** `ultimaEjecucionDias` (el tiempo de ciclo de Informes necesita la fracción real y ya excluye canceladas por exigir `finalizado`):

1. **`ejecucionParaPlazoDias(transiciones)`**: misma pasada que el helper existente, pero solo cierra la visita cuando la salida va a **`conformidad`** (obra realmente terminada — allowlist, NO denylist por `cancelada`: la cancelación con cargo sale a `facturacion_cobro` y se escaparía), y aplica **piso de 1 día** (`Math.max(1, dias)`) al resultado, coherente con el `min="1"` del form de presupuesto.
2. **Informes** (`components/metricas/panel-metricas.client.tsx`): el memo que deriva la duración de ejecución produce un segundo mapa con el helper nuevo; `desvioPlazo` lee de ese mapa. El ciclo sigue leyendo el mapa fraccional existente.
3. **Picker de técnicos** (`features/gestiones/service.ts`, stats de asignación): swap de `ultimaEjecucionDias` → `ejecucionParaPlazoDias` (ese mapa solo alimenta el % de plazo).

Sin migraciones, sin cambios de esquema, sin tocar el server layer de métricas.

## Criterios de aceptación

1. Gestión con plazo 1 día resuelta en horas (salida normal a Conformidad): computa 0% de desvío (cumplió), no −90%.
2. Gestión cancelada en plena ejecución (con o sin cargo): NO computa en el cumplimiento de plazo del técnico (Informes ni picker).
3. Desasignación en plena ejecución: la visita parcial del saliente no se le imputa al técnico entrante; la gestión recién computa cuando el nuevo técnico saca SU obra a Conformidad.
4. El tiempo de ciclo de Informes no cambia (sigue restando la fracción real de obra).
5. `tsc` + `eslint` verdes.

## Dev Agent Record

- **Archivos:** `features/gestiones/ejecucion.ts` (helper nuevo `ejecucionParaPlazoDias`), `components/metricas/panel-metricas.client.tsx` (el memo de ejecución produce dos mapas: fraccional para el ciclo, con criterio de plazo para `desvioPlazo`), `features/gestiones/service.ts` (stats del picker: swap al helper nuevo). Sin migraciones.
- **Verificación:** `tsc` + `eslint` verdes. Tests de lógica del helper (tsx, 8 casos): clamp a 1 con salida normal, 5 días exactos, cancelada sin cargo / con cargo (→ `facturacion_cobro`) no computan, desasignación no imputa la visita parcial al entrante (computa recién cuando el nuevo sale a conformidad, con SU duración), obra en curso no computa, y el ciclo conserva la fracción real. E2E en navegador 2026-07-17: card "Cumplimiento de plazo" de Informes renderiza (59 gestiones, solo los que se pasaron) y el picker muestra el efecto del piso (−88.9% = plazo 9 con real clampeado a 1 — antes daba −99%).
- **Datos de contexto (investigación):** 21/117 ejecuciones medidas < 1 día, 4/117 con salida anormal. Case file: `_bmad-output/implementation-artifacts/investigations/metrica-cumplimiento-plazo-investigation.md`.
