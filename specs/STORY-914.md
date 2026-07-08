# STORY-914 — Dashboard de métricas de valor: 8 gráficos, tiempo real y filtros (v1.1)

> **v1.1 (2026-07-08, revisión pre-commit):** 3 fixes de base detectados en revisión: (1) el trigger `proteger_gestiones_update` no whitelisteaba `cobrado_monto`/`cobrado_fee` → `registrarCobro` fallaba con `sin_permiso` para el gestor administrativo (migración `fix_proteger_cobro_snapshot`); (2) las RLS de `tecnicos`/`franjas_disponibilidad`/`tecnico_especialidades` no incluían al gestor administrativo → su dashboard mostraba ranking/desvío vacíos y cobertura con capacidad 0 en silencio (migración `administrativo_lee_recursos_metricas`); (3) la policy de insert de `calificaciones` no ataba `tecnico_id`/etapa/autor — se endurece para que la base no confíe en la app (migración `endurecer_calificaciones_insert`). Además el gráfico #5 rellena con 0 los meses sin gestiones (la línea no salta huecos).

**Estado:** 🚧 en desarrollo · **Fecha:** 2026-07-08
**Origen:** Fausti — "las métricas que tenemos ahora no sirven, son horribles, no son intuitivas ni están bien seleccionados los gráficos". Pide métricas que aporten valor real de negocio, **a golpe de vista**, con una librería de gráficos especializada (recharts, ya instalada). Quiere ~8 métricas **graficadas** (no cards peladas), **dinámicas y en tiempo real**, y **filtrables** según lo que miden. Varias requieren construir la feature antes de poder medirlas (calificación, cancelación).
**Panel BMAD (party mode):** Mary (analista), John (PM), Winston (arquitecto), Sally (UX/dataviz).

## Objetivo

Reemplazar el bloque "Rendimiento" actual (primera respuesta, resolución mediana, por etapa, por especialidad — poco accionables) por un **dashboard de 8 métricas graficadas de valor de negocio**, cada una con la forma visual correcta, con filtros propios y actualización en tiempo real donde corresponde. Se corrige de raíz el bug de inmutabilidad de las métricas mensuales.

> **Ubicación (respeta STORY-912):** el dashboard vive en el **Inicio** de cada rol (sección "Rendimiento", vía `PanelMetricas`). `/metricas` sigue redirigiendo. Como el módulo crece bastante, si en revisión resulta pesado dentro del Inicio se evaluará devolverle una página propia — pero el default es respetar la consolidación de STORY-912.

## Contrato del módulo de métricas (5 reglas transversales — no negociables)

1. **Desktop-first, responsive** — el dashboard lo ven admin/gestores, **no el técnico**, así que **no es mobile-first**. Se optimiza para pantalla grande (grilla de tarjetas, 2–3 gráficos por fila) y solo se garantiza que no se rompa en tablet.
2. **Denominador siempre visible** — ningún porcentaje sin su "sobre cuántos". Cada gráfico muestra el N de su muestra.
3. **Muestra chica = gráfico humilde** — por debajo de un umbral (N < 5), el gráfico se atenúa y muestra "muestra chica, tomar con pinzas". No se oculta el dato, se lo vuelve humilde.
4. **Hechos congelados — el pasado no se recalcula nunca** (mata el bug de oro). Los montos y estados se snapshotean en el momento del hecho (cobro, calificación, cancelación); las métricas históricas suman hechos congelados, no recalculan sobre el valor actual.
5. **Viva o cerrada** — cada métrica declara si "respira" (presente → Realtime sobre `gestiones`/`eventos_gestion`, refresco quirúrgico de solo la métrica afectada) o es "de piedra" (histórico → sin suscripción, no cambia). Filtros: solo los que le cambian el sentido a esa métrica, **client-side**, arrastrando su denominador.

## Las 8 métricas

| # | Métrica (pregunta de negocio) | Gráfico | Viva/Cerrada | Filtros | Construir |
|---|---|---|---|---|---|
| 1 | **Ingresos + fee, últimos 6 meses** — ¿gano y hacia dónde voy? | Barras mensuales apiladas (ingreso técnico + fee) | Cerrada (histórico) | rango de meses | `cobrado_monto`/`cobrado_fee` snapshot (fix bug de oro) |
| 2 | **Funnel + cancelación** — ¿dónde se me caen? | Funnel chart | Viva | especialidad, rango de fechas | estado `cancelada` + motivo en `avanzar_etapa()` |
| 3 | **Ranking de técnicos** ⭐ — ¿mi equipo es bueno? | Barras horizontales rankeadas + estrella | Viva | especialidad | tabla `calificaciones` + captura al cerrar |
| 4 | **Cuellos de botella** — ¿dónde se traba? | Barras horizontales, peor etapa en ámbar | Viva | especialidad | nada (sale de `eventos_gestion`) |
| 5 | **Volumen de ingreso** — ¿entra más o menos laburo? | Línea temporal (gestiones creadas por semana/mes) | Cerrada + tramo vivo | especialidad, rango | nada (`creado_en`) |
| 6 | **Composición: causa × pagador** — ¿qué trabajo hago y quién paga? | 2 donuts chicos (causa / pagador) | Viva | rango de fechas | nada (enums `causa`, `pagador`) |
| 7 | **Rechazos desglosados** — ¿cuánto rechazo y de qué tipo? | Barras agrupadas: presupuesto / conformidad / asignación | Viva | rango de fechas | nada (dato ya existe, 3 fuentes distintas) |
| 8 | **Cobertura por especialidad** — ¿tengo con quién cubrir lo que entra? | Barras divergentes: demanda vs. capacidad | Viva | — | cruzar `franjas_disponibilidad` × demanda (la más analítica) |

**Nota de Mary (rechazos, #7):** son **tres rechazos distintos y jamás se mezclan en un número**: presupuesto rechazado (`presupuestos.estado='rechazado'` → problema comercial/precio), conformidad rechazada (`conformidades.estado='rechazada'` → problema de calidad del técnico), asignación rechazada (`gestiones.asignacion_aceptada=false` → problema de capacidad/match). Cada barra su color dentro de la paleta del contract.

**Nota de John (#8):** es la más cara y la que más miente con muestra chica. Si en implementación se complica, es la única candidata a diferirse a una story posterior sin romper el valor del resto.

## Prerequisitos a construir (3 desarrollos)

### A. Calificación del técnico (⭐) — feature nueva
- **Migración:** tabla `calificaciones` (`id`, `gestion_id` **unique** → una por gestión, `tecnico_id`, `autor_id` → gestor que sigue, `estrellas` int `CHECK 1..5`, `comentario` text null, `creado_en`). RLS: insert por admin/gestor con scope de ownership; select scopeado como el resto. **Sin UPDATE ni DELETE por rol** — la calificación es un hecho histórico inmutable (regla #4).
- **Captura (UX, Sally):** al llegar la gestión a **Finalizado**, la pantalla del gestor que la sigue muestra un paso de cierre con **5 estrellas grandes y tocables** + comentario opcional: "¿Cómo estuvo el técnico?". Casi obligatorio: si se esconde en un menú, la métrica nace muerta. Server action `calificarTecnico()`.
- **Quién califica:** el `gestor_id` dueño de la gestión (definición cerrada para no sesgar el promedio por huecos — regla del denominador).

### B. Inmutabilidad de finanzas (fix bug de oro) — migración chica
- **Migración:** agregar `gestiones.cobrado_monto numeric` y `gestiones.cobrado_fee numeric` (snapshots). Al marcar el cobro (cuando se setea `cobrado_en`), la server action guarda el **valor de ese momento** (`costo_final + cargo_admin` y `cargo_admin` respectivamente). Backfill de las ya cobradas con su valor actual.
- **Métricas históricas** (#1, tramo cerrado de #5) leen de `cobrado_monto`/`cobrado_fee`, **nunca recalculan sobre `costo_final`**. Si luego se corrige `costo_final`, el histórico no se mueve.

### C. Estado terminal `cancelada` — migración + funnel
- **Migración:** agregar valor `cancelada` al enum `etapa_gestion`. La transición pasa **solo por `avanzar_etapa()`** con **motivo obligatorio** (validado, guardado en `eventos_gestion.detalle`). Sin motivo → error (data basura prohibida).
- Habilita medir cancelación real (#2): hoy una gestión muerta queda colgada en su etapa y es indistinguible de una lenta.

## Alcance (código)

### `features/metricas/service.ts` (reescritura del cómputo)
- Nueva forma `Metricas` con las 8 series. Cada serie declara `tipo: "viva" | "cerrada"` y su `n` (denominador).
- Históricas (#1, tramo cerrado #5) suman `cobrado_monto`/`cobrado_fee` (hechos congelados). Vivas se computan sobre el estado actual scopeado por RLS.
- **Se elimina** el cálculo actual de "primera respuesta / resolución mediana / por etapa / resolución por especialidad" (se los comen el funnel #2 y los cuellos #4, mejor contados).

### `components/metricas/panel-metricas.client.tsx` (reescritura de UI)
- Grilla desktop de tarjetas (2–3 por fila), barra de filtros propia por tarjeta. Filtrado **client-side** (patrón STORY-910): el service trae el set completo una vez, filtrar recorta en memoria.
- Gráficos recharts según la tabla: `FunnelChart` (#2), `BarChart` horizontal (#3, #4), `LineChart` (#5), `PieChart`/donut ×2 (#6), `BarChart` agrupado (#7), barras divergentes (#8), `BarChart` apilado (#1).
- Colores del design contract (esmeralda = marca/acción, ámbar = atención/peor, rojo = error/rechazo). Sin leyendas innecesarias, grid recesivo, tooltips propios (reusar `TooltipCaja`).
- **Realtime:** suscripción a `gestiones`/`eventos_gestion` (reusar canal de notificaciones); el payload indica qué cambió y refresca **solo** las métricas vivas afectadas, no las 8.
- **Humildad de muestra:** helper que atenúa la tarjeta y muestra el aviso cuando `n < 5`.

### Nuevos componentes UI
- Paso de calificación al cierre (estrellas) en el detalle de la gestión Finalizada, para el gestor dueño.
- Selector de motivo al cancelar una gestión (dispara `avanzar_etapa(..., 'cancelada', motivo)`).

### Migraciones (Supabase)
- `crear_tabla_calificaciones` (tabla + RLS + índice por `tecnico_id`).
- `snapshot_cobrado_monto` (columnas + backfill + set en la action de cobro).
- `etapa_cancelada` (enum + validación de motivo en `avanzar_etapa`).

### `features/gestiones/service.ts` (o donde viva el cobro/transición)
- `calificarTecnico(gestionId, estrellas, comentario)` (server action).
- Cobro: snapshotea `cobrado_monto`/`cobrado_fee`.
- Cancelación: `avanzar_etapa` a `cancelada` con motivo.

## Criterios de aceptación
1. El dashboard muestra las 8 métricas, cada una con el gráfico de la tabla, en grilla desktop responsive (no se rompe en tablet).
2. Cada gráfico muestra su denominador (N). Con `n < 5` la tarjeta se atenúa y avisa "muestra chica".
3. Las métricas vivas se actualizan en tiempo real ante un cambio de etapa (verificable moviendo una gestión y viendo el funnel/cuellos refrescar sin recargar), y el refresco es quirúrgico (solo la métrica afectada).
4. Los filtros por tarjeta funcionan client-side e instantáneos, y el denominador se recalcula al filtrar.
5. **Inmutabilidad:** corregir `costo_final` de una gestión cobrada en un mes ya cerrado **no cambia** el gráfico de ingresos de ese mes (lee `cobrado_monto` congelado).
6. Calificación: al finalizar una gestión, el gestor dueño puede poner estrellas (1–5) + comentario; una por gestión; aparece en el ranking #3. No se puede editar una calificación ya puesta.
7. Cancelación: una gestión puede pasar a `cancelada` solo vía `avanzar_etapa()` con motivo obligatorio, y cae en el funnel #2.
8. `npx tsc --noEmit` verde y sin errores de eslint en los archivos tocados; RLS en la tabla nueva desde su primera migración.

## Fuera de alcance
- Métricas por técnico visibles para el propio técnico (este dashboard es de gestión, no del técnico).
- Umbrales/alertas configurables sobre métricas (ej. "cuello > 5 días = alerta") — se evalúa después si aporta.
- Exportación/PDF del dashboard.
- Métrica #8 (cobertura) puede diferirse a una story posterior si complica la entrega (decisión de John).

## Dev Agent Record
- **Commit:** _(pendiente — Fausti revisa en local antes de commitear)_
- **Migraciones aplicadas** (proyecto `ejwokycbyjtlxwusbhtt`): `etapa_cancelada_enum`, `avanzar_etapa_cancelacion` (transición a `cancelada` + motivo obligatorio), `crear_tabla_calificaciones` (RLS, sin update/delete = inmutable), `snapshot_cobrado_monto` (columnas `cobrado_monto`/`cobrado_fee` + backfill de las 3 ya cobradas), `realtime_calificaciones` (publicación). **v1.1:** `fix_proteger_cobro_snapshot` (whitelist del trigger suma los 2 snapshots — verificado empíricamente con transacción simulando al administrativo), `administrativo_lee_recursos_metricas` (select de tecnicos/franjas/tecnico_esp para el administrativo; policies renombradas `staff_lee_*`), `endurecer_calificaciones_insert` (autor = auth.uid, técnico = el de la gestión, etapa finalizada — verificado: rechaza técnico ajeno, acepta caso legítimo).
- **Archivos:**
  - `features/metricas/service.ts` — reescrito: entrega datos granulares (filas + eventos + cobertura + especialidades); mantiene tiles accionables; elimina el cómputo viejo de medianas/por-etapa.
  - `components/metricas/panel-metricas.client.tsx` — reescrito: 8 gráficos recharts (barras apiladas, funnel, ranking ⭐, barras horiz. con peor en ámbar, línea, 2 donuts, barras agrupadas rojas, barras demanda/capacidad) + barra de filtros (especialidad + período) client-side + N por tarjeta + humildad con muestra chica + `RefrescoVivo` de `calificaciones`.
  - `features/finanzas/service.ts` — `registrarCobro` congela `cobrado_monto`/`cobrado_fee`.
  - `features/gestiones/service.ts` — `cancelarGestion()` y `calificarTecnico()`; detalle trae la calificación.
  - `features/gestiones/types.ts` — `Etapa` suma `cancelada`; `GestionDetalle.calificacion`.
  - `components/gestiones/detalle.client.tsx` — estrellas al finalizar (gestor owner), cancelar con motivo, badge/stepper/timeline manejan `cancelada`.
  - `components/gestiones/mis-trabajos.client.tsx` — `cancelada` como historial del técnico.
- **Verificación:** `npx tsc --noEmit` verde · eslint verde en los tocados · `npx next build` OK (23 rutas). Backfill: las 3 gestiones cobradas quedaron con snapshot. Pendiente: verificación en navegador de Fausti (cargar una calificación y cancelar una gestión para poblar ranking y funnel).
