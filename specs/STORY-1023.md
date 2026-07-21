# STORY-1023 — Cards del técnico consistentes con las del gestor: la ubicación es el título (v1.0)

**Estado:** ✅ hecha · **Origen:** pedido directo de Fausti (2026-07-21): "hacer que las cards del técnico sean consistentes con las de gestión (el título debería ser la ubicación)".

## Problema

La card del tablero del gestor titula con la **dirección** de la propiedad (`tablero.client.tsx:90-93`) y pone la descripción como línea secundaria. La card del técnico en "Mis trabajos" hace exactamente lo inverso: titula con la **descripción** y relega la dirección a línea chica con pin, en sus dos variantes — `TarjetaAccion` (`mis-trabajos.client.tsx:93-97`) y `TarjetaSeguimiento` (`:117-125`). Mismo dato, jerarquía opuesta: el técnico piensa en "a dónde voy" y el sistema le grita "qué pasó".

Ambas vistas ya comparten query (`tableroGestiones()` → `SELECT_RESUMEN`): `direccion` y `descripcion` viajan en las dos. Es un swap puramente presentacional.

## Alcance

1. **`TarjetaAccion`**: título destacado = `direccion` (con pin y `truncate`); línea secundaria = `descripcion` (`line-clamp` para no estirar la card).
2. **`TarjetaSeguimiento`**: ídem — título = `direccion`, secundaria = `descripcion`. La `especialidad` (hoy pegada a la dirección en la secundaria) queda como badge/texto donde ya está en la variante de acción, sin duplicarla en la línea de descripción.
3. Un solo archivo: `codigo/components/gestiones/mis-trabajos.client.tsx`. Sin cambios en service/types/queries.

## Fuera de alcance

- Tocar el detalle de gestión (h1 = descripción): es la misma vista para gestor y técnico, y ahí la card "Propiedad" ya muestra la dirección con link a Maps.
- Traer `unidad`/`tipo` de la propiedad a la lista (hoy solo están en el detalle): la dirección sola ya iguala a la card del gestor. Si hiciera falta, es otra story.

## Criterios de aceptación

1. Como técnico, en "Mis trabajos" toda card (acción y seguimiento) titula con la dirección de la propiedad, igual que la card del tablero del gestor.
2. La descripción sigue visible como línea secundaria en ambas variantes.
3. Especialidad, urgencia, nº de gestión, antigüedad y CTA quedan donde estaban.
4. La búsqueda del técnico sigue encontrando por dirección y por descripción (los `CAMPOS_BUSQUEDA` no cambian).
5. Regresión: tablero del gestor intacto; `tsc` + eslint verdes.

## Dev Agent Record

- **Commit:** _pendiente de OK_.
- **Archivos:** `codigo/components/gestiones/mis-trabajos.client.tsx` (único): `TarjetaAccion` — título = dirección con pin + `truncate`, descripción secundaria con `line-clamp-2`; `TarjetaSeguimiento` — título = dirección con pin, secundaria = `descripcion · especialidad` con `truncate`.
- **Verificación:** `tsc --noEmit`, eslint y `next build` verdes. E2E navegador como tecnicouno, **viewport mobile 390×844**: cards de acción ("Por responder"/"A corregir") titulan con la dirección (Caseros 10, Ituzaingó 1435) y muestran la descripción abajo; cards de seguimiento (En cobro/En liquidación) ídem con `descripción · especialidad` truncada. Badges, #numero, antigüedad y CTA en su lugar; búsqueda intacta (mismos campos).
