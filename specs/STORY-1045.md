# STORY-1045 — Los badges de estado de la card no se apagan al cambiar de etapa (se pisan entre sí) (v1.0)

**Estado:** 🔨 en prueba · **Origen:** pedido de Fausti (2026-07-23). Bug de UI detectado sobre los badges de las cards de gestiones; investigado en party mode (roundtable Mary·John·Winston·Sally).

## Problema

Las cards de gestiones muestran badges de estado a lo largo del ciclo de vida ("Urgente", "Ampliación", "Falta calificar", "En pausa", "Reasignar"). El reporte de Fausti: **se pisan entre ellos**. Ejemplo: una gestión con el badge "Ampliación" que llega al final sin que se califique al técnico debería mostrar "Falta calificar", pero queda mostrando "Ampliación".

La investigación encontró **dos causas** (no una):

**Causa A — flags derivados que no se apagan al cambiar de etapa (la raíz del síntoma).** En `normalizarFila()` (`features/gestiones/service.ts`) hay tres flags que derivan de una **tabla hija** y se calculan **sin guarda de etapa**:

- `ampliacion_pendiente` = `ampliaciones.some(a => a.estado === "enviada")`
- `presupuesto_pendiente` = `presupuestos.some(p => p.estado === "enviado")`
- `conformidad_rechazada` = `ultimaConformidad?.estado === "rechazada"`

Esas filas hijas **no se resetean al cancelar la gestión** (ni `cancelarGestion` ni `avanzar_etapa` las tocan; la única resolución es la UI de cada resolver, que solo existe en su etapa). Entonces una ampliación que quedó `enviada` sigue haciendo `ampliacion_pendiente = true` aunque la gestión ya esté en `cancelada` (o en `finalizado`, para data anterior al candado de la STORY-1042). El badge "Ampliación" sobrevive a su etapa y tapa al que sí corresponde.

El único de la familia que está bien es `calificacion_pendiente`, que **trae la guarda de etapa en el origen** (`g.etapa === "finalizado" && ...`). Es el modelo a copiar.

Los otros dos (`presupuesto_pendiente`, `conformidad_rechazada`) no tienen badge propio en la card, pero se filtran **crudos en el asistente** (`features/asistente/tools.ts:430,440,526`): una gestión cancelada con un presupuesto `enviado` le aparece al asistente como "esperando decisión" — mismo bug, otra boca.

**Causa B — la fila de badges del tablero no envuelve (por qué se ve "pisado").** El contenedor de badges del tablero (`tablero.client.tsx`) es `flex` **sin `flex-wrap`**, en un `justify-between` contra la especialidad (`truncate`) y el contador de días. Además es **inconsistente**: "En pausa"/"Ampliación"/"Falta calificar" tienen `shrink-0 whitespace-nowrap`, pero "Urgente"/"Reasignar" no. Con varios badges a la vez la fila desborda y el último queda clippeado. (Detalle y Archivadas ya usan `flex-wrap`, por eso ahí no pasa.)

## Decisión de diseño

- **No es "prioridad entre badges" ni "excluyentes".** Es **cada badge prendido solo en la etapa donde es accionable**. Cuando dos son legítimos a la vez, **coexisten** (por eso el `flex-wrap`, no elegir uno). Doctrina: un badge sobre el que no podés actuar en esta etapa es ruido.
- **Se arregla en el ORIGEN, no en cada consumidor (Regla #0).** Acotar los tres flags por etapa en `normalizarFila` —igual que `calificacion_pendiente`— es un solo lugar donde la verdad se calcula bien una vez. Evita repetir la guarda en cada card/consumidor (que es exactamente cómo nació el bug) y **arregla el asistente de regalo**.
- **Urgente es OTRO animal — no entra en el fix de los tres flags.** `urgencia` es un **atributo directo** de la gestión, no un flag derivado de tabla hija que se cuelga: no miente. NO se acota por etapa como los otros tres. Pero, por la misma doctrina de accionabilidad, **no se muestra en estados terminales** (`finalizado`/`cancelada`): ahí la urgencia de un trabajo ya cerrado no sirve para actuar y solo le roba renglón a "Falta calificar". Es una guarda distinta, por una razón distinta — que quede escrito para que nadie confunda el porqué.
- **`flex-wrap` + `shrink-0` unificado** en las filas de badges de card angosta (tablero), para que ningún badge se clippee y todos se comporten igual.

## Alcance

1. **`features/gestiones/service.ts` (`normalizarFila`):** acotar los tres flags por etapa en el origen:
   - `presupuesto_pendiente`: solo `true` en `etapa === "presupuesto"`.
   - `ampliacion_pendiente`: solo `true` en `etapa === "en_ejecucion"`.
   - `conformidad_rechazada`: solo `true` en `etapa === "conformidad"`.
2. **`components/gestiones/tablero.client.tsx`:**
   - Guarda de Urgente: `gestion.urgencia === "urgente" && !ETAPAS_TERMINALES.has(gestion.etapa)`.
   - Fila de badges (contenedor): agregar `flex-wrap`; darle a "Urgente" y "Reasignar" el mismo `shrink-0 whitespace-nowrap` que ya tienen los demás.
3. **`components/gestiones/detalle.client.tsx`:** misma guarda de Urgente en terminales en el header (`gestion.urgencia === "urgente" && !ETAPAS_TERMINALES.has(gestion.etapa)`).

## Fuera de alcance

- **`mis-trabajos.client.tsx` no necesita cambios:** el fix al origen ya apaga `ampliacion_pendiente` fuera de `en_ejecucion`; y en la vista técnico las etapas terminales usan cards de seguimiento/historial que NO renderizan el badge "Urgente" (la urgencia va por el borde izquierdo).
- **Naming (deuda aparte):** la misma etiqueta tiene dos nombres según la pantalla ("En pausa" tablero / "Técnico no continúa" detalle; "Reasignar" / "Reasignar técnico"). Un nombre-un significado. No se toca en esta story.
- **Ampliación zombie en `cancelada` (deuda de datos, aparte):** que `cancelarGestion` resuelva/cierre las ampliaciones `enviada` colgadas al cancelar (hoy quedan sin UI para resolverse, porque `AmpliacionGestor` solo vive en `en_ejecucion`). Es fix de datos, no de percepción — otra story. El fix de esta story hace que dejen de gritar desde la card, aunque sigan en la DB.
- No se agrega estado/columna ni migración. No se toca el candado de la STORY-1042 (lee la tabla directo, no el flag) ni `AmpliacionGestor` (se muestra por etapa, no por flag).

## Criterios de aceptación

1. **Ampliación acotada:** una gestión con una ampliación `enviada` que ya no está en `en_ejecucion` (cancelada, o finalizada con data vieja) **no** muestra el badge "Ampliación".
2. **Ampliación sigue funcionando donde corresponde:** en `en_ejecucion` con ampliación `enviada`, el badge "Ampliación" aparece en el tablero y en Mis trabajos (sin regresión de la STORY-1042).
3. **Asistente:** una gestión cancelada con presupuesto `enviado` / conformidad `rechazada` deja de contarse como "esperando decisión" / "a resubir".
4. **Urgente en terminales:** una gestión `finalizado`/`cancelada` con `urgencia === "urgente"` **no** muestra "Urgente" (ni en el tablero ni en el detalle). En etapas activas Urgente se comporta igual que hoy.
5. **Falta calificar visible:** una gestión finalizada sin calificar muestra "Falta calificar" sin que la tape ningún otro badge.
6. **Sin clipping:** con varios badges a la vez, la fila del tablero envuelve (no se corta el último).
7. **Sin regresión:** flujo normal intacto. `tsc`/eslint verdes.

## Dev Agent Record

- **Commit:** `PENDIENTE` (2026-07-23). Sin migración.
- **Archivos:**
  - `codigo/features/gestiones/service.ts` (`normalizarFila`): los tres flags derivados de tablas hijas se acotan por etapa **en el origen** — `presupuesto_pendiente` solo `presupuesto`, `ampliacion_pendiente` solo `en_ejecucion`, `conformidad_rechazada` solo `conformidad` (modelo `calificacion_pendiente`). Arregla también el consumo crudo del asistente.
  - `codigo/components/gestiones/tablero.client.tsx`: guarda de Urgente en terminales (`!ETAPAS_TERMINALES.has(gestion.etapa)`); fila de badges con `flex-wrap` y `shrink-0 whitespace-nowrap` unificado en Urgente y Reasignar.
  - `codigo/components/gestiones/detalle.client.tsx`: misma guarda de Urgente en terminales en el header.
- **Verificación:**
  - `tsc --noEmit` exit 0 y eslint limpio sobre los archivos tocados.
  - **E2E en navegador (Playwright, dev local, contra data real):**
    - #68 finalizado·urgente·sin calificar → card muestra **solo "Falta calificar"** (antes "Urgente"+"Falta calificar"). Idem #63, #131.
    - #35 finalizado·urgente·calificada → sin badges (Urgente oculto).
    - #226 finalizado + ampliación `enviada` → **sin "Ampliación"** (ya no se filtra a terminal).
    - #225 Cobro + ampliación `enviada` → sin "Ampliación".
    - #230/#232 en ejecución + ampliación `enviada` → **"Ampliación" sí** (sin regresión STORY-1042).
    - #109 en ejecución·urgente → "Urgente" aparece en tablero y detalle (no se sobre-suprimió).
    - #142 cancelada·urgente → detalle header "Cancelada · Gas · Archivada", **sin "Urgente"**.
  - Criterio del asistente verificado por construcción (mismo `normalizarFila` acotado que el tablero).
- **Deudas documentadas en `tasks/PENDIENTES.md`** (aparte): ampliación zombie al cancelar (fix de datos) y naming inconsistente del mismo badge entre pantallas.
- **Pendiente:** card de Trello para Rami/Giuli.
