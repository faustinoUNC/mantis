# STORY-962 — La gestión no ofrece ni muestra al inquilino cuando su legajo ya está cerrado

**Estado:** 📝 aprobada · **Origen:** Fausti (2026-07-14, card Trello #86): "Puedo mandar un mail de confirmación de presupuesto a un inquilino que ya no habita la vivienda. Desde Administraciones la vivienda figura solo con propietario (sin inquilino), pero al esperar la aprobación del presupuesto aparece la opción de mandar el mail al inquilino que ya no está; además la info de la gestión muestra que el inquilino todavía habita cuando el legajo dice que no — inconsistencia."

## Causa raíz

La vigencia del inquilino se representa **solo** con `legajos.fecha_fin` (`NULL` = habita; con fecha = cerrado). La **cartera** filtra por `fecha_fin IS NULL` (`features/cartera/service.ts:160`) → muestra "solo propietario". Pero la **gestión** resuelve el inquilino haciendo join por el `legajo_id` **congelado** al crearse (`features/gestiones/service.ts:181-194`) **sin revalidar `fecha_fin`**: trae, muestra y permite mailear al inquilino aunque su legajo esté cerrado. De ahí la inconsistencia legajo (sin inquilino) vs gestión (con inquilino).

La guarda `cerrarLegajo` (`cartera/service.ts:399-405`) impide cerrar un legajo con gestiones no terminales, pero el hueco sigue existiendo para gestiones ya finalizadas/canceladas, gestiones que volvieron de etapa ("← Volver a Asignación", `detalle.client.tsx:656`) y datos previos a esa guarda.

## Decisión (Fausti)

**Legajo cerrado (`fecha_fin` ≠ null) → la gestión lo trata como "sin inquilino, solo propietario"**, exactamente igual que la cartera. Un legajo cerrado deja de ofrecerse como pagador/destinatario y deja de mostrarse como contacto vigente. Fuente de verdad única de la vigencia: `legajos.fecha_fin IS NULL`. (Regla #0: se reusa el criterio que ya usa la cartera, sin campos ni estados nuevos.)

## Implementación

Se agrega `fecha_fin` al embed del legajo y, en cada punto de resolución, el inquilino solo cuenta si `legajo.fecha_fin == null`. No se filtra la fila en la query (eso borraría la gestión); se filtra el **uso del inquilino**.

- **`codigo/features/gestiones/service.ts`**
  - `SELECT_RESUMEN` (:66) y `SELECT_DETALLE` (:71): el embed pasa de `legajos(inquilinos(...))` a `legajos(fecha_fin, inquilinos(...))`.
  - `normalizarFila` (:56): `inquilino_nombre` = `legajo?.fecha_fin == null ? legajo.inquilinos?.nombre : null`.
  - `resolverContacto` (:74-91): si `legajo?.fecha_fin != null`, ignorar el inquilino y devolver el propietario.
- **`codigo/features/finanzas/service.ts`**
  - `datosDocumento` (:119-131): al resolver nombre/email del inquilino por `legajo_id`, traer `fecha_fin` y tratar el legajo cerrado como sin inquilino (usar el propietario).
  - `errorPagador` (:218): además de `!g?.legajo_id`, rechazar `pagador === "inquilino"` si el legajo está cerrado (`fecha_fin` ≠ null) — mensaje claro ("El inquilino ya no habita la vivienda; el pagador debe ser el propietario.").
- **`codigo/features/gestiones/service.ts`** `resolverPresupuesto` (:776-781): misma guarda — `pagador === "inquilino"` exige legajo **vigente**, no solo existente.

Sin migración (campo ya existe). El selector de pagador en `detalle.client.tsx:618,758` ya depende de `gestion.inquilino_nombre`, así que al quedar `null` la opción "Inquilino" desaparece sola.

## Criterios de aceptación

1. Con el legajo del inquilino cerrado, la gestión muestra el contacto del **propietario** (no del inquilino) y ya no aparece "Inquilino" como bloque de contacto vigente.
2. En la aprobación/envío del presupuesto, con legajo cerrado **no** se ofrece "Inquilino" como pagador/destinatario del mail.
3. Aunque una pestaña vieja intente `pagador === "inquilino"` con legajo cerrado, el server lo rechaza con mensaje claro (no se envía el mail al inquilino que se fue).
4. Legajo vigente (`fecha_fin` null): todo sigue funcionando igual que hoy (inquilino como contacto y pagador posible).
5. `tsc` + `eslint` verdes.

## Dev Agent Record

- **Archivos:** `codigo/features/gestiones/service.ts` (`SELECT_RESUMEN`, `SELECT_DETALLE`, `normalizarFila`, `resolverContacto`, `resolverPresupuesto`), `codigo/features/finanzas/service.ts` (`datosDocumento`, `errorPagador`).
- **Verificación:** `tsc --noEmit` + `eslint` verdes. E2E pendiente de Fausti (cerrar el legajo de un inquilino con una gestión suya no-terminal / volver de etapa: confirmar que la gestión pasa a mostrar el propietario y que "Inquilino" desaparece como pagador/destinatario del presupuesto).
- **Commit:** _(pendiente — sin commitear; aplicar fetch + pull --rebase antes de pushear)_
