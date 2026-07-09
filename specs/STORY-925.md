# STORY-925 — Buscadores en cartera: propietarios, inquilinos y propiedades por cualquier nombre (v1.0)

**Estado:** ✅ done · **Fecha:** 2026-07-09
**Origen:** Fausti — "un buscador en propietarios y en inquilinos, y en propiedades que puedas buscar no solo por nombre de la propiedad sino también por nombre de inquilino o nombre de propietario".

## Objetivo

Encontrar rápido a cualquier persona o propiedad de la cartera sin scrollear: los listados de propietarios e inquilinos ganan buscador, y el de propiedades busca también por quién la ocupa y de quién es.

## Decisión (Regla #0)

Filtrado **client-side** con el patrón existente de STORY-910 (`coincideTexto`, sin tildes, consulta vacía = todo pasa) — las listas ya viajan completas al cliente, no hace falta tocar queries por paginación.

- **Propietarios / Inquilinos** (`personas.client.tsx`): input de búsqueda arriba de la tabla que filtra por **nombre, correo, teléfono y CUIL**.
- **Propiedades** (`propiedades.client.tsx`): la búsqueda existente (solo dirección) pasa a matchear **dirección, nombre del propietario y nombre del inquilino vigente**. Para eso `listarPropiedades` suma `inquilinos(nombre)` al embed de legajos y `Propiedad` expone `inquilino_nombre` (del legajo vigente, null si está libre). La columna Ocupación muestra el nombre del inquilino junto al badge — si buscás por inquilino tenés que ver por qué matchea la fila.
- Estado vacío diferenciado: "Sin resultados para esa búsqueda." vs "Todavía no hay X cargados."

## Alcance
- `features/cartera/types.ts` — `Propiedad.inquilino_nombre: string | null`.
- `features/cartera/service.ts` — `listarPropiedades` embebe `inquilinos(nombre)` y mapea el vigente.
- `components/cartera/propiedades.client.tsx` — búsqueda multi-campo con `coincideTexto` + nombre del inquilino visible en Ocupación.
- `components/cartera/personas.client.tsx` — input de búsqueda + filtro multi-campo.

## Criterios de aceptación
1. En propietarios e inquilinos, tipear parte del nombre, correo, teléfono o CUIL filtra la tabla (sin distinguir tildes/mayúsculas).
2. En propiedades, buscar por nombre del inquilino vigente o del propietario encuentra la propiedad; por dirección sigue funcionando.
3. Una propiedad ocupada muestra el nombre de su inquilino en la columna Ocupación.
4. `tsc` verde, eslint verde, `next build` OK.

## Dev Agent Record
- **Commit:** _(este commit)_
- **Archivos:** `features/cartera/types.ts` (`Propiedad.inquilino_nombre`) · `features/cartera/service.ts` (embed `inquilinos(nombre)` en legajos, mapeo del vigente) · `components/cartera/propiedades.client.tsx` (búsqueda multi-campo con `coincideTexto` + inquilino visible en Ocupación) · `components/cartera/personas.client.tsx` (input de búsqueda + filtro por nombre/correo/teléfono/CUIL + estado vacío diferenciado).
- **Verificación:** `tsc` verde · eslint verde · `next build` OK · embed nuevo probado contra PostgREST real (legajos con `inquilinos(nombre)` devuelve objeto to-one como se mapea).
