# STORY-911 — Home del técnico: filtro por etapa (selector + hoja) + estados de seguimiento separados + paginación (v3.0)

**Estado:** 🚧 en desarrollo · **Fecha:** 2026-07-07

## Cambios v3.0 (segunda devolución de Fausti)
La v2 (secciones por etapa, siempre visibles) no lo convenció por dos motivos: (1) quería un **filtro por etapa** — pero **no** un chip genérico; y (2) los estados que **no** implican actividad del técnico estaban **amontonados** en una sola división "En seguimiento", cuando quiere verlos **separados y filtrables**.
- **Control elegido (sobre mockups):** **selector + hoja (bottom sheet)**. Un campo "Etapa: Todas (N) ⌄" que abre una hoja desde abajo con la lista de etapas + contador + **punto de color** (esmeralda = te toca actuar, gris = en seguimiento). Cero chips.
- **Estados de seguimiento desglosados** en etapas propias y filtrables: **Presupuesto enviado**, **Esperando aprobación**, **En facturación**, **En liquidación** (antes eran un solo "En seguimiento").
- **"Todas"** = todas las secciones (por etapa) apiladas; elegir una etapa = solo esa sección. Paginación "Mostrar más" por sección se mantiene.
**Origen:** Pedido de Fausti tras la carga de prueba. Con **varias gestiones activas**, el home del técnico (`/tecnico` → `MisTrabajos`) se vuelve un caos en el celular. Un primer intento (v1, chips "Todas/Te esperan/Urgentes/En espera" + búsqueda) fue **rechazado**: los chips no eran categorías excluyentes (Urgentes se pisaba con las otras), la estética de las cards no convencía y **no paginaba**. Se revirtió (main volvió a `27789b4`).

## Objetivo

Clasificación **lógica, intuitiva y mutuamente excluyente** de las gestiones del técnico, cards más prolijas y **paginación**, todo mobile-first (390px, una mano, targets ≥44px).

## Decisión (elegida por Fausti sobre mockups)

**Agrupar por etapa del trabajo** (secciones que siguen el funnel del técnico). Cada gestión cae en **una sola** sección. El técnico ve de un vistazo qué tipo de tarea tiene pendiente.

### Grupos (orden por prioridad de acción, se muestran solo los que tienen items)
1. **Por responder** — `asignacion` sin responder (`asignacion_aceptada === null`) → CTA "Responder solicitud".
2. **A presupuestar** — `presupuesto` sin enviar (`!presupuesto_pendiente`) → CTA "Cargar presupuesto".
3. **En obra** — `en_ejecucion` → CTA "Registrar avance".
4. **A corregir** — `conformidad` rechazada → CTA "Resubir conformidad".
5. **En seguimiento** — el resto activo, sin acción del técnico (presupuesto enviado, conformidad esperando aprobación, en facturación, en liquidación). Cards compactas con sub-estado, sin CTA.

- **Urgencia = señal visual, NO categoría:** borde izquierdo ámbar + badge "Urgente" + orden (urgentes primero dentro de cada grupo). Así se elimina el solapamiento que tenía la v1.
- **Sub-estado** en las cards de "En seguimiento": "Presupuesto enviado" / "Esperando aprobación" / "En facturación" / "En liquidación".

## Alcance

### `components/gestiones/mis-trabajos.client.tsx` (reescritura)
- **Encabezado de identidad** intacto (fecha + "Hola, {nombre}" + resumen de accionables — STORY-907).
- **Búsqueda** (una línea, arriba) por dirección / descripción / especialidad (reusa `coincideTexto`). Se aplica a todos los grupos.
- **Secciones por grupo** con título + contador. Cada card:
  - **Accionable:** especialidad + (urgente) + tiempo, descripción, dirección con pin, y **CTA full-width** esmeralda (una acción clara).
  - **En seguimiento:** compacta — descripción + dirección·especialidad + badge de sub-estado + tiempo.
- **Paginación mobile por grupo:** cada sección muestra los primeros **5**; botón **"Mostrar más (N)"** revela +5. Estado local por sección (componente `GrupoTareas`).
- **Empty states:** sin gestiones activas → "Estás al día"; con búsqueda sin resultados → "Nada coincide con la búsqueda".

### Sin cambios en
- `app/tecnico/page.tsx`, servicios, tipos, RLS, detalle y sus CTAs.

## Criterios de aceptación
1. Las gestiones se agrupan por etapa del trabajo; cada una aparece en **una sola** sección con su contador.
2. La urgencia es señal visual (ámbar + orden), no un filtro/sección aparte.
3. Cada sección muestra 5 y **"Mostrar más (N)"** revela el resto (paginación mobile). El estado es por sección.
4. La búsqueda acota todas las secciones; sin resultados → empty state de búsqueda (no el "Estás al día").
5. Cards prolijas y consistentes; CTA claro en las accionables; sub-estado en las de seguimiento. Respeta el design contract (un acento por significado, sin sombras, ≥44px, 390px).
6. `npx tsc --noEmit` verde y sin errores de eslint en el archivo tocado.

## Fuera de alcance (Regla #0)
- Chips de filtro / segmentos (rechazado en v1).
- Filtro por especialidad, persistir estado en URL, paginación numérica (en mobile "Mostrar más" es más natural).
- Cambios en el detalle o la agenda.

## Dev Agent Record
- **Commit (v2, reemplazado):** e265d81 — secciones por etapa sin filtro, seguimiento amontonado. Fausti pidió filtro por etapa (no chip) + seguimiento desglosado.
- **Commit (v3):** 69a5b68 (pusheado a main → auto-deploy)
- **Archivos (v3):**
  - `components/gestiones/mis-trabajos.client.tsx`: etapas del técnico desglosadas en `ETAPAS_TEC` (incluye seguimiento separado: Presupuesto enviado / Esperando aprobación / En facturación / En liquidación + catch-all "Otras"); `SelectorEtapa` (campo "Etapa: X (N)" + hoja bottom-sheet montada con `createPortal` en `document.body` para evitar el containing-block del `.animate-aparecer` raíz); `FilaEtapa` (dot esmeralda/gris + contador); `SeccionEtapa` con paginación "Mostrar más".
  - `app/globals.css`: keyframe `--animate-subir` (slide-up de la hoja).
- **Verificación (navegador real, 390px, sesión técnico `tecnicouno`, carga `[CARGA]` = 36 activas):**
  - Campo "Etapa: Todas (36)" abre la hoja desde abajo con etapas separadas + contador + punto de color (esmeralda = te toca: Por responder/A presupuestar/En obra; gris = seguimiento: Esperando aprobación/En facturación/En liquidación). ✅
  - Elegir "En facturación" cierra la hoja, el campo pasa a "En facturación (6)" y se muestra solo esa sección (6, con "Mostrar más (1)"). Los estados de seguimiento quedaron **separados y filtrables**. ✅
  - Fix del portal: la hoja quedaba fuera del viewport (contenida por el div raíz con transform de animación) → `createPortal` a `document.body` la ancla al viewport. ✅
  - `npx tsc --noEmit` verde; `eslint` del archivo sin errores.
