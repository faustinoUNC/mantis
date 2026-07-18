# STORY-988 — Registro de técnico: overflow horizontal al adjuntar documentos (v1.0)

**Estado:** ✅ done · **Origen:** Fausti, card Trello #109. En la página de registro del técnico hay scroll horizontal molesto y, cuando aparece, el botón verde "Enviar solicitud" y el botón "×" de eliminar documentos adjuntos quedan fuera de vista (hay que scrollear a la derecha).

## Diagnóstico (reproducido en el navegador a 360px)

El form vacío no desborda. El overflow aparece **al adjuntar un documento con nombre largo**: medido a 360px, el `scrollWidth` salta a 631px (271px de más). Culpable: el `<div>` raíz de `InputArchivo` (`components/ui/input-archivo.client.tsx`) es un item del grid de documentos (`grid gap-4 sm:grid-cols-2`) y, como todo item de grid/flex, tiene `min-width: auto`. El `truncate min-w-0` del nombre de archivo nunca se activa porque ningún ancestro está restringido en ancho → el nombre largo estira el item, el grid y el `<body>`. Con el body más ancho que el viewport, el botón "×" (a la derecha de la fila) y el botón "Enviar solicitud" quedan cortados.

## Fix (Regla #0 — una clase)

- `components/ui/input-archivo.client.tsx`: el `<div>` raíz pasa de `flex flex-col gap-1.5` a `flex flex-col gap-1.5 **min-w-0**`. Con el item de grid en `min-width: 0`, el track se ajusta al contenedor y el `truncate` del nombre de archivo funciona → sin desborde. Beneficia todas las filas (DNI single + Matrícula múltiple) y no afecta los otros usos de `InputArchivo` (liquidación, alta manual).

## Fuera de alcance

- El resto del form (grilla de especialidades, inputs) ya es responsive a 360px — no se toca.

## Criterios de aceptación

1. A 360px, con uno o varios documentos adjuntos de nombre largo, NO hay scroll horizontal (`scrollWidth == clientWidth`).
2. El botón "×" de eliminar cada documento y el botón "Enviar solicitud" quedan siempre visibles sin scrollear a la derecha.
3. Los nombres de archivo largos se truncan con "…" en vez de estirar la fila.
4. `tsc`/eslint verdes; el alta manual y el adjunto de liquidación (STORY-986) siguen andando.

## Dev Agent Record

- **Commit:** _(pendiente de push)_
- **Archivos:** `codigo/components/ui/input-archivo.client.tsx` (`min-w-0` en el `<div>` raíz).
- **Verificación:** `tsc`/eslint verdes. E2E a 360px (Playwright): con un documento adjunto de nombre largo el `scrollWidth` bajó de 631px (271px de overflow) a 360px (0 overflow); el nombre se trunca con "…" y el "×" + "Enviar solicitud" quedan visibles.
