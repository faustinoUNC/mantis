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
| [STORY-959](STORY-959.md) | El técnico gestiona su contacto (email/teléfono) y su contraseña desde el perfil; la inmobiliaria ya no edita datos de contacto (recorte de STORY-948 a nombre + CUIL) | ✅ done |
| [STORY-958](STORY-958.md) | Un técnico rechazado puede volver a enviar la solicitud — v2.0: el reintento reabre la MISMA fila (visible siempre para el staff como "Reintento", motivo anterior conservado, links de mails viejos vivos) | ✅ done |
| [STORY-957](STORY-957.md) | La página de Técnicos se actualiza en tiempo real (tabla `tecnicos` a la publicación Realtime + `RefrescoVivo` en la lista) | ✅ done |
| [STORY-956](STORY-956.md) | El admin gestiona el correo (edición inline con sync auth+usuarios) y la contraseña (link de restablecimiento por email) de los empleados (card #80 de Trello) | ✅ done |
| [STORY-955](STORY-955.md) | Verificación de email en el registro de técnico (la solicitud llega al staff recién al verificar), contraseña por link al aprobar y "¿olvidaste tu contraseña?" para todos los roles (card #78 de Trello) | ✅ done |
| [STORY-954](STORY-954.md) | Presión por especialidad en Informes: demanda de gestiones del período vs. técnicos aprobados (ranking de presión, card #73 de Trello) | ✅ done |
| [STORY-953](STORY-953.md) | La campanita de notificaciones lleva a donde corresponde (inbox, técnico, gestión) | ✅ done |
| [STORY-952](STORY-952.md) | Buscador de direcciones: re-rank client-side — las sugerencias que coinciden con la calle tipeada van primero (Photon rankeaba por cercanía) | ✅ done |
| [STORY-951](STORY-951.md) | Sin 404 desde la campanita tras rechazar una asignación: al rechazar se borran las notificaciones del técnico sobre esa gestión | ✅ done |
| [STORY-950](STORY-950.md) | Cobro con medios de pago combinados (mitad efectivo, mitad transferencia) + tarjeta de crédito como medio | ✅ done |
| [STORY-949](STORY-949.md) | Alta de administración solo propietario+propiedad (fin de las altas a medias por inquilino inválido) + desplegable de legajos solo con inquilinos sin legajo vigente | ✅ done |
| [STORY-948](STORY-948.md) | La inmobiliaria puede editar todos los datos personales, especialidades y matrícula de un técnico ya creado | ✅ done |
| [STORY-947](STORY-947.md) | El teléfono de propietarios e inquilinos deja de ser opcional (client + server, sin migración) | ✅ done |
| [STORY-946](STORY-946.md) | Liquidación al técnico: el sistema calcula el monto (materiales rendidos + mano de obra presupuestada), la administración solo confirma método de pago | ✅ done |
| [STORY-945](STORY-945.md) | Registro de técnico: fin del 413 silencioso en el celular (validación client-side + compresión de imágenes + try/catch + `bodySizeLimit`) y matrículas múltiples (migración 2 fases — fase 2 post-deploy) | ✅ done |
| [STORY-944](STORY-944.md) | CUIL, email y teléfono no pueden repetirse dentro de cada tipo de persona (técnicos, propietarios, inquilinos) — chequeo server + índice UNIQUE en DB | ✅ done |
| [STORY-943](STORY-943.md) | Presupuestación: eliminar "Causa" y `pagador_sugerido` (migración 2 fases — fase 2 post-deploy), pagador explícito sin opción Inquilino inexistente, inspección obligatoria antes de presupuestar | ✅ done |
| [STORY-942](STORY-942.md) | Documentos al pagador sin desglose: presupuesto y nota de cobro solo total (fee adentro); resumen de obras con el monto cobrado — la comisión no se expone | ✅ done |
| [STORY-941](STORY-941.md) | "Cobro" en vez de "Facturación" + sección "Administración"/"Administraciones"; fuera los ABMs sueltos de personas — alta/edición/cambio de propietario e inquilino desde la propiedad | ✅ done |
| [STORY-940](STORY-940.md) | Bug: el "comprobante de liquidación" que recibe el técnico por email es en realidad un detalle genérico (falta confirmación de pago + fecha real de pago) | ✅ done |
| [STORY-939](STORY-939.md) | Bug: los dos botones "Vista previa" al finalizar no distinguen nota de cobro de comprobante de liquidación | ✅ done |
| [STORY-938](STORY-938.md) | Bug: el técnico no ve quién es el gestor ni el contacto del cliente en el detalle de su gestión (RLS acotada + UI) | 🚧 en desarrollo |
| [STORY-937](STORY-937.md) | Desvío de presupuesto medido SOLO sobre materiales (reales vs presupuestados, fallback costo_final − mano de obra) y ponderado por plata — scorecard de asignación + card de Informes | ✅ done |
| [STORY-936](STORY-936.md) | Terminar la obra: al menos una nota de avance obligatoria y el exceso de materiales rendidos sobre lo presupuestado se justifica con gastos imprevistos (bloqueo UI + server, sin migración) | ✅ done |
| [STORY-935](STORY-935.md) | Validaciones de flujo + archivo: no crear gestión sin técnico de la especialidad; email del presupuesto obligatorio antes de aprobar (`presupuesto_enviado_en`); saludo por nombre en el resumen de obras; archivar finalizadas + vista "Archivo" con división por roles | ✅ done |
| [STORY-934](STORY-934.md) | Rendición de materiales al terminar la ejecución (foto de comprobantes + total, obligatorios), gastos imprevistos sin aprobación, liquidación = rendido + mano de obra, fee solo lectura en facturación | ✅ done |
| [STORY-933](STORY-933.md) | Adelantos de obra al técnico | ❌ descartada (se liquida todo al final contra rendición — STORY-934) |
| [STORY-932](STORY-932.md) | Gastos imprevistos del técnico en ejecución: tabla espejo de `presupuestos` (técnico propone, gestor aprueba), foto de ticket obligatoria, costo_final los absorbe, nota de cobro con desglose | ✅ done |
| [STORY-931](STORY-931.md) | Especialidades del técnico en el scorecard de asignación (todas, bajo el nombre) | ✅ done |
| [STORY-930](STORY-930.md) | Headers de seguridad HTTP (anti-clickjacking + hardening): X-Frame-Options, nosniff, Referrer-Policy, sin x-powered-by | 🚧 en desarrollo |
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

| [STORY-501](STORY-501.md) | Notificaciones realtime + emails de estado (5.1–5.3) — v1.2: emails de resultado al técnico | ✅ done |

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
| [STORY-911](STORY-911.md) | Home del técnico: filtro por etapa (selector + hoja), seguimiento separado, paginación; stepper responsive; etapa Presupuesto mobile; copy "Horarios" | 🚧 en desarrollo |
| [STORY-912](STORY-912.md) | Consolidar Métricas dentro del Inicio (un dashboard, menos menú); importes sin contador | 🚧 en desarrollo |
| [STORY-913](STORY-913.md) | El técnico ve sus gestiones finalizadas como historial (etapa más en su home) | 🚧 en desarrollo |
| [STORY-914](STORY-914.md) | Dashboard de métricas de valor: 8 gráficos, tiempo real y filtros + inmutabilidad de finanzas (calificación ⭐, funnel/cancelación, cuellos, composición, rechazos, cobertura) | 🚧 en desarrollo |
| [STORY-915](STORY-915.md) | Desempeño del técnico a golpe de vista: desvío de presupuesto (dashboard) + scorecard visual en la asignación (⭐, obras, % rechazo/cancelación, disponibilidad, tooltips); "más barato" descartado por no confiable | 🚧 en desarrollo |
| [STORY-916](STORY-916.md) | Bug: "Volver" desde el detalle de una gestión iba al Inicio en vez del tablero | 🚧 en desarrollo |
| [STORY-917](STORY-917.md) | Métricas accionables: gestiones estancadas (días en etapa), cobranza por antigüedad y reincidencia a 90 días (listas linkeadas al detalle, sin migraciones) | 🚧 en desarrollo |
| [STORY-918](STORY-918.md) | Carga demo realista (80 gestiones en todas las etapas, marcador `[DEMO]`) para probar métricas + reversión total (`scripts/demo-borrar.sh`). Sin cambios en `codigo/` | ✅ sembrado |
| [STORY-919](STORY-919.md) | Retoques del dashboard de métricas (party mode): fix rechazos asignación + calificación, embudo→barras, reincidencia N+scroll, combo ingresos/volumen, quitar cobertura, gradiente de magnitud, fee demo | 🚧 en desarrollo |
| [STORY-920](STORY-920.md) | Unificar card de cobro (Pendientes + Dinero pendiente → "Gestiones pendientes de cobro"), nueva card "Prioridad por valor" (fee mayor→menor), quitar pills "ahora" y filtro de especialidad, ensanchar "Composición del trabajo" | 🚧 en desarrollo |
| [STORY-921](STORY-921.md) | "Métricas"→"Informes"; Cuellos y Tiempo de ciclo sin el tiempo de ejecución (depende del tamaño de obra); nueva métrica "Cumplimiento de plazo" por técnico (real vs plazo comprometido); label "Plazo de obra (días)" | 🚧 en desarrollo |
| [STORY-922](STORY-922.md) | Alta unificada "Administración": wizard en `/cartera/nueva` (propietario + propiedad obligatorios, inquilino/legajo opcional) sobre las tablas existentes — sin entidad nueva ni migraciones | ✅ done |
| [STORY-923](STORY-923.md) | CUIL como documento único (reemplaza DNI/CUIT en técnicos, propietarios e inquilinos): renombre de columnas + validación con dígito verificador; v1.1 mensajes de error descriptivos + placeholders con ejemplo válido | ✅ done |
| [STORY-924](STORY-924.md) | Bugs: 404 al rechazar asignación (RLS + revalidate), teléfonos solo numéricos (3 forms + services) y bloqueo de bajas de cartera con gestiones abiertas (party mode: inquilino vía legajos, propietario vía propiedades, legajo vía legajo_id) | ✅ done |
| [STORY-925](STORY-925.md) | Buscadores en cartera: propietarios/inquilinos (nombre, correo, teléfono, CUIL) y propiedades también por propietario e inquilino vigente (+ inquilino visible en Ocupación) | ✅ done |
| [STORY-926](STORY-926.md) | Buscador del tablero: también por propietario e inquilino de la gestión (embed en SELECT_RESUMEN, inquilino del legajo snapshot) | ✅ done |
| [STORY-927](STORY-927.md) | Selector "Buscar por" unificado en todos los buscadores (FiltrosLista + coincideCampo; tablero, propiedades, personas, técnicos, empleados, home del técnico) | ✅ done |
| [STORY-928](STORY-928.md) | Auditoría: buscador unificado + dirección como principal (consistencia con tablero/Inicio) + logs legibles (detalle JSON visible, etapas humanas, labels faltantes, query única) | ✅ done |
| [STORY-929](STORY-929.md) | Limpieza del dashboard de Informes: sacar "Gestiones cobradas", quitar tortas de "Composición del trabajo" y renombrar "Prioridad por valor"→"Orden por valor" (card "Gestiones ordenadas por fee") | 🚧 en desarrollo |
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
