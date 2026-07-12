# STORY-942 — Documentos al pagador sin desglose: la comisión no se expone (v1.0)

**Estado:** ✅ done (commit `bb70bd6`) · **Origen:** Fausti (2026-07-12), card 3. La línea "Gestión administrativa" (fee de la inmobiliaria) hoy queda a la vista en los PDFs que van al pagador, y el resumen de obras muestra costos SIN fee que no coinciden con lo cobrado — la diferencia delata la comisión.

## Objetivo

Que todos los documentos que salen a un pagador (propietario/inquilino) cuenten **un solo número coherente** (el total con fee incluido), sin desglose que exponga la comisión. El técnico y el staff siguen viendo el detalle real.

## Alcance y decisiones

### A. PDF de presupuesto y de nota de cobro (`features/finanzas/pdf.tsx`)

- Para `tipo: "presupuesto" | "nota"` desaparece el desglose (Materiales / Mano de obra / Gestión administrativa): la caja muestra **solo la fila de total** ("Total presupuestado" / "Total a cobrar"), que ya incluye el fee.
- Para `tipo: "comprobante"` (técnico) el desglose Materiales + Mano de obra queda como está (nunca tuvo fee — es su liquidación real).
- La descripción del trabajo, plazo y demás secciones no cambian.

### B. Resumen de obras (`features/cartera/service.ts` + `resumen-pdf.tsx`)

- El costo por obra pasa a ser **lo efectivamente cobrado**: `cobrado_monto` (snapshot del cobro, ya incluye fee); fallback para gestiones sin cobro registrado: `costo_final + cargo_admin`.
- Así el número del resumen coincide con el de la nota de cobro que recibió esa persona.

### C. Lo que NO cambia

- Vistas internas del staff (evaluación de presupuesto, conformidad, cobro): siguen mostrando materiales/mano de obra/fee desglosados.
- Comprobante de liquidación al técnico.
- Los emails (cuerpo genérico) — el desglose viajaba solo en el PDF.

## Criterios de aceptación

1. PDF de presupuesto y de nota de cobro: sin líneas de desglose, solo total (con fee adentro).
2. PDF de comprobante al técnico: idéntico a hoy.
3. Resumen de obras: cada obra muestra el monto cobrado (con fee); coincide con la nota de cobro.
4. `tsc` + eslint + `next build` verdes.

## Dev Agent Record
- **Estado:** ✅ done (2026-07-12). Commit `bb70bd6` en main (renumerada por choque con las stories 938-940 de Giuliano), deploy automático en Vercel verificado.
- **Archivos:**
  - `features/finanzas/pdf.tsx` — desglose (Materiales/Mano de obra) SOLO para `tipo === "comprobante"`; la línea "Gestión administrativa" desapareció del template; `DatosDocumento.cargoAdmin` eliminado.
  - `features/finanzas/service.ts` — ya no arma `cargoAdmin` para el PDF (el total sigue incluyéndolo).
  - `features/cartera/service.ts` — resumen de obras: `costo = cobrado_monto ?? (costo_final + cargo_admin)` — coincide con la nota de cobro.
- **Verificación:** `tsc` + eslint + `next build` verdes. Vista previa del PDF de presupuesto generada OK vía UI. Comprobante del técnico sin cambios de lógica (misma rama del template).
