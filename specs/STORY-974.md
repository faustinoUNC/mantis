# STORY-974 — Auditoría: filtros server-side que no mienten + datos invisibles afuera

**Estado:** ✅ done · **Origen:** party mode 2026-07-15 (Mary/John/Winston/Sally + Amelia) convocado por Fausti para hacer la Auditoría más clara, valiosa y con mejor UX. Supersede la parte de filtros de STORY-928.

## El problema

Fausti definió el uso real de `/admin/auditoria`: **control interno** — "quién hizo qué" y cómo se llevaron a cabo las gestiones e interacciones de los empleados con el sistema. Contra ese uso, la pantalla actual falla en tres frentes:

1. **El filtro miente.** `historialGlobal()` trae los últimos **200 eventos globales** y el filtro/búsqueda corre client-side sobre esa ventana. Buscar "Urquiza 193" no muestra el historial de Urquiza 193: muestra lo que de Urquiza 193 cayó dentro de las últimas 200 filas, **pareciendo completo**. Hoy hay 1.863 eventos en la DB → el admin ve el 11% del historial sin ninguna señal de que le falta el resto. Para una pantalla cuyo propósito declarado es "evidencia de plazos", descalificante.
2. **Datos que ya guardamos y no mostramos** (Winston: "congelamos los hechos y después no los mostramos"):
   - `tecnico_no_continua` (abandono, STORY-971) no está en el mapa `LABEL` de la Auditoría → aparece el **slug crudo** en la tabla del admin, y como el filtro de tipos se arma desde ese mapa, además es infiltrable. El mapa de Actividad (`LABEL_EVENTO` en `detalle.client.tsx`) sí lo tiene: son **dos mapas duplicados** que ya divergieron.
   - El `imputado` y el `tecnico_saliente` de las desasignaciones (congelados en el detalle por diseño de STORY-966) y el `cargo` de cancelación (STORY-967) no se muestran en `resumenDetalle` — `detalleLegible` de Actividad ya muestra imputado y cargo: **dos funciones duplicadas** que también divergieron.
   - El detalle está truncado con `line-clamp-1` aunque el propio comentario del código dice "la mitad del valor de auditoría vive ahí".
3. **Sin eje persona ni tiempo.** Para "qué hizo X esta semana" hoy hay búsqueda de texto libre por nombre (sobre la ventana de 200) y nada más: ni filtro por usuario, ni rol visible, ni rango de fechas.

## La solución

Una story, tres frentes. Sin migraciones, sin tablas nuevas, sin realtime: los datos ya existen — dejamos de esconderlos (Regla #0).

### 1. Filtros server-side — muere el límite 200

`historialGlobal(filtros)` pasa a filtrar y paginar **en la query**:

- **Persona**: select de usuarios reales (`listarActores()`: id, nombre, rol — todos, incluidos inactivos: la auditoría es historia) → `eq(actor_id)`.
- **Tipo de evento**: `eq(tipo)`, opciones desde el mapa centralizado.
- **Búsqueda** (dirección o descripción): resuelve primero las gestiones que matchean (`ilike` sobre `descripcion` y sobre `propiedades.direccion`) y filtra `in(gestion_id, …)`. Sin matches → resultado vacío honesto.
- **Rango de fechas** (desde/hasta, inputs `type="date"`): `gte`/`lte` sobre `creado_en` con offset fijo `-03:00` (Argentina no tiene DST).
- **Paginación server-side**: `range()` + `count: "exact"`, 20 por página. El `<Paginador>` presentacional se reutiliza con props calculadas del count.
- **Denominador visible** (Mary): el total de eventos que matchean se muestra SIEMPRE ("84 eventos"), con o sin filtro activo.

El client llama la server action al cambiar filtros (debounce + `useTransition`); la primera página viene renderizada del server como hasta ahora.

### 2. Datos invisibles afuera — y un solo lugar para las labels

- Nuevo módulo compartido `features/gestiones/eventos.ts` (client-safe, sin `"use server"`): `LABEL_EVENTO`, `detalleLegible()`, `etiquetaEtapa()` y el merge `MEDIO_LABEL`. `detalle.client.tsx` y `auditoria.client.tsx` importan de ahí y **borran sus copias locales** — el próximo evento nuevo no puede volver a nacer visible en una pantalla e invisible en la otra. Se adopta el wording de Actividad (el mapa completo: 20 tipos, verificado contra la DB).
- `detalleLegible` suma `tecnico_saliente` ("Saliente: {nombre}") — imputado y cargo ya estaban; la Auditoría los gana al compartir la función.
- **Detalle expandible**: click en una fila con detalle alterna `line-clamp-1` ↔ texto completo (cursor pointer solo en filas con detalle; el link a la gestión no dispara el toggle).

### 3. Legibilidad cronológica (Sally)

- **Separadores por día** en la tabla (fila que abarca las 4 columnas: "Martes 15/07/26", días manuales — sin `toLocaleString`, doctrina hydration de la 973). La columna "Cuándo" queda solo con la hora `hh:mm`.
- **Rol junto al actor**: la celda "Quién" muestra nombre + rol (`NOMBRE_ROL`) en línea secundaria. Eventos sin actor conocido siguen como "Sistema".

## Descartado en el party (documentado para no re-proponer)

- **Export CSV/PDF** — Fausti explícito: uso interno, nadie externo ve esta pantalla ("no hace falta").
- **Realtime en Auditoría** — un log interno no necesita moverse solo mientras se lo mira.
- **Timeline visual con iconos** — la tabla con separadores por día alcanza.

## Criterios de aceptación

1. Buscar una dirección con historial más viejo que los últimos 200 eventos globales muestra TODO su historial (paginado), no la ventana. El total visible coincide con `count(*)` filtrado en la DB.
2. Filtro por persona (select con todos los usuarios) + rango de fechas combinables entre sí y con tipo/búsqueda; cambiar cualquier filtro vuelve a página 1 y el conteo total se actualiza.
3. El evento de abandono aparece como "El técnico avisó que no puede continuar" (no `tecnico_no_continua`) y es filtrable por tipo.
4. Una desasignación imputada al técnico muestra "Abandonada por el técnico" y el técnico saliente en su detalle, en Auditoría y en Actividad.
5. Click en una fila con detalle largo lo expande completo; el link a la gestión sigue navegando.
6. La tabla agrupa por día con separador y la celda "Quién" muestra el rol del actor.
7. `LABEL_EVENTO`/`detalleLegible`/`etiquetaEtapa` viven en UN solo módulo importado por ambas pantallas (cero mapas duplicados).
8. Sin regresión en Actividad (misma info que antes + técnico saliente).
9. `tsc` + `eslint` verdes; sin errores de hidratación en consola.

## Dev Agent Record

- **Archivos:** `features/gestiones/eventos.ts` (NUEVO: `LABEL_EVENTO` + `detalleLegible` + `etiquetaEtapa` compartidos), `features/gestiones/salientes.ts` (NUEVO: `nombrarSalientes` — el evento congela el UUID del saliente, se traduce a nombre server-side), `features/auditoria/types.ts` (NUEVO: tipos + `AUDITORIA_POR_PAGINA` fuera del "use server"), `features/auditoria/service.ts` (filtros + `count: "exact"` + `range()`; `listarActores`), `components/auditoria/auditoria.client.tsx` (rework: server action con debounce+transition, descarte de respuestas viejas, separadores por día, rol, detalle expandible), `app/admin/auditoria/page.tsx`, `components/gestiones/detalle.client.tsx` (borra los mapas/funciones duplicados), `features/gestiones/service.ts` (`obtenerGestion` nombra salientes).
- **Verificación:** `tsc`+`eslint` verdes. E2E local (2026-07-15) con conteos validados 1:1 contra SQL: total 1.863; persona "Tecnico Uno" → 152 (= DB); persona+tipo abandono → 1 (= DB); búsqueda "Urquiza" → 81 (= DB, historial fuera de la ventana de 200); rango 14/07 → 32 (= DB). "Saliente: Tecnico Uno" y "Abandonada por el técnico" visibles en Auditoría Y Actividad; label del abandono correcto y filtrable; expansión de fila ok; consola sin errores de hidratación.
- **Hallazgo en implementación:** `tecnico_saliente` congelado es el **id** del usuario — mostrarlo crudo era peor que no mostrarlo. `nombrarSalientes()` lo resuelve en ambos services y `detalleLegible` omite el dato si quedara sin resolver (nunca imprime un UUID).
- **v1.1 (mismo día):** botón de actualizar a pedido de Fausti — ícono `refrescar` (nuevo en `iconos.tsx`), junto al contador de eventos: re-consulta con los filtros y la página actuales (el fetch se extrajo a `cargar()`, compartido con el efecto de filtros), gira mientras carga. Matiza el descarte del realtime: lo descartado es la tabla moviéndose sola, no poder traer lo nuevo a demanda.
