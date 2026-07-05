# Story 8.3: Dashboards de métricas por rol

Status: done
Versión: 1.0.0

## Story

Como usuario del sistema,
quiero ver las métricas de mi área en un dashboard,
para tomar decisiones con datos.

## Acceptance Criteria

1. **Given** `/metricas` (staff: admin + ambos gestores; el técnico no — su vista es "Mis trabajos"), **Then** cada rol ve SOLO sus números:
   - **Gestor de mantenimiento**: sus gestiones (RLS scope automático) — activas, urgentes con +24 h sin asignar, primera respuesta mediana, resolución mediana.
   - **Gestor administrativo**: pendientes de cobro (cantidad + monto), pendientes de liquidación, cobrado y liquidado acumulados.
   - **Admin**: todo lo anterior sobre el total.
2. **And** dos charts (recharts, reglas del skill dataviz): "Gestiones por etapa" y "Resolución mediana por especialidad (días)" — barras finas esmeralda (paleta validada), grid recesivo, tooltip por barra, texto en tokens de tinta.
3. **And** métricas calculadas del event log (primera respuesta = creada→Asignación; resolución = creada→Finalizado) — los KPIs del PRD §9 validados por el research.

## Dev Notes

- Session client → RLS ya scopea por rol (el gestor ve SOLO sus gestiones — el dashboard es personal, coherente con el ownership).
- Dataset chico: cómputo en TS (medianas). Sin tablas nuevas ni agregaciones SQL (Regla #0).
- Single-series bars → sin leyenda (el título nombra la serie); nada de dual-axis; color #059669 validado con el script del skill (ALL PASS).
- Score de técnico (calificación post-obra) NO está en v1 — no existe el rating en el funnel; queda para cuando se agregue (documentado).

### References

- [Source: epics.md#story-83] · [Source: PRD §9 KPIs] · [Source: skill dataviz — form/marks/interaction]

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code, 2026-07-05)

### Completion Notes List

- E2E: /metricas como admin — 8 tiles (operativa + finanzas: cobrado $42.000, liquidado $42.000) + 2 charts esmeralda. Paleta validada con el script del skill dataviz (ALL PASS); serie única sin leyenda, grid recesivo, texto en tinta, tooltip por barra.
- RLS scopea solo: el gestor de mantenimiento ve métricas de SUS gestiones.
- recharts instalado. Score de técnico documentado como fuera de v1 (no hay rating post-obra).
- Files: features/metricas/service.ts · components/metricas/dashboard.client.tsx · app/metricas/{layout,page}.tsx · navs

### File List

(ver notas)
