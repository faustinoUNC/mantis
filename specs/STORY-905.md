# Story 9.5: Actividad — línea de tiempo única del detalle

Status: done
Versión: 1.1.0

> Pedido de Fausti (2026-07-06): el historial era un lío — 4 secciones separadas (Presupuestos, Avances, Conformidades, Historial), sellos confusos ("Inspección" en notas de ejecución) y lectura fragmentada. Quería algo claro, sintético y bien adaptado a celular para el técnico.

## Solución

Una única sección **Actividad**: línea de tiempo vertical (más nuevo arriba) que fusiona eventos + notas del técnico + conformidades:

- **Cambios de etapa** = separadores visuales (pill esmeralda "→ Presupuesto" con dot grande) — estructuran la lectura por capítulos.
- **Notas del técnico** con su sello correcto según cuándo se registraron: "Inspección" (etapa presupuesto) / "Avance de obra" (ejecución) + foto inline.
- **Decisiones** con su motivo en la misma línea (rechazos de presupuesto/conformidad/asignación).
- **Conformidades** con thumbnail y estado.
- Se eliminaron las secciones Presupuestos/Avances/Conformidades/Historial — las fichas de presupuesto viven en el bloque de acción de su etapa y el PDF queda descargable en finanzas.

Mobile-first: timeline de una columna con línea vertical, tipografía compacta, fechas en mono a la derecha. Verificado E2E en 390px.

## v1.1 — Ítems con información pertinente (pedido Fausti)

Cada evento del timeline muestra ahora **quién** lo hizo (— nombre del actor, vía FK nueva eventos_gestion.actor_id → usuarios) y **los datos del hecho** en un renglón secundario: presupuesto enviado (total + plazo), aprobado (pagador), conformidad aprobada (costo final), asignación (técnico), reasignación (nuevo gestor), nota de cobro (total + destinatario), cobro (medio), liquidación (monto + ref factura). Los datos se guardan en `detalle` jsonb AL CREAR el evento (fuente de verdad histórica — no se recalculan) y `detalleLegible()` los renderiza. Eventos previos quedan sin detalle (datos de prueba).

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code, 2026-07-06)

### File List

- components/gestiones/detalle.client.tsx — componente Actividad reemplaza a las 4 secciones (Seccion eliminado)
