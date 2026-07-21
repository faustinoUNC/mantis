# STORY-1030 — Devolución/ajuste al desasignar: campo numérico de verdad (v1.0)

**Estado:** ✅ done · **Origen:** card Trello #150 (2026-07-21, https://trello.com/c/ZJw05b64) — el tester pudo tipear símbolos y texto en el campo de plata; Fausti confirmó por captura que el campo es "Devolución / ajuste en el acto" del modal de desasignación.

## Problema

El campo "Devolución / ajuste en el acto" (STORY-1014, `DesasignarTecnico` en `detalle.client.tsx`) es un `Input` de texto libre con `inputMode="decimal"` — eso solo sugiere el teclado numérico en el celular; en desktop acepta letras y símbolos. Al confirmar, el handler hace `replace(/[^\d.]/g, "")`: cualquier basura ("abc$%!") se convierte **en silencio** en "sin devolución", sin error ni aviso. El sistema ya tiene dos patrones de campo de plata y este no sigue ninguno: los de Finanzas filtran los caracteres mientras se tipea (controlados), los de presupuesto son `type="number"`.

## Alcance

- El campo pasa a ser **controlado con filtro en el tipeo** (mismo patrón que "Monto a adelantar ahora" de `finanzas.client.tsx`): letras y símbolos no se pueden escribir — desaparecen al tipear. El submit lee el estado, no el FormData.
- La validación de negocio existente no cambia (`desasignarTecnico`: 0 < devolución ≤ adelanto).

## Fuera de alcance

- El campo "Cómo se arregló" del saldado manual (STORY-1019) sigue siendo texto libre a propósito: ahí los números y símbolos son contenido legítimo ("devolvió $10.000 en efectivo"). Se documenta como comportamiento esperado en la card.

## Criterios de aceptación

1. En el modal de desasignar con adelanto, tipear letras o símbolos en "Devolución / ajuste en el acto" no escribe nada; los dígitos sí.
2. Una devolución válida sigue congelándose en el evento como hasta ahora; devolución mayor al adelanto sigue rechazada con su mensaje.
3. `tsc`/eslint verdes.

## Dev Agent Record

- **Commit:** ver commit del push conjunto con STORY-1029 (2026-07-21).
- **Archivos:** `codigo/components/gestiones/detalle.client.tsx` (`DesasignarTecnico`) — estado `devolucion` controlado con `replace(/[^\d.]/g, "")` en el `onChange` (patrón "Monto a adelantar ahora" de `finanzas.client.tsx`); el submit lee el estado.
- **Verificación:** `tsc`/eslint verdes. E2E navegador (gestión #108 `[DEMO]`): tipear `abc$%!hola` deja el campo vacío; tipear `1a5b0c000!` deja `150000`; la desasignación con esa devolución la congeló bien en el evento (`devolucion_adelanto: 150000`, verificado en la constancia y la Actividad).
