# STORY-1004 — Embudo de gestión en tiempo real: dónde está el cuello de botella HOY (v1.1)

**Estado:** ✅ done · **Origen:** reunión con Andres Garcia (Fathom 2026-07-18) — Fausti sobre el "Embudo de gestiones" de Informes: la vista de un año "no sirve para nada". Card Trello #125 (https://trello.com/c/zJv3oTkm).

## Problema

El "Embudo de gestiones" de Informes cuenta, sobre el período elegido, **cuántas gestiones alcanzaron cada etapa** (dato acumulado de conversión). Sobre un año eso no informa nada accionable: no dice dónde está frenado el trabajo AHORA. Además vive dentro de la caja "En el período" (cuyo filtro "gobierna SOLO lo de adentro"), así que su lectura depende de un rango de fechas que para esta pregunta es ruido.

## Solución

Convertir el gráfico en una **foto en tiempo real**: cuántas gestiones **activas** hay hoy en cada etapa. La barra más alta es el cuello de botella del momento (ej.: una barra gigante en Cobro = ahí se está amontonando el trabajo). Complementa a "Cuellos de botella" (días promedio por etapa, que ya existe): el embudo dice *cuántas* hay paradas en cada etapa, cuellos dice *cuánto* tardan en promedio.

## Alcance

1. **Dato** (`funnel` en `panel-metricas.client.tsx`): reescribir para contar gestiones activas por **etapa actual** (`filasEsp`, TODAS las gestiones, no el subconjunto del período). Activas = etapa distinta de `finalizado` y `cancelada`. Salida: una barra por etapa presente, en el orden del flujo (`ORDEN_ETAPAS`). Se eliminan las dependencias de `metricas.eventos`/`idsPeriodo`/período que usaba el cálculo acumulado.
2. **Ubicación**: sacar la card del embudo de la caja "En el período" y ponerla en un bloque propio de estado actual (`Bloque titulo="Carga por etapa"`, `cols={1}`), junto al resto de las vistas "ahora" (arriba de la caja del período). Badge `alcance="ahora"` (el tooltip ya dice "Estado actual — no cambia con el período"). Nota de naming: el bloque se llama **"Carga por etapa"**, no "Embudo" — no es un embudo (no hay conversión que se angoste), es la foto de dónde se amontona el trabajo (feedback de Fausti).
3. **Presentación**: barras horizontales coloreadas con `rampaMagnitud(value / max)` — igual criterio que "Cuellos de botella", así el cuello se lee por color e intensidad. Título de card "Gestiones activas por etapa", `ayuda` "Dónde están HOY las gestiones abiertas. La barra más alta es el cuello de botella.". Tooltip "N gestiones". Vacío → "No hay gestiones activas.".
4. El bloque "Flujo del trabajo" dentro del período queda con "Tiempo de ciclo" y "Cuellos de botella" (ambas métricas SÍ del período).

## v1.1 — Audit de "¿es realmente en tiempo real?" (feedback de Fausti)

**Duda de Fausti:** ¿el gráfico es realmente en vivo? **Sí.** El audit lo confirmó — y de paso corrigió un error mío.

**Hallazgo:** `PanelMetricas` se renderiza SIEMPRE dentro de `InicioRol` (`app/admin/page.tsx` y `app/gestion/page.tsx`), y `InicioRol` **ya** tiene `<RefrescoVivo tabla="gestiones" />`. Como `router.refresh()` re-fetchea el payload completo de métricas (`obtenerMetricas`), el panel entero — y por lo tanto las 5 cards "ahora" (Carga por etapa, estancadas, cobro, fee, presión) — **ya se actualizaba en vivo** ante cualquier cambio de `gestiones`. No era el outlier que se creyó en un primer momento.

**Error corregido:** en un primer intento se agregó un `<RefrescoVivo tabla="gestiones" />` DENTRO del panel. Fue un duplicado: el cliente Supabase reusa el canal por topic, y como `InicioRol` ya tenía `vivo-gestiones` suscripto, el segundo `.on()` tiraba `cannot add postgres_changes callbacks for realtime:vivo-gestiones after subscribe()` (error de consola en Inicio, para todo rol que la abra). **Se revirtió.** Neto en código: solo un comentario que documenta por qué el panel NO debe re-suscribirse a `gestiones` (lo hace el contenedor) y que sí conserva su propia suscripción a `calificaciones` (que `InicioRol` no cubre, para la card de Calificación).

**Verificación en vivo (SIN mi línea, solo con la suscripción de `InicioRol`):** base "78 gestiones" → `UPDATE gestiones SET etapa='finalizado'` de una gestión `[DEMO]` en conformidad → el total del gráfico bajó a **"77 gestiones"** solo en ~1s → revert a `conformidad` → volvió a **"78 gestiones"** solo. Dato restaurado. Consola: 0 errores tras el revert.

**Nota sobre "Presión por especialidad":** su lado del TRABAJO (gestiones) queda en vivo por lo anterior; un cambio de PLANTEL de técnicos (tablas `tecnicos`/`tecnico_especialidades`) todavía necesita recargar Informes. No se agregó suscripción (REGLA #0): es administrativo, infrecuente y se hace desde la vista de Técnicos.

## Fuera de alcance

- Cuellos de botella y Tiempo de ciclo: sin cambios (siguen siendo del período — un promedio histórico, no un snapshot).
- Sin tablas ni migraciones: el dato ya está en `metricas.filas` (etapa actual de cada gestión).

## Criterios de aceptación

1. El embudo muestra una barra por cada etapa con al menos una gestión activa, con el conteo real de gestiones que están HOY en esa etapa (verificable contra la DB: `count(*) group by etapa` excluyendo finalizado/cancelada).
2. Cambiar el selector de período (Mes/Trimestre/Año/Todo) **no** altera el embudo (es snapshot, lleva el badge "ahora").
3. La barra más alta queda con el color más intenso de la rampa (cuello de botella evidente); las más bajas, verde-azuladas.
4. Sin gestiones activas → mensaje "No hay gestiones activas." (no dibuja gráfico vacío).
5. `tsc`/eslint verdes; "Cuellos de botella" y "Tiempo de ciclo" siguen funcionando dentro de la caja del período (regresión).
6. (v1.1) Con Informes abierto, un cambio de etapa de una gestión se refleja en el gráfico **sin recargar** en ~1s (lo provee la suscripción de `InicioRol`), y la consola de Inicio queda **sin errores**.

## Dev Agent Record

- **Commits:** `737c81a` (v1.0, código+specs, junto con STORY-1005); `03d4918` (rename del bloque "Embudo en tiempo real" → "Carga por etapa"); `<v1.1 audit>` (2026-07-19).
- **Archivos:** `codigo/components/metricas/panel-metricas.client.tsx` (rewrite del `useMemo` `funnel` a snapshot por etapa actual desde `filasEsp`; card movida a un `Bloque titulo="Carga por etapa"` con `alcance="ahora"` fuera de la caja "En el período"; `BRAND_D` eliminado por quedar sin uso; v1.1: comentario documentando por qué NO se re-suscribe a `gestiones` — lo hace `InicioRol` — conservando solo `calificaciones`).
- **Verificación v1.0:** `tsc`/eslint verdes. E2E navegador (Admin): el gráfico muestra una barra por etapa con total = `count(*) group by etapa` de la DB excluyendo finalizado/cancelada; **Asignación** es la barra más larga y la más intensa (terracota) = cuello de botella; las chicas quedan verde-azuladas. Badge "ahora". "Cuellos de botella"/"Tiempo de ciclo" siguen dentro de la caja del período. Captura: `story-1004-embudo-tiempo-real.png`.
- **Verificación v1.1 (en vivo, ya vía `InicioRol`):** E2E navegador SIN recargar: base "78 gestiones" → `UPDATE gestiones SET etapa='finalizado'` de una gestión `[DEMO]` en conformidad → total del gráfico → **"77"** solo en ~1s → revert a `conformidad` → **"78"** solo. Consola sin errores tras revertir el duplicado. Dato de prueba restaurado. `tsc` del proyecto: los únicos 2 errores están en `features/asistente/tools.ts` (archivo local sin trackear, ajeno a esta story); `panel-metricas.client.tsx` compila limpio. eslint verde.
