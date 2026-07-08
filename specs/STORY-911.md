# STORY-911 — Home del técnico: agrupación por etapa del trabajo + paginación + cards mobile (v2.0)

**Estado:** 🚧 en desarrollo · **Fecha:** 2026-07-07
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
- **Commit:** e265d81 (pusheado a main → auto-deploy)
- **Archivos:** `components/gestiones/mis-trabajos.client.tsx` (reescritura: grupos mutuamente excluyentes por etapa; `GrupoTareas` con paginación "Mostrar más" por sección; `TarjetaAccion` / `TarjetaSeguimiento`; `subEstado()`; búsqueda con `coincideTexto`). Sin cambios de datos/servicio.
- **Verificación (navegador real, 390px, sesión técnico `tecnicouno`, carga `[CARGA]` = 37 gestiones activas):**
  - 4 grupos por etapa: Por responder 7 · A presupuestar 5 · En obra 6 · En seguimiento 19 (suman 37). Cada gestión en **un solo** grupo. "A corregir" no aparece (no hay conformidad rechazada) — se muestran solo los grupos con items. ✅
  - Paginación por sección: 5 iniciales + "Mostrar más (N)" → +5 (probado 5→10→15 en "En seguimiento"). ✅
  - Búsqueda ("ventana") acota todos los grupos; los sin match desaparecen; sin resultados → empty state de búsqueda. ✅
  - Urgencia como señal visual (borde ámbar + orden urgentes-primero); sub-estado de seguimiento en badge **neutro** (se corrigió doble-acento ámbar). ✅
  - `npx tsc --noEmit` verde; `eslint` del archivo sin errores.
