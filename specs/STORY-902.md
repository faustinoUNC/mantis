# Story 9.2: Presupuesto formal con PDF/email + rediseño del detalle de gestión

Status: done
Versión: 1.0.0

> Batch de mejoras pedidas por Fausti (2026-07-05, segunda tanda de pruebas).

## Alcance implementado

1. **Presupuesto formal del técnico**: formulario estandarizado — Trabajo a realizar (textarea, obligatorio), Materiales $, Mano de obra $, Plazo en días (obligatorio) y Observaciones. Validado en UI y server. Migración: `presupuestos` + `descripcion_trabajo`, `plazo_dias`.
2. **PDF del presupuesto** (tipo nuevo en el generador de finanzas: trabajo, desglose, total, plazo, pie "sujeto a aprobación") con **Descargar PDF** y **Enviar al pagador por email** en la etapa de evaluación (staff mantenimiento). Destinatario = pagador confirmado o sugerido. Evento `presupuesto_enviado_pagador`.
3. **Evaluación con contenido visible**: el gestor ve la inspección del técnico + la ficha completa del presupuesto (trabajo, montos, plazo, observaciones) EN el bloque de acción — antes solo veía los botones.
4. **Rediseño del detalle**: N° de gestión, badges arriba, card de datos en grid (Propiedad con link a Maps, Gestor, Técnico, Causa, Paga, Costo/Creada), card de acción con encabezado de etapa, secciones uniformes (Presupuestos con ficha completa, Avances como lista con sello Inspección, Conformidades, Historial). La foto de la conformidad se ve al evaluarla.
5. **Detalle 100% vivo**: avances/presupuestos/conformidades en la publicación realtime + RefrescoVivo por tabla — el gestor ve los avances del técnico al instante durante los días de ejecución, sin esperar la conformidad. Verificado E2E (nota insertada por atrás apareció sin recargar).
6. **Fix Resend + plus-addressing**: el modo testing de Resend rebota los alias `ausitesis+x@gmail.com` (compara la dirección exacta) — se normalizan al enviar (hack de testing documentado; el log guarda el destinatario real). Presupuesto entregado ✓.
7. Admin ve también las tiles financieras en su Inicio.

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code, 2026-07-05)

### File List

- Migraciones: presupuesto_formal, realtime_detalle_gestion
- components/ui/textarea.tsx · components/gestiones/detalle.client.tsx (rewrite)
- features/gestiones/{types,service} (presupuesto formal) · features/finanzas/{pdf,service} (tipo presupuesto) · features/email/service (destinoEntregable)
- app/admin/page.tsx (tiles financieras)
