# STORY-982 — Finanzas gráfico y de un vistazo (rediseño UX del módulo)

**Estado:** ✅ done · **Origen:** pedido de Fausti (2026-07-16) sobre el módulo Finanzas que introdujo Giuliano (`6f2a863` + buscador `869417f`): "actualmente son listas eternas, no son intuitivas, son súper extensas — veamos si podemos hacerlo de una manera más gráfica, más funcional, más simple, de mejor calidad visual".

## Diagnóstico

El módulo (`/finanzas`) es funcional pero es 100% listas planas:

1. **Sin resumen**: para saber cuánta plata está pendiente hay que leer los encabezados de grupo desperdigados; no hay una foto "de un vistazo".
2. **Cerrados = lista infinita**: todos los meses expandidos, uno debajo del otro. Con historia real esto crece sin techo — la queja de las "listas eternas".
3. **Nada gráfico**: cero visualización, cuando la app ya tiene recharts y patrones probados en Informes (STORY-914/919).
4. **Pendientes sin prioridad**: vienen en el orden arbitrario del server; la antigüedad (el dato accionable) no ordena.

## Diseño (Regla #0: se reusa lo que ya existe, no se agrega infraestructura)

**El server layer no se toca** (`features/finanzas/consultas.ts` ya trae todo). Cambia solo `components/finanzas/finanzas.client.tsx` (+ helpers puros en `consultas-types.ts` si hacen falta).

### 1. Resumen — 4 stat cards arriba de los tabs (siempre visibles)

| Card | Dato grande | Secundario |
|---|---|---|
| Por cobrar | $ total pendiente | n gestiones · **"N demoradas"** en ámbar si hay pendientes ≥ `DIAS_ALERTA` |
| Por liquidar | $ total pendiente | ídem |
| Cobrado en {mes en curso} | $ del mes | n gestiones |
| Liquidado en {mes en curso} | $ del mes | n gestiones |

Grid 2 col mobile / 4 col desktop. Tipografía y Card del contract (borde = elevación, sin sombras). Tocar una card de pendiente lleva al tab correspondiente.

### 2. Gráfico mensual por tab (recharts, patrón Informes)

Dentro de cada tab, entre pendientes y cerrados: barras verticales esmeralda "Cobrado por mes" / "Liquidado por mes" — últimos 12 meses como máximo, meses sin movimiento en 0 (cero real: ya había sistema). Tooltip con $ y cantidad. **Responde a la búsqueda**: buscar un técnico en Liquidaciones muestra cuánto se le liquidó por mes (funcional, no decorativo). Con menos de 2 meses con datos no se dibuja (una barra sola no es serie).

### 3. Cerrados por mes → grupos colapsables

Cada mes es un encabezado clickeable (mes · n gestiones · total · chevron). **Solo el mes más reciente arranca abierto**; el resto colapsado. Con búsqueda activa se expanden todos los grupos con coincidencias (los resultados nunca quedan escondidos). Se mata la lista eterna sin perder nada.

### 4. Pendientes ordenados por antigüedad

Descendente (la más vieja primero) — mismo criterio que "qué cobrar primero" de Informes. La fila no cambia (título/subtítulo/monto/antigüedad, alerta ámbar ≥ 8 días).

### Fuera de alcance (simplicidad)

Sin selector de período, sin export, sin gráfico combinado cobros-vs-liquidaciones, sin paginación adicional, sin tocar queries ni permisos.

## Criterios de aceptación

1. Al entrar a `/finanzas` se ve de un vistazo: por cobrar, por liquidar, cobrado y liquidado del mes en curso, sin scrollear.
2. En cada tab hay un gráfico de barras mensual con tooltip ($ + cantidad) que se re-calcula con la búsqueda.
3. Los meses cerrados están colapsados salvo el más reciente; se expanden/colapsan al click; una búsqueda con coincidencias los expande sola.
4. Los pendientes aparecen ordenados de más viejo a más nuevo; la alerta ámbar de ≥ 8 días se mantiene.
5. Toda fila sigue linkeando a su gestión; el buscador sigue filtrando ambas secciones.
6. Tokens del design contract (esmeralda = marca, ámbar = urgente); sin sombras decorativas. `tsc` + `eslint` verdes.

## Dev Agent Record

- **Archivos:** `components/finanzas/finanzas.client.tsx` (único archivo tocado — server layer intacto, como pedía el diseño): `StatCard` (4 cards de resumen, click lleva al tab), `GraficoMensual` genérico (recharts, meses continuos vía `rangoMeses`, tope 12, tooltip $ + cantidad, no se dibuja con <2 meses con datos), `GrupoMes` + `GruposCerrados` (colapsables con chevron rotado del set propio; el más reciente abierto por defecto; búsqueda activa = todos forzados abiertos sin chevron), `porAntiguedad` para ordenar pendientes. Colores idénticos a `panel-metricas` (BRAND/GRID/INK_MUTED). Ajuste durante E2E: se quitó el borde esmeralda de "card activa" (dos cards resaltadas a la vez confundían; el estado del tab ya lo muestra el segmentado).
- **Verificación:** `tsc` + `eslint` verdes. E2E en navegador (2026-07-16, admin): cards con datos reales ($6.249.000 por cobrar · 14 gestiones · 5 demoradas en ámbar); pendientes ordenados 37→11→10→9→8 días→hoy; gráfico "Cobrado por mes" dic 25→jul 26 con meses vacíos en 0; solo Julio 2026 expandido (Junio→Diciembre colapsados), expandir/colapsar Junio suma/quita sus 20 filas; tab Liquidaciones + búsqueda "tecnico uno" filtra pendientes (3) y meses, expande todos los grupos con coincidencias y el gráfico se recalcula solo con lo del técnico. Links a gestión intactos. Consola limpia.
