# STORY-982 — Finanzas gráfico y de un vistazo (rediseño UX del módulo)

**Versión:** 1.4.0 · **Estado:** ✅ done · **Origen:** pedido de Fausti (2026-07-16) sobre el módulo Finanzas que introdujo Giuliano (`6f2a863` + buscador `869417f`): "actualmente son listas eternas, no son intuitivas, son súper extensas — veamos si podemos hacerlo de una manera más gráfica, más funcional, más simple, de mejor calidad visual".

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

Sin selector de período, sin export, sin paginación adicional, sin tocar queries ni permisos. ~~Sin gráfico combinado cobros-vs-liquidaciones~~ → entra en v1.1 (abajo).

## v1.1 — Gráfico combinado cobros vs. liquidaciones (pedido de Fausti, 2026-07-16)

- **"Cobrado vs. liquidado por mes"** arriba, debajo de las stat cards y fuera de los tabs (es la foto global entra-vs-sale; no depende del tab ni de la búsqueda). Barras **agrupadas** (no apiladas: no son partes de un todo) — cobrado en esmeralda, liquidado en ámbar (mismo par de series de dinero que "Ingresos cobrados" de Informes). Leyenda debajo; tooltip con $ y cantidad de cada serie, **sin "diferencia" derivada** (un cobro de julio puede liquidarse en agosto — mostrar la resta como ganancia mentiría; doctrina de honestidad de Informes).
- Los gráficos por tab ("Cobrado por mes" / "Liquidado por mes") pasan a mostrarse **solo con búsqueda activa**: su valor diferencial es graficar lo buscado (p. ej. cuánto se le liquidó a un técnico por mes); sin búsqueda duplicaban media serie del combinado, tres gráficos era ruido (Regla #0).
- Misma regla de honestidad: el combinado no se dibuja con menos de 2 meses con datos; meses sin movimiento en $0 (cero real); tope 12 meses.

## v1.2 — Sin gráficos; tarjetas en vez de filas (pedido de Fausti, 2026-07-16)

Feedback: los gráficos de v1.0/v1.1 **se superponen con Informes en el Inicio** — afuera todos (combinado y por tab). Lo que tenía que ser "más gráfico" es **la visualización de cada cobro/liquidación**: las filas planas "horribles y básicas" no escalan visualmente ("si se usa por 5 años el sistema será un desastre").

- **Se eliminan** `GraficoCombinado` y `GraficoMensual` (y recharts del módulo). Las 4 stat cards quedan (no son gráficos y no están en el Inicio).
- **`TarjetaGestion` reemplaza a `FilaGestion`**: grilla de tarjetas (1 col mobile / 2 sm / 3 xl), cada gestión es un objeto visual con jerarquía: **monto grande arriba a la izquierda** (es Finanzas: la plata manda), antigüedad como **`Badge` del contract** arriba a la derecha (ámbar si ≥ 8 días, neutro si no) o medio de pago en cerradas, descripción en `line-clamp-2`, y abajo dirección (ícono `pin`) + pagador/técnico (ícono `perfil`) en muted.
- Pendientes y cerradas usan la misma tarjeta (consistencia); los meses colapsables se mantienen — son los que hacen escalable el histórico — pero su contenido pasa de lista dentro de una Card a grilla de tarjetas.
- Estados vacíos y links a la gestión sin cambios.

## v1.3 — Conciliación con el Inicio (reporte de Fausti, 2026-07-16)

Reporte: "no me coinciden el total a cobrar ni el total a liquidar de Finanzas con lo que está en el Inicio". Diagnóstico (verificado con SQL contra la DB):

1. **Bug real en Informes** (`panel-metricas.client.tsx`, card "Gestiones pendientes de cobro" que se ve en el Inicio): el total "Por cobrar" sumaba `costo_final + cargo_admin` ignorando `cargo_cancelacion` — STORY-967 ("una cancelación con cargo vale su cargo") se aplicó a la LISTA de esa card pero no a la barra del total. Con una cancelación con cargo en cobro: Informes $6.234.000 vs Finanzas $6.249.000. **Fix:** misma fórmula que Finanzas (`cargo_cancelacion ?? costo_final + cargo_admin`); como la cancelada con cargo nunca pasa por liquidación (el cobro la cierra en `cancelada`), su cargo va entero al bucket del fee de la casa. Ahora ambas pantallas muestran el mismo número.
2. **"A técnicos" no era "por liquidar"**: esa leyenda es la composición de lo POR COBRAR (gestiones en etapa de cobro, $5.318.000); el "Por liquidar" de Finanzas ($4.318.010) son OTRAS gestiones (ya cobradas, en etapa de liquidación) con los adelantos de materiales restados (STORY-977). Son platas distintas y no deben coincidir. **Fix de claridad:** la leyenda pasa de "A técnicos" a **"Trabajo del técnico"** (mismo rótulo que el gráfico de ingresos), para que no se lea como la liquidación pendiente. El Inicio no muestra ningún "$ por liquidar"; esa foto vive en Finanzas.
3. Typo preexistente corregido en la misma card: "14 gestiónes" → "14 gestiones".
4. La variable interna `liquidar` de `pendiente` (calculada y nunca renderizada desde STORY-920) se elimina.

## v1.4 — Histórico: un mes por vez (pedido de Fausti, 2026-07-16)

Feedback sobre los meses colapsables de v1.2: "sigue sin convencerme… hay que buscar otra forma más visual y pensada para que crezca y no sea algo eterno" — aun colapsados, la pila de encabezados crece sin techo (5 años ≈ 60 renglones).

- **`HistorialMensual` reemplaza a los colapsables**: en pantalla hay siempre **UN solo mes** — flechas ‹ › para el mes vecino y un `<select>` de meses (solo los que tienen movimientos) para saltar lejos. La vista mide lo mismo con 6 meses que con 6 años de uso.
- Encabezado del mes: título de sección ("Cobrados"/"Liquidadas") + navegación + `n gestiones · $ total` a la derecha. Default: el mes más reciente con datos.
- **Con búsqueda activa** la navegación desaparece y se listan todos los meses con coincidencias (encabezado por mes + grilla): el largo lo acota la búsqueda, no el tiempo. Al limpiar la búsqueda se vuelve al mes que estaba elegido.

## Criterios de aceptación

1. Al entrar a `/finanzas` se ve de un vistazo: por cobrar, por liquidar, cobrado y liquidado del mes en curso, sin scrollear.
2. En cada tab hay un gráfico de barras mensual con tooltip ($ + cantidad) que se re-calcula con la búsqueda.
3. Los meses cerrados están colapsados salvo el más reciente; se expanden/colapsan al click; una búsqueda con coincidencias los expande sola.
4. Los pendientes aparecen ordenados de más viejo a más nuevo; la alerta ámbar de ≥ 8 días se mantiene.
5. Toda fila sigue linkeando a su gestión; el buscador sigue filtrando ambas secciones.
6. Tokens del design contract (esmeralda = marca, ámbar = urgente); sin sombras decorativas. `tsc` + `eslint` verdes.

## Dev Agent Record

- **Archivos:** `components/finanzas/finanzas.client.tsx` (único archivo tocado — server layer intacto, como pedía el diseño): `StatCard` (4 cards de resumen, click lleva al tab), `GraficoMensual` genérico (recharts, meses continuos vía `rangoMeses`, tope 12, tooltip $ + cantidad, no se dibuja con <2 meses con datos), `GrupoMes` + `GruposCerrados` (colapsables con chevron rotado del set propio; el más reciente abierto por defecto; búsqueda activa = todos forzados abiertos sin chevron), `porAntiguedad` para ordenar pendientes. Colores idénticos a `panel-metricas` (BRAND/GRID/INK_MUTED). Ajuste durante E2E: se quitó el borde esmeralda de "card activa" (dos cards resaltadas a la vez confundían; el estado del tab ya lo muestra el segmentado).
- **v1.2:** fuera todos los gráficos (recharts eliminado del módulo — se superponían con Informes en el Inicio); `TarjetaGestion` + `Grilla` (1/2/3 col) reemplazan a `FilaGestion`: monto `text-lg` arriba-izquierda, `Badge` de antigüedad (urgente/neutro) en pendientes o medio de pago en cerradas, descripción `line-clamp-2`, dirección con ícono `pin` y persona con `perfil`. `Vacio` ahora trae su propia Card; `GrupoMes` renderiza `Grilla` en vez de Card-lista. E2E (2026-07-16): grilla de 3 col con badges ámbar en demoradas, colapso Julio 57→38 tarjetas y reapertura, búsqueda "ferreyra" filtra (20) y expande grupos. `tsc` + `eslint` verdes, consola limpia.
- **v1.1 (superada por v1.2):** `GraficoCombinado` ("Cobrado vs. liquidado por mes") debajo de las stat cards — barras agrupadas esmeralda/ámbar sobre las series completas sin filtrar (`gruposCobros`/`gruposLiq` en `Finanzas`), leyenda "Cobrado (entra)" / "Liquidado a técnicos (sale)", tooltip con $ y cantidad por serie (sin resta derivada). Los `GraficoMensual` por tab quedan detrás de `hayBusqueda`. Helper `plataCorta` compartido. E2E: tooltip "dic 25 — Cobrado: $2.256.000 · 6 gestiones / Liquidado: $2.157.000 · 6 gestiones"; sin búsqueda no hay gráfico de tab; "demo" (varios meses) lo hace aparecer; "urquiza" (1 mes) lo mantiene oculto por la regla de ≥2 meses; el combinado no reacciona a la búsqueda. `tsc` + `eslint` verdes, consola limpia.
- **Verificación v1.0:** `tsc` + `eslint` verdes. E2E en navegador (2026-07-16, admin): cards con datos reales ($6.249.000 por cobrar · 14 gestiones · 5 demoradas en ámbar); pendientes ordenados 37→11→10→9→8 días→hoy; gráfico "Cobrado por mes" dic 25→jul 26 con meses vacíos en 0; solo Julio 2026 expandido (Junio→Diciembre colapsados), expandir/colapsar Junio suma/quita sus 20 filas; tab Liquidaciones + búsqueda "tecnico uno" filtra pendientes (3) y meses, expande todos los grupos con coincidencias y el gráfico se recalcula solo con lo del técnico. Links a gestión intactos. Consola limpia.
