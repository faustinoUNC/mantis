# Investigation: Métrica de cumplimiento de plazo — días fraccionales y contaminación por cancelación/desasignación

## Hand-off Brief

1. **Qué pasa.** La métrica de cumplimiento de plazo (Informes + picker de técnicos) computa días reales fraccionales sin piso (una obra de 2 horas da ≈ −98% de desvío) y cuenta como "ejecución completa" cualquier salida de `en_ejecucion`, incluidas cancelaciones y desasignaciones — ambos mecanismos Confirmados con cita de código y datos reales (21/117 ejecuciones < 1 día; 4/117 con salida anormal).
2. **Dónde está el caso.** Concluido: root cause Confirmado en los dos consumidores (`panel-metricas.client.tsx:557` y `gestiones/service.ts:710`), perímetro barrido — el resto de usos de `plazo_dias` es display-only y `ciclo`/`cuellos` no sufren el mismo defecto (con un side finding menor en cuellos y en desvío de materiales).
3. **Próximo paso.** Crear STORY (fix no trivial: toca un helper compartido con otro consumidor que NO debe clampearse) — dirección de fix abajo.

## Case Info

| Field            | Value                                                                        |
| ---------------- | ---------------------------------------------------------------------------- |
| Ticket           | N/A (reporte verbal de Fausti, sesión 2026-07-17)                            |
| Date opened      | 2026-07-17                                                                    |
| Status           | Concluded                                                                     |
| System           | MANTIS 2 — Next.js + Supabase (proyecto `ejwokycbyjtlxwusbhtt`)               |
| Evidence sources | Código (`codigo/`), datos productivos vía SQL read-only, historia de stories  |

## Problem Statement

Reporte de Fausti (hipótesis inicial, verbatim resumido):

1. Cuando un técnico resuelve una gestión en menos de 1 día, la métrica computa ~0 días y "destruye" el promedio — el técnico nunca puede estimar menos de 1 día (`plazo_dias` mínimo 1), así que el real debería pisarse a mínimo 1.
2. (No seguro) Desasignar un técnico o cancelar una gestión no debería contar para su cumplimiento de plazo: asignado y cancelado el mismo día hace parecer que "trabaja más rápido que la luz".

## Evidence Inventory

| Source                                   | Status    | Notes                                                                 |
| ---------------------------------------- | --------- | --------------------------------------------------------------------- |
| Cálculo de la métrica (código)           | Available | `panel-metricas.client.tsx`, `gestiones/service.ts`, `ejecucion.ts`   |
| Datos productivos (eventos_gestion)      | Available | SQL read-only sobre el proyecto Supabase del perfil mantis            |
| Stories previas (921, 966)               | Available | Comentarios en código citan el linaje                                 |
| Migraciones SQL locales                  | Missing   | No hay `.sql` en el repo; `avanzar_etapa` vive solo en la DB — no hizo falta leerla: los service actions muestran las transiciones válidas |

## Investigation Backlog

| # | Path to Explore                                             | Priority | Status | Notes                                            |
| - | ----------------------------------------------------------- | -------- | ------ | ------------------------------------------------ |
| 1 | Cálculo desvíoPlazo en Informes                              | High     | Done   | Confirmado defectuoso                            |
| 2 | Stats del picker de técnicos                                 | High     | Done   | Mismo cálculo, mismos defectos                   |
| 3 | Otros consumidores de `plazo_dias`                           | High     | Done   | finanzas/eventos/detalle: display-only           |
| 4 | Otros consumidores de duración de ejecución (ciclo, cuellos) | Medium   | Done   | ciclo OK (exige finalizado); cuellos side finding |
| 5 | Contaminación de canceladas en desvío de materiales          | Low      | Open   | Side finding — evaluar en la story del fix       |

## Confirmed Findings

### Finding 1: El desvío de plazo usa días fraccionales sin piso

**Evidence:** `codigo/components/metricas/panel-metricas.client.tsx:557-562` y `codigo/features/gestiones/ejecucion.ts:24`

**Detail:** `ultimaEjecucionDias` devuelve `(salida − entrada) / 86400000` — un float. En `desvioPlazo`, `pct = ((real − plazoDias) / plazoDias) * 100` con `real = 0.08` (2 horas) y `plazoDias = 5` da **−98.4%**. El form de presupuesto exige `plazo_dias ≥ 1` (`detalle.client.tsx:551`, `min="1"`), o sea el técnico jamás puede comprometer menos de 1 día pero la métrica sí le computa menos de 1 día real. La premisa 1 de Fausti es correcta.

### Finding 2: Cualquier salida de `en_ejecucion` cuenta como ejecución completa

**Evidence:** `codigo/features/gestiones/ejecucion.ts:21-27` — el loop cierra la visita con `e.deEtapa === "en_ejecucion"` sin mirar `aEtapa`.

**Detail:** Salidas posibles según los service actions: a `conformidad` (flujo normal), a `cancelada` (cancelación sin cargo, `service.ts:415`), a `facturacion_cobro` (cancelación CON cargo, `service.ts:415`), a `asignacion` (desasignación, `service.ts:465`). Las tres últimas NO son obra terminada, pero `ultimaEjecucionDias` las mide igual.

### Finding 3: Las gestiones canceladas entran a la métrica con técnico y plazo vigentes

**Evidence:** `panel-metricas.client.tsx:559-561` (no filtra por etapa) + `gestiones/service.ts:387-438` (`cancelarGestion` no anula `tecnico_id` ni rechaza el presupuesto aprobado).

**Detail:** Una gestión cancelada en plena ejecución conserva `tecnico_id` y su presupuesto `aprobado` con `plazo_dias` → pasa todos los guards del cálculo y computa la ejecución parcial (cortita) como si fuera obra cumplida. Es exactamente el escenario "más rápido que la luz" de Fausti.

### Finding 4: Datos reales — 21/117 ejecuciones < 1 día, 4/117 con salida anormal

**Evidence:** SQL read-only 2026-07-17 sobre `eventos_gestion` + `presupuestos` (aprobado, `plazo_dias ≥ 1`) + `gestiones` (con técnico). Salidas de `en_ejecucion` por destino: conformidad 116, asignacion 3, facturacion_cobro 3, cancelada 1.

**Detail:** De las 117 ejecuciones que la métrica hoy mide: 21 computan menos de 1 día (cada una mete un término entre −50% y −100% al promedio del técnico) y 4 tienen última salida ≠ conformidad (2 de ellas además < 1 día). El defecto no es teórico: ya está distorsionando los promedios.

### Finding 5: El picker de técnicos replica el mismo cálculo con los mismos defectos

**Evidence:** `codigo/features/gestiones/service.ts:655-714` (comentario explícito: "mismo cálculo que la card homónima de Informes").

**Detail:** Usa el mismo `ultimaEjecucionDias` y la misma fórmula de %; filtra por `tecnico_id === id` así que las canceladas con técnico cuentan igual. El fix tiene que aplicarse en AMBOS consumidores (o en un punto común) para que Informes y picker no diverjan.

## Deduced Conclusions

### Deduction 1: La desasignación contamina de forma acotada y transitoria (al nuevo técnico)

**Based on:** Finding 2 + `desasignarTecnico` (`service.ts:440-470`, retroceso TOTAL: presupuesto queda rechazado) + guard `plazoDias` del cálculo.

**Reasoning:** Tras desasignar, el presupuesto aprobado del saliente queda rechazado → `plazoDias = null` → la gestión sale de la métrica. Recién vuelve a entrar cuando el técnico NUEVO tiene su propio aprobado; si el nuevo todavía no cerró su ejecución, `ultimaEjecucionDias` devuelve la visita parcial del SALIENTE (la única completa) y se la imputa al nuevo contra SU plazo. Cuando el nuevo termina, su visita pisa a la anterior (self-healing).

**Conclusion:** El caso desasignación es real pero transitorio y se imputa al técnico equivocado (el entrante, no el saliente). El fix de "solo salidas a conformidad" lo elimina de raíz. Matiz a la premisa de Fausti: si la gestión se cancela o desasigna ANTES de entrar a ejecución, NO contamina (no hay entrada/salida de `en_ejecucion` → `real = null` → se saltea).

### Deduction 2: `ciclo` no sufre el defecto de canceladas; el clamp NO debe ir en el helper

**Based on:** `panel-metricas.client.tsx:458-468` (ciclo exige evento a `finalizado`) y `:435-455` (`ejecucionPorGestion` alimenta a AMBAS métricas).

**Reasoning:** El ciclo resta la duración de obra del tiempo total — ahí la fracción real (0.08 días) es lo correcto; pisarla a 1 día dentro de `ultimaEjecucionDias` restaría de más y distorsionaría el ciclo. Las canceladas nunca llegan a `finalizado`, así que el ciclo ya las excluye.

**Conclusion:** El piso de 1 día va en los DOS puntos de comparación contra `plazo_dias`, no en `ejecucion.ts`. (Alternativa: un segundo helper `ejecucionParaPlazo` que encapsule piso + solo-conformidad, compartido por panel y picker.)

## Hypothesized Paths

### Hypothesis 1 (de Fausti): resolver en <1 día computa 0 y destruye la métrica

**Status:** Confirmed

**Resolution:** Findings 1 y 4. Matiz: no computa exactamente 0 sino la fracción real de día; el efecto sobre el promedio es el descripto.

### Hypothesis 2 (de Fausti): canceladas/desasignadas contaminan el cumplimiento de plazo

**Status:** Confirmed

**Resolution:** Findings 2, 3, 4 y Deduction 1. Matiz: solo contaminan si la gestión ya estaba EN ejecución; canceladas/desasignadas antes de ejecutar no entran a la métrica.

## Missing Evidence

| Gap | Impact | How to Obtain |
| --- | ------ | ------------- |
| — (ninguno bloqueante) | | |

## Source Code Trace

| Element       | Detail                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------ |
| Error origin  | `codigo/features/gestiones/ejecucion.ts:21-27` (`ultimaEjecucionDias` — cierra visita con cualquier salida) + falta de piso en los consumidores |
| Trigger       | Cálculo de `desvioPlazo` en Informes (`panel-metricas.client.tsx:557`) y stats del picker (`gestiones/service.ts:710`) |
| Condition     | Gestión con presupuesto aprobado (`plazo_dias ≥ 1`) y técnico, cuya última salida de `en_ejecucion` es < 1 día y/o ≠ conformidad |
| Related files | `codigo/components/metricas/panel-metricas.client.tsx`, `codigo/features/gestiones/service.ts`, `codigo/features/gestiones/ejecucion.ts`, `codigo/components/gestiones/detalle.client.tsx` (min=1 del form) |

## Conclusion

**Confidence:** High

Los dos reportes de Fausti están Confirmados con código citado y datos productivos. Root cause doble, mismo origen (`ultimaEjecucionDias` + sus dos consumidores):

1. **Sin piso:** días reales fraccionales comparados contra un plazo cuyo mínimo posible es 1 día → toda obra rápida genera desvíos negativos enormes que diluyen el promedio del técnico (21 de 117 ejecuciones hoy).
2. **Salida anormal cuenta como obra terminada:** cancelación (con o sin cargo) y desasignación en plena ejecución cierran una "visita completa" corta que la métrica toma como cumplimiento estelar (4 de 117 hoy; la desasignación además se imputa al técnico entrante).

Perímetro del barrido: el picker de técnicos tiene el mismo defecto (Finding 5); `ciclo` NO (exige finalizado); demás usos de `plazo_dias` son display-only.

## Recommended Next Steps

### Fix direction

En un punto común para Informes y picker (p. ej. helper nuevo junto a `ultimaEjecucionDias`, sin tocar el existente que usa `ciclo`):

1. **Solo contar la ejecución si su salida fue a `conformidad`** (obra realmente terminada). Elimina canceladas con/sin cargo y desasignaciones.
2. **Piso de 1 día**: `Math.max(1, dias)` antes de comparar contra `plazo_dias`. Coherente con el `min="1"` del form.

NO clampearse dentro de `ultimaEjecucionDias`: el ciclo necesita la fracción real.

### Diagnostic

Ninguno pendiente — verificación post-fix: re-correr el SQL de Finding 4 esperando que `salida_anormal` y `menos_de_1_dia` dejen de entrar al cálculo (comparar promedios del panel antes/después con los datos demo).

## Reproduction Plan

1. Gestión con presupuesto aprobado (plazo 5 días) → técnico entra a ejecución → cancelarla a las 2 horas (sin cargo). Hoy: el técnico gana ≈ −98% en la card "Cumplimiento de plazo" del picker/Informes. Esperado post-fix: la gestión no computa.
2. Gestión con plazo 1 día resuelta en 3 horas (salida normal a conformidad). Hoy: −87.5%. Esperado post-fix: 0% (cumplió).

## Side Findings

- **Desvío de materiales también admite canceladas** (Hypothesized): `desvio` (`panel-metricas.client.tsx:525-550`) y su gemelo del picker no filtran por etapa; una cancelada en ejecución con rendición parcial (`materiales_total` bajo) aparenta "gastó menos de lo presupuestado". Mismo patrón, evaluar en la story si se filtra igual.
- **Cuellos de botella incluye canceladas** (Confirmed, `panel-metricas.client.tsx:406-432`): sus tiempos de etapa son reales, así que es defendible — solo notar que una ola de cancelaciones rápidas puede bajar artificialmente el promedio de las etapas administrativas.
- El evento de salida por cancelación con cargo va a `facturacion_cobro`, no a `cancelada` — cualquier fix que filtre "por etapa destino = cancelada" se lo perdería; por eso la dirección correcta es allowlist (`= conformidad`), no denylist.
