# PRD — MANTIS 2: Sistema de Gestión de Mantenimiento Inmobiliario

| | |
|---|---|
| **Versión** | 1.1.0 |
| **Fecha** | 2026-07-05 |
| **Estado** | Borrador — pendiente aprobación de Fausti |
| **Basado en** | MANTIS original (`projects/tesis/sist_gestion_incidentes`) — sistema de gestión de incidentes ISBA |
| **Research** | [Market research (competencia)](../_bmad-output/planning-artifacts/research/market-gestion-mantenimiento-inmobiliario-research-2026-07-05.md) · [Domain research (dominio AR)](../_bmad-output/planning-artifacts/research/domain-mantenimiento-inmobiliario-argentina-research-2026-07-05.md) |

> **v1.1.0**: incorpora los hallazgos de la investigación de mercado y dominio (BMAD research workflows, 2026-07-05). Cambios marcados con 🔎.

---

## 1. Visión

Sistema web para que una **inmobiliaria** gestione el **mantenimiento** de las propiedades que administra. Evoluciona el MANTIS original con estos cambios de fondo:

- La palabra **"incidente" desaparece** → todo es una **"Gestión de mantenimiento"**.
- **El rol cliente desaparece.** Inquilinos y propietarios son **entidades administradas** (reciben emails y documentación) pero **NUNCA acceden al sistema**. Esto es una restricción CRÍTICA e innegociable.
- El dominio se reduce y se centra en la **operatoria interna de la inmobiliaria**: recepción del reporte, asignación del técnico, ejecución, conformidad, facturación, cobro y liquidación.
- Gestión visual tipo **tablero Kanban (estilo Trello)** con un funnel simple y claro.
- Ingesta de reportes desde la **casilla Gmail exclusiva** de mantenimientos, con asistencia de **IA** para crear la gestión.
- **Mobile-first absoluto para el técnico** (crítico), diseño 100% personalizado (nada genérico de IA).

## 2. Roles del sistema

| Rol | Acceso | Responsabilidad principal |
|---|---|---|
| **Administrador** | Total | Todo: mantenedores, empleados, habilitar/bloquear usuarios en tiempo real, auditoría, todas las acciones del funnel |
| **Gestor de mantenimiento** | Operativa técnica | Inbox de reportes, creación de gestiones, clasificación, asignación de técnicos (viendo su disponibilidad), evaluación de presupuestos y conformidades, alta/enrolamiento de técnicos |
| **Gestor administrativo** | Finanzas | Facturación al inquilino o propietario (según corresponda), registro de cobros, liquidación y comprobante al técnico, envío de documentación por email |
| **Técnico** | Solo sus trabajos, 100% mobile | Aceptar/rechazar asignaciones, inspección, presupuesto, registro de avances, conformidad, gestión de su agenda/disponibilidad |

**SIN acceso al sistema (solo entidades):**

| Entidad | Interacción |
|---|---|
| **Inquilino** | Reporta por email/teléfono a la inmobiliaria. Recibe factura por email cuando el costo le corresponde. |
| **Propietario** | Recibe factura por email cuando le corresponde, y el PDF "Resumen de obras" de su propiedad. |

### 2.1 Permisos en el funnel (punto 16 del brief)

- Cada gestor **ve todo el tablero** pero **solo puede accionar en las columnas de su área**. Las tarjetas fuera de su competencia se ven **opacadas / solo lectura** (puede abrir el detalle informativo, no tomar acciones).
- El **administrador** puede accionar en cualquier columna.
- Las tarjetas son **editables solo hasta cierta etapa** del funnel (definido por etapa en la matriz de la sección 5).

### 2.2 Bloqueo de acceso en tiempo real

- Admin puede **inhabilitar cualquier empleado o técnico** → el bloqueo es inmediato: sesión revocada + realtime + middleware (mismo mecanismo `esta_activo` del original, endurecido).

## 3. Modelo de dominio (entidades)

### ABMs requeridos
- **Propietarios** (ABM)
- **Inquilinos** (ABM)
- **Propiedades** (ABM)
- **Vinculación** propiedad ↔ propietario ↔ inquilino
- **Técnicos** (ABM + enrolamiento con documentación: DNI, seguro, etc. — igual al flujo de MANTIS original: solicitud → evaluación → alta/rechazo; o alta manual directa)
- **Empleados** (usuarios internos con rol)

### Legajos por propiedad (punto 8 — clave)
- Cada propiedad tiene **N legajos**, uno por cada período de ocupación de un inquilino (el inquilino puede cambiar).
- Toda gestión de mantenimiento queda **asentada en el legajo vigente** al momento del reporte.
- Exportable: **PDF "Resumen de obras"** por legajo/propiedad → documentación de respaldo para propietario, inquilino y para el vendedor al recibir llaves (checklist de verificación de reparaciones).

### Otras entidades
- **Gestión de mantenimiento** (la tarjeta del Kanban) con clasificación por especialidad (plomería, electricidad, gas, carpintería…).
  - 🔎 **Urgencia** (normal | urgente) como campo de primera clase, con semántica legal argentina: lo urgente el propietario debe atenderlo en **24 hs** y lo normal en **10 días** (CCyC, régimen supletorio post-DNU 70/2023) — el sistema alerta cuando una gestión urgente se acerca al plazo sin asignación.
  - 🔎 **Causa del deterioro** (desgaste/antigüedad | daño por uso | mejora): input con el que el sistema **sugiere** quién paga (regla CCyC: desgaste → propietario; daño culpable → inquilino), sujeto a lo pactado en el contrato. El gestor siempre confirma.
- **Presupuestos, avances, conformidades** (heredan la mecánica probada del original).
- **Facturas** (a inquilino o propietario), **cobros**, **liquidaciones al técnico** con su **comprobante**.
- **Notificaciones**, **auditoría** (quién hizo qué), **mantenedores** (tablas configurables).

## 4. Ingesta de reportes (Email → Sistema)

Canal oficial: **una casilla Gmail EXCLUSIVA para reportar mantenimientos**.

1. El sistema **escucha esa casilla** y cada mail entrante aparece en un **Inbox** dentro del panel, con notificación al gestor de mantenimiento.
   - 🔎 El inbox registra el **canal** de origen de forma extensible (email | manual | whatsapp-futuro): WhatsApp es el canal real del mercado argentino y es candidato natural para v2, sin cambiar el flujo aguas abajo.
   - 🔎 Acción **"descartar con motivo"** (no corresponde / resuelto por teléfono / duplicado), auditable — benchmark: Latchel resuelve 23% de los tickets sin despachar técnico. Objetivo: **cero mails sin destino** (gestión o descarte con motivo).
2. Desde el mensaje, el gestor puede:
   - **Crear gestión manualmente** (también puede crearla desde cero en el tablero sin mail).
   - **Botón IA**: la IA lee el mail, genera una **síntesis**, la **encuadra en una de las categorías/especialidades definidas en los mantenedores**, e invoca una tool que **da de alta la tarjeta en la primera columna** del tablero.
3. Lo generado por IA es **siempre editable** (hasta la etapa límite del funnel).

## 5. Funnel de gestión (tablero Kanban)

Propuesta de columnas — simplifica el flujo del original eliminando todo lo que dependía del cliente (aprobación de presupuesto por cliente, rechazos del cliente, etc.):

| # | Columna | Responsable de accionar | Editable |
|---|---|---|---|
| 1 | **Ingresado** | Gestor mantenimiento (clasifica, completa datos, vincula propiedad/legajo) | ✔ total |
| 2 | **Asignación** | Gestor mantenimiento (elige técnico **viendo su calendario de disponibilidad** antes de enviar la solicitud); técnico acepta/rechaza | ✔ |
| 3 | **Presupuesto** | Técnico (inspección + presupuesto) → Gestor mantenimiento aprueba/rechaza y define **quién paga: inquilino o propietario** | ✔ parcial |
| 4 | **En ejecución** | Técnico (registra avances con fotos/notas desde el celular) | ✖ (solo avances) |
| 5 | **Conformidad** | Técnico sube conformidad firmada → Gestor mantenimiento la valida (puede rechazar y pedir resubida) | ✖ |
| 6 | **Facturación y cobro** | Gestor administrativo: emite la nota de cobro con detalle, la **envía por email** a inquilino o propietario, registra el cobro | ✖ |
| 7 | **Liquidación técnico** | Gestor administrativo: registra pago al técnico + genera y envía **comprobante con detalle** | ✖ |

🔎 Precisiones de la etapa 6 (domain research):
- **Cobro al propietario, dos mecanismos**: descuento en la **liquidación mensual del alquiler** (el caso común en la práctica argentina) o cobro directo (obras grandes). Ambos se modelan en `cobros`.
- El documento emitido es una **nota de cobro/detalle de obra de la inmobiliaria** que referencia la **factura C** del técnico monotributista — el sistema documenta el circuito fiscal, no lo reemplaza (validar con el contador).
- 🔎 La etapa muestra la **comparación presupuesto aprobado vs costo final** (práctica del líder Property Meld).
| 8 | **Finalizado** | — (cierre; queda en legajo e historial) | ✖ |

Reglas:
- La **etapa vive en la DB como campo explícito** + tabla de eventos (lección del original: los sub-estados derivados en runtime en 3 componentes distintos fueron frágiles).
- Cada transición dispara **notificación al rol que debe accionar** (el sistema avanza por eventos — punto 23).
- Se conservan del original los movimientos de excepción: técnico rechaza asignación → vuelve a Asignación; presupuesto rechazado → reasignar o repropuestar; conformidad rechazada → resubir.

## 6. Agenda y disponibilidad del técnico

- El técnico gestiona su **calendario de disponibilidad** (franjas) — se hereda la funcionalidad de calendario del original.
- El gestor de mantenimiento **visualiza la disponibilidad ANTES de enviar la solicitud de asignación**.

## 7. Finanzas (gestor administrativo)

- Factura de obra al **inquilino o propietario según corresponda** (definido en etapa Presupuesto), con detalle de lo realizado.
- Envío de la factura **por correo desde el sistema**.
- Registro del **cobro**.
- **Liquidación al técnico** + comprobante con detalle, también enviable por email.

## 8. Notificaciones (punto 23 — fundamental)

- Sistema **robusto y 100% en tiempo real** (diseñado desde el día 1, ver ARQUITECTURA.md §4).
- Notificaciones **claras y precisas entre áreas y hacia el técnico**: cada evento del funnel notifica al rol que debe accionar.
- In-app realtime (badge + toast + centro de notificaciones) y email para las externas (facturas, comprobantes).
- 🔎 **Emails de estado automáticos al inquilino** (reporte recibido / técnico asignado / resuelto) — estándar del mercado, reduce re-reclamos. El inquilino recibe, nunca accede.

## 9. Métricas y reportes

- **Cada rol ve solo las métricas de su área** (dashboard propio por rol).
- 🔎 KPIs validados por el research (benchmark de líderes del mercado):
  - **Velocidad de primera respuesta** al reporte (objetivo < 1 h en horario laboral) y **velocidad mediana de resolución** por especialidad ("speed of repair", la métrica estrella de Property Meld) — calculadas del event log.
  - **Cumplimiento de plazos legales**: gestiones urgentes atendidas dentro de las 24 hs.
  - **Score del técnico**: calificación post-obra + desvío presupuesto vs costo final (vendor scorecard).
  - **Calidad del triage IA**: % de gestiones creadas por IA sin edición posterior.
  - **Cero reclamos perdidos**: 100% de mails del inbox con destino (gestión o descarte con motivo).
- Definición fina y priorización: se trabajará con los workflows/agentes **BMAD** (analista Mary) sobre esta base.
- Módulo de reportes **simple, fácil de entender**, con gráficos de **excelente calidad, visuales y representativos** (librería de charts dedicada).

## 10. Mantenedores (solo Administrador)

Apartado del panel visible **únicamente para el administrador**:
- **Especialidades** (plomería, electricidad, gas, carpintería…) — luego usadas para clasificar las gestiones y matchear técnicos.
  - 🔎 Seed inicial (taxonomía estándar del mantenimiento edilicio AR): Plomería, Gas, Electricidad, Albañilería, Pintura/Impermeabilización, Carpintería, Herrería/Cerrajería, Climatización, Techos/Zinguería, Vidriería, Control de plagas, Otros.
  - 🔎 Flag **`requiere_matricula`** por especialidad (Gas: siempre; Electricidad: según jurisdicción) → condiciona la documentación exigida al técnico en el enrolamiento.
- **Roles** — asignables en el mantenedor de **Empleados** a cada usuario tipo empleado.
- Extensible a otros catálogos (tipos de propiedad, etapas configurables, plantillas de email…).

## 11. Auditoría y trazabilidad (punto 24)

- Historial de acciones **de negocio** (no logs internos): *quién hizo qué y cuándo*, accesible al administrador.
- Cada gestión de mantenimiento muestra su **timeline verificable** completo.
- 🔎 El event log con timestamps fehacientes (reporte → notificación → resolución) sirve como **evidencia ante conflictos legales** por plazos de reparación — valor de negocio del módulo, no solo trazabilidad interna. El PDF "Resumen de obras" complementa al **acta de entrega/devolución** estándar del sector.

## 12. UX/UI (puntos 3, 17, 25 — requerimiento fuerte)

- **Vista técnico 100% pensada para celular**: dedos, gestos, animaciones pulidas. CRÍTICO.
- Diseño **100% personalizado**: nada de plantillas genéricas de IA ni cards típicas. Se usará un proceso de diseño real (skills `frontend-design` / `ui-ux-pro-max`, design system propio, referencias pro).
- El funnel debe ser **simple y sumamente claro** para seguir cada gestión de un vistazo.

## 13. Fuera de alcance

- Acceso de inquilinos/propietarios al sistema (portal externo): NO.
- Pagos online integrados (pasarelas): NO en v1 — solo registro de cobros/pagos.
- App nativa: NO — web responsive (PWA como en el original).

## 14. Criterios de éxito

1. Un reporte que entra por Gmail puede convertirse en gestión (con o sin IA) en < 1 minuto.
2. El técnico opera todo su flujo desde el celular sin fricción.
3. Ningún evento del funnel queda sin notificar al rol responsable, en tiempo real.
4. El PDF "Resumen de obras" por legajo sale completo y presentable.
5. Cero acciones fuera de rol (verificado por RLS + permisos por columna).
