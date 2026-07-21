# STORY-1028 — El botón de expandir el panel lateral no desaparece en pantallas bajas (v1.0)

**Estado:** ✅ implementada y verificada E2E (commit pendiente) · **Origen:** card Trello #151 "No puedo volver a poner el panel lateral como antes. El botón para ampliarlo desapareció" (tester, 2026-07-21). Screenshot: ventana de 656 px de alto, sidebar colapsado a rail de íconos, sin chevron visible → el usuario queda atrapado en el rail.

## Problema

El rail colapsado (STORY-989 v1.1) usa `overflow-visible` en el `<nav>` para que los tooltips que asoman a la derecha no se recorten. Pero con overflow visible el `min-height:auto` del flex item resuelve a min-content: el nav **no puede encogerse** y, cuando los ítems no entran en el alto de la ventana (el staff de admin tiene 10 ítems × 44 px + campana + pie ≈ 740 px), empuja el pie y el botón de colapsar/expandir fuera del `aside` (`h-svh`) — el chevron queda abajo del viewport, invisible. En modo expandido el nav es `overflow-y-auto` (min-height 0), por eso ahí el botón sí se ve y se puede colapsar pero no volver.

## Alcance

`components/paneles/sidebar.client.tsx`, solo el rail colapsado y solo en viewports bajos (`@media (max-height: 50rem)` = 800 px, altura peor caso del rail del admin con margen):

1. El nav pasa a `min-h-0 overflow-y-auto` → los íconos scrollean y el pie + chevron quedan siempre visibles.
2. Los tooltips estéticos se ocultan en ese caso (un scroll container los recortaría a un jirón); queda el `aria-label`. En viewports normales nada cambia: tooltips y rail sin scroll como hasta ahora.

## Fuera de alcance

- Rehacer los tooltips con portal/JS para que sobrevivan al scroll container: complejidad que no paga (Regla #0) — el caso degradado es solo ventanas bajas.
- Tocar el modo expandido o el layout mobile: ya funcionan.

## Criterios de aceptación

1. Ventana de ~650 px de alto, sidebar colapsado (rol admin, 10 ítems): el chevron de expandir se ve y funciona; el pie (avatar + salir) también.
2. Misma ventana: los íconos del nav scrollean si no entran; sin tooltips flotantes.
3. Ventana alta (>800 px), colapsado: comportamiento actual intacto — sin scroll, tooltips a la derecha visibles (regresión STORY-989 v1.1).
4. Modo expandido: sin cambios en cualquier alto.
5. `tsc` + eslint verdes.

## Dev Agent Record

- **Commit:** _pendiente_.
- **Archivos:** `codigo/components/paneles/sidebar.client.tsx` (nav del rail: `min-h-0 overflow-y-auto` bajo `@media (max-height:50rem)`; tooltips `hidden` en el mismo caso).
- **Verificación:** `tsc --noEmit` + eslint verdes. **E2E** (Playwright, rol admin = 10 ítems, la ventana del tester 1357×656): colapsado → el chevron de expandir y el pie quedan visibles, los íconos scrollean, y el botón expande de vuelta ✅. **Regresión** en 1357×900: rail sin scroll, tooltip "Finanzas" visible a la derecha, chevron abajo ✅. Modo expandido intacto en ambas alturas.
