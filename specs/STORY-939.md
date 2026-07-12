# STORY-939 — Bug: los dos botones de "Vista previa" al finalizar no distinguen nota de cobro de comprobante de liquidación (v1.0)

**Estado:** ✅ done · **Origen:** Giuliano, tras usar el detalle de una gestión finalizada: "después de pagar se generan dos documentos, la nota de cobro y comprobante de liquidación, pero no se aclaran cuál es cuál, solo se ve 'vista previa'". Regla #0: fix mínimo de copy, sin tocar datos ni estructura.

## Diagnóstico

`EnvioDocumento` (`components/gestiones/envio-documento.client.tsx`) ya recibe la prop `etiqueta` ("nota de cobro" / "comprobante de liquidación") pero solo la mostraba **adentro del modal**, una vez abierto (línea 131). El botón visible (línea 93) siempre decía el texto genérico `"Vista previa"`, sin usar `etiqueta`. En `FinanzasAcciones` (`components/gestiones/finanzas.client.tsx:167-176`), la etapa "Finalizado" renderiza dos `EnvioDocumento` uno al lado del otro — ambos con el mismo botón genérico, indistinguibles hasta hacer clic.

## Fix
`envio-documento.client.tsx:93` — el botón ahora muestra `Ver {etiqueta}` (capitalizado vía CSS, mismo patrón que el header del modal) en vez de `"Vista previa"` genérico. Sin cambios de datos/props — `etiqueta` ya se pasaba correctamente desde los 3 call sites.

## Criterios de aceptación
1. En una gestión finalizada, los dos botones dicen "Ver Nota De Cobro" y "Ver Comprobante De Liquidación" — distinguibles sin hacer clic.
2. Los demás usos de `EnvioDocumento` (presupuesto en etapa de facturación, envío en `detalle.client.tsx`) siguen funcionando igual, solo con el texto del botón actualizado.
3. `tsc`/eslint verdes.

## Dev Agent Record
- **Archivos:** `codigo/components/gestiones/envio-documento.client.tsx` (línea 93).
- **Verificación:** `tsc --noEmit` y `eslint` limpios.
