# STORY-960 — CUIL obligatorio al cargar propietario e inquilino

**Estado:** ✅ done · **Origen:** Fausti (2026-07-13, card Trello #81): "Al cargar un inquilino el campo de CUIL no es obligatorio cuando debería serlo". Decisión de alcance (Fausti): obligatorio **para inquilino Y propietario** (no solo inquilino).

## Contexto

STORY-923 unificó el documento en `cuil` y lo dejó **opcional, validado solo si se completa** para propietario/inquilino (el técnico sí lo tenía obligatorio). El alta/edición de propietario e inquilino comparten las mismas piezas (`CamposPersona`, `validarPersona`, `resolverPersona`, `guardarPersona`), así que el cambio es único y cubre a ambos de una. El técnico va por otro camino (`features/tecnicos/service.ts`) y ya lo exige — no se toca.

## Alcance

- El CUIL/CUIT pasa a **obligatorio** en el alta y en la edición de propietarios e inquilinos, en cliente **y** servidor (el server es la garantía real; el cliente es UX).
- Se reutiliza `errorCuil` de `shared/utils/cuil.ts`, que ya devuelve "Ingresá el CUIL/CUIT en números." cuando viene vacío — alcanza con llamarlo siempre (sin el guard ternario) para validar presencia + formato.
- **Sin migración**: la columna `cuil` sigue nullable en DB (hay propietarios/inquilinos legacy con `cuil IS NULL`; un `SET NOT NULL` fallaría). Mismo criterio que el teléfono obligatorio de STORY-924: se hace cumplir en el código, no con constraint. Consecuencia asumida: editar un legacy sin CUIL ahora exige completarlo para poder guardar (deseado).

## Implementación

- **`codigo/components/cartera/persona-campos.client.tsx`**
  - `CamposPersona`: el `<Input>` del CUIL pasa a `required` y el placeholder deja de decir "opcional".
  - `validarPersona`: se quita el guard ternario — `errorCuil(nueva.cuil, "CUIL/CUIT")` se llama siempre (cubre inquilino vía `legajos.client.tsx` y propietario vía `propietario.client.tsx`).
  - `FormEditarPersona`: no pasa por `validarPersona`, así que se valida el CUIL con `errorCuil` en el `onSubmit` antes de llamar a `guardarPersona` (edición de propietario/inquilino desde la propiedad).
- **`codigo/features/cartera/service.ts`**
  - `guardarPersona` (edición): CUIL obligatorio — `errorCuil(datos.documento, "CUIL/CUIT")` sin el ternario.
  - `resolverPersona` (alta al abrir legajo del inquilino y alta de propietario del wizard): CUIL obligatorio — `errorCuil(ref.nueva.cuil, "CUIL/CUIT")` sin el ternario.

## Criterios de aceptación

1. Cargar un inquilino nuevo (abrir legajo) sin CUIL → error, no se guarda. Con CUIL válido → guarda.
2. Cargar un propietario nuevo (wizard de administración) sin CUIL → error, no se guarda.
3. Editar propietario o inquilino y dejar el CUIL vacío → no permite guardar (client + server).
4. CUIL con formato inválido (≠11 dígitos o verificador incorrecto) → el mensaje de `errorCuil` de siempre.
5. `tsc` + `eslint` verdes.

## Dev Agent Record

- **Archivos:** `codigo/components/cartera/persona-campos.client.tsx`, `codigo/features/cartera/service.ts`.
- **Verificación:** `tsc --noEmit` + `eslint` verdes. E2E pendiente (probar alta/edición de propietario e inquilino sin CUIL → error; con CUIL válido → guarda) al pullear.
- **Commit:** _(pendiente — sin pushear todavía; falta el push de la otra rama de Fausti)_.
