# Story 9.3: Cargo por gestión administrativa + vista previa y envío unificado de documentos

Status: done
Versión: 1.1.0

> Pedidos de Fausti (2026-07-06): fee administrativo en la facturación, preview del PDF antes de enviar, y un flujo de envíos más estético y consistente.

## Alcance implementado

1. **Cargo por gestión administrativa**: columna `gestiones.cargo_admin` (≥0, default 0). En Facturación el administrativo lo ingresa y ve el resumen en vivo (Trabajo + Gestión administrativa = Total a facturar). Entra al PDF de la nota como línea propia y suma al total. Solo en la nota (no en presupuesto ni comprobante).
2. **Vista previa del PDF**: componente `EnvioDocumento` — v1.1 (pedido Fausti): **preview y envío SEPARADOS** — "Vista previa" abre el modal (portal al body) con el PDF real embebido SOLO para mirar/descargar (footer: Descargar/Cerrar, sin envío); "Enviar {doc} al {pagador} por email" es un botón independiente. Ver nunca empuja a enviar. Estado "Enviado por email ✓" junto a los botones.
3. **Envíos unificados**: el mismo componente en presupuesto (evaluación del gestor), nota de cobro (facturación) y re-descarga en Finalizado (nota + comprobante, modo solo-lectura sin enviar). Services devuelven `DocumentoGenerado` con destinatario {nombre, rotulo, email}.

## Dev Notes

- **Gotcha CSS cazado**: `animate-aparecer` con fill both deja `transform` residual → el contenedor del detalle se volvía containing block y el modal `fixed` quedaba pegado abajo. Doble fix: keyframe final `transform: none` + **modal por `createPortal(document.body)`** (regla del proyecto: overlays SIEMPRE por portal).
- El preview de la nota persiste `cargo_admin` (borrador inofensivo) para que datosDocumento lea siempre de la gestión.

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code, 2026-07-06)

### Completion Notes List

- E2E verificado: input 15000 → resumen $190.000 + $15.000 = $205.000 → modal centrado con el PDF real (N° 73074D07, destinatario Roberto Díaz) y acciones al pie.

### File List

- Migración: cargo_gestion_administrativa
- components/gestiones/envio-documento.client.tsx (nuevo) · finanzas.client.tsx (rewrite del bloque facturación) · detalle.client.tsx (evaluación usa EnvioDocumento)
- features/finanzas/{pdf.tsx (cargoAdmin), service.ts (DocumentoGenerado + guardarCargoAdmin + destinatario)} · features/gestiones/{service,types} (cargo_admin, nota_emitida_en)
- app/globals.css (keyframe aparecer → transform: none)
