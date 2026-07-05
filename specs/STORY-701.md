# Story 7.1 (+7.2/7.3): Finanzas — nota de cobro, cobro y liquidación al técnico

Status: done
Versión: 1.0.0

> Cubre las stories 7.1, 7.2 y 7.3 de epics.md. Alcance v1.3.0: cobro SIMPLE (solo emitir a quien corresponda y registrar) — sin compensación contra liquidación de alquiler.

## Story

Como gestor administrativo,
quiero emitir la nota de cobro con el detalle de la obra, registrar el cobro y liquidar al técnico con su comprobante,
para cerrar el circuito financiero de cada gestión.

## Acceptance Criteria

1. **Given** una gestión en "Facturación y cobro" con pagador y costo final, **When** el administrativo emite la nota de cobro, **Then** se genera el **PDF** (detalle de obra, presupuesto aprobado vs costo final, pagador) y se **envía por email** al inquilino o propietario según el pagador (adjunto), con evento y log en `emails_enviados`. También se puede descargar.
2. **When** registra el cobro (medio: transferencia | efectivo | otro), **Then** queda `cobrado_en` + medio y la gestión pasa a "Liquidación técnico" (vía `avanzar_etapa`).
3. **When** registra la liquidación (monto, referencia a la factura C del técnico), **Then** se genera el **comprobante PDF**, se envía por email al técnico, y la gestión pasa a "Finalizado".
4. **And** solo administrativo/admin pueden ejecutar estas acciones (la matriz de `avanzar_etapa` ya lo garantiza; los services verifican rol).

## Dev Notes

- **Sin tablas nuevas** (Regla #0): columnas en `gestiones` (`nota_emitida_en`, `cobrado_en`, `medio_cobro`, `liq_monto`, `liq_factura_ref`, `liq_pagada_en`). Los PDFs se generan **on-demand** (no se almacenan).
- PDF con `@react-pdf/renderer` (ARQUITECTURA §1) server-side → base64 → el cliente descarga (sin rutas API, NFR10). El email adjunta el mismo base64 (Resend `attachments`).
- La nota es un **documento interno de la inmobiliaria** que referencia la factura C del técnico — no reemplaza la facturación fiscal (domain research).
- Los datos del destinatario salen del legajo (inquilino) o del propietario de la propiedad según `pagador`; lookups con admin client tras verificar rol.

### References

- [Source: epics.md#epic-7] · [Source: PRD §5 etapa 6/7, §7] · [Source: STORY-501 email service]

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code, 2026-07-05)

### Completion Notes List

- E2E completo con la gestión "Canilla": nota de cobro (PDF esmeralda con presupuesto aprobado + total) **entregada por email al inquilino** (ausitesis@gmail.com, estado=enviado) → cobro registrado (transferencia) → liquidación con ref factura C 0003-00000871 → comprobante al técnico intentado (fallido por dominio Resend, logueado SIN romper el flujo) → FINALIZADO.
- Sin tablas nuevas: 6 columnas en gestiones. PDFs on-demand (@react-pdf/renderer → base64 → download client-side, sin rutas API).
- Matriz de notificaciones ampliada: liquidacion_registrada→tecnico, nota_cobro_enviada→gestor.
- En Finalizado quedan los botones de re-descarga de nota y comprobante (solo administrativo/admin).

### File List

- Migración finanzas_en_gestiones (columnas + policy update administrativo)
- features/finanzas/{pdf.tsx, service.ts} · features/email/service.ts (adjuntos)
- components/gestiones/finanzas.client.tsx · detalle.client.tsx (integración)
