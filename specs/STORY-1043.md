# STORY-1043 — El input del 2º medio de cobro no dejaba tipear centavos (coma decimal) (v1.0)

**Estado:** 🔨 en prueba · **Origen:** pedido de Fausti (2026-07-23). Bug de entrada en el pago combinado de la etapa de Cobro.

## Problema

En la etapa de **Cobro**, al activar "Pago combinado (dos medios)", la administración tipea el monto del **2º medio** y el 1º se autocompleta con el resto (`monto1Num = Math.max(total - monto2Num, 0)`, input `disabled readOnly`). El caso real: un total de $15 que se paga mitad y mitad → $7,50 en cada medio.

El bug: el input del 2º medio **no dejaba escribir la coma decimal**, así que era imposible cargar $7,50. Dos causas encadenadas en `components/gestiones/finanzas.client.tsx`:

- El `onChange` hacía `e.target.value.replace(/\D/g, "")` → `\D` borra **todo lo que no sea dígito 0-9**, incluida la coma, en el mismo momento de tipearla.
- El parseo `Number(monto2)` sobre un string de solo dígitos nunca podía dar un decimal.

Viene de STORY-975 (máscara de miles en vivo): se pensó para montos enteros con separador de miles, y el caso "mitad y mitad" con centavos nunca se contempló. El input ya declaraba `inputMode="decimal"` — la intención de permitir decimales estaba, pero la máscara la anulaba.

El **server ya era decimal-safe**: `registrarCobro` (`features/finanzas/service.ts`) hace `Number(datos.monto2)` y valida finito / `> 0` / `< base`, sin redondeo a entero. El bug era 100% del cliente.

## Decisión de diseño

- **Coma decimal es-AR, sin librería de máscara (Regla #0).** En es-AR el separador de miles es el punto y el decimal es la coma, así que **conviven sin ambigüedad**: se limpia todo menos dígitos y coma, se agrupan miles solo en la parte entera y se respeta la coma (incluida la coma "en progreso" mientras todavía no se tipearon los centavos). Nada de `react-number-format` ni máscaras: dos funciones puras chicas, mismo criterio simple que `plata()`/`formatearPesos` de STORY-975.
- **Máximo 2 decimales.** Es plata: `resto.join("").slice(0, 2)`.
- **Solo cliente.** El server ya acepta el decimal; no se toca `registrarCobro` ni la validación server-side (que sigue siendo la autoritativa).
- **Fix acotado al 2º medio.** Es el único input con esta máscara; el 1º es derivado (`plata(monto1Num)`, readOnly) y ya mostraba decimales. El input de "Recargo tarjeta (%)" tiene su propia máscara (`[^\d.]`) y no se toca.

## Alcance

`codigo/components/gestiones/finanzas.client.tsx` (`FormCobro`):

1. **`normalizarMonto(value)`** — nueva: `value.replace(/[^\d,]/g, "")`, deja una sola coma y recorta a 2 decimales. Reemplaza el `replace(/\D/g,"")` del `onChange` del 2º medio.
2. **`formatearPesos(raw)`** — reescrita: agrupa miles (`toLocaleString("es-AR")`) solo sobre la parte entera y reincorpora la parte decimal tal cual, preservando la coma final mientras se tipea.
3. **`montoADecimal(raw)`** — nueva: `Number(raw.replace(",", ".")) || 0`. Reemplaza `Number(monto2)` en el cálculo de `monto2Num`.

Las validaciones existentes (`seExcede = monto2Num >= total`, `mismoMedio`, submit deshabilitado) operan sobre `monto2Num` → siguen funcionando sin cambios.

## Fuera de alcance

- No se toca el server (`registrarCobro` ya es decimal-safe).
- No se toca el input de "Recargo tarjeta (%)" ni el de "Adelanto materiales" (otra máscara, otro flujo).
- No se agrega dependencia de máscara de input.

## Criterios de aceptación

1. **Centavos en el 2º medio:** con un total de $15, activar pago combinado y tipear `7,5` en el 2º medio → el 1º se autocompleta en `$ 7,5` y el submit queda habilitado.
2. **Separador de miles intacto:** tipear `1234` sigue mostrándose `1.234` (regresión de STORY-975); `1234,5` → `1.234,5`.
3. **Coma en progreso:** al escribir `7,` el input no borra la coma (deja seguir con los centavos); máximo 2 decimales (`7,555` → `7,55`).
4. **Validaciones vivas:** si el 2º medio ≥ total sigue apareciendo el error de exceso; dos medios iguales siguen bloqueados.
5. **Registro correcto:** el cobro combinado con decimales queda registrado con los montos exactos (evento + finanzas), sin redondear a entero.
6. `tsc`/eslint verdes.

## Dev Agent Record

- **Commit:** _(pendiente)_
- **Archivos:**
  - `codigo/components/gestiones/finanzas.client.tsx`: `formatearPesos` reescrita para decimales + nuevas `normalizarMonto` y `montoADecimal`; `onChange` del 2º medio usa `normalizarMonto`, `monto2Num` usa `montoADecimal`.
- **Verificación:**
  - `tsc --noEmit` verde.
  - Click-through en navegador pendiente (pasos en los criterios de aceptación).
