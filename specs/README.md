# Specs — MANTIS 2

Índice de especificaciones. **Las specs son la ÚNICA fuente de verdad** — ningún código se escribe sin su STORY aprobada (formato Mary+GOLD, SemVer).

## Documentos base

| Doc | Versión | Estado |
|---|---|---|
| [PRD.md](PRD.md) | 1.1.0 | Borrador — pendiente aprobación (incluye hallazgos 🔎 del research) |
| [ARQUITECTURA.md](ARQUITECTURA.md) | 1.0.0 | Borrador — pendiente aprobación |

## Research (BMAD workflows — 2026-07-05)

| Doc | Contenido |
|---|---|
| [Market research](../_bmad-output/planning-artifacts/research/market-gestion-mantenimiento-inmobiliario-research-2026-07-05.md) | Competencia global (Property Meld, Latchel, Fixflo, Vendoroo, AppFolio, Buildium) y AR (Xintel, Inmosoft, Barreeo); comunicación sin acceso al sistema; IA; 8 recomendaciones accionables |
| [Domain research](../_bmad-output/planning-artifacts/research/domain-mantenimiento-inmobiliario-argentina-research-2026-07-05.md) | Marco legal CCyC/DNU 70-2023 (quién paga, plazos 24h/10d); operatoria de administradoras; taxonomía de especialidades; actas y documentación; facturación monotributo |

## Épicas y stories

**Breakdown completo: [`_bmad-output/planning-artifacts/epics.md`](../_bmad-output/planning-artifacts/epics.md)** — 8 épicas, 31 stories con criterios de aceptación, FR1–FR30 cubiertos, validado (2026-07-05). Las 10 épicas previstas originalmente se consolidaron en 8 por la Regla #0 (simplicidad).

| # | Épica | Stories |
|---|---|---|
| 1 | Fundaciones, equipo y mantenedores | 1.1–1.5 |
| 2 | Cartera: propiedades, propietarios, inquilinos y legajos | 2.1–2.4 |
| 3 | Técnicos: enrolamiento y agenda | 3.1–3.4 |
| 4 | Funnel de gestión (corazón del sistema) | 4.1–4.7 |
| 5 | Notificaciones realtime y emails de estado | 5.1–5.3 |
| 6 | Inbox Gmail + IA | 6.1–6.3 |
| 7 | Finanzas: facturación, cobro y liquidación | 7.1–7.3 |
| 8 | Trazabilidad, resumen de obras y métricas | 8.1–8.3 |

## Stories en desarrollo (specs/STORY-XXX.md)

Los archivos `STORY-XXX.md` (fuente de verdad para el hook spec-first) se generan **just-in-time** con `bmad-create-story` a partir de `epics.md`, justo antes de desarrollar cada una. Convención: `STORY-101.md` = Épica 1 Story 1.1, `STORY-407.md` = Épica 4 Story 4.7.

| Story | Título | Estado |
|---|---|---|
| [STORY-101](STORY-101.md) | Setup del proyecto y design system base | ✅ done |
