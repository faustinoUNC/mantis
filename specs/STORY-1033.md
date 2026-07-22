# STORY-1033 — Campos de plata sin `type="number"`: chau "e", "+" y "-" (v1.0)

**Estado:** 🔨 en prueba · **Origen:** reporte de Fausti (2026-07-21) — el campo del fee de la inmobiliaria acepta caracteres no numéricos (`e`, `+`, `-`). Barrido pedido: encontrar y arreglar TODOS los campos numéricos con el mismo defecto.

## Problema

El `<input type="number">` nativo acepta `e`/`E` (notación científica), `+` y `-` — el usuario puede tipear `1e5`, `--3` o `+2e-4`. Además, con basura tipeada `Number(e.target.value)` da `NaN` o el browser reporta `""`, y los `min`/`step` solo validan en el submit nativo (que varios de estos forms ni usan). STORY-1030 ya arregló este defecto en el campo de devolución; el barrido encontró que **los 8 `type="number"` restantes del sistema** viven todos en `codigo/components/gestiones/detalle.client.tsx`:

1. "Gestión administrativa ($) — fee de la inmobiliaria" (el reportado, controlado)
2. "Materiales ($)" — presupuesto del técnico
3. "Mano de obra ($)" — presupuesto del técnico
4. "Plazo de obra (días)" — entero
5. "% inquilino" — pagador compartido (controlado, entero)
6. "Monto extra ($)" — ampliación
7. "Total final gastado en materiales ($)" — rendición
8. "Cargo por cancelación ($)"

El resto del sistema ya usa el patrón correcto (texto + `inputMode` + filtro en el tipeo): Finanzas, alta de técnico, cartera.

## Alcance

- Componente nuevo `InputNumerico` en `codigo/components/ui/input-numerico.client.tsx`: un `Input` de texto con `inputMode` numérico que filtra en el tipeo — solo dígitos, y a lo sumo un punto decimal si `decimales` (la coma se convierte a punto). Es el patrón de STORY-1030 empaquetado para no repetirlo 8 veces.
- Los 8 inputs de `detalle.client.tsx` pasan a `InputNumerico` (los de plata con decimales; plazo y % inquilino enteros).
- La validación de negocio server-side existente no cambia (plazo ≥ 1, ampliación > 0, rendición > 0, montos ≥ 0, `Number.isFinite` en todos).

## Fuera de alcance

- No se migran los campos ya saneados de Finanzas/técnicos/cartera a `InputNumerico` — funcionan bien; se tocan solo si alguna vez hay que modificarlos.
- Formateo con separador de miles mientras se tipea (Finanzas lo hace en sus campos; acá no se agrega).

## Criterios de aceptación

1. En los 8 campos no se puede tipear `e`, `+`, `-` ni letras; los dígitos sí, y en los de plata un solo punto decimal (la coma se convierte).
2. Los flujos siguen andando: enviar presupuesto, aprobar con fee, pagador compartido con %, pedir ampliación, terminar con rendición y cancelar con cargo guardan los mismos valores que antes.
3. `tsc`/eslint verdes.

## Dev Agent Record

- **Commit:** `ef16ff0` (2026-07-21).
- **Archivos:** `codigo/components/ui/input-numerico.client.tsx` (nuevo — `InputNumerico`: `Input` de texto con `inputMode` y filtro en el tipeo, prop `decimales`); `codigo/components/gestiones/detalle.client.tsx` (los 8 `type="number"` pasan a `InputNumerico`; `cargoAdmin` pasa a estado string con derivado `cargoAdminNum` para poder tipear decimales en un input de texto).
- **Verificación:** `tsc` y eslint verdes; no queda ningún `type="number"` en el código. E2E navegador (gestión [DEMO] con presupuesto enviado, admin): fee — tipear `1e+5-abc2,5.9` deja `152.59` y el resumen/total usan el valor saneado ($15.000 → total $368.000); % inquilino — tipear `e-5+a5` deja `55`; cargo por cancelación (camino FormData) — tipear `-1e9+.2.,3x` deja `19.23`. Consola sin errores ni warnings.
