# STORY-946 — Liquidación al técnico: monto calculado por el sistema, la administración solo confirma el pago (v1.0)

**Estado:** ✅ done (migración `liq_medio` verificada aplicada en Supabase el 2026-07-13) · **Origen:** Giuliano: *"A la hora de liquidar en la cuenta administración en vez de dejar que la administración llene un cuadro con que tanto es, el sistema va a calcular cuanto es en base al presupuesto y a los gastos adicionales que el técnico puso y la administración solo va a poner si pago o no y con que método de pago"*.

## Alcance (decisiones confirmadas con Giuliano)

- **El monto ya NO lo tipea la administración.** Se calcula en el servidor con el mismo criterio que ya regía como *sugerencia* desde STORY-934: `materiales_total` (rendido por el técnico al terminar la ejecución) + `monto_mano_obra` del presupuesto aprobado; fallback a `costo_final` para gestiones viejas sin rendición. Ahora es el valor autoritativo — no editable por la administración.
- **"Gastos adicionales que el técnico puso" (`gastos_imprevistos`) no se suman aparte.** Ya están plegados dentro del `materiales_total` que el técnico rinde (son la evidencia/justificación cuando lo rendido supera lo presupuestado en materiales — STORY-936). Sumarlos de nuevo acá sería duplicar el monto.
- **Referencia de factura del técnico (`liq_factura_ref`)**: se saca del formulario — Giuliano: *"La saco"*. La columna en `gestiones` NO se borra (preserva historial); simplemente deja de escribirse en liquidaciones nuevas. Los comprobantes viejos que ya tenían ese dato lo siguen mostrando en el PDF.
- **Métodos de pago**: lista cerrada provista textualmente por Giuliano — Efectivo, Crédito, Débito, Transferencia, Cheque, Pagaré, Otros. Reemplaza el patrón de 3 opciones que usaba "Registrar cobro" (transferencia/efectivo/otro), que no aplicaba para liquidación al técnico.
- **Formulario final**: un solo campo, "Método de pago" (Select). Sin campo de monto, sin campo de referencia.

## Fix

- **`features/finanzas/service.ts`**:
  - Nuevas constantes `MEDIOS_LIQUIDACION` (7 valores) y `MEDIO_LIQUIDACION_LABEL` (etiquetas en español).
  - `datosDocumento()`: agrega `liq_medio` al select de `gestiones` y calcula `medioPago` (solo para `tipo === "comprobante"`) para mostrarlo en el PDF.
  - `registrarLiquidacion(gestionId, { medio })`: firma nueva (antes recibía monto y referencia tipeados por la administración). Valida `medio` contra `MEDIOS_LIQUIDACION`, recalcula el monto en el servidor (nunca confía en el cliente para montos — mismo patrón que `registrarCobro`), valida `monto > 0`, escribe `liq_monto`, `liq_medio` (columna nueva) y `liq_pagada_en`. Ya no escribe `liq_factura_ref`.
- **`features/finanzas/pdf.tsx`**: `DatosDocumento` gana `medioPago?: string | null`. La caja "Pago registrado" del comprobante (STORY-940) ahora también muestra el método de pago cuando está disponible. El bloque de `facturaRef` se deja intacto para no perder el dato histórico de comprobantes viejos.
- **`components/gestiones/finanzas.client.tsx`**: la etapa `liquidacion_tecnico` muestra siempre el resumen (materiales rendidos + mano de obra → total a liquidar, con fallback a costo_final si la gestión no tiene rendición) y un formulario con un único campo Select "Método de pago" (opciones de `MEDIOS_LIQUIDACION`). Se eliminó el `Input` de monto libre.

## Migración SQL (pendiente de correr en Supabase)

```sql
alter table gestiones add column if not exists liq_medio text;
```

No requiere backfill: gestiones ya liquidadas antes de este cambio simplemente quedan con `liq_medio` en `null` (sus comprobantes ya emitidos no se regeneran).

## Criterios de aceptación

1. En la etapa "Liquidación al técnico", la administración ve el monto a liquidar ya calculado (materiales rendidos + mano de obra presupuestada, o costo_final si no hay rendición) y NO puede editarlo.
2. El único campo del formulario es "Método de pago", con las 7 opciones exactas pedidas por Giuliano.
3. Al confirmar, se guarda `liq_monto` (calculado en servidor, no en base a lo que mandó el cliente), `liq_medio` y `liq_pagada_en`, y la gestión avanza a `finalizado`.
4. El comprobante de liquidación (PDF y email) muestra el método de pago elegido.
5. Comprobantes históricos con `liq_factura_ref` cargado siguen mostrando esa referencia; los nuevos simplemente no la tienen.
6. `tsc`/eslint verdes.

## Dev Agent Record

- **Archivos:** `codigo/features/finanzas/service.ts`, `codigo/features/finanzas/pdf.tsx`, `codigo/components/gestiones/finanzas.client.tsx`.
- **Migración:** ver bloque SQL arriba — pendiente de que Giuliano la corra en el SQL Editor de Supabase (no hay MCP vivo en esta sesión).
- **Verificación:** `tsc --noEmit` y `eslint .` limpios (corridos después de reconciliar con STORY-945 de Faustino, que tocó `features/tecnicos/service.ts` sin overlap con estos archivos).
- **Nota de reconciliación:** este trabajo se numeró originalmente STORY-945, pero Faustino pusheó un STORY-945 propio (fix de body-size-limit + matrículas múltiples) mientras esta historia estaba en desarrollo. Se renombró a STORY-946 tras confirmar que no había overlap de archivos con el trabajo de Faustino (`git pull --ff-only` limpio).
