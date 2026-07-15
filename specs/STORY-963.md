# STORY-963 — Un CUIL no puede pertenecer a dos personas distintas entre propietarios e inquilinos

**Estado:** ✅ done · **Origen:** Fausti (2026-07-14, card Trello #85): "Puedo dar de alta un inquilino nuevo usando el mismo CUIL que el de un propietario con otro nombre (ser otra persona y no la misma)."

## Causa raíz

`propietarios` e `inquilinos` son **tablas separadas** y toda la validación de duplicado es **intra-tabla, nunca cruzada** (`shared/utils/duplicados.ts:24-46`: `duplicadoPersona` consulta únicamente `from(tabla)`). Los índices UNIQUE del CUIL también son uno por tabla (`propietarios_cuil_key`, `inquilinos_cuil_key`, ver `specs/STORY-944.md:43,46`). Por eso el mismo CUIL puede existir una vez en cada tabla sin que ningún control lo detecte.

## Decisión (Fausti) — bloqueo inteligente

El CUIL identifica a una persona: **no puede repetirse entre dos personas distintas**. Pero una **misma** persona sí puede ser propietaria de un inmueble e inquilina de otro. Regla:

- Al dar de alta/editar un propietario o un inquilino, además del chequeo intra-tabla actual, **chequear el CUIL en la OTRA tabla**.
- Si el CUIL existe en la otra tabla **con otro nombre** → **bloquear** (es otra persona; error claro nombrando a quién pertenece).
- Si existe en la otra tabla **con el mismo nombre** → **permitir** (es la misma persona en su otro rol).

Comparación de "misma persona" por **nombre normalizado** (trim + minúsculas + colapsar espacios). Simple y suficiente para el caso real; no se crea tabla `personas` unificada (Regla #0 — sería un refactor grande para un chequeo puntual).

## Implementación

- **`codigo/shared/utils/duplicados.ts`** — nueva función `cuilCruzadoOtraPersona(supabase, tablaActual, cuil, nombre, excluirId?)`:
  - `otraTabla = tablaActual === "propietarios" ? "inquilinos" : "propietarios"` (solo aplica entre propietarios/inquilinos; técnicos quedan fuera).
  - Busca en `otraTabla` un registro con ese `cuil` (`select("nombre").eq("cuil", cuil).limit(1)`).
  - Si existe y el nombre normalizado **difiere** del nombre entrante → devuelve mensaje: `"Ese CUIL ya pertenece a {nombre existente} (registrado como {propietario|inquilino}). Un CUIL no puede ser de dos personas distintas."`. Si coincide o no existe → `null`.
- **`codigo/features/cartera/service.ts`**
  - `guardarPersona` (:63): tras el `duplicadoPersona` existente, si `tipo ∈ {propietarios, inquilinos}` llamar `cuilCruzadoOtraPersona` con el nombre del form y `excluirId` (edición). Devolver el error si lo hay.
  - `resolverPersona` (:203): mismo chequeo cruzado en el alta desde wizard/legajo/cambio de propietario.

Sin migración: el índice UNIQUE cruzado a nivel DB requeriría unificar tablas; el bloqueo inteligente (mismo-CUIL-otra-persona) tampoco se puede expresar como constraint simple. La garantía queda en el chequeo server-side (consistente con cómo ya funciona `duplicadoPersona`, cuyo respaldo DB es solo intra-tabla). La ventana de carrera es despreciable para este flujo manual.

## Criterios de aceptación

1. Alta de inquilino con un CUIL que ya tiene un **propietario de otro nombre** → bloqueada con mensaje que nombra al propietario existente. (Y viceversa: propietario con CUIL de inquilino de otro nombre.)
2. Alta de inquilino con un CUIL que ya tiene un propietario **del mismo nombre** (misma persona en ambos roles) → permitida.
3. Editar un propietario/inquilino sin cambiar su CUIL no se bloquea a sí mismo (`excluirId`).
4. El caso intra-tabla (dos propietarios con el mismo CUIL) sigue bloqueado como hoy.
5. `tsc` + `eslint` verdes.

## Dev Agent Record

- **Archivos:** `codigo/shared/utils/duplicados.ts` (`cuilCruzadoOtraPersona`), `codigo/features/cartera/service.ts` (import + `guardarPersona`, `resolverPersona`).
- **Verificación:** `tsc --noEmit` + `eslint` verdes. E2E local (2026-07-14): alta de inquilino con el CUIL de Rodolfo Aguirre (propietario) y otro nombre → bloqueado con el mensaje esperado; mismo alta con el nombre "Rodolfo Aguirre" → permitido.
- **Commit:** `226e167` (junto con STORY-962/964). Card Trello #85 movida a "En prueba".
