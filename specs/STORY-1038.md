# STORY-1038 — Ampliación de presupuesto con pagador propio en obras compartidas (v1.0)

**Estado:** 🔨 en prueba · **Origen:** pedido de Fausti (2026-07-22) — "cuando el técnico pide una ampliación en una gestión de pago compartido, habría que determinar de nuevo quién la paga (una parte o ambas) reutilizando la lógica existente, y cuidar cómo incide en todo lo demás". Segundo punto del mismo reporte: el recuadro del adelanto de materiales mostraba solo el presupuesto original, sin sumar la ampliación aprobada (bug del texto de referencia).

## Problema

1. **Ampliación en obra compartida (STORY-1031/1017):** hoy el aviso de ampliación va a los DOS pagadores con el mismo cuerpo y, al cobrar, esa plata extra se reparte por el **mismo % global** de la obra. No se puede decir "esta ampliación la paga solo el propietario" (caso real: un arreglo extra que le corresponde a una sola de las partes).
2. **Adelanto de materiales (STORY-1018):** el texto de referencia "El técnico presupuestó $X en materiales" mostraba solo el presupuesto original aprobado, ignorando las ampliaciones ya autorizadas — aunque el techo del aviso ámbar (`topeAdelanto`) sí las sumaba. Confundía al que carga el adelanto.

## Decisión de diseño

**Solo aplica a obras compartidas** (decisión de Fausti): en pagador único la ampliación la paga esa misma parte, sin cambios. La ampliación gana su **propio pagador** (`inquilino` | `propietario` | `compartido` + %), reusando el modelo de la 1031. **El gestor lo elige al enviar la ampliación** (el técnico nunca ve plata del cliente — mismo criterio que el pagador del Presupuesto, STORY-943), y **hereda el pagador/% de la obra por default** (un clic si no cambia nada). Se ancla al enviar (espejo de `enviada_pagador_en`).

- **DB:** `ampliaciones` gana `pagador pagador_gestion NULL` + `pagador_pct_inquilino int NULL` (1–99, solo con `pagador='compartido'`). `NULL` = hereda el de la obra (ampliaciones viejas y las de obra no compartida).
- **Reparto del cobro — helper único** (`repartoCompartido`, módulo puro): el cobro compartido deja de ser un % plano del total. Cada ampliación aprobada con pagador propio se imputa a su pagador por su **monto autorizado**; el resto del total (`costo_final + cargo_admin − Σ ampliaciones propias`) se reparte por el % de la obra. Fórmula:
  > `montoInquilino = round(base × pctObra) + Σ(porción inquilino de cada ampliación según su pagador)`, `montoPropietario = total − montoInquilino`.
  Las ampliaciones que heredaron el pagador de la obra (mismo %) no hace falta apartarlas — dan idéntico dentro de la base. **Corner** (`base < 0`: el técnico rindió menos que solo las ampliaciones propias — extremo, casi imposible): se cae al reparto plano por % global para no romper, documentado.
- **El helper reemplaza los 5 cálculos de reparto hoy dispersos** (regla del PRD: nada de derivar en componentes): nota/PDF (`datosDocumento.split`), cuánto cobra cada parte (`registrarCobro`), la vista de la card de facturación, el bloque `CobroPorPartes` (STORY-1036) y `parteObra` del historial de cartera.
- **Email de la ampliación:** si la ampliación la paga una sola parte → va solo a esa parte con su monto; si es compartida → va a las dos con el reparto (mismo patrón que la nota por parte de la 1036). El gate `enviada_pagador_en` no cambia.
- **Adelanto (fix del texto):** "El técnico presupuestó $X en materiales + $Y de ampliación autorizada = $Z" cuando hay ampliación aprobada del técnico actual (el cálculo del tope ya existía; solo el texto quedaba corto).

## Fuera de alcance

- Re-elegir pagador de la ampliación en obras de pagador único (queda heredado).
- Cobrar la ampliación como un acto separado del cobro de la obra (sigue siendo parte del total, repartido).
- Tocar cómo el técnico solicita la ampliación (monto + motivo, sin cambios) ni el techo del adelanto (ya sumaba la ampliación).

## Criterios de aceptación

1. En una obra compartida, al enviar una ampliación el gestor ve un selector de pagador que **arranca con el de la obra** (ej. Compartido 20/80) y puede cambiarlo a inquilino, propietario o compartido con otro %. En obra de pagador único no aparece (hereda).
2. El email de la ampliación va a la(s) parte(s) correcta(s): una sola si la paga una parte (con su monto), las dos con reparto si es compartida.
3. Al cobrar, el monto de cada parte refleja el pagador de cada ampliación: una ampliación 100% del propietario se le suma entera al propietario, no se reparte por el % de la obra. La suma de las partes da exacto el total. Vale para el reparto de la nota/PDF, la card de facturación, el cobro por partes (STORY-1036) y el historial de la propiedad.
4. El recuadro del adelanto muestra el presupuesto de materiales + las ampliaciones autorizadas del técnico ("$X + $Y de ampliación = $Z"); sin ampliación, el texto queda igual que antes.
5. Regresión: obra compartida SIN ampliaciones de pagador propio (todas heredadas) → reparto idéntico a la STORY-1036; obra de pagador único → todo igual que hoy; ampliaciones viejas (`pagador` null) heredan sin romper. `tsc`/eslint verdes.

## Dev Agent Record

- **Commit:** `2915712` (2026-07-22).
- **Implementación (2026-07-22):** 8 archivos + 1 migración.
  - **DB:** migración `story_1038_ampliacion_pagador` — `ampliaciones` gana `pagador pagador_gestion NULL` + `pagador_pct_inquilino int NULL` (check 1–99).
  - `features/finanzas/consultas-types.ts`: **helper único `repartoCompartido(total, pctObra, ampliaciones)`** (+ tipo `AmpliacionReparto`) — imputa cada ampliación de pagador propio a su pagador y reparte la base por el % de obra; corner `base<0` → reparto plano.
  - `features/finanzas/service.ts`: `enviarAmpliacionEmail` recibe `pagadorAmpliacion` (solo obra compartida; hereda si no), ancla `pagador`/`pct` en la fila y manda el aviso a la(s) parte(s) correcta(s) con su monto; helper `ampliacionesRepartoDeGestion` (aprobadas del técnico actual con pagador propio); `datosDocumento` (split de la NOTA) y `registrarCobro` (monto por parte) usan `repartoCompartido`. `tecnico_id` agregado a las dos queries.
  - `features/gestiones/types.ts`: `Ampliacion` gana `pagador` + `pagador_pct_inquilino`; `features/gestiones/service.ts`: la query de `obtenerGestion` los trae.
  - `components/gestiones/detalle.client.tsx` (`AmpliacionGestor`): selector "¿Quién paga esta ampliación?" (solo obra compartida, default heredado) + input % → `enviarAmpliacionEmail`.
  - `components/gestiones/finanzas.client.tsx`: `ampliacionesReparto(gestion)` + `repartoCompartido` en `CobroPorPartes` y en la vista del reparto de la card; **fix del adelanto** — el texto suma la ampliación autorizada ("$X + $Y de ampliación = $Z").
  - `features/cartera/historial.ts` (`parteObra`) + `features/cartera/service.ts`: el reparto del historial de la propiedad considera las ampliaciones con pagador propio (query de aprobadas por obra compartida).
- **Verificación (2026-07-22, `tsc`+eslint verdes, E2E navegador como admin):**
  - Reparto del cobro (#93, compartida 40/60, total $384.000, ampliación aprobada de $100.000 pagador=propietario): Cobro del inquilino $113.600 (40% de la base $284.000) y del propietario $270.400 — la ampliación entera al propietario, suma exacta $384.000 ✓ (sin el fix daría 153.600/230.400).
  - Selector + email (#119, compartida 30/70): default "Compartido / 20%" heredado; elegir "Solo el propietario" oculta el % y envía UN email a la propietaria; persistió `pagador='propietario'` ✓.
  - Fix adelanto (#218, ampliación aprobada $15.000): "El técnico presupuestó $10.000 en materiales + $15.000 de ampliación autorizada = $25.000." ✓
  - Datos de prueba sembrados y luego borrados.
