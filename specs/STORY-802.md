# Story 8.2: PDF "Resumen de obras" por legajo

Status: done
Versión: 1.0.0

## Story

Como gestor,
quiero exportar el resumen de obras de un legajo o propiedad,
para respaldar a propietario, inquilino y al vendedor que verifica reparaciones al recibir llaves.

## Acceptance Criteria

1. **Given** un legajo con gestiones, **When** se descarga el "Resumen de obras" desde el detalle de la propiedad, **Then** el PDF lista cada obra del período: fecha, especialidad, descripción, técnico, costo, pagador y estado.
2. **And** se puede **enviar por email al propietario** desde el mismo lugar (log en emails_enviados).
3. **And** disponible por legajo individual (vigente o histórico); staff-only.

## Dev Notes

- Reusa la infraestructura PDF de finanzas (@react-pdf/renderer → base64 → download / adjunto email). Documento nuevo `ResumenObras` en features/finanzas/pdf.tsx (o módulo propio en cartera — decidir por cohesión: va en features/cartera/resumen-pdf.tsx).
- Complementa el acta de entrega/devolución del sector (domain research): incluye estado de conformidad por obra.
- Gestiones del legajo: filtro `legajo_id` (todas las etapas, marcando finalizadas).

### References

- [Source: epics.md#story-82] · [Source: PRD §3 legajos, §8] · [Source: STORY-701 pdf infra]

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code, 2026-07-05)

### Completion Notes List

- E2E: "Enviar al propietario" desde el legajo vigente → email resumen_obras ENTREGADO (estado=enviado) con PDF adjunto. Botones en legajo vigente e históricos.
- El PDF lista obras con especialidad, técnico, costo, pagador y estado (EN CURSO si no finalizó) — complementa el acta de devolución del sector.
- Files: features/cartera/resumen-pdf.tsx · cartera/service.ts (datosResumen/descargar/enviar) · legajos.client.tsx

### File List

(ver notas)
