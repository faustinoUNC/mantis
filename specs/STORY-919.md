# STORY-919 — Retoques del dashboard de métricas (post carga demo) (v1.2)

> **Cambios v1.2 (2026-07-21):** las series temporales ("Tiempo de ciclo" e "Ingresos cobrados") vuelven a **mostrar el período en curso** — pedido de Fausti al ver que Walter (STORY-1026) muestra julio y el panel cortaba en junio. `ventanaUtil` ya no descarta el último cubo: lo marca `enCurso` y se dibuja (barra atenuada en Ingresos; "(en curso)" en el tooltip — el eje lo omite para no clipear), pero la **tendencia y el umbral de "pocos datos" siguen contando solo períodos completos** (la corrección anti-sesgo de la v1.0 sigue vigente: la línea punteada termina en el último período completo).

> **Cambios v1.1 (2026-07-13):** la card **"Rechazos por tipo" se ELIMINÓ** del dashboard por decisión de Fausti — "no es valiosa para el negocio". Con ella se fue su código de soporte: memo `rechazos`/`totalRechazos` del panel, la constante `ROJO`, el campo `EventoMetrica.tipo` y el fetch de eventos `asignacion_rechazada` (el service vuelve a traer solo `transicion`). No re-proponer esta métrica (queda también en Descartados de `tasks/PENDIENTES.md`).

**Estado:** 🚧 en desarrollo (aprobado en party mode 2026-07-08) · **Origen:** Fausti, tras ver el tablero con la carga demo de STORY-918. Discusión y decisiones en `_bmad-output/party-mode/` (Mary/John/Winston/Sally).

## Objetivo

Corregir bugs y mejorar la claridad del dashboard de métricas (`codigo/components/metricas/panel-metricas.client.tsx` + `codigo/features/metricas/service.ts`) que la carga demo dejó a la vista. Regla #0: la solución más simple que cumpla. Contract "Esmeralda técnica" respetado.

## Alcance y decisiones (8 puntos)

### A. Bugs de código

1. **Rechazos por tipo — "Asignación" siempre 0 (BUG).** El código cuenta `f.asignacionAceptada === false`, pero el flujo real (`responder_asignacion` en Postgres) al rechazar setea `asignacion_aceptada = NULL` y `tecnico_id = NULL` — nunca queda en `false`. El rechazo solo existe como evento `asignacion_rechazada`.
   - **Fix:** el service (`obtenerMetricas`) debe contar los eventos `asignacion_rechazada`. Agregar al tipo `Metricas` un contador (o incluir esos eventos en el fetch existente y contarlos client-side, respetando el scope RLS del rol). El desglose sigue sin mezclar los 3 tipos (presupuesto/conformidad/asignación).

2. **"Calificación de técnicos" muestra 0 (REPRODUCIR primero).** Hay 24 calificaciones bien linkeadas; RLS deja leer a admin/administrativo; el ranking *debería* pintar. Sospecha: página cacheada (Server Component servido antes del seed por SQL directo, sin `revalidatePath`). 
   - **Acción:** reproducir en vivo con navegador y hard-reload antes de tocar código. Si persiste, cazar el bug. De paso, revisar que el estado vacío correcto aplique (hay dos textos distintos: genérico vs "no hay calificaciones").

### B. Claridad (sin cambio de datos)

3. **Embudo de gestiones — labels de etapa no se ven.** El `FunnelChart` de recharts recorta los labels a la derecha y con 9 etapas se hace fideo.
   - **Decisión (sala):** reemplazar el Funnel por **barras horizontales** — una barra por etapa, la etapa en el eje izquierdo (recharts no lo recorta), el número adentro. Mismo dato de conversión, se lee de un saque, sin el componente caprichoso.

4. **Reincidencia (90 días) — N engañoso + falta scroll.**
   - El `N` de la tarjeta usa `filas.length` (universo, 87). Debe ser **la cantidad de reincidencias** (`reincidencia.total`, ej. 13).
   - La lista está capada con `slice(0,5)`. **Mostrar todas** dentro de un contenedor con `max-height` + `overflow-y-auto`. Mismo patrón para **"Cobranza por antigüedad"** (misma limitación latente).
   - Nota: los "a los 0 días" repetidos son data real vieja de Fausti, no bug de la métrica.

### C. Producto / UX

5. **Combinar "Ingresos cobrados" (#1) + "Volumen de ingreso" (#5) en UNA tarjeta.** (Fausti eligió combo real.)
   - **Combo honesto:** un solo gráfico (recharts `ComposedChart`) sobre **una única línea de tiempo = fecha de cobro**. Barras apiladas de $ (trabajo del técnico + fee) en el eje izquierdo; **línea = cantidad de gestiones cobradas ese cubo** en el eje derecho. La relación barra/línea es el ticket promedio (responde "¿facturé más por más trabajo o por ticket más alto?").
   - La línea es un tono neutro oscuro (no un cuarto acento). **Ambos ejes rotulados** con todas las letras. Se elimina la tarjeta separada de "Volumen de gestiones nuevas por creación".

9. **Granularidad temporal atada al selector de período (semanal/mensual).** (Fausti: el gráfico de ingresos debería permitir ver por semana, no solo por mes.)
   - **Sin control nuevo.** La granularidad se **deriva del selector de período que ya existe** arriba (Todo / 12 meses / 90 días / 30 días): **30 y 90 días → cubos semanales; 12 meses y Todo → cubos mensuales.** El usuario nunca elige "semana/mes"; elige cuánto tiempo mira y el gráfico elige los cubos legibles.
   - Se **elimina el hardcodeo "últimos 6 meses"** de la tarjeta de finanzas (hoy ignora el selector) → pasa a respetar el período como el resto. Es sacar una excepción, no agregar complejidad. El título deja de decir "6 meses" fijo.

10. **Línea de tendencia (simple, con humildad).** (Fausti: aporta valor para decidir, pero sin complejizar/que sea ilegible.)
    - Solo sobre **series temporales**: la de **$ del combo de ingresos**. NO en el resto (embudo, ranking, donuts, listas: no tienen eje temporal → sería adorno).
    - **Una sola recta punteada en tono neutro** (no un cuarto acento), rótulo "tendencia", regresión lineal simple (mínimos cuadrados) client-side.
    - **Puerta de humildad:** aparece solo con **≥6 cubos** de datos (semanas o meses). Con pocos puntos no se dibuja (evita "trazar una recta sobre ruido"). Así sirve en vista semanal sin esperar un año.
11. **NUEVA métrica — "Tiempo de ciclo".** (Fausti: la implementamos en esta vuelta.)
    - Serie temporal: **días promedio de creación → finalización**, por cubo (mes/semana según el período, como #9), sobre las gestiones **finalizadas en ese cubo**. Con **línea de tendencia** (#10, ≥6 cubos).
    - Responde: "¿el equipo resuelve cada vez más rápido o más lento?" — salud operativa a lo largo del tiempo.
    - **Convive con "Cuellos de botella"** (no lo reemplaza): Cuellos dice *dónde* se traba (promedio por etapa, foto de hoy); Tiempo de ciclo dice *si mejora* (total, en el tiempo). Preguntas distintas, complementarias.
    - Sin migración: usa los eventos de transición (`creada` → transición a `finalizado`) que el service ya trae.

### E. Copy — subtítulo de cada tarjeta

Cada tarjeta lleva un subtítulo de **una línea**: *qué se mide + qué se aprende mirándola*. Super breve, sin extenderse. Reemplaza el `ayuda` actual de cada `MetricCard`.

| Tarjeta | Subtítulo |
|---|---|
| Gestiones estancadas | Las activas que más días llevan sin moverse — qué destrabar primero. |
| Cobranza por antigüedad | Facturas esperando cobro y hace cuánto — cuáles reclamar antes de que envejezcan. |
| Ingresos cobrados | Lo cobrado por período, separando la ganancia de la casa del pago al técnico — si crece o cae. |
| Embudo de gestiones | Cuántas gestiones alcanzaron cada etapa — dónde se caen antes de terminar. |
| Calificación de técnicos | Promedio de estrellas por técnico — quién resuelve mejor a ojos del gestor. |
| Reincidencia (90 días) | Problemas que volvieron a la misma propiedad y rubro en 90 días — posible retrabajo. |
| Cuellos de botella | Días promedio en cada etapa — la más lenta es la que frena todo. |
| Tiempo de ciclo | Días de creación a finalización por período — si el equipo resuelve más rápido o más lento. |
| Composición del trabajo | Por qué entra el trabajo y quién lo paga — con qué tipo de gestión se llena la agenda. |
| Rechazos por tipo | Rechazos de presupuesto, conformidad y asignación (nunca mezclados) — dónde se traba el circuito. |
| Cumplimiento de presupuesto | Cuánto se desvía el costo final de lo presupuestado, por técnico — quién cotiza fino y quién se pasa. |

6. **Cobertura por especialidad — QUITAR.** (Fausti eligió quitarla.) Comparaba peras con bananas (gestiones activas [conteo] vs horas/semana) en el mismo eje. Se elimina la tarjeta #8 y su cálculo `cobertura` en el service (`CoberturaEsp`, franjas/tecEsp). 
   - Anotado para el futuro: si hace falta, reflotar el gap como **alerta** ("especialidades con demanda activa y sin técnicos que la cubran", ej. Control de plagas: 2 activas / 0 técnicos) — NO como gráfico.

7. **Gradiente de magnitud en "Cuellos de botella" (#4) y "Cumplimiento de presupuesto" (#9).** (Fausti pidió verde→rojo por empeoramiento.)
   - **Distinción del contract:** un *accent* (ámbar/rojo) marca estados discretos; una *escala secuencial* representa una magnitud continua. Se agrega al design contract una **escala de magnitud** propia (verde-azulado calmo → terracota/naranja quemado) que **NO reusa el rojo de error `#dc2626`**.
   - Aplicar SOLO donde hay magnitud ordenable: días en cuello y % de desvío. El color se interpola por valor normalizado (el peor = extremo cálido). No aplicar a categorías.

### D. Datos (STORY-918, no toca código)

8. **Fee de la inmobiliaria muy bajo + rango de fechas corto.** Dos tweaks del seed (`scripts/demo-seed.sql`, ya editados a **v2**, pendientes de re-sembrar):
   - Fee `cargo` de 6–12% → **15–22% del presupuesto** (antes daba ~8,5% de la obra).
   - `ts_alta` de mar-2026 → **sep-2025**, y spread de finalizadas/canceladas a ~240 días, para que la demo abarque **~10 meses** y las series temporales + tendencia se vean bien (hoy solo 3-4 meses). Se clampea `t0 ≥ ts_alta` para que ninguna gestión preceda a la cartera.
   - **Un solo re-seed** aplica ambos, y conviene hacerlo junto con la implementación de esta story (para ver granularidad + tendencia con datos reales). La base VIVA sigue en **v1** (fee 8,5%, abr-jul) hasta el re-seed.

## Prioridad
1. **Bugs (A):** #1 rechazos (fix de service), #2 calificación (reproducir → fix si aplica).
2. **Claridad (B):** #4 reincidencia N+scroll, #3 embudo a barras.
3. **Producto (C):** #6 quitar cobertura (rápido), #5 combo ingresos, #9 granularidad por período, #10 tendencia, #11 métrica Tiempo de ciclo, #7 gradiente de magnitud (+ contract).
4. **Copy (E):** subtítulos de todas las tarjetas.
5. **Datos (D):** #8 re-seed v2 (fee + rango ~10 meses) — habilita ver #9/#10/#11 con datos.

## Criterios de aceptación
1. "Rechazos por tipo" muestra los rechazos de asignación reales (eventos `asignacion_rechazada`).
2. "Calificación de técnicos" pinta el ranking cuando hay calificaciones (verificado en vivo).
3. Embudo legible: etapa visible en cada barra.
4. Reincidencia: N = cantidad de reincidencias; la lista completa es scrolleable (idem Cobranza).
5. Una sola tarjeta de ingresos con barras $ + línea de cantidad cobrada, ejes rotulados, misma base temporal (cobro).
6. Sin tarjeta de Cobertura.
7. Cuellos y Cumplimiento con escala de magnitud (rampa propia, no el rojo de error), documentada en el contract.
8. Los gráficos temporales (ingresos) cambian de cubo mensual↔semanal según el período elegido, sin control extra; se fue el hardcodeo de "6 meses".
9. Tendencia (recta punteada neutra) sobre los $ del combo, visible solo con ≥6 cubos.
10. Nueva tarjeta "Tiempo de ciclo" (días creación→finalización por cubo, con tendencia), conviviendo con Cuellos.
11. Cada tarjeta con su subtítulo de una línea (tabla de la sección E).
12. Fee demo realista (~15–22%) y demo abarcando ~10 meses tras el re-seed v2.
13. `tsc` + eslint verdes; contract actualizado; sin regresiones en las demás métricas.

## Dev Agent Record
- **Estado:** ✅ implementado y verificado en local (2026-07-08). Sin commitear (Fausti revisa).
- **Archivos:**
  - `codigo/features/metricas/service.ts` — rechazos de asignación por evento (`EventoMetrica.tipo` + fetch `asignacion_rechazada`); quitada la cobertura (`CoberturaEsp`, franjas, tecEsp, `horasEntre`); **fix bug calificación** (ver abajo).
  - `codigo/components/metricas/panel-metricas.client.tsx` — reescrito: 5 bloques con encabezado (`Bloque`), embudo→barras horizontales, reincidencia con N=reincidencias + scroll (idem estancadas/cobranza), combo `ComposedChart` de ingresos (barras $ técnico+fee + línea cantidad cobrada + tendencia, doble eje rotulado), rechazos asignación por evento, cobertura eliminada, escala de magnitud (`rampaMagnitud`) en Cuellos y Cumplimiento, nueva métrica **Tiempo de ciclo**, granularidad semana/mes derivada del período, tendencia por regresión (≥6 cubos), subtítulos nuevos.
  - `codigo/features/gestiones/service.ts` — mismo fix de calificación en el detalle.
  - `_bmad-output/.../DESIGN.md` — sección "Escala de magnitud".
  - `scripts/demo-seed.sql` — v2 (fee 15–22%, rango ~10 meses); `scripts/demo-borrar.sh` — fix del `+`→espacio en las queries REST (la cartera demo no se borraba).
- **Bug de calificación (raíz):** `calificaciones.gestion_id` es UNIQUE → PostgREST resuelve el embed `calificaciones(estrellas)` como to-ONE (objeto), no array. El código hacía `.[0]` (asumía array) → `estrellas` siempre null → ranking vacío ("0 gestiones"). Latente desde STORY-914; la demo con 24 calificaciones lo destapó. Fix: contemplar objeto o array. (No era RLS: verificado que admin lee las 24.)
- **Verificación:** `tsc` + eslint + `next build` verdes. Re-seed v2 aplicado (80 gestiones, 7 meses de cobros dic-25→jul-26, fee 17,1%, 4 rechazos de asignación, 0 eventos futuros) + 86 fotos. Revisado en navegador como admin: los 5 bloques ordenados, embudo legible, rechazos con Asignación, gradientes, tiempo de ciclo con tendencia, combo de ingresos, **calificación poblada** (7 técnicos), reincidencia N=21, sin cobertura. Reversión `demo-borrar.sh` probada end-to-end.
- **Nota:** hay un warning de React key preexistente en `SidebarStaff` (ajeno a métricas) — no se toca en esta story.

## Segunda tanda de ajustes (2026-07-08, tras revisión de Fausti)

- **Gestiones estancadas:** solo las paradas **≥1 día** en su etapa (las de 0 días no son "estancadas"); orden por días desc; **gradiente de magnitud** en el número de días; layout dirección (principal) + "etapa · descripción" (secundario).
- **Tarjetas del tablero** (`components/gestiones/tablero.client.tsx`): ahora lideran con la **dirección** y la descripción va debajo (antes al revés).
- **"Cobranza por antigüedad" → "Pendientes de cobro"** (renombrada).
- **Embudo:** subtítulo sin "dónde se caen".
- **Rechazos por tipo:** subtítulo reescrito (explica cada instancia).
- **Calificación de técnicos:** ya no es top; muestra **todos** los técnicos con obra o nota + **obras finalizadas** junto a las estrellas + scroll vertical.
- **Reincidencia:** ELIMINADA (poco clara / poco útil por ahora).
- **Ingresos:** el combo se **separó en dos tarjetas** — "Ingresos cobrados" ($ técnico+fee + tendencia) y "Gestiones cobradas" (cantidad + tendencia). Menos denso.
- **Tendencias con diagnóstico:** leyenda que interpreta la recta (↑/↓ + % + si es bueno o malo, en verde/terracota). En "Tiempo de ciclo", "Ingresos" y "Gestiones cobradas".
- **DESAJUSTE del período en curso (auditoría):** el último cubo temporal es siempre parcial (mes/semana en curso) y sesgaba la tendencia — en "Tiempo de ciclo" incluso la **invertía** (mostraba "más rápido -38%" cuando en realidad venía "más lento +12%"). Fix: la regresión de tendencia **excluye el cubo en curso** (la línea termina en el último período completo).
- **Inicio — tiles:** "Urgentes +24h sin técnico" (contaba mal: 24h desde la creación) → **"Urgentes sin técnico"** (urgente + activa + sin técnico; para algo urgente, estar sin asignar YA es la alerta). Campo `urgentesDemoradas` → `urgentesSinTecnico`.
- **Inicio — cards financieras:** se quitaron "Por cobrar" y "Por liquidar a técnicos" (importe) de `/admin`, `/gestion`, `/administracion`. Reemplazadas por una métrica nueva **"Dinero pendiente"** en el bloque Dinero: *Por cobrar* con desglose honesto **trabajo (a técnicos) + fee (casa)** (NO materiales/mano de obra: `costo_final` es un solo número, ese detalle solo vive en el presupuesto y puede diferir), y *Por liquidar a técnicos*. En `/administracion` quedan dos contadores accionables (gestiones por cobrar / por liquidar).
- **Verificación 2ª tanda:** `tsc` + eslint + `next build` verdes; revisado en navegador (admin): tiles corregidas (urgentes=4), "Dinero pendiente" con su barra apilada, tendencias con diagnóstico y sin el sesgo del período en curso.
- **Auditoría de otras métricas (pedido de Fausti):** revisadas todas — Cuellos (valores correctos vs duraciones sembradas), Embudo, Rechazos, Cumplimiento, Composición, Estancadas, Pendientes de cobro: OK. Único punto menor no-bug: en Composición el donut de "pagador" suma menos que el N porque el pagador recién se define al aprobar el presupuesto (esperado).

## Tercera tanda (2026-07-08, tras revisión + investigación con agentes + 2ª party)

Se lanzaron 2 agentes de investigación (selector rango/granularidad; etiquetado de tendencias) y se sintetizó en party mode. Decisiones e implementación:

- **Tile "Urgentes sin técnico" → "Urgentes sin asignar":** ahora cuenta urgentes en **Ingresado + Asignación** (todavía sin arrancar), no "sin técnico" (que confundía con la etapa). Campo `urgentesSinAsignar`. Se agregó **hover** (ⓘ + `title`) explicando la definición — nuevo campo `hint` en `TileInicio`.
- **Selector de período → presets con nombre de granularidad y bucket FIJO** (estilo iOS, recomendación del agente): **Mes (30d, semanal) · Trimestre (90d, semanal) · Año (12m, mensual) · Todo (mensual)**, default **Año**. El bucket ya no se auto-deriva de forma sorpresiva; cada preset tiene cantidad de barras sana. Se eliminó `granularidad()`.
- **"Charts se rompían" al cambiar de período — dos causas y sus fixes:** (a) buckets con conteos malos en los bordes → resuelto con los presets de bucket fijo; (b) datos ralos → **estado "pocos datos"** cuando una serie tiene < 3 cubos con dato (en vez de un gráfico de 2 barras que miente), y la **tendencia solo se dibuja con ≥ 6 cubos completos**. Además se **densificó la demo** (STORY-918): +50 finalizadas distribuidas dic-2025→jul-2026, tapando el bache de junio (cobros/mes: 6/9/4/8/8/11/**20**/4). Total demo 130 gestiones.
- **Leyenda de tendencia → TASA absoluta con ventana** (recomendación del agente: un "%" sobre una pendiente de regresión no tiene base). Ahora dice p.ej. **"↑ +0,7 días por mes en cerrar (tendencia · 7 meses)"**, **"↑ +$ 843.290 por mes (tendencia · 12 meses)"**, **"↑ +1,5 gestiones por mes (tendencia · 12 meses)"**. Resuelve el "+12% ¿respecto a qué?". `diagnostico()` (%) → `capTendencia()` (tasa); `tendencia()` ahora devuelve `{ yhat, m }` (pendiente).
- **Verificación 3ª tanda:** `tsc` + eslint verdes; revisado en navegador en Año y Mes — junio lleno, ninguna serie rota, tendencias con baseline claro, tile con hover.
- **Alcance del período — rótulo por tarjeta + sectorización (elegido por Fausti):** el selector queda global arriba; las tarjetas que NO lo siguen llevan un rótulo chico junto al título: **"ahora"** o **"histórico"**. `MetricCard` tiene prop `alcance?: "ahora" | "historico"` con tooltip.
  - Además Fausti pidió **sectorizar** para que queden juntas las que dependen del filtro y separadas las de "ahora"/histórico. Layout final por alcance:
    - **Para resolver hoy** (ahora): Gestiones estancadas · Pendientes de cobro · Dinero pendiente (se movió acá desde el bloque Dinero).
    - **Del período** (siguen el filtro, contiguas): Flujo del trabajo (Embudo · Rechazos · Cuellos · Tiempo de ciclo) · Dinero (Ingresos cobrados · Gestiones cobradas) · Perfil del trabajo (Composición).
    - **Histórico · desempeño de técnicos** (acumulado, al final): Calificación · Cumplimiento.
- **Toggle de series en "Ingresos cobrados":** la leyenda es clickeable — se puede ocultar "Trabajo del técnico" o "Ganancia inmobiliaria (fee)" para aislar una serie (recharts `hide` en cada `<Bar>`). **La tendencia se calcula por serie y se muestra SOLO al aislar una** (la de esa serie); con ambas visibles no hay línea (una tendencia del total apilado es ambigua) y aparece el hint "Tocá una serie… para ver su tendencia".
- **Caja "En el período" (sectorización con el filtro en la cabecera — pedido de Fausti):** el selector de período dejó el header global y pasó a ser la **cabecera de una caja con borde** que envuelve exactamente las métricas que dependen del filtro (Flujo del trabajo · Dinero · Perfil del trabajo). Así el alcance del filtro es visual: gobierna solo lo de adentro. La **especialidad** sigue en el header global (filtra TODO). "Para resolver hoy" (ahora) queda arriba de la caja y "Histórico · desempeño de técnicos" debajo, ambos fuera del alcance del período.
