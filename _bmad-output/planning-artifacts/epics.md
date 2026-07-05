---
stepsCompleted: [1, 2, 3, 4]
validation:
  fr_coverage: "FR1–FR30 cubiertos — verificado story por story"
  forward_dependencies: "ninguna (3.2 corregida: contador local en vez de notificación push)"
  tables_jit: "cada story crea solo las tablas que necesita"
  simplicidad: "Regla #0 aplicada — 8 épicas, 31 stories, sin features especulativos"
inputDocuments:
  - specs/PRD.md
  - specs/ARQUITECTURA.md
  - _bmad-output/planning-artifacts/research/market-gestion-mantenimiento-inmobiliario-research-2026-07-05.md
  - _bmad-output/planning-artifacts/research/domain-mantenimiento-inmobiliario-argentina-research-2026-07-05.md
---

# MANTIS 2 - Epic Breakdown

## Overview

Descomposición completa de épicas y stories para MANTIS 2 a partir del PRD v1.1.0 y ARQUITECTURA v1.0.0. **Regla #0 del proyecto: SIMPLICIDAD — cada story elige la solución más simple que cumpla el requisito; nada especulativo.**

## Requirements Inventory

### Functional Requirements

FR1: Autenticación de empleados y técnicos (login/logout) con roles: administrador, gestor de mantenimiento, gestor administrativo, técnico.
FR2: Inquilinos y propietarios NO tienen usuario ni acceso — son entidades de datos con contacto (restricción crítica).
FR3: El admin puede habilitar/inhabilitar cualquier empleado o técnico; el bloqueo es inmediato (realtime + middleware).
FR4: ABM de propietarios (datos + contacto email).
FR5: ABM de inquilinos (datos + contacto email).
FR6: ABM de propiedades.
FR7: Vinculación propiedad ↔ propietario ↔ inquilino mediante legajos (un legajo por período de ocupación de un inquilino; el inquilino puede cambiar).
FR8: Exportación de PDF "Resumen de obras" por legajo/propiedad (gestiones realizadas durante el período, con conformidades).
FR9: ABM de técnicos con especialidades; enrolamiento por auto-registro con carga de documentación (DNI, y matrícula si la especialidad lo exige) y evaluación de alta por admin o gestor de mantenimiento; alta manual directa también posible.
FR10: Agenda/disponibilidad del técnico (franjas); el gestor la visualiza antes de enviar la solicitud de asignación.
FR11: Inbox de reportes: el sistema escucha la casilla Gmail exclusiva y muestra cada mail entrante con notificación al gestor de mantenimiento; campo canal extensible (email | manual).
FR12: Acción "descartar con motivo" en el inbox (no corresponde / resuelto por teléfono / duplicado), auditable. Todo mail termina en gestión o descarte.
FR13: Botón IA en el inbox: sintetiza el mail, clasifica especialidad (contra el mantenedor) y urgencia, y crea la card en la primera columna del Kanban vía tool. Siempre editable.
FR14: Creación manual de gestiones desde el tablero (sin mail).
FR15: Tablero Kanban de 8 columnas: Ingresado → Asignación → Presupuesto → En ejecución → Conformidad → Facturación y cobro → Liquidación técnico → Finalizado. Etapa como campo explícito en DB.
FR16: Gestión con campos: especialidad, urgencia (normal|urgente), causa del deterioro (desgaste|daño|mejora), legajo/propiedad vinculada, pagador sugerido/confirmado (inquilino|propietario), descripción.
FR17: Transiciones de etapa SOLO vía función `avanzar_etapa()` (valida permiso por rol/columna, atómica, inserta evento).
FR18: Permisos por columna: cada gestor acciona solo en sus columnas; ve el resto en solo lectura (tarjeta opacada). Admin acciona en todas. Tarjetas editables solo hasta etapa Presupuesto.
FR19: Asignación: gestor elige técnico viendo su disponibilidad; el técnico acepta o rechaza (rechazo → vuelve a Asignación).
FR20: Técnico registra inspección y presupuesto; gestor de mantenimiento aprueba/rechaza y define quién paga (con sugerencia por causa según regla CCyC).
FR21: Técnico registra avances (fotos + notas) desde el celular durante En ejecución.
FR22: Técnico sube conformidad firmada; gestor la valida o rechaza (rechazo → resubir).
FR23: Facturación: gestor administrativo emite nota de cobro con detalle de obra, la envía por email a inquilino o propietario, y registra el cobro (simple: fecha + medio — SIN compensación contra la liquidación del alquiler, fuera de alcance). Muestra comparación presupuesto vs costo final.
FR24: Liquidación al técnico: registro de pago + comprobante con detalle enviado por email; referencia a la factura C del técnico.
FR25: Notificaciones in-app realtime por evento del funnel al rol que debe accionar (badge + toast + centro de notificaciones + no-leídas al reconectar).
FR26: Emails de estado automáticos al inquilino: reporte recibido / técnico asignado / resuelto.
FR27: Mantenedores (solo admin): especialidades (con flag requiere_matricula, seed de 12), roles/empleados.
FR28: Auditoría: historial de acciones de negocio (quién hizo qué y cuándo) para el admin + timeline verificable por gestión.
FR29: Métricas por rol: primera respuesta, velocidad mediana de resolución por especialidad, cumplimiento 24hs urgentes, score técnico (calificación + desvío presupuesto/costo), % gestiones IA sin edición, cero reclamos perdidos.
FR30: Dashboard por rol: cada quien ve solo su área.

### NonFunctional Requirements

NFR1: SIMPLICIDAD (Regla #0): solución más simple que cumpla; sin abstracciones ni features especulativos.
NFR2: Vista técnico 100% mobile-first: dedos, gestos, animaciones pulidas (crítico).
NFR3: Diseño 100% personalizado, sin plantillas genéricas de IA (skills frontend-design / ui-ux-pro-max).
NFR4: Notificaciones robustas y 100% realtime: outbox transaccional, cero eventos perdidos.
NFR5: RLS en todas las tablas desde su primera migración; permisos de columna validados server-side en `avanzar_etapa()`.
NFR6: Reporte→gestión en < 1 minuto (con o sin IA).
NFR7: Bloqueo de usuario efectivo en segundos.
NFR8: Emails solo vía `features/email/service.ts` (Resend) con log en `emails_enviados`.
NFR9: PDFs server-side con @react-pdf/renderer.
NFR10: Sin rutas API salvo webhooks (Gmail) y cron.

### Additional Requirements

- Stack: Next.js 15 App Router + TypeScript + Tailwind 4 + Supabase + Vercel. Proyecto greenfield en `codigo/` (create-next-app, sin starter template externo).
- Patrón features/{modulo}/types.ts + service.ts ('use server'); cliente browser solo auth + realtime.
- Esquema núcleo: usuarios, propietarios, inquilinos, propiedades, legajos, gestiones, eventos_gestion, asignaciones, presupuestos, avances, conformidades, facturas/cobros/liquidaciones, inbox_reportes, notificaciones, especialidades, franjas_disponibilidad, emails_enviados.
- Ingesta Gmail: polling con Vercel Cron para MVP (migrable a push Pub/Sub sin tocar aguas abajo).
- Botón IA: server action → API Claude (claude-sonnet-5) con tool use `crear_gestion`.
- Custom claim de rol en JWT vía trigger en auth.users.
- Matriz evento→rol destinatario en tabla (matriz_notificaciones), no hardcodeada.

### UX Design Requirements

(No existe documento UX todavía — se generará el design system en EPIC-01 con las skills de diseño. Los requisitos UX del PRD están en NFR2/NFR3.)

### FR Coverage Map

FR1: Epic 1 — auth y roles · FR2: Epic 2 (modelo sin usuario) + Epic 1 (restricción auth) · FR3: Epic 1 — bloqueo realtime · FR4: Epic 2 · FR5: Epic 2 · FR6: Epic 2 · FR7: Epic 2 — legajos · FR8: Epic 8 — PDF resumen de obras · FR9: Epic 3 — técnicos · FR10: Epic 3 — agenda · FR11: Epic 6 — inbox Gmail · FR12: Epic 6 — descarte · FR13: Epic 6 — botón IA · FR14: Epic 4 — creación manual · FR15: Epic 4 — kanban · FR16: Epic 4 — campos gestión · FR17: Epic 4 — avanzar_etapa · FR18: Epic 4 — permisos por columna · FR19: Epic 4 — asignación · FR20: Epic 4 — presupuesto · FR21: Epic 4 — avances · FR22: Epic 4 — conformidad · FR23: Epic 7 — facturación/cobro · FR24: Epic 7 — liquidación · FR25: Epic 5 — notificaciones realtime · FR26: Epic 5 — emails de estado · FR27: Epic 1 — mantenedores · FR28: Epic 8 — auditoría · FR29: Epic 8 — métricas · FR30: Epic 8 — dashboards

## Epic List

### Epic 1: Fundaciones, equipo y mantenedores
El equipo de la inmobiliaria puede entrar al sistema con su rol, el admin gestiona empleados (alta, rol, bloqueo inmediato) y configura los mantenedores (especialidades con requiere_matricula, seed de 12). Incluye setup del proyecto, design system propio y layout por rol.
**FRs covered:** FR1, FR2 (parte auth), FR3, FR27 — NFR1, NFR3, NFR5, NFR7

### Epic 2: Cartera — propiedades, propietarios, inquilinos y legajos
El equipo administra la cartera completa: ABMs de propietarios, inquilinos y propiedades, y la vinculación por legajos (períodos de ocupación). Propietarios/inquilinos son entidades sin acceso.
**FRs covered:** FR2, FR4, FR5, FR6, FR7

### Epic 3: Técnicos — enrolamiento y agenda
Los técnicos pueden enrolarse con su documentación (evaluada por admin/gestor de mantenimiento) o ser dados de alta manualmente, y gestionan su disponibilidad desde el celular.
**FRs covered:** FR9, FR10 — NFR2

### Epic 4: Funnel de gestión de mantenimiento (corazón del sistema)
El equipo gestiona todo el ciclo en el tablero Kanban de 8 columnas: creación manual, clasificación, asignación viendo disponibilidad, presupuesto con sugerencia de pagador, ejecución con avances del técnico (mobile), conformidad. Transiciones atómicas con permisos por columna.
**FRs covered:** FR14–FR22 — NFR2, NFR5

### Epic 5: Notificaciones realtime y emails de estado
Cada evento del funnel notifica in-app en tiempo real al rol que debe accionar (outbox transaccional, cero pérdidas) y envía emails de estado automáticos al inquilino.
**FRs covered:** FR25, FR26 — NFR4, NFR8

### Epic 6: Inbox Gmail + IA
Los reportes que llegan a la casilla exclusiva aparecen en el inbox; el gestor los convierte en gestión manualmente, con el botón IA (síntesis + clasificación + card automática) o los descarta con motivo. Cero reclamos perdidos.
**FRs covered:** FR11, FR12, FR13 — NFR6, NFR10

### Epic 7: Finanzas — facturación, cobro y liquidación al técnico
El gestor administrativo emite la nota de cobro (comparación presupuesto vs costo final), la envía por email al pagador, registra el cobro y liquida al técnico con comprobante.
**FRs covered:** FR23, FR24 — NFR8, NFR9

### Epic 8: Trazabilidad, resumen de obras y métricas
El admin audita quién hizo qué; cada gestión muestra su timeline verificable; se exporta el PDF "Resumen de obras" por legajo; y cada rol ve su dashboard con las métricas validadas por el research.
**FRs covered:** FR8, FR28, FR29, FR30 — NFR9

**Dependencias:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. Cada épica es standalone con lo ya construido; ninguna requiere épicas futuras.

---

## Epic 1: Fundaciones, equipo y mantenedores

El equipo entra al sistema con su rol, el admin gestiona empleados y mantenedores. Base técnica y de diseño de todo lo demás.

### Story 1.1: Setup del proyecto y design system base

Como administrador,
quiero que el sistema exista como aplicación desplegable con identidad visual propia,
para que todas las features se construyan sobre una base sólida y consistente.

**Acceptance Criteria:**

**Given** el repo con convención `codigo/` + `specs/`
**When** se inicializa el proyecto (Next.js 15 + TS + Tailwind 4 + Supabase local)
**Then** `npm run dev` levanta la app con página de login shell
**And** existen los tokens del design system propio (colores, tipografía, espaciado — generados con skill frontend-design/ui-ux-pro-max, nada genérico)
**And** el proyecto compila sin errores y tiene estructura `app/ components/ features/ hooks/ shared/`

### Story 1.2: Login y acceso por rol

Como empleado o técnico,
quiero ingresar con email y contraseña y caer en el panel de mi rol,
para trabajar solo con lo que me compete.

**Acceptance Criteria:**

**Given** un usuario existente con rol asignado (admin | gestor_mantenimiento | gestor_administrativo | tecnico)
**When** hace login
**Then** es redirigido al layout de su rol y su rol viaja como custom claim en el JWT
**And** las tablas `usuarios` tienen RLS activo desde su primera migración
**Given** un inquilino o propietario
**When** se intenta cualquier acceso
**Then** es imposible: no existen en `auth.users` (FR2)

### Story 1.3: ABM de empleados con asignación de rol

Como administrador,
quiero dar de alta empleados y asignarles rol desde el mantenedor de empleados,
para controlar quién hace qué en el sistema.

**Acceptance Criteria:**

**Given** el admin en el mantenedor de empleados (visible solo para admin)
**When** crea un empleado con nombre, email y rol
**Then** el empleado recibe credenciales y puede loguearse con su rol
**And** el admin puede editar rol y datos, y ver el listado completo
**Given** un usuario no-admin
**When** intenta acceder al mantenedor
**Then** no lo ve en la navegación y la ruta le es denegada (server-side)

### Story 1.4: Bloqueo y habilitación en tiempo real

Como administrador,
quiero inhabilitar a cualquier empleado o técnico con efecto inmediato,
para cortar el acceso ante cualquier problema.

**Acceptance Criteria:**

**Given** un usuario activo con sesión abierta
**When** el admin lo inhabilita
**Then** en segundos el usuario queda fuera (realtime sobre `esta_activo` + chequeo en middleware + revocación de refresh tokens)
**And** al intentar loguearse ve "cuenta inhabilitada"
**When** el admin lo rehabilita
**Then** puede volver a ingresar normalmente

### Story 1.5: Mantenedor de especialidades

Como administrador,
quiero gestionar las especialidades de mantenimiento,
para que gestiones y técnicos se clasifiquen con un catálogo único.

**Acceptance Criteria:**

**Given** el mantenedor de especialidades (solo admin)
**When** se corre el seed inicial
**Then** existen las 12 especialidades del research (Plomería, Gas, Electricidad, Albañilería, Pintura/Impermeabilización, Carpintería, Herrería/Cerrajería, Climatización, Techos/Zinguería, Vidriería, Control de plagas, Otros) con su flag `requiere_matricula` (Gas: true)
**And** el admin puede crear, renombrar y desactivar especialidades (no borrar si están en uso)

---

## Epic 2: Cartera — propiedades, propietarios, inquilinos y legajos

### Story 2.1: ABM de propietarios

Como gestor (mantenimiento o administrativo),
quiero administrar propietarios con sus datos de contacto,
para vincularlos a propiedades y enviarles documentación por email.

**Acceptance Criteria:**

**Given** el módulo de propietarios
**When** se crea/edita un propietario (nombre, email, teléfono, CUIT opcional)
**Then** queda disponible para vincular a propiedades
**And** el email es obligatorio y validado (es el canal de facturas y resúmenes)
**And** no se puede eliminar un propietario con propiedades vinculadas (solo desactivar)

### Story 2.2: ABM de inquilinos

Como gestor,
quiero administrar inquilinos con sus datos de contacto,
para asociarlos a legajos y notificarlos por email.

**Acceptance Criteria:**

**Given** el módulo de inquilinos
**When** se crea/edita un inquilino (nombre, email, teléfono, DNI opcional)
**Then** queda disponible para asociar a un legajo
**And** aplican las mismas reglas de email obligatorio y baja lógica que propietarios

### Story 2.3: ABM de propiedades

Como gestor,
quiero administrar las propiedades de la cartera,
para que toda gestión de mantenimiento quede anclada a una propiedad.

**Acceptance Criteria:**

**Given** el módulo de propiedades
**When** se crea/edita una propiedad (dirección, tipo, propietario vinculado)
**Then** la propiedad muestra su propietario actual y su estado de ocupación
**And** el listado permite buscar por dirección y filtrar por propietario

### Story 2.4: Legajos — historial de ocupación por inquilino

Como gestor,
quiero abrir y cerrar legajos que vinculan propiedad + inquilino por período,
para que el historial de obras quede asentado por ocupación (y exportable después).

**Acceptance Criteria:**

**Given** una propiedad con propietario
**When** se abre un legajo con un inquilino y fecha de inicio
**Then** queda como legajo vigente de la propiedad (solo puede haber uno vigente por propiedad)
**When** el inquilino se va y se cierra el legajo con fecha de fin
**Then** el legajo pasa a histórico y se puede abrir uno nuevo con otro inquilino
**And** la propiedad muestra la lista completa de legajos (vigente + históricos)

---

## Epic 3: Técnicos — enrolamiento y agenda

### Story 3.1: Alta manual de técnico

Como administrador o gestor de mantenimiento,
quiero dar de alta un técnico con sus especialidades y documentación,
para incorporarlo directamente a la red de la inmobiliaria.

**Acceptance Criteria:**

**Given** el módulo de técnicos
**When** se crea un técnico con datos, especialidades y documentación (DNI; matrícula obligatoria si alguna especialidad tiene `requiere_matricula`)
**Then** el técnico queda habilitado, puede loguearse y aparece como asignable en sus especialidades
**And** sin matrícula cargada no se le puede asignar una especialidad que la exige

### Story 3.2: Auto-enrolamiento de técnico

Como técnico nuevo,
quiero registrarme desde el celular cargando mi documentación,
para postularme a trabajar con la inmobiliaria.

**Acceptance Criteria:**

**Given** la página pública de enrolamiento (mobile-first)
**When** el técnico completa datos, especialidades y sube su documentación
**Then** queda una solicitud "pendiente de evaluación" y NO puede acceder al sistema todavía
**And** el módulo de técnicos muestra un contador de solicitudes pendientes visible para admin y gestor de mantenimiento (la notificación push in-app llega con la Épica 5, sin cambiar esta story)

### Story 3.3: Evaluación de solicitudes de técnicos

Como administrador o gestor de mantenimiento,
quiero revisar la documentación y aprobar o rechazar solicitudes,
para controlar la calidad de la red de técnicos.

**Acceptance Criteria:**

**Given** una solicitud pendiente con documentación visible
**When** se aprueba
**Then** el técnico queda habilitado y recibe email de bienvenida
**When** se rechaza (con motivo)
**Then** el técnico recibe email con el motivo y la solicitud queda archivada

### Story 3.4: Agenda de disponibilidad del técnico

Como técnico,
quiero cargar mis franjas de disponibilidad desde el celular,
para recibir asignaciones solo cuando puedo trabajar.

**Acceptance Criteria:**

**Given** el técnico logueado en su vista mobile
**When** carga/edita franjas de disponibilidad (día + rango horario)
**Then** su calendario refleja los cambios al instante
**And** la interacción es táctil y pulida (gestos, targets grandes) — NFR2

---

## Epic 4: Funnel de gestión de mantenimiento

### Story 4.1: Crear gestión de mantenimiento manual

Como gestor de mantenimiento,
quiero crear una gestión con sus datos esenciales,
para iniciar el seguimiento de un mantenimiento reportado.

**Acceptance Criteria:**

**Given** el formulario de nueva gestión
**When** se completa descripción, propiedad (→ legajo vigente auto-vinculado), especialidad, urgencia y causa del deterioro
**Then** la gestión nace en etapa "Ingresado" con pagador SUGERIDO por la causa (desgaste→propietario, daño→inquilino) sin confirmar
**And** la gestión queda con `gestor_id` = el gestor que la creó (ownership — solo el admin podrá cambiarlo)
**And** si la urgencia es "urgente" la tarjeta lo muestra de forma inequívoca (plazo legal 24h)

### Story 4.2: Tablero Kanban con permisos por columna

Como miembro del equipo,
quiero ver el funnel completo en un tablero de 8 columnas y accionar solo donde me compete,
para seguir cada gestión de un vistazo sin pisar áreas ajenas.

**Acceptance Criteria:**

**Given** gestiones en distintas etapas
**When** un gestor de mantenimiento mira el tablero
**Then** ve ÚNICAMENTE las gestiones donde él es `gestor_id` (ownership — enforced por RLS, no solo UI); las tarjetas de columnas ajenas (Facturación, Liquidación) se ven opacadas y de solo lectura
**And** el gestor administrativo ve las gestiones en sus columnas y el resto opacado; el admin ve todas y acciona en todas
**And** las tarjetas son editables solo hasta la etapa Presupuesto (FR18)
**And** el tablero se actualiza en tiempo real cuando otra persona mueve una tarjeta

### Story 4.3: Transiciones de etapa atómicas

Como sistema,
quiero que toda transición pase por `avanzar_etapa()` en Postgres,
para que sea imposible avanzar sin permiso ni sin evento registrado.

**Acceptance Criteria:**

**Given** una gestión en cualquier etapa
**When** un usuario con permiso ejecuta la transición
**Then** en UNA transacción cambia la etapa e inserta el evento en `eventos_gestion` (quién, cuándo, de→a)
**When** un usuario sin permiso para esa columna lo intenta (incluso por API directa)
**Then** la función lo rechaza server-side
**And** los movimientos de excepción funcionan: rechazo de técnico → Asignación; conformidad rechazada → re-subir

### Story 4.4: Asignación de técnico con disponibilidad visible

Como gestor de mantenimiento,
quiero elegir técnico viendo su disponibilidad antes de enviarle la solicitud,
para asignar bien a la primera.

**Acceptance Criteria:**

**Given** una gestión en "Asignación" con especialidad definida
**When** el gestor abre el selector de técnico
**Then** ve solo técnicos habilitados de esa especialidad con su calendario de disponibilidad
**When** envía la solicitud
**Then** el técnico la ve en su vista mobile y puede aceptar o rechazar (con motivo)
**And** si rechaza, la gestión vuelve a "Asignación" para reasignar

### Story 4.5: Inspección, presupuesto y decisión de pagador

Como técnico,
quiero cargar mi inspección y presupuesto desde el celular,
para que el gestor lo evalúe y la obra pueda arrancar.

**Acceptance Criteria:**

**Given** una asignación aceptada
**When** el técnico carga inspección (notas + fotos) y presupuesto (materiales + mano de obra)
**Then** el gestor de mantenimiento recibe la tarea de evaluarlo
**When** el gestor aprueba
**Then** CONFIRMA el pagador (inquilino|propietario — puede corregir la sugerencia) y la gestión pasa a "En ejecución"
**When** el gestor rechaza (con motivo)
**Then** el técnico puede re-presupuestar o el gestor reasignar

### Story 4.6: Registro de avances del técnico

Como técnico,
quiero registrar avances con fotos y notas desde el celular,
para dejar constancia del trabajo mientras lo hago.

**Acceptance Criteria:**

**Given** una gestión "En ejecución" asignada al técnico
**When** sube un avance (foto desde cámara + nota corta)
**Then** el avance aparece en el timeline de la gestión al instante
**And** subir foto + nota toma ≤ 3 taps desde su pantalla principal (NFR2)

### Story 4.7: Conformidad firmada y validación

Como técnico,
quiero subir la conformidad firmada al terminar,
para que el gestor la valide y el trabajo quede formalmente cerrado.

**Acceptance Criteria:**

**Given** una gestión "En ejecución" con la obra terminada
**When** el técnico sube la foto de la conformidad firmada
**Then** la gestión pasa a "Conformidad" y el gestor recibe la tarea de revisarla
**When** el gestor la aprueba
**Then** pasa a "Facturación y cobro" con el costo final registrado
**When** la rechaza (ilegible/incompleta, con motivo)
**Then** el técnico puede resubir sin cambiar de etapa

### Story 4.8: Reasignación de gestor responsable (solo admin)

Como administrador,
quiero reasignar el gestor responsable de una gestión,
para redistribuir la carga o cubrir ausencias sin que nadie más pueda tocarlo.

**Acceptance Criteria:**

**Given** una gestión con `gestor_id` asignado
**When** el admin la reasigna a otro gestor de mantenimiento
**Then** el cambio queda como evento auditado en `eventos_gestion` (quién, cuándo, de quién→a quién)
**And** el gestor anterior DEJA de ver la gestión en su tablero y el nuevo la ve al instante
**When** un gestor de mantenimiento intenta cambiar `gestor_id` (incluso por API)
**Then** es rechazado server-side (RLS/función — solo rol administrador)

---

## Epic 5: Notificaciones realtime y emails de estado

### Story 5.1: Outbox transaccional de notificaciones

Como sistema,
quiero generar las notificaciones dentro de la misma transacción del evento,
para que ningún evento del funnel quede sin notificar.

**Acceptance Criteria:**

**Given** la tabla `matriz_notificaciones` (evento → rol destinatario, editable como mantenedor)
**When** `avanzar_etapa()` inserta un evento
**Then** un trigger inserta las filas en `notificaciones` para los usuarios del rol destinatario, en la MISMA transacción
**And** si el trigger falla, la transición también (atomicidad total)

### Story 5.2: Centro de notificaciones realtime

Como usuario del sistema,
quiero enterarme al instante cuando me toca accionar,
para que la gestión nunca quede frenada esperando que alguien mire.

**Acceptance Criteria:**

**Given** un usuario logueado
**When** se crea una notificación para él
**Then** en < 2 segundos ve badge actualizado + toast (Supabase Realtime, filtrado por RLS a las propias)
**And** el centro de notificaciones lista no-leídas primero, con link directo a la gestión
**When** el websocket estuvo caído y reconecta
**Then** el fetch inicial recupera las no-leídas (cero pérdidas percibidas)

### Story 5.3: Emails de estado automáticos al inquilino

Como inquilino (sin acceso al sistema),
quiero recibir emails cuando mi reclamo avanza,
para saber que me están atendiendo sin llamar a la inmobiliaria.

**Acceptance Criteria:**

**Given** una gestión vinculada a un legajo con inquilino con email
**When** ocurre: creación / técnico asignado / conformidad aprobada
**Then** el inquilino recibe el email de estado correspondiente (plantillas React Email vía Resend)
**And** cada envío queda logueado en `emails_enviados` (destinatario, tipo, gestión, timestamp)
**And** los emails salen SOLO desde `features/email/service.ts` (NFR8)

---

## Epic 6: Inbox Gmail + IA

### Story 6.1: Ingesta de la casilla Gmail al inbox

Como gestor de mantenimiento,
quiero que cada mail a la casilla de mantenimientos aparezca en el inbox del panel,
para no depender de tener el Gmail abierto.

**Acceptance Criteria:**

**Given** la casilla Gmail exclusiva configurada
**When** llega un mail nuevo
**Then** en ≤ 2 minutos aparece en `inbox_reportes` (polling Vercel Cron + Gmail API) con remitente, asunto, cuerpo y canal='email'
**And** el gestor recibe notificación in-app realtime
**And** los mails ya ingestados no se duplican (idempotencia por message-id)

### Story 6.2: Del mail a la gestión (o descarte con motivo)

Como gestor de mantenimiento,
quiero convertir cada mail en gestión o descartarlo con motivo,
para que ningún reclamo quede sin destino.

**Acceptance Criteria:**

**Given** un mail en el inbox
**When** el gestor elige "crear gestión"
**Then** se abre el formulario de la Story 4.1 pre-cargado con los datos del mail, y al guardar el mail queda vinculado a la gestión
**When** elige "descartar" (no corresponde | resuelto por teléfono | duplicado + nota)
**Then** el mail queda archivado con motivo y autor (auditable)
**And** el inbox muestra solo lo pendiente; nada puede quedar sin estado

### Story 6.3: Botón IA — síntesis y alta automática

Como gestor de mantenimiento,
quiero que la IA lea el mail y cree la gestión clasificada,
para pasar de reporte a tarjeta en segundos.

**Acceptance Criteria:**

**Given** un mail en el inbox
**When** el gestor toca el botón IA
**Then** un server action llama a Claude (tool use `crear_gestion`) que devuelve: síntesis, especialidad (SOLO del catálogo del mantenedor), urgencia sugerida y propiedad inferida si el texto lo permite
**And** la gestión se crea en "Ingresado" marcada como origen IA, 100% editable
**And** si la IA no puede clasificar, cae en especialidad "Otros" y lo indica — nunca falla silenciosamente
**And** reporte→gestión toma < 1 minuto (NFR6)

---

## Epic 7: Finanzas — facturación, cobro y liquidación

### Story 7.1: Nota de cobro con detalle de obra

Como gestor administrativo,
quiero emitir la nota de cobro con el detalle de lo realizado y enviarla por email al pagador,
para iniciar el cobro con respaldo completo.

**Acceptance Criteria:**

**Given** una gestión en "Facturación y cobro" con pagador confirmado
**When** el gestor emite la nota de cobro
**Then** se genera el PDF (detalle de obra, avances, costo final, comparación presupuesto vs costo final, referencia a factura C del técnico) — @react-pdf/renderer
**And** se envía por email al inquilino o propietario según el pagador, con log en `emails_enviados`

### Story 7.2: Registro del cobro

Como gestor administrativo,
quiero registrar cómo se cobró la obra,
para cerrar el circuito financiero con el pagador.

**Acceptance Criteria:**

**Given** una nota de cobro emitida
**When** el pagador es el propietario
**Then** el gestor registra el cobro (fecha + medio de pago)
**And** aplica igual para inquilino o propietario — un solo mecanismo simple
**And** al registrar el cobro la gestión pasa a "Liquidación técnico"

### Story 7.3: Liquidación al técnico con comprobante

Como gestor administrativo,
quiero registrar el pago al técnico y enviarle su comprobante,
para dejar la gestión completamente saldada.

**Acceptance Criteria:**

**Given** una gestión en "Liquidación técnico"
**When** el gestor registra el pago (monto, fecha, referencia a la factura C del técnico)
**Then** se genera el comprobante PDF con detalle y se envía por email al técnico
**And** la gestión pasa a "Finalizado" y queda asentada en el legajo

---

## Epic 8: Trazabilidad, resumen de obras y métricas

### Story 8.1: Timeline por gestión y auditoría global

Como administrador,
quiero ver quién hizo qué y cuándo — global y por gestión,
para tener trazabilidad completa y evidencia ante conflictos.

**Acceptance Criteria:**

**Given** los eventos de `eventos_gestion` + acciones de ABM auditadas
**When** el admin abre la auditoría global
**Then** ve el historial filtrable por usuario, tipo de acción y fecha (acciones de negocio, no logs internos)
**And** cada gestión muestra su timeline completo con timestamps fehacientes (evidencia de plazos legales 24h/10d)

### Story 8.2: PDF "Resumen de obras" por legajo

Como gestor,
quiero exportar el resumen de obras de un legajo o propiedad,
para respaldar a propietario, inquilino y al vendedor que verifica reparaciones al recibir llaves.

**Acceptance Criteria:**

**Given** un legajo con gestiones finalizadas
**When** se exporta el "Resumen de obras"
**Then** el PDF lista cada obra del período: fecha, especialidad, descripción, técnico, costo, pagador y conformidad
**And** se puede exportar por legajo individual o por propiedad (todos los legajos)
**And** se puede enviar por email al propietario desde el sistema

### Story 8.3: Dashboards de métricas por rol

Como usuario del sistema,
quiero ver las métricas de mi área en mi dashboard,
para tomar decisiones con datos.

**Acceptance Criteria:**

**Given** los eventos históricos del funnel
**When** el gestor de mantenimiento abre su dashboard
**Then** ve: velocidad de primera respuesta, velocidad mediana de resolución por especialidad, cumplimiento 24h de urgentes, % gestiones IA sin edición
**And** el gestor administrativo ve: cobros pendientes/realizados, liquidaciones, montos por período
**And** el admin ve todo + score de técnicos (calificación + desvío presupuesto/costo)
**And** los gráficos usan el design system (skill dataviz) — visuales y representativos, cada rol ve SOLO su área
