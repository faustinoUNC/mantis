# STORY-940 — Bug: el "comprobante de liquidación" que recibe el técnico por email es en realidad un detalle genérico (v1.0)

**Estado:** ✅ done · **Origen:** Giuliano, con captura del email real recibido por un técnico de prueba ("Comprobante de liquidación — Duarte quiros 2100"): *"el mail que se le envía al técnico tiene que adjuntar el comprobante, actualmente lo que envía es SOLAMENTE EL DETALLE y encima el detalle (el archivo pdf) tiene como nombre COMPROBANTE"*. Regla #0: fix de contenido mínimo, sin nuevo documento ni tabla.

## Diagnóstico

No hay dos documentos distintos ("detalle" vs "comprobante") — `registrarLiquidacion()` (`features/finanzas/service.ts:399`) genera un único PDF vía `datosDocumento(gestionId, "comprobante")` + `generarPDF()`, y ese PDF usa el mismo componente `Documento` (`features/finanzas/pdf.tsx:62`) que la nota de cobro: título, caja "Trabajo realizado", desglose de materiales/mano de obra y un total. La única diferencia real entre "nota" y "comprobante" era el rótulo del total y el destinatario — layout idéntico. Por eso el archivo, aunque se llama `comprobante-{numero}.pdf`, se lee como una planilla de costos (un "detalle"), no como una constancia de que el pago se efectivamente realizó — no dice cuándo se pagó ni lo confirma explícitamente.

## Fix

- `features/finanzas/pdf.tsx`: para `tipo === "comprobante"`, se agrega una caja "Pago registrado" al principio del documento ("Se liquidó $ X el DD/MM/AAAA"), antes del desglose de trabajo/costos — así el documento arranca confirmando el pago, no describiendo la tarea.
- `features/finanzas/service.ts` (`datosDocumento`): se suma `liq_pagada_en` al select de `gestiones`, y para `tipo === "comprobante"` el campo `fecha` del documento pasa a ser la fecha real del pago (`liq_pagada_en`) en vez de la fecha de generación/descarga — importante porque el comprobante se puede volver a descargar días después desde el detalle de la gestión, y antes mostraba la fecha de la descarga, no la del pago.
- No se tocó el nombre de archivo (`comprobante-{numero}.pdf`) ni el texto del email — con el contenido corregido, el nombre ya es correcto.

## Criterios de aceptación

1. El email de liquidación al técnico adjunta un PDF que arranca confirmando el pago (monto + fecha real de pago), no solo un desglose de costos.
2. Si se vuelve a descargar el comprobante desde el detalle de la gestión días después, la fecha que muestra sigue siendo la del pago original, no la del día de la descarga.
3. La nota de cobro (al pagador) no cambia — mismo comportamiento que antes.
4. `tsc`/eslint verdes.

## Dev Agent Record

- **Archivos:** `codigo/features/finanzas/pdf.tsx` (caja "Pago registrado"), `codigo/features/finanzas/service.ts` (`liq_pagada_en` en el select + cálculo de `fecha` para comprobante).
- **Verificación:** `tsc --noEmit` y `eslint` limpios sobre ambos archivos.
