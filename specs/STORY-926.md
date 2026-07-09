# STORY-926 — Buscador del tablero: también por propietario e inquilino de la gestión (v1.0)

**Estado:** ✅ done · **Fecha:** 2026-07-09
**Origen:** Fausti — "permitir la búsqueda por inquilino o propietario de las gestiones en el buscador del kanban" (continuación natural de STORY-925).

## Objetivo

En el tablero (kanban), tipear el nombre del propietario o del inquilino encuentra sus gestiones, además de los campos actuales (descripción, dirección, especialidad, técnico).

## Decisión (Regla #0)

Extender lo que ya existe, sin queries nuevas:
- `SELECT_RESUMEN` embebe `propietarios(nombre)` dentro de `propiedades` y `legajos(inquilinos(nombre))` vía el FK `legajo_id` (snapshot de la gestión — el inquilino correcto es el del legajo con que se creó, no el ocupante actual).
- `GestionResumen` gana `propietario_nombre: string | null` e `inquilino_nombre: string | null` (null si la gestión nació con la propiedad libre).
- `tablero.client.tsx` suma ambos campos al `coincideTexto` y actualiza el placeholder.
- Para el técnico la RLS puede no dejarle leer propietarios/inquilinos → el embed devuelve null y esos campos simplemente no matchean en su home; no rompe nada.

## Alcance
- `features/gestiones/types.ts` — dos campos en `GestionResumen`.
- `features/gestiones/service.ts` — `SELECT_RESUMEN` + `normalizarFila`.
- `components/gestiones/tablero.client.tsx` — filtro y placeholder.

## Criterios de aceptación
1. En el tablero, buscar por nombre de propietario o de inquilino muestra sus gestiones; los campos anteriores siguen matcheando.
2. Una gestión creada con la propiedad libre no rompe la búsqueda (inquilino null).
3. `tsc` verde, eslint verde, `next build` OK.

## Dev Agent Record
- **Commit:** _(este commit)_
- **Archivos:** `features/gestiones/types.ts` (`propietario_nombre` + `inquilino_nombre` en `GestionResumen`) · `features/gestiones/service.ts` (`SELECT_RESUMEN` con `propietarios(nombre)` y `legajos(inquilinos(nombre))`, mapeo en `normalizarFila`) · `components/gestiones/tablero.client.tsx` (filtro + placeholder).
- **Verificación:** `tsc` verde · eslint verde · `next build` OK · embed probado contra PostgREST real: to-one como objeto y `legajos: null` en gestiones nacidas con la propiedad libre.
