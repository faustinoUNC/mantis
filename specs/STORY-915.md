# STORY-915 — Desempeño del técnico a golpe de vista: desvío de presupuesto + scorecard en la asignación (v1.3)

> **v1.1 (2026-07-08):** cada señal del scorecard muestra, al hacer hover, un tooltip breve y sintético explicando qué mide (pedido de Fausti — que quien asigna entienda cada número sin adivinar).
> **v1.2 (2026-07-08, revisión pre-commit):** el % de cancelación del scorecard se calcula sobre las gestiones **terminadas** (finalizadas + canceladas), no sobre todas — las activas diluían la señal (`nGestiones` → `nTerminadas` en `StatsTecnico`). Limitación documentada: al reasignar técnico se pisa `tecnico_id`, así que el rechazo histórico deja de contar para el técnico que rechazó (no hay historial de asignaciones — aceptado por Regla #0).
> **v1.3 (2026-07-08):** dos ajustes de UX del scorecard pedidos por Fausti. (1) **Obras** se desdobla en dos señales: *En curso* (activas = carga actual, ya existía) y *Hechas* (finalizadas — track record del técnico, análogo a "viajes realizados"; las canceladas NO cuentan como hechas). Nuevo `obrasRealizadas` en `StatsTecnico`. (2) La tira de días de disponibilidad, que solo mostraba **qué** días trabaja, ahora revela **a qué hora** de cada día vía tooltip ordenado al hover (mismo patrón visual que los tooltips de los chips), sin saturar la tarjeta.

**Estado:** 🚧 en desarrollo · **Fecha:** 2026-07-08
**Origen:** Fausti, tras la 2ª party mode. (1) Aprueba la métrica **desvío de presupuesto** (qué técnico cumple lo que presupuesta) y **descarta** "qué técnico es más barato" (no se puede hacer confiable: el único normalizador de alcance —`plazo_dias`— es auto-reportado y basura; normalizar por rubros violaría la Regla #0 → no se mete data inexacta). (2) Pide **rediseñar el momento en que se manda la solicitud de asignación al técnico**: hoy es un dropdown a ciegas; debe volverse **sintético, visual y gráfico**, para que quien asigna vea de un vistazo cómo se maneja cada técnico.
**Panel BMAD:** Mary, John, Winston, Sally (misma sala que [STORY-914]).

## Objetivo

Que la decisión de asignación deje de ser a ciegas: cada técnico candidato se muestra como una **tarjeta elegible (scorecard)** con sus señales de desempeño a golpe de vista. Y sumar la métrica **desvío de presupuesto** al dashboard (STORY-914).

## Por qué "el más barato" no va (decisión registrada)

Comparar mano de obra entre técnicos exige normalizar por alcance (pintar una casa ≠ pintar una pared). El único dato de alcance disponible es `presupuestos.plazo_dias`, auto-reportado y ya demostrado poco fiable (valores basura en la base). Construir un catálogo de rubros estandarizados por especialidad sería un sistema entero (viola Regla #0). Conclusión de la mesa: **no se agrega** — Fausti no quiere datos inexactos. En su lugar va el **desvío**, que compara a cada técnico contra su propia vara (su presupuesto), anulando el problema del alcance.

## Métrica nueva: desvío de presupuesto

- **Definición:** por técnico, promedio de `(costo_final − monto_presupuestado_aprobado) / monto_presupuestado_aprobado`. Positivo = termina cobrando más de lo que presupuestó; ~0 = cumple.
- **Confiable** porque cada técnico se mide contra su propio presupuesto (no contra otro). Cero dato nuevo: `costo_final` y el presupuesto aprobado ya existen.
- **Dashboard (STORY-914):** gráfico nuevo "Cumplimiento de presupuesto por técnico" — barras por técnico, verde si cumple (~0), ámbar si se va para arriba. Con regla de muestra chica (bajo N gestiones cerradas, atenuado/oculto).

## Scorecard del técnico en la asignación

Reemplaza el `<Select>` de `AccionAsignar` por **tarjetas seleccionables** (una por técnico candidato de la especialidad). Cada tarjeta muestra, sintético:

| Señal | Fuente | Lectura |
|---|---|---|
| **⭐ Calificación** | `calificaciones` (avg estrellas) | calidad percibida |
| **Desvío de presupuesto** | `costo_final` vs presup. aprobado | ¿cumple la plata? (verde/ámbar) |
| **Obras en gestión** | gestiones activas asignadas | ¿está saturado? |
| **% rechazo de asignaciones** | `asignacion_aceptada=false` | ¿suele rechazar lo que le mandás? |
| **% cancelación** | gestiones suyas que terminan `cancelada` | señal de fuga |
| **Disponibilidad** | `franjas_disponibilidad` | días/horas de trabajo (visual, no texto plano) |

- **Regla de muestra chica:** cada señal con pocos datos se muestra como "—/sin datos", nunca un número que engañe (Mary). El denominador (N) acompaña donde importa.
- **A golpe de vista:** chips/mini-visuales, no párrafos. Mobile-friendly igual (el detalle sí lo ve el gestor en celular), pero el foco es claridad.

## Arquitectura del dato (privacidad + exactitud)

- Las stats por técnico se calculan **agregadas across TODAS sus gestiones** (no solo las del gestor actual) → se computan con **admin client** en el server, devolviendo **solo números** (nunca gestiones de otros gestores). El gestor ve "Técnico X: 4.2★, +5% desvío, 3 obras" sin acceder a datos ajenos.
- Se extiende `tecnicosDisponibles(especialidadId)` para incluir `stats` por técnico, o una función `estadisticasTecnicos(ids)` dedicada.

## Alcance (código)
- `features/gestiones/types.ts` — `TecnicoDisponible.stats: { estrellas, nCalif, desvioPct, nDesvio, obrasActivas, pctRechazoAsig, nAsig, pctCancelacion, nGestiones } | null`.
- `features/gestiones/service.ts` — `tecnicosDisponibles` computa las stats (admin client, agregados).
- `components/gestiones/detalle.client.tsx` — `AccionAsignar` reescrito como scorecards seleccionables.
- `features/metricas/service.ts` — filas incluyen `costoFinal` y `presupuestoAprobado` (para el desvío del dashboard).
- `components/metricas/panel-metricas.client.tsx` — gráfico #9 "Cumplimiento de presupuesto por técnico".

## Criterios de aceptación
1. Al asignar, el gestor ve una tarjeta por técnico candidato con: ⭐ calificación, desvío de presupuesto, obras en gestión, % rechazo de asignaciones, % cancelación y disponibilidad — sintético y visual.
1.b (v1.1) Cada señal muestra al hover un tooltip breve que explica qué mide.
2. Cada señal con muestra insuficiente muestra "—/sin datos", no un número engañoso.
3. Las stats son agregados across todas las gestiones del técnico (exactas), computadas en server sin filtrar por ownership, exponiendo solo números.
4. El dashboard suma el gráfico "Cumplimiento de presupuesto por técnico" (desvío), verde/ámbar, con regla de muestra chica.
5. "Qué técnico es más barato" NO se implementa (queda documentada la decisión).
6. `tsc` verde, eslint verde, `next build` OK. RLS intacta (admin client solo para agregados numéricos).

## Fuera de alcance
- Comparación de mano de obra normalizada por alcance ("más barato") — descartada por no confiable.
- Ranking global de técnicos por desvío fuera del contexto de asignación/dashboard.

## Dev Agent Record
- **Commit:** _(pendiente — Fausti revisa en local antes de commitear)_
- **Archivos:**
  - `features/gestiones/types.ts` — `StatsTecnico` + `TecnicoDisponible.stats`.
  - `features/gestiones/service.ts` — `estadisticasTecnicos(ids)` (admin client, agregados across todas las gestiones del técnico: estrellas, desvío %, obras activas, **obras realizadas (v1.3)**, % rechazo asignaciones, % cancelación); `tecnicosDisponibles` las adjunta.
  - `components/gestiones/detalle.client.tsx` — `AccionAsignar` reescrito como **scorecards seleccionables** (`ScorecardTecnico` + `ChipStat` + `TiraDias`): ⭐ calif · desvío (verde/ámbar) · obras · % rechaza · % cancela · tira de días con disponibilidad. "s/d" cuando falta muestra. Quitado el `<Select>` y el import `DIAS` (sin uso). **(v1.1)** cada `ChipStat` muestra tooltip al hover (label subrayado punteado, cursor-help, `align` izq/der para no desbordar la card). **(v1.3)** grilla de chips pasa a `grid-cols-3` (2 filas) con 6 señales: se desdobla Obras en *En curso* (activas) y *Hechas* (`obrasRealizadas`, finalizadas); `TiraDias` suma tooltip con los horarios por día (helper `horariosPorDia`, orden Lun→Sáb→Dom, mismo estilo de tooltip que los chips).
  - `features/metricas/service.ts` — filas suman `costoFinal` y `presupuestoAprobado` (presupuesto aprobado).
  - `components/metricas/panel-metricas.client.tsx` — gráfico #9 "Cumplimiento de presupuesto" (desvío por técnico, verde ≤10% / ámbar >10%). Además: el gráfico #1 (finanzas) ahora discrimina la **ganancia de la inmobiliaria (fee) en ámbar** con leyenda y total en tooltip (pedido Fausti).
- **Verificación:** `npx tsc --noEmit` verde · eslint verde · `npx next build` OK (23 rutas). Pendiente verificación en navegador de Fausti (con 2 técnicos y pocas gestiones, la mayoría de señales del scorecard mostrarán "s/d" hasta que haya historia — comportamiento esperado).
