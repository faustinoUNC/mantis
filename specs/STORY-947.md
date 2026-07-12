# STORY-947 — El teléfono de propietarios e inquilinos deja de ser opcional (v1.0)

**Estado:** ✅ done · **Origen:** Giuliano: *"Cargar el teléfono para los clientes no debe ser opcional, arregla eso"*.

## Alcance

- **"Clientes" = propietarios e inquilinos** (cartera), no técnicos — mismo criterio de lenguaje de dominio que STORY-944 (que ya distinguía "técnico" de "clientes" explícitamente en el pedido original). El teléfono de técnicos sigue opcional; no se tocó.
- Aplica a las 3 rutas de alta/edición de propietario/inquilino, todas centralizadas en `components/cartera/persona-campos.client.tsx` y `features/cartera/service.ts`:
  1. Wizard de alta de administración (`crearAdministracion` → `resolverPersona`).
  2. Cambiar propietario desde la propiedad (`cambiarPropietario` → `resolverPersona`).
  3. Abrir legajo / alta de inquilino (`abrirLegajo` → `resolverPersona`).
  4. Edición inline de una persona ya cargada (`FormEditarPersona` → `guardarPersona`).

## Fix

- **`components/cartera/persona-campos.client.tsx`**:
  - `CamposPersona`: el Input de teléfono ahora tiene `required` (antes sin atributo, placeholder decía "Opcional, solo números" → ahora "Solo números").
  - `validarPersona()`: agrega teléfono al chequeo de campos obligatorios para modo "nuevo" (ya validaba nombre + email); mensaje actualizado a "Completá nombre, email y teléfono del {quien}."
- **`features/cartera/service.ts`**:
  - `guardarPersona()`: valida `normalizarTelefono(datos.telefono)` no vacío ANTES del insert/update — cubre tanto el alta directa como la edición inline, y no se puede bypassear enviando solo espacios o caracteres no numéricos (se valida el resultado normalizado, no el string crudo).
  - `resolverPersona()` (compartida por las 3 rutas de alta): mismo chequeo sobre el teléfono normalizado.
- **Sin migración de DB**: no se agregó `NOT NULL` en las columnas `telefono` de `propietarios`/`inquilinos`. A diferencia de STORY-944 (unicidad, que necesita el índice UNIQUE para cerrar la ventana de carrera entre altas concurrentes), acá no hay condición de carrera que un chequeo de app no cubra — cada insert/update pasa por `guardarPersona`/`resolverPersona`, únicos puntos de escritura. Un `NOT NULL` retroactivo además hubiera exigido backfillear los teléfonos de personas ya cargadas sin ese dato, que no fue parte del pedido (Regla #0 — no complejizar lo que no hace falta).

## Criterios de aceptación

1. Los 3 formularios de alta de propietario/inquilino no dejan enviar sin teléfono (bloqueo nativo del navegador vía `required` + mensaje de `validarPersona` antes del submit).
2. La edición inline de una persona existente tampoco permite guardar con el teléfono vacío.
3. Aunque alguien bypasee el cliente (curl directo al server action), `guardarPersona`/`resolverPersona` rechazan la escritura sin teléfono con "El teléfono es obligatorio."
4. Pegar solo caracteres no numéricos en el campo (ej. "abc") también se rechaza — se valida el teléfono ya normalizado (solo dígitos), no el string crudo.
5. Personas ya cargadas antes de este cambio sin teléfono no se ven afectadas retroactivamente (sin migración, sin backfill forzado); simplemente no van a poder volver a guardarse sin completar el dato si se editan.
6. El teléfono de técnicos sigue siendo opcional (fuera de alcance).
7. `tsc`/eslint verdes.

## Dev Agent Record

- **Archivos:** `codigo/components/cartera/persona-campos.client.tsx` (`CamposPersona`, `validarPersona`), `codigo/features/cartera/service.ts` (`guardarPersona`, `resolverPersona`).
- **Verificación:** `tsc --noEmit` y `eslint` limpios.
