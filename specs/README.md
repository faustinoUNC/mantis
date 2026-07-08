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
| 4 | Funnel de gestión (corazón del sistema) | 4.1–4.8 |
| 5 | Notificaciones realtime y emails de estado | 5.1–5.3 |
| 6 | Inbox Gmail + IA | 6.1–6.3 |
| 7 | Finanzas: facturación, cobro y liquidación | 7.1–7.3 |
| 8 | Trazabilidad, resumen de obras y métricas | 8.1–8.3 |

## Stories en desarrollo (specs/STORY-XXX.md)

Los archivos `STORY-XXX.md` (fuente de verdad para el hook spec-first) se generan **just-in-time** con `bmad-create-story` a partir de `epics.md`, justo antes de desarrollar cada una. Convención: `STORY-101.md` = Épica 1 Story 1.1, `STORY-407.md` = Épica 4 Story 4.7.

| Story | Título | Estado |
|---|---|---|
| [STORY-101](STORY-101.md) | Setup del proyecto y design system base | ✅ done |
| [STORY-102](STORY-102.md) | Login y acceso por rol | ✅ done |
| [STORY-103](STORY-103.md) | ABM de empleados con asignación de rol | ✅ done |
| [STORY-104](STORY-104.md) | Bloqueo y habilitación en tiempo real | ✅ done |
| [STORY-105](STORY-105.md) | Mantenedor de especialidades | ✅ done |

**ÉPICA 1 COMPLETA** ✅ (2026-07-05)

| [STORY-201](STORY-201.md) | ABM de propietarios | ✅ done |
| [STORY-202](STORY-202.md) | ABM de inquilinos | ✅ done |
| [STORY-203](STORY-203.md) | ABM de propiedades | ✅ done |
| [STORY-204](STORY-204.md) | Legajos por período de ocupación | ✅ done |
| [STORY-205](STORY-205.md) | Ubicación en Google Maps (mapa + botón) | ✅ done |

**ÉPICA 2 COMPLETA** ✅ (2026-07-05)

| [STORY-301](STORY-301.md) | Alta manual de técnico | ✅ done |
| [STORY-302](STORY-302.md) | Auto-enrolamiento con documentación | ✅ done |
| [STORY-303](STORY-303.md) | Evaluación de solicitudes | ✅ done |
| [STORY-304](STORY-304.md) | Agenda de disponibilidad (mobile) | ✅ done |

**ÉPICA 3 COMPLETA** ✅ (2026-07-05) — Recortes de alcance v1.3.0: sin seguro del técnico; cobro simple sin compensación contra liquidación de alquiler.

| [STORY-401](STORY-401.md) | Núcleo del funnel: modelo + avanzar_etapa() + tablero (4.1–4.3) | ✅ done |
| [STORY-404](STORY-404.md) | Asignación con disponibilidad visible | ✅ done |
| [STORY-405](STORY-405.md) | Inspección, presupuesto y pagador | ✅ done |
| [STORY-406](STORY-406.md) | Avances del técnico | ✅ done |
| [STORY-407](STORY-407.md) | Conformidad y validación | ✅ done |
| [STORY-408](STORY-408.md) | Reasignación de gestor (solo admin) | ✅ done |

**ÉPICA 4 COMPLETA** ✅ (2026-07-05) — ciclo completo verificado E2E con 3 roles. Facturación/liquidación con acción mínima (el módulo completo llega en la Épica 7).

| [STORY-501](STORY-501.md) | Notificaciones realtime + emails de estado (5.1–5.3) | ✅ done |

**ÉPICA 5 COMPLETA** ✅ (2026-07-05) — realtime en vivo verificado; email real entregado; falta verificar dominio en Resend para destinatarios reales.

| [STORY-701](STORY-701.md) | Finanzas: nota de cobro PDF, cobro y liquidación (7.1–7.3) | ✅ done |
| [STORY-901](STORY-901.md) | Post-MVP: sidebar+dashboards, nav mobile técnico, inbox vivo, registro | ✅ done |
| [STORY-902](STORY-902.md) | Presupuesto formal (PDF/email) + rediseño del detalle vivo | ✅ done |
| [STORY-903](STORY-903.md) | Cargo administrativo + vista previa y envío unificado de PDFs | ✅ done |
| [STORY-904](STORY-904.md) | Stepper + feedback de avance, restyle del tablero, bloqueo por presencia | ✅ done |
| [STORY-905](STORY-905.md) | Actividad: línea de tiempo única del detalle | ✅ done |
| [STORY-906](STORY-906.md) | Correcciones de la auditoría multi-agente (seguridad DB, finanzas, inbox, realtime, UI) | ✅ done |
| [STORY-907](STORY-907.md) | Refinamiento UX/UI: identidad y vida (saludo+avatar, cards del técnico, stagger, fixes) | ✅ done |
| [STORY-908](STORY-908.md) | Bug: notificación realtime en la campana al recibir una solicitud de técnico (trigger sobre `tecnicos`) | 🚧 en desarrollo |
| [STORY-909](STORY-909.md) | UX: confirmación inline antes de inhabilitar un empleado (evitar deshabilitación accidental) | 🚧 en desarrollo |
| [STORY-910](STORY-910.md) | Búsqueda + paginación en listados (técnicos/especialidades/empleados/auditoría) + filtro por gestor y orden por fecha + fix de scroll horizontal del tablero | 🚧 en desarrollo |
| [STORY-911](STORY-911.md) | Home del técnico: agrupación por etapa del trabajo + búsqueda + paginación "Mostrar más" + cards mobile | 🚧 en desarrollo |

**ÉPICA 7 COMPLETA** ✅ (2026-07-05) — nota de cobro con PDF entregada por email; circuito completo hasta Finalizado.

| [STORY-801](STORY-801.md) | Auditoría global + timeline | ✅ done |
| [STORY-802](STORY-802.md) | PDF Resumen de obras por legajo | ✅ done |
| [STORY-803](STORY-803.md) | Dashboards de métricas por rol | ✅ done |

**ÉPICA 8 COMPLETA** ✅ (2026-07-05)

| [STORY-601](STORY-601.md) | Inbox Gmail + botón IA (6.1–6.3) | ✅ done |

**ÉPICA 6 COMPLETA** ✅ (2026-07-05)

---

# 🎉 LAS 8 ÉPICAS ESTÁN COMPLETAS — MVP de MANTIS 2 terminado (2026-07-05)

Pendientes del proyecto: ver **[`tasks/PENDIENTES.md`](../tasks/PENDIENTES.md)** (única fuente de verdad).
