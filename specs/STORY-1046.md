# STORY-1046 — El gasto real del técnico solo impacta en el desvío de presupuesto cuando la inmobiliaria aprueba la conformidad (v1.0)

**Estado:** 🔨 en prueba · **Origen:** pedido de Fausti (2026-07-23). Bug de métrica detectado en el circuito ejecución → conformidad. Investigado con dos exploraciones de código + verificación contra la base de producción.

## Problema

En la etapa de **ejecución**, el técnico rinde el **total final gastado en materiales** (input `materiales_total`, `AccionConformidadTecnico` en `detalle.client.tsx`). `subirConformidad()` (`features/gestiones/service.ts`) escribe ese número en `gestiones.materiales_total` en el **mismo instante** en que mueve el funnel `en_ejecucion → conformidad`. La única validación es que sea `> 0`.

El bug: la métrica de **desvío de presupuesto por técnico** (STORY-937 — Σ materiales reales / Σ presupuestados − 1) lee `materiales_total` **sin ningún gate de etapa ni de estado de conformidad**. Entonces, apenas el técnico rinde, el número ya impacta en sus métricas — **antes** de que la inmobiliaria apruebe la conformidad.

Caso real: el técnico presupuestó $10 pero al rendir tipeó $100 por error. Aunque la inmobiliaria **rechace** la conformidad indicando el error de tipeo, el $100 **sigue inflando el desvío del técnico** hasta que resuba corregido, porque el rechazo (`resolverConformidad(aprobar=false)`) no toca `materiales_total`. La métrica debería reflejar el gasto **recién cuando la inmobiliaria da el OK** en conformidad.

## Decisión de diseño

- **Gate único: "existe conformidad aprobada" (Regla #0).** El desvío cuenta una gestión solo si tiene al menos una fila `conformidades` con `estado = 'aprobada'`. Es el criterio que calca el modelo mental del usuario ("recién cuando la apruebo, impacta") y es coherente con el resto de las métricas que ya gatean (`obrasRealizadas` exige `etapa = 'finalizado'`; el desvío de plazo solo cuenta obras que salieron a conformidad).
- **No hace falta limpiar `materiales_total` en el rechazo.** Con el gate, mientras la conformidad esté `subida` (pendiente) o `rechazada` la gestión no cuenta; cuando el técnico corrige (resube, sobreescribiendo `materiales_total`) y la inmobiliaria aprueba, el valor guardado ya es el correcto. Un solo criterio, sin tocar el flujo de rechazo. Más simple.
- **El fallback por `costo_final` no se toca y no se rompe.** `costo_final` se escribe **solo al aprobar la conformidad** (`resolverConformidad`, `service.ts`), así que ya está intrínsecamente gateado a post-aprobación. Las gestiones viejas/demo que cuentan por ese fallback tienen todas conformidad aprobada → pasan el gate igual, sin cambio.

## Verificación de impacto (base de producción, 2026-07-23)

- **106 / 106 finalizadas** tienen conformidad aprobada → el gate **no saca ni una obra real** de la métrica. Igual `facturacion_cobro` (15/15) y `liquidacion_tecnico` (10/10).
- Los **únicos** registros cuyo conteo cambia: **10 gestiones paradas en etapa `conformidad`** (rindió, aún sin aprobar / rechazada) — que es exactamente el bug — más **2 canceladas** sueltas con `materiales_total` (una cancelada no es obra realizada; `obrasRealizadas` ya las excluye).
- **Demo/seed sin cambios:** las gestiones demo tienen `materiales_total = NULL` y cuentan por `costo_final`; todas las de `facturacion_cobro+` tienen conformidad aprobada.

## Alcance

Dos cómputos **gemelos** del desvío (misma fórmula STORY-937), mismo gate en ambos:

1. **`components/metricas/panel-metricas.client.tsx`** (card "Desvíos de presupuesto" de Informes, `useMemo desvio`): la fila **ya trae** `f.conformidades` (array de estados) → agregar el gate `f.conformidades.includes("aprobada")` al inicio del loop, antes de acumular. **Sin tocar queries.**
2. **`features/gestiones/service.ts`** (`estadisticasTecnicos` → desvío del picker de asignación y del ranking del asistente/Walter): el SELECT de gestiones (`gestiones` de esa función) **no trae** conformidades → agregar `conformidades(estado)` al embed y el mismo gate `conformidades?.some((c) => c.estado === "aprobada")` antes de acumular `matReales/matPresupuestados/nDesvio`.

## Fuera de alcance

- **No se toca ningún uso contable/operativo** de `materiales_total` ni `costo_final`: nota de cobro / PDF (`features/finanzas/service.ts`), liquidación al técnico, historial de cartera y resumen de obra, y el detalle de conformidad de la obra individual (`detalle.client.tsx` sigue mostrando "Gastado real en materiales" y el costo final de ESA gestión igual que hoy). El gate es solo sobre el **promedio agregado** del técnico.
- **No se toca la métrica gemela de plazo** (`desvioPlazoPct`), que comparte archivos y nombres.
- **No se limpia `materiales_total` en el rechazo** (innecesario con el gate; ver decisión).
- **Sin migración de DB** (no hay columna ni estado nuevo; el gate es en la lectura).

## Criterios de aceptación

1. **Ejecución no impacta:** un técnico que rinde $100 y la gestión queda en etapa `conformidad` (sin aprobar) **no** aparece con ese desvío ni en la card de Informes ni en el scorecard del picker ni en el ranking de Walter.
2. **Rechazo no impacta:** si la inmobiliaria rechaza la conformidad por el error de tipeo, el $100 **sigue sin contar**.
3. **Aprobación sí impacta:** cuando el técnico resube el valor correcto ($10) y la inmobiliaria **aprueba**, recién ahí la gestión entra al desvío, con el valor corregido.
4. **Sin regresión en obras reales:** todas las gestiones `facturacion_cobro / liquidacion_tecnico / finalizado` siguen contando igual que hoy (incluidas las que cuentan por el fallback `costo_final`). Los números del panel de Informes para obras finalizadas no cambian.
5. **Consistencia entre sitios:** la card de Informes y el scorecard del picker aplican el mismo gate (no puede una decir un desvío y la otra otro para el mismo técnico por incluir gestiones sin aprobar).
6. **Sin regresión técnica:** `tsc --noEmit` y `eslint` verdes sobre los archivos tocados. La métrica de plazo intacta.

## Dev Agent Record

- **Commit:** `24ed58d` (2026-07-23). Sin migración de DB.
- **Archivos:**
  - `codigo/components/metricas/panel-metricas.client.tsx`: en el `useMemo desvio` (card "Desvíos de presupuesto"), gate `if (!f.conformidades.includes("aprobada")) continue;` antes de acumular. La fila ya traía `f.conformidades`; sin tocar queries. La métrica de plazo (`desvioPlazo`) es un `useMemo` aparte → no afectada.
  - `codigo/features/gestiones/service.ts` (`estadisticasTecnicos`, desvío del picker/ranking Walter): SELECT de `gestiones` suma `conformidades(estado)`; tipo `GFila` suma `conformidades: { estado: string }[] | null`; en el loop, `real = !conformidadAprobada ? null : …` (gate por conformidad aprobada **envolviendo solo el desvío**, sin `continue`, para no gatear por error el cómputo de plazo que corre en el mismo loop).
- **Verificación:**
  - `tsc --noEmit` y `eslint` verdes sobre los dos archivos.
  - Delta contra base de producción (2026-07-23): de 122 gestiones que contaban → 110 tras el gate; salen exactamente **12 = 10 en etapa `conformidad` (el bug) + 2 canceladas**. Cero finalizadas/facturación/liquidación afectadas.
  - Click-through E2E en la app: pendiente (Rami/Giuliano).
