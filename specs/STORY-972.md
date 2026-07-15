# STORY-972 — Nota de cobro para la cancelación con cargo

**Estado:** ✅ done · **Origen:** card Trello #93, error 9 de la ronda de prueba 2026-07-15. Supersede la decisión #3 de STORY-967 ("sin nota de cobro para cancelaciones en v1") — la prueba real mostró que el administrativo necesita un documento para respaldar el cargo ante el cliente.

## El problema

Al cancelar con cargo, la gestión pasa por Cobro pero el administrativo no tiene NINGÚN documento para mandarle al pagador: la vista simplificada de STORY-967 quitó la nota de cobro entera. El cargo se cobra "de palabra".

## La solución (reusar el circuito de nota que ya existe)

1. **`datosDocumento()` entiende la cancelación** (`features/finanzas/service.ts`): para `tipo: "nota"` en una gestión con `cargo_cancelacion`, el total ES el cargo, sin desglose de presupuesto ni rendición, y el dato nuevo `cancelacion: true` viaja al PDF. El destinatario sigue siendo el pagador elegido.
2. **PDF** (`features/finanzas/pdf.tsx`): con `cancelacion`, la caja del trabajo se titula "Trabajo cancelado" y aclara "Cargo por cancelación acordado con la administración"; el total mantiene "Total a cobrar".
3. **Email** (`emitirNotaCobro`): asunto/cuerpo específicos ("Cargo por cancelación — {dirección}").
4. **UI** (`finanzas.client.tsx`): la vista de cobro de cancelación gana el bloque `EnvioDocumento` de siempre (vista previa + enviar por mail, con la marca `nota_emitida_en` compartida).

Sin migraciones: columnas y circuito existentes.

## Criterios de aceptación

1. En Cobro de una cancelación con cargo: vista previa de la nota → PDF "Nota de cobro" con "Trabajo cancelado", el cargo como total y el pagador como destinatario.
2. "Enviar por mail" manda el PDF al email del pagador con asunto de cancelación, marca `nota_emitida_en` y deja el evento `nota_cobro_enviada` en Actividad.
3. El cobro normal (gestión no cancelada) genera la misma nota de siempre, sin cambios.
4. `tsc` + `eslint` verdes.

## Dev Agent Record

- **Archivos:** `features/finanzas/service.ts` (`datosDocumento` cancelación-aware + copy del email), `features/finanzas/pdf.tsx` (`DatosDocumento.cancelacion` + caja "Trabajo cancelado"), `components/gestiones/finanzas.client.tsx` (bloque `EnvioDocumento` en la rama de cancelación).
- **Verificación:** `tsc`+`eslint` verdes. E2E local 2026-07-15: gestión cancelada con cargo desde En ejecución → en Cobro, la vista previa devolvió el PDF con "Trabajo cancelado" y total = cargo; envío por mail OK (evento + `nota_emitida_en`).
