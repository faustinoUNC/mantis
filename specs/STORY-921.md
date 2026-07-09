# STORY-921 — Cumplimiento de plazo de obra + circuito sin tiempo de ejecución (v1.0)

**Estado:** 🚧 en desarrollo (aprobado en party mode 2026-07-09, Mary/John/Winston/Sally) · **Origen:** Fausti, tras usar el dashboard. Regla #0: la solución más simple que cumpla. Contract "Esmeralda técnica".

## Insight central

El tiempo de la etapa `en_ejecucion` (el trabajo físico del técnico) **depende del tamaño de la obra** — no es lo mismo pintar una pared que una casa entera. Meterlo en las métricas de eficiencia del **circuito** (Cuellos de botella, Tiempo de ciclo) las ensucia: el trabajo físico "gana" el gráfico y tapa los cuellos administrativos reales. Y ese mismo dato de ejecución, **contrastado contra el plazo que el técnico se comprometió** (`presupuestos.plazo_dias`, hoy dato muerto), es una métrica nueva de desempeño: **¿el técnico cumple los plazos que promete?** — el gemelo en *tiempo* del "Cumplimiento de presupuesto" (que ya existe en *plata*).

## Alcance y decisiones

### A. Renombrar el panel
`h2 "Métricas" → "Informes"`. Comunica mejor a un gestor no técnico que es material para mirar/exportar.

### B. Reordenar el bloque "Flujo del trabajo"
Nuevo orden: **Embudo · Rechazos · Tiempo de ciclo · Cuellos de botella** (el "cuánto tarda todo" antes del desglose "dónde se traba").

### C. Excluir el tiempo de ejecución de Cuellos y Tiempo de ciclo
El qualifier va en el **subtítulo** (títulos cortos por contract), no en el título.
- **Cuellos de botella** — subtítulo: "Días promedio por etapa, sin el tiempo de ejecución — la del circuito más lenta es la que frena todo." Implementación: **no dibujar la barra `en_ejecucion`** (filtrar `e !== "en_ejecucion"` en el useMemo `cuellos`).
- **Tiempo de ciclo** — subtítulo: "Días de creación a finalización sin el tiempo de obra — la eficiencia del circuito, no el tamaño del trabajo." Implementación: **restar por gestión la duración de `en_ejecucion`** al total creación→finalización (queda el tiempo administrativo del circuito).
- **Duración de `en_ejecucion` por gestión:** entrada (transición `a_etapa="en_ejecucion"`) → salida (transición `de_etapa="en_ejecucion"`), derivada 100% client-side de `metricas.eventos` (ya se traen). Gestión sin par entrada/salida (dato legacy): resta 0 (degrada con gracia; en `ciclo` sólo entran finalizadas, que siempre pasaron por ejecución). Clamp `Math.max(0, …)` por robustez.

### D. Nueva métrica de técnicos — "Cumplimiento de plazo"
Gemela de "Cumplimiento de presupuesto", mismo molde (`desvio`): barras horizontales por técnico, escala de magnitud (teal→terracota, NO el rojo de error), bloque **"Histórico · desempeño de técnicos"**, al lado de Cumplimiento de presupuesto.
- **Unidad: % de desvío** (igual que presupuesto, no días → comparabilidad entre obras de distinto tamaño, que es justo el ruido a sacar).
- **Fórmula:** `(díasReales − plazoDias) / plazoDias × 100`, promediado por técnico.
- **Lectura:** positivo = se pasó del plazo comprometido = peor (extremo cálido); ≤0 = cumplió/adelantó. Misma semántica que presupuesto → cero fricción.
- **díasReales** = duración de `en_ejecucion` (misma derivación que C). **plazoDias** = del **presupuesto aprobado** (el que se ejecutó).
- **Filtro de inclusión:** `plazoDias > 0` **y** duración de `en_ejecucion` computable **y** `tecnicoNombre` (mismas guardas que `desvio`).
- **Subtítulo:** "Cuánto se desvía la obra del plazo que el técnico comprometió — quién cumple los tiempos que promete."

### E. Campo "Plazo (días)" → "Plazo de obra (días)"
- Renombrar el label en `detalle.client.tsx` (~L490): `Plazo (días)` → **`Plazo de obra (días)`** (sentence case del contract; se conserva la unidad porque es un `type=number`).
- **Obligatoriedad: YA cumplida** — el form es `required min=1` y `enviarPresupuesto()` valida server-side ("Indicá el plazo estimado en días."). Este punto de Fausti no requiere tocar backend, solo el label.

## Cambios de service (mínimo — 1 campo)
`plazo_dias` NO viaja hoy en `FilaMetrica`. En `codigo/features/metricas/service.ts`:
- Sumar `plazo_dias` al embed `presupuestos(...)` del select.
- Sumarlo al type `G.presupuestos`.
- Exponer `plazoDias: number | null` en `FilaMetrica`, tomado del aprobado (`aprob?.plazo_dias ?? null`).
La duración de `en_ejecucion` se calcula client-side (sin cambio de service). La obligatoriedad ya existe.

## Criterios de aceptación
1. El título del panel dice "Informes".
2. En "Flujo del trabajo" el orden es Embudo · Rechazos · Tiempo de ciclo · Cuellos de botella.
3. "Cuellos de botella" no muestra la barra "En ejecución"; su subtítulo aclara "sin el tiempo de ejecución".
4. "Tiempo de ciclo" descuenta la duración de ejecución por gestión; su subtítulo aclara "sin el tiempo de obra".
5. Nueva card "Cumplimiento de plazo" en el bloque Histórico, junto a "Cumplimiento de presupuesto", con % de desvío por técnico (real de ejecución vs plazo comprometido), escala de magnitud, lectura positivo=peor.
6. El label del campo dice "Plazo de obra (días)"; sigue obligatorio (form + server, ya existente).
7. `tsc` + eslint + `next build` verdes; sin regresiones; service solo agrega `plazoDias`.

## Dev Agent Record
- **Estado:** ✅ implementado (2026-07-09). Sin commitear (Fausti revisa).
- **Archivos:**
  - `codigo/features/metricas/service.ts` — `plazo_dias` sumado al embed `presupuestos(...)`, al type `G`, y `plazoDias` en `FilaMetrica` (del aprobado).
  - `codigo/components/metricas/panel-metricas.client.tsx` — h2 "Métricas"→"Informes"; nuevo `useMemo ejecucionPorGestion` (duración de en_ejecucion entrada→salida desde eventos); `cuellos` filtra `en_ejecucion`; `ciclo` resta la ejecución por gestión (clamp ≥0); nuevo `useMemo desvioPlazo` + card "Cumplimiento de plazo"; reorden Tiempo de ciclo↔Cuellos; subtítulos "sin tiempo de ejecución/obra". Bloque Histórico reestructurado: Calificación full-width + fila de 2 con las gemelas (presupuesto · plazo) para no dejar hueco.
  - `codigo/components/gestiones/detalle.client.tsx:490` — label "Plazo (días)"→"Plazo de obra (días)".
- **Micro-decisiones tomadas (a confirmar por Fausti):** (a) label con unidad "Plazo de obra (días)" en vez de "Plazo de Obra" a secas (es input numérico); (b) STORY-921 nueva en vez de bump 920 (trazabilidad de la métrica).
- **Verificación:** `tsc --noEmit` + `eslint` + `next build` verdes. Falta pasada visual en navegador con la carga demo (validar que "Cumplimiento de plazo" pinta y que ciclo/cuellos bajan al sacar la ejecución).

## Ajustes tras revisión de Fausti (2026-07-09)
Fausti vio "Cumplimiento de plazo" como "pirámide invertida": todos los técnicos negativos (terminaron antes) y el color por magnitud absoluta pintaba de terracota a los que se adelantaban (confuso). Fixes:
- **Datos demo variados:** el seed ponía `d6 (ejecución) = plazo * [0.6,1.3]` sin sesgo por técnico → todo levemente negativo y convergido. Se agregó un **sesgo persistente por técnico** en `scripts/demo-seed.sql` (t_dos 1.35 … t_raul 0.75) + jitter por obra, para un espectro real (+35% se pasa … −25% se adelanta). Aplicado también a la **base viva** con un UPDATE de `plazo_dias` sobre las gestiones DEMO (no se tocaron los tiempos reales de ejecución, solo el plazo prometido).
- **Color con signo** (no magnitud absoluta): se pasó (pct>0) = rampa cálida ámbar→terracota según cuánto; cumplió/se adelantó (pct≤0) = teal calmo. `colorPlazo(pct)`. Adelantarse ya no se pinta como "malo".
- **Orden descendente:** el que más se pasó, arriba (era ascendente).
- **Leyenda** bajo el gráfico: "Se pasó del plazo · Cumplió o se adelantó · 0% = justo en fecha". Tooltip reescrito ("Tardó X% más" / "Terminó X% antes" / "Justo en el plazo").
- Verificación: `tsc`+eslint+`next build` verdes; spread confirmado por SQL (+31,8% tecnicodos … −23,9% Raúl Medina).

## Segunda tanda de retoques (2026-07-09, revisión de Fausti)
- **Tooltip explicativo en "Cumplimiento de presupuesto"** (mismo estilo que plazo): "Costó X% más/menos que lo presupuestado" / "Costó lo presupuestado".
- **Período en curso ya no se dibuja en las series temporales** (Tiempo de ciclo + Ingresos/Gestiones cobradas). El último cubo es siempre parcial → la línea se desplomaba en falso al final. Ya se excluía de la *tendencia*; ahora también de la *línea*. Nuevo helper `ventanaUtil(cubos, acum)`: recorta el cubo en curso (último) **y** los cubos vacíos del arranque (los ceros de antes del primer dato hundían la tendencia de "Gestiones cobradas" y la hacían arrancar negativa). Aplicado en los memos `ciclo` y `dinero`.
- **Tooltip de las tiles del Inicio** (`inicio-rol.tsx`): el `title` nativo (delay ~1s, poco fiable) → tooltip CSS propia on-brand (inmediata, `group/tip` + `group-hover/tip:block`) en el ⓘ. Afecta a "Urgentes sin asignar" y cualquier tile con `hint`.
- Verificación: `tsc`+eslint+`next build` verdes.
