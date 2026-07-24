# STORY-1049 — Una ampliación de presupuesto aprobada no debe contar como desvío de presupuesto (v1.0)

**Estado:** 🔨 en prueba — diseñada en party mode (Mary·John·Winston·Amelia·Boundary), confirmada por Fausti vía AskUserQuestion, implementada y verificada E2E (2026-07-23). Falta commit/push + card Trello + re-verificación de Rami/Giuliano. · **Origen:** pedido de Fausti (2026-07-23). Deuda de métrica documentada desde el 19/07 (memlog de party mode, acta de Mary al pushear la STORY-1017).

## Problema

La métrica de **desvío de presupuesto** (STORY-937) compara, ponderado por plata y solo sobre materiales:

```
desvíoPct = ( Σ materiales_reales / Σ materiales_presupuestados ) − 1
```

- **Numerador** — `materiales_reales` = `gestiones.materiales_total`, el total que rinde el técnico al terminar la obra. **Incluye** lo gastado con una ampliación.
- **Denominador** — `materiales_presupuestados` = `presupuestos.monto_materiales` del presupuesto **original aprobado**. **No incluye** las ampliaciones.

La feature de **ampliación de presupuesto** (STORY-1017) vive en una tabla propia `ampliaciones`. Al aprobar una ampliación, `resolverAmpliacion()` (`features/gestiones/service.ts`) solo cambia `ampliaciones.estado = 'aprobada'` e inserta un evento — **no toca ningún presupuesto**. Ninguna métrica lee `ampliaciones`.

El bug: cuando el técnico solicita una ampliación, se la **aprueban**, y luego rinde el total real (que legítimamente incluye ese gasto extra autorizado), el desvío lo lee como sobrecosto.

Caso de Fausti: presupuesto de materiales **$10**, el técnico pide una ampliación de **+$10**, la inmobiliaria la **aprueba**, y al terminar rinde **$20** (lo autorizado exacto). Hoy el desvío da **+100%** — calumnia a un técnico que gastó exactamente lo que le firmaron. Debería dar **0%**.

Era una deuda conocida: el 19/07, al pushear la STORY-1017, Fausti preguntó "¿el desvío del técnico sigue igual?" y quedó en acta que sí — "la métrica mide *cómo presupuestó*, no *si lo autorizaron*". Esta story paga esa deuda.

## Decisión de diseño

- **"Materiales autorizados" = `monto_materiales` (aprobado) + Σ `ampliaciones.monto` con estado `aprobada` de esa gestión.** Ese es el nuevo **denominador** del desvío. Es la MISMA definición de "lo autorizado" que ya usa el **tope de adelanto (STORY-1018)**: la ampliación suma **entera**, sin partir en materiales/mano de obra, a sabiendas, por **Regla #0**. Dos verdades del mismo concepto en el mismo sistema sería el bug de mañana.
- **Solo ampliaciones `aprobada`.** Una ampliación **rechazada** o **pendiente** (`enviada`, sin resolver) **no** agranda el techo. Si el técnico rinde por encima del presupuesto con una ampliación rechazada/pendiente, ese excedente **sigue contando como desvío** — gastó sin autorización, y eso es exactamente lo que la métrica tiene que cazar. La aprobación de la inmobiliaria es la única llave (mismo criterio que el gate de conformidad de la STORY-1046 y el tope de la STORY-1018).
- **Por gestión, no por técnico.** El denominador de una obra suma *todas* las ampliaciones aprobadas de *esa obra*. El numerador (`materiales_total`) es por gestión y se atribuye entero al técnico actual; para que numerador y denominador miren el **mismo universo**, el denominador también lleva la obra entera. (La STORY-1018 dijo "del técnico actual" porque ahí sumaba el tope de UN técnico; acá el recorte es la gestión. Misma doctrina, distinto alcance — se documenta para que nadie lo lea como contradicción.)
- **Una sola definición, en un solo lugar.** Un helper puro en `features/gestiones/` (`materialesAutorizados(montoMaterialesAprobado, montoAmpliacionesAprobadas)`) que los **tres** call-sites consumen. Prohibido repetir la suma a mano en cada componente (así nació este bug: la métrica confiaba en que el denominador "ya estaba bien").
- **No cambia el gate de conformidad aprobada (STORY-1046)** ni el fallback por `costo_final`. La ampliación aprobada suma al denominador **dentro** de esos criterios, no los abre ni los cierra.

## Alcance

Tres cómputos del desvío, misma fórmula STORY-937, mismo denominador nuevo:

1. **`features/gestiones/service.ts`** — desvío por técnico (`estadisticasTecnicos`, scorecard del picker de asignación + ranking del asistente/Walter; loop `matReales/matPresupuestados`). Su SELECT de `gestiones` **no** trae ampliaciones → agregar el embed `ampliaciones(monto, estado)`, sumarlo al tipo `GFila`, y en el loop hacer `matPresupuestados += monto_materiales + Σ(ampliaciones aprobadas)`.
2. **`features/metricas/service.ts` + `components/metricas/panel-metricas.client.tsx`** — card "Desvíos de presupuesto" de Informes. El SELECT de `gestiones` (`metricas/service.ts:105`) **no** trae ampliaciones → agregar `ampliaciones(monto, estado)` al embed, sumar `ampliacionesAprobadas: number` a `FilaMetrica`, y en el `useMemo desvio` (`panel-metricas.client.tsx:550`) usar `f.matPresupuestada + f.ampliacionesAprobadas` como denominador.
3. **`components/gestiones/detalle.client.tsx`** — "Desvío sobre materiales" del detalle de conformidad de la obra individual (`desvioMat`, línea ~1645). `gestion.ampliaciones` **ya está cargada** (se usa en la UI de ampliación) → sumar las aprobadas al `matPresupuestados` local. Sin tocar query. El desglose visible ("Materiales presupuestados" vs "Gastado real") suma una línea "Ampliación aprobada" para que el número cierre a la vista (ver Criterios).

## Fuera de alcance

- **No se toca el flujo contable/operativo:** `costo_final`, nota de cobro / PDF, liquidación al técnico, reparto inquilino/propietario. La ampliación ya participa ahí por su cuenta (STORY-1017/1038); esta story es **solo** sobre la métrica de desvío.
- **No se toca la métrica gemela de plazo** (`desvioPlazoPct`), que comparte archivos y nombres pero mide tiempo, no plata.
- **No se crea la métrica de "calidad de presupuesto"** (frecuencia de ampliaciones por técnico). John la dejó en acta: el técnico que presupuesta mal y tapa con ampliaciones aprobadas quedará con desvío 0 — es correcto para *esta* métrica (mide "gastó lo autorizado", no "presupuestó bien"). La calidad de presupuesto es **otra** métrica, deuda documentada, **no** se fusiona acá.
- **Sin migración de DB.** No hay columna ni estado nuevo; el cambio es de **lectura** (embeds + suma en el denominador). La tabla `ampliaciones` ya existe (STORY-1017).

## Criterios de aceptación

1. **Ampliación aprobada = 0 desvío:** obra con materiales $10 + ampliación **aprobada** $10, técnico rinde $20 (conformidad aprobada) → desvío **0%** en la card de Informes, en el scorecard del picker/Walter y en el "Desvío sobre materiales" del detalle. (Caso exacto de Fausti.)
2. **Ampliación rechazada sí cuenta:** mismos $10 + ampliación **rechazada** $10, rinde $20 → desvío **+100%** (gastó sin autorización). Igual si la ampliación quedó **pendiente/enviada** sin resolver.
3. **Sin ampliación, sin cambios:** obra sin ampliación → el desvío es idéntico a hoy (regresión cero para la enorme mayoría de las obras).
4. **Ampliación parcial:** materiales $10 + ampliación aprobada $10 (techo $20), rinde $25 → desvío **+25%** (se pasó $5 sobre lo autorizado, no $15 sobre el original).
5. **Consistencia entre los tres sitios:** para la misma obra/técnico, card de Informes, scorecard del picker y desvío del detalle dan el mismo número (una sola definición de "materiales autorizados").
6. **Coherencia con STORY-1018:** el denominador del desvío usa exactamente la misma fórmula de "materiales autorizados" que el tope de adelanto (materiales vigentes + ampliaciones aprobadas, monto entero, sin split).
7. **Gate de conformidad intacto (STORY-1046):** una obra rendida pero con conformidad no aprobada sigue sin contar; la ampliación no cambia eso.
8. **Fallback de obras viejas coherente:** una gestión que cuenta por `costo_final − mano_obra` (sin `materiales_total`) con ampliación aprobada también suma la ampliación al denominador → se verifica en E2E que no se rompe.
9. **Sin regresión técnica:** `tsc --noEmit` y `eslint` verdes sobre los archivos tocados. Métrica de plazo intacta.

## Dev Agent Record

- **Commit:** `c642806` (2026-07-23). Sin migración de DB.
- **Archivos:**
  - `codigo/features/gestiones/desvio.ts` **(nuevo)** — helper único `sumaAmpliacionesAprobadas(ampliaciones)`: Σ `monto` de las de estado `aprobada`. La definición ÚNICA de "cuánta plata de ampliación se autorizó", consumida por los 3 call-sites. Módulo puro (sin `'use server'`) → importable desde server y client.
  - `codigo/features/gestiones/service.ts` (`estadisticasTecnicos`, scorecard picker/Walter) — embed `ampliaciones(monto, estado)` en el SELECT; `GFila` suma `ampliaciones`; denominador `matPresupuestados += monto_materiales + sumaAmpliacionesAprobadas(g.ampliaciones)`.
  - `codigo/features/metricas/service.ts` — embed `ampliaciones(monto, estado)`; tipo `G` y `FilaMetrica` suman `ampliacionesAprobadas: number` (= `sumaAmpliacionesAprobadas(g.ampliaciones)`).
  - `codigo/components/metricas/panel-metricas.client.tsx` — `useMemo desvio`: denominador `cur.presup + f.matPresupuestada + f.ampliacionesAprobadas`.
  - `codigo/components/gestiones/detalle.client.tsx` — `matAutorizados = matPresupuestados + sumaAmpliacionesAprobadas(gestion.ampliaciones)`; `desvioMat = rendido − matAutorizados`; línea "Ampliación aprobada +$X" en el desglose y label "Desvío sobre materiales autorizados" cuando hay ampliación. `costo_final` NO se toca (sigue = rendido + mano de obra).
- **Verificación (2026-07-23):**
  - `tsc --noEmit` y `eslint` verdes sobre los 5 archivos.
  - **Réplica SQL de la fórmula exacta (viejo vs nuevo) contra prod:** cambian exactamente 3 técnicos con ampliaciones aprobadas — Faustino 42,6%→**10,6%**, tecnico tres 37,2%→**13,0%**, tecnicodos 20,3%→**19,5%** (la ampliación **rechazada** de #102 NO suma). Los otros 9 técnicos, idénticos (regresión cero).
  - **E2E navegador (admin, dev :3000, data real):**
    - Scorecard del picker (gestión #216, `estadisticasTecnicos`): Faustino Pieroni **"Presup. +10.6%"** — matchea el valor nuevo (era +42,6%). Confirma el path embed+helper+suma.
    - Desvío por obra del detalle (gestión en etapa `conformidad`): renderiza "Materiales presupuestados $999.999.999", **"Ampliación aprobada +$999.999.999"** (línea nueva), "Gastado real $1", **"Desvío sobre materiales autorizados −$1.999.999.997 (−100%)"** (denominador = presupuesto + ampliación). Confirma el path del detalle.
  - Casos de la data real que respaldan los 4 criterios: #221 (25%→0%, caso plata), #218 (400%→11% con DOS ampliaciones), #102 (60%→23% con rechazada excluida), #226 (200%→200% con pendiente excluida).
  - Click-through E2E de Rami/Giuliano: pendiente.
