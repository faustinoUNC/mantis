# STORY-999 — Tipo de inmueble: Duplex, uso en el detalle y unidad/piso opcional (v1.0)

**Estado:** ✅ done · **Origen:** Fausti (UX): en el commit de Giuliano que tipó el campo "Tipo" como select (`d7ab4d3`) faltó **Duplex**. Además el tipo no se usa en ningún lado visible más allá de la cartera — debería verse, p. ej. en la card de la propiedad del detalle de gestión. De paso, ahí la **dirección se corta** (truncate). Y hace falta **un único input opcional** para sub-descripción de ubicación (piso y depto, número de casa en un complejo, etc.) — uno solo para todos los casos, para no complejizar.

## Alcance

1. **Duplex** (`features/cartera/types.ts`): se suma `"Duplex"` a `TIPOS_INMUEBLE` (queda Departamento, Casa, PH, Duplex, Local, Oficina, Cochera). El select del alta y la validación server-side lo toman solos.

2. **Campo `unidad` (nueva columna)**: migración `alter table propiedades add column unidad text` (nullable, sin CHECK — texto libre, igual que `direccion`). Es el **único** input extra: cubre piso+depto, casa/lote en complejo, número de local, etc.
   - Alta de administración (`components/cartera/alta-administracion.client.tsx`): un `Input` opcional **"Piso / unidad"** debajo del select Tipo, placeholder con ejemplos. Se manda en `crearAdministracion`.
   - `crearAdministracion` (`features/cartera/service.ts`): acepta `unidad`, la inserta con `trim() || null`.

3. **Darle uso al tipo (+ unidad) en el detalle de gestión** (`components/gestiones/detalle.client.tsx`): la card de datos suma, bajo la dirección de la propiedad, una línea secundaria apagada con `tipo · unidad` (lo que exista; si no hay ninguno, no se muestra la línea). `GestionDetalle` gana `propiedad_tipo` y `propiedad_unidad`; `SELECT_DETALLE` agrega `tipo, unidad` al embed `propiedades(...)`; `obtenerGestion` los mapea.

4. **Dirección cortada**: la dirección de la propiedad en esa card dejaba de verse por doble `truncate` (el wrapper `Dato` y el `<span>`). Se saca del componente `Dato` genérico y se arma un bloque propio que **envuelve** (`break-words`) en vez de cortar, con el ícono de pin alineado arriba.

5. **Mostrar `unidad` donde ya se muestra el tipo**:
   - Detalle de propiedad (`app/cartera/propiedades/[id]/page.tsx`): la línea de tipo pasa a `tipo · unidad`.
   - Listado de propiedades (`components/cartera/propiedades.client.tsx`): la unidad va como sub-línea apagada bajo la dirección.
   - `Propiedad` (type) gana `unidad: string | null`; `listarPropiedades` y `obtenerPropiedad` seleccionan y mapean `unidad`.

## Fuera de alcance

- **No** se agrega edición de propiedad existente (dirección/tipo/unidad hoy son read-only en el detalle de propiedad); `unidad` se setea en el alta. Las propiedades ya cargadas quedan con `unidad` null hasta que se re-den de alta o se agregue edición (pendiente aparte si hace falta).
- **No** se condiciona el input por tipo (siempre visible, opcional) — un solo input para todos los casos, REGLA #0.
- Sin CHECK constraint ni migración de datos en `tipo`/`unidad` (siguen texto libre en DB).

## Criterios de aceptación

1. En el alta, el select Tipo ofrece **Duplex** entre las opciones.
2. En el alta hay un input opcional "Piso / unidad"; lo cargado se guarda y se ve luego en el detalle de la propiedad y en el detalle de la gestión.
3. En el detalle de una gestión, la card de datos muestra la dirección **completa** (envuelta, sin cortar) y debajo `tipo · unidad` cuando existen.
4. El listado de propiedades muestra la unidad bajo la dirección; el detalle de propiedad muestra `tipo · unidad`.
5. `tsc`/eslint verdes.

## Dev Agent Record

- **Commit:** `1a0a7a8` (pusheado a main 2026-07-18).
- **Archivos:** `codigo/features/cartera/types.ts`, `codigo/features/cartera/service.ts`, `codigo/components/cartera/alta-administracion.client.tsx`, `codigo/components/cartera/propiedades.client.tsx`, `codigo/app/cartera/propiedades/[id]/page.tsx`, `codigo/features/gestiones/types.ts`, `codigo/features/gestiones/service.ts`, `codigo/components/gestiones/detalle.client.tsx` + migración `propiedades_unidad`.
- **Verificación:** `tsc`/eslint verdes. E2E en el navegador (Admin): alta con Duplex + "Piso 7, Depto B" → resumen "Duplex · Piso 7, Depto B" → detalle de propiedad idem. Detalle de gestión (Caseros 10) muestra la dirección en dos líneas (envuelta, sin cortar) + "Depto · Piso 2, Depto A". Datos de prueba limpiados.
