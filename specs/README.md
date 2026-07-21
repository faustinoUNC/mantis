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
| [STORY-1021](STORY-1021.md) | Fotos del cliente en el inbox: la ingesta baja los adjuntos de imagen del mail (hasta 5, `image/*`, ≤10 MB) al bucket `gestiones` y la card del inbox los muestra como miniaturas; al convertir en gestión los paths viajan a `gestiones.fotos_reporte_paths` y el detalle muestra "Fotos del reporte" bajo la descripción, visible para todos los roles (el técnico ve el problema antes de ir). Antes la foto se perdía en silencio | ✅ hecha |
| [STORY-1020](STORY-1020.md) | Volver contextual: el "← Volver" del detalle de gestión pasa de `/tablero` fijo a `router.back()` con fallback al tablero (o `/tecnico`) — vuelve a Finanzas/cartera/técnico/auditoría/archivo, donde sea que se abrió; la pestaña de Finanzas vive en la URL (`?tab=`) para que el back restaure Cobros/Liquidaciones/Adelantos exacta. Los breadcrumbs "← Técnicos"/"← Administración" no se tocan (nombran su destino) | ✅ hecha |
| [STORY-1019](STORY-1019.md) | Ciclo de vida de los adelantos (card #141): pestaña "Adelantos" en Finanzas (En obra / A resolver / Saldados por mes) sobre un read-model único en `features/finanzas/` — cero tablas, la liquidación salda sola el camino feliz; evento `adelanto_saldado` con nota obligatoria (botón en la constancia, admin+administrativo); ítems "a resolver" por desasignación, cancelación y sobrante de liquidación; card en el perfil staff del técnico + aviso ámbar al liquidar con deuda abierta (no bloquea ni descuenta); la tool de finanzas de Walter envuelve la misma lectura (solo roles que ven Finanzas). Revierte conscientemente el "sin lista global / sin marcar resuelto" de STORY-1014 (15ª sesión, caso real del E2E) | 📋 aprobada |
| [STORY-1018](STORY-1018.md) | Tope de adelanto de materiales (card #140): aviso ámbar con confirmación (NUNCA bloqueo — la v1.1 de STORY-977 removió el tope duro por romper casos legítimos) cuando el acumulado supera `materiales del presupuesto vigente + ampliaciones aprobadas del técnico actual` (la ampliación suma entera, a sabiendas; mano de obra afuera); vive en el paso de confirmación existente con el excedente concreto; `excedente_tope` congelado en el evento para Auditoría. El "límite que sigue a la re-presupuestación" no se programa: la fórmula lee el presupuesto vigente | 📋 aprobada |
| [STORY-1017](STORY-1017.md) | Ampliación de presupuesto durante la obra (card #123): el técnico pide el gasto extra (monto + motivo) en plena ejecución y el pagador lo autoriza ANTES de gastarlo — circuito espejo del presupuesto inicial (email sin PDF con los tres números + gate `enviada_pagador_en` para registrar la autorización). Tabla propia `ampliaciones` (no contamina `presupuestos`); rechazo con motivo notificado al técnico; desasignar rechaza las del saliente; en Cobro, aviso ámbar (no candado) si el costo final supera lo autorizado (aprobado + ampliaciones del técnico actual). La re-aprobación post-obra de la card original quedó descartada: con la fórmula del costo final cerrada era teatro | 🔨 en prueba |
| [STORY-1016](STORY-1016.md) | Tarjeta del tablero rota cuando el técnico no continúa (card #137): el badge "Técnico no continúa" no tenía `shrink-0`/`whitespace-nowrap` y en la columna angosta se partía en dos renglones inflando la caja ámbar y aplastando la especialidad a "G…". Fix: badge corto "En pausa" (mismo vocabulario que la vista del técnico) en una sola línea. Solo el tablero; el detalle conserva el texto largo | 🔨 en prueba |
| [STORY-1015](STORY-1015.md) | Walter borraba el chat al navegar entre secciones (card #135): `PanelShell` y `<Walter>` se re-montan al cruzar de un layout de sección a otro, y los mensajes vivían solo en `useChat`. Fix: persistir `messages` en `sessionStorage` (`walter-chat`, por pestaña) igual que ya se hace con la posición de la burbuja; "Nueva" limpia la clave | 🔨 en prueba |
| [STORY-1014](STORY-1014.md) | Desasignar técnico con adelanto (card #134): el adelanto del saliente ya no se hereda — `avanzar_etapa()` lo congela como `adelanto_saliente` en el evento y resetea la columna (el entrante arranca en cero; liquidación y panel quedan bien solos); el modal avisa en ámbar y acepta una devolución/ajuste opcional en el acto (patrón "monto en la salida" de STORY-967); constancia permanente en el detalle con el neto a resolver. RPC versionado por primera vez en `scripts/avanzar_etapa.sql` | 🔨 en prueba |
| [STORY-1013](STORY-1013.md) | Walter no expone el fee de la inmobiliaria (`cargo_admin`) al técnico (auditoría de robustez 2026-07-19): la tool compartida `detalle_gestion` devolvía el fee también al rol técnico, un dato que la UI le oculta (vive solo en `FinanzasAcciones`, rol administrativo). Fix de un campo: `cargo_admin` condicional al rol. El resto de lo financiero (pagador, costo final, adelanto) se mantiene por paridad con la UI | 🔨 en prueba |
| [STORY-1009](STORY-1009.md) | Número identificador visible de gestión (card #128): columna `numero` secuencial asignada por la DB (backfill cronológico), `#N` en la tarjeta del tablero, header del detalle (reemplaza el prefijo UUID), mis-trabajos del técnico y archivadas; buscable por N° (con o sin `#`) en las tres vistas; el combo "¿Surgió de otra gestión?" y los PDF de finanzas usan el mismo número | ✅ done |
| [STORY-1007](STORY-1007.md) | Walter — asistente IA con burbuja flotante y tools por rol: chat con streaming (Vercel AI SDK + `claude-haiku-4-5`, route handler único como excepción documentada), 16 tools read-only que reusan los services con RLS de sesión (el rol JAMÁS viaja del cliente; catálogo por rol = matriz de guards), botones deep-link whitelisteados, guardrails de demo (límites duros, off-topic, errores amables). Cero tablas, cero escritura | ✅ done |
| [STORY-1005](STORY-1005.md) | Informes: renombrar los gráficos "Cumplimiento de presupuesto/plazo" a "Desvíos de presupuesto" y "Desvío de plazo" (reunión con Andres 2026-07-18, card #126) — el nombre confundía el signo; los gráficos ya medían desvío. Solo copy | ✅ done |
| [STORY-1004](STORY-1004.md) | Embudo de gestión en tiempo real (reunión con Andres 2026-07-18, card #125): el embudo pasaba a foto "ahora" — gestiones activas por etapa actual (excluye finalizado/cancelada), barra más alta = cuello de botella, coloreada por magnitud. Se sacó de la caja "En el período" a un bloque de estado actual "Carga por etapa" (badge "ahora"); "Cuellos de botella"/"Tiempo de ciclo" quedan del período. v1.1 (audit "¿es en vivo?"): confirmado que YA es en vivo — `PanelMetricas` vive dentro de `InicioRol`, que ya se suscribe a `gestiones` (router.refresh re-fetchea las métricas). Se revirtió un intento de re-suscribir dentro del panel que duplicaba el canal `vivo-gestiones` (error de consola) | ✅ done |
| [STORY-1003](STORY-1003.md) | Bug del desvío de la rendición (detectado en la reunión con Andres 2026-07-18): comparaba lo gastado en materiales contra el presupuesto TOTAL (materiales + mano de obra) → daba negativo aunque el técnico gastara de más. Fix: desvío = rendido − materiales presupuestados (como Informes) + labels sin ambigüedad ("Total final gastado en materiales — sin contar tu mano de obra" en el input del técnico, "Gastado en materiales (rendido)" en Conformidad/Cobro/Liquidación) | ✅ done |
| [STORY-1002](STORY-1002.md) | Adelanto de materiales (reunión con Andres 2026-07-18): la caja de En ejecución muestra lo que el técnico presupuestó en materiales (la referencia para decidir cuánto adelantar) y exige comprobante por cada adelanto (recibo firmado o transferencia, PDF/imagen ≤8 MB) — el path queda en el detalle del evento (sin migración) y la Actividad muestra "Ver comprobante" con URL firmada | ✅ done |
| [STORY-1001](STORY-1001.md) | Gestiones vinculadas (card #19): camino para el trabajo adicional descubierto durante la ejecución o la inspección — columna `gestion_origen_id`, combo opcional "¿Surgió de otra gestión?" en el alta (propiedad autocompletada), chip de vínculo + resaltado por hover en el tablero, "Surgió de"/"Gestiones vinculadas" en el detalle y cartel ámbar informativo (NO bloqueo) al aprobar conformidad de la madre con vinculadas en curso. Descartados: bloqueo de la madre y visor gráfico | ✅ done |
| [STORY-1000](STORY-1000.md) | Cobro como gestor financiero (card #111): la whitelist del trigger `proteger_gestiones_update` no conocía las columnas de cobro nuevas (`medio_cobro_2`/`cobrado_monto_2` STORY-950, `recargo_tarjeta_*` STORY-975, `adelanto_materiales` STORY-977) → tarjeta de crédito con recargo, pago combinado y adelanto morían con `sin_permiso` para ese rol (como admin funcionaba). Fix: migración que recrea el trigger con la lista completa — sin cambios en `codigo/` | ✅ done |
| [STORY-999](STORY-999.md) | Tipo de inmueble: se suma **Duplex** (faltaba en el select de Giuliano `d7ab4d3`), el tipo se muestra en la card del detalle de gestión, se arregla la dirección cortada (envuelve en vez de truncar) y se agrega un único input opcional **"Piso / unidad"** (columna `unidad`) para sub-descripción de ubicación (piso+depto, casa en complejo, nº de local) — pedido UX de Fausti | ✅ done |
| [STORY-998](STORY-998.md) | Técnicos: filtro por estado — control segmentado Todas/Pendientes/Aprobados/Rechazados (patrón Auditoría/Finanzas) integrado al buscador, "Buscar por", paginado y orden pendientes-primero ya existentes — pedido UX de Fausti | ✅ done |
| [STORY-997](STORY-997.md) | Botones de acción icon-only con tooltip estético: componentes reusables `BotonIcono` + `ConTooltip`; las acciones de barra/fila (Nueva gestión/Alta manual/Nuevo empleado/Nueva especialidad/Nueva administración → ＋; Ver detalle → 👁; Inhabilitar → ⃠; Editar → ✎; Actualizar → ⟳) pasan a solo ícono con tooltip; los submits de formulario conservan texto — pedido UX de Fausti | ✅ done |
| [STORY-996](STORY-996.md) | Simplificar las explicaciones de métricas: en la card de asignación de técnico el `title` nativo pasa a un tooltip estético (`ConTooltip`, cajita `bg-foreground`) con textos cortos, y en el Inicio las 10 descripciones `ayuda` se acortan a una línea sin jerga ("igual que en Informes"/"event log"/"circuito") — pedido UX de Fausti | ✅ done |
| [STORY-995](STORY-995.md) | Visor de fotos único (lightbox): tap en cualquier miniatura del detalle → overlay a pantalla completa (reemplaza el `<a target=_blank>` de la 991); token `visor-foto` en el contract — evolución del contract propuesta en la auditoría UX | 📝 borrador |
| [STORY-994](STORY-994.md) | Reconciliar la escala tipográfica: decidir body 14 vs 15px (~213 usos de `text-sm`) y micro (token `caption:12px` o piso duro 13px) para eliminar los tres "chicos" que conviven sin criterio — evolución del contract, requiere decisión de Fausti | 📝 borrador |
| [STORY-993](STORY-993.md) | Skeletons de carga por ruta (`loading.tsx`): hoy no hay ni uno en toda la app y el contract los manda; esqueletos del layout final en detalle, tablero, informes, finanzas e inbox (patrón `SkeletonCard`, respeta reduced-motion) — cumplimiento pendiente detectado en la auditoría UX | 📝 borrador |
| [STORY-992](STORY-992.md) | Token `section-header`: un solo estilo para encabezados de sección (13px/600 muted, sin uppercase) — hoy el mismo nivel usa 4 tamaños distintos (legajos/finanzas/métricas/detalle); evolución del contract propuesta en la auditoría UX | 📝 borrador |
| [STORY-991](STORY-991.md) | Pulido visual premium dentro del contract: 12 fixes de cumplimiento sin tocar funcionalidad — sacar `uppercase tracking-wide` prohibido, ring de foco esmeralda en todos los clickables, `prefers-reduced-motion`, hex→tokens, montos→mono, targets ≥44px del técnico (campana/quitar-foto), nota de avance a textarea, fotos ampliables, grupo de acciones de legajos — auditoría de 5 agentes UX (tsc+eslint verdes; sin commitear) | 🚧 en desarrollo |
| [STORY-990](STORY-990.md) | Encabezados de página consistentes: se elimina la "palabrita gris" de arriba (rótulos inconsistentes/jerga: Funnel, Mantenedor, Trazabilidad), el título pasa a ser el nombre del ítem del menú y cada página lleva una frase corta en criollo; Auditoría deja de decir "event log/timestamps" — pedido UX de Fausti | ✅ done |
| [STORY-989](STORY-989.md) | Sidebar del staff colapsable a rail de íconos: flechita (chevron) que colapsa el panel de `w-56` a `w-16` (solo íconos, labels como tooltip) y lo expande; estado persistido en localStorage vía `useSyncExternalStore`; el pie oculta nombre/rol/"Salir" con `group-data` — pedido UX de Fausti | ✅ done |
| [STORY-988](STORY-988.md) | Registro de técnico responsive: `min-w-0` en la raíz de `InputArchivo` — el nombre de archivo largo de un documento adjunto estiraba el grid (item con `min-width:auto`) y generaba scroll horizontal que tapaba el "×" de eliminar y el botón "Enviar solicitud"; reproducido y re-verificado a 360px — card Trello #109 | ✅ done |
| [STORY-987](STORY-987.md) | Asignar técnico: la card con 7 métricas pasa a **lista compacta** (una fila por técnico, especialidades como chip de la que matchea + resto con `+N` sin truncar, calif/carga/horarios inline; el detalle de métricas restantes solo en la fila seleccionada) — escala a decenas de técnicos — card Trello #48 | ✅ done |
| [STORY-986](STORY-986.md) | Liquidación: el PDF automático se renombra "detalle de liquidación" (no es un comprobante, es la planilla que arma MANTIS) y se puede adjuntar un comprobante de pago real opcional al liquidar (transferencia PDF/imagen o foto del recibo firmado) que se suma al email del técnico junto al detalle; `enviarEmail` pasa a múltiples adjuntos, columna `liq_comprobante_path` — card Trello #46 | ✅ done |
| [STORY-985](STORY-985.md) | Historial de la propiedad + Resumen de obras honesto: sección "Historial" en la página de la propiedad (línea de tiempo con los legajos como capítulos y las obras sin legajo en "Propiedad sin ocupar"; encabezado con obras/terminadas/invertido + split por pagador; chip ámbar de especialidad reincidente ≥3) y PDF con tres estados reales (Terminada con fecha real / En curso / Cancelada — la sin cargo afuera), "qué se hizo" del presupuesto aprobado y totales del período — diseño de party mode, décima sesión | ✅ done |
| [STORY-984](STORY-984.md) | Cumplimiento de plazo honesto: helper `ejecucionParaPlazoDias` (solo obras terminadas — salida a `conformidad`, allowlist — y piso de 1 día coherente con el `min="1"` del form) en la card de Informes y en los chips del picker; canceladas con/sin cargo y desasignaciones dejan de computar como cumplimiento y las obras de horas dejan de dar −98% — card Trello #106, investigación BMAD con datos reales | ✅ done |
| [STORY-983](STORY-983.md) | Reasignación sin restos del técnico saliente: columnas de autor `tecnico_id` en `presupuestos`/`conformidades` (patrón `avances`, backfill por última desasignación), gates de inspección y de avance scoped al técnico actual (UI + server), carteles de rechazo solo del propio presupuesto/conformidad, card "Inspección del técnico" del gestor solo del asignado — cierra los 4 síntomas heredados de STORY-966 | ✅ done |
| [STORY-982](STORY-982.md) | Finanzas gráfico y de un vistazo: 4 stat cards de resumen (por cobrar / por liquidar / cobrado y liquidado del mes), tarjetas en grilla en vez de filas (v1.2: monto grande + badge de antigüedad/medio + dirección y persona con íconos; los gráficos v1.1 se quitaron por superponerse con Informes), histórico de UN mes por vez con flechas + selector (v1.4, no crece con los años; v1.3 concilió el "Por cobrar" del Inicio) y pendientes ordenados por antigüedad — rediseño UX del módulo de Giuliano (`6f2a863`), sin tocar el server layer | ✅ done |
| [STORY-981](STORY-981.md) | ComboFiltrable en todos los selects que crecen con los datos: modo formulario del componente (sin opción "Todos", placeholder propio, lista plana sin encabezados) aplicado a propiedad en Crear gestión (tablero + inbox, integra el fix `feb8805`), personas de cartera (SelectorPersona: 3 pantallas) y gestores (filtro del tablero + reasignar) — los selects fijos y chicos quedan nativos | ✅ done |
| [STORY-980](STORY-980.md) | Auditoría de eventos de sistema: tabla nueva `eventos_sistema` (actor nullable, afectado congelado en `detalle`) + 11 tipos de identidad y acceso (crear/rol/estado/blanqueo de empleados; postulación/alta/aprobación/rechazo/estado de técnicos) + tabs "Gestiones | Sistema" en `/admin/auditoria` con filtros server-side patrón 974 — party mode 2026-07-15 | ✅ done |
| [STORY-976](STORY-976.md) | El aviso "no puedo continuar" se hace ver y pausa la obra: campo explícito `aviso_no_continua_en/motivo` (patrón `desasignada_en`), banner ámbar del gestor + badges en tablero/detalle/lista del técnico, acciones del técnico bloqueadas (UI + server) hasta que el gestor decida, "El técnico continúa" (`aviso_resuelto`) y toda transición del funnel limpia el aviso — card #93, tercera ronda de prueba | ✅ done |
| [STORY-975](STORY-975.md) | Recargo por tarjeta de crédito al cobrar (% que tipea la administración, se suma al total) + UX del formulario de cobro (resumen en vivo, medio 2 formateado a currency) — migración pendiente: `recargo_tarjeta_pct`/`recargo_tarjeta_monto` | 🚧 en desarrollo |
| [STORY-979](STORY-979.md) | Identidad consistente de empleados: filtros por `usuario.id` (nunca por nombre) y presentación "Nombre (Rol)" solo donde se mezclan roles — filtro del kanban por id con rol, copia de supervisión "Responsable: {nombre} ({rol}) — {desc}" — party mode 2026-07-16 | ✅ done |
| [STORY-978](STORY-978.md) | El admin recibe copia de supervisión de toda notificación con destino gestor/nuevo_gestor/administrativos (título en voz de admin + "Gestor: {nombre} — {descripción}" congelados en la fila; guardas actor/destinatario; técnico afuera) — fix del gap de STORY-501, party mode 2026-07-15 | ✅ done |
| [STORY-977](STORY-977.md) | Adelanto de materiales al técnico antes de la ejecución (un solo campo, tope = materiales del presupuesto aprobado), descontado en la liquidación — revive STORY-933 simplificado | 🚧 en desarrollo |
| [STORY-974](STORY-974.md) | Auditoría con filtros server-side que no mienten (persona con rol, tipo, dirección/descripción, rango de fechas; paginación + count real — muere el límite 200) + datos invisibles afuera (labels centralizados en `eventos.ts`, imputado y saliente nombrado, detalle expandible) + separadores por día — party mode 2026-07-15 | ✅ done |
| [STORY-973](STORY-973.md) | El cobro combinado se ve completo: Actividad y Auditoría muestran total, medio con label y 2º medio con su monto (`medio_cobro_2` no se leía en ninguna pantalla) — card #6, error de la prueba de STORY-950 | ✅ done |
| [STORY-972](STORY-972.md) | Nota de cobro para la cancelación con cargo: mismo circuito de nota (vista previa + email), total = cargo, PDF "Trabajo cancelado" — supersede la decisión #3 de STORY-967 (card #93, error 9 de la prueba) | ✅ done |
| [STORY-971](STORY-971.md) | El técnico avisa que no puede continuar: evento `tecnico_no_continua` + notificación al gestor vía outbox; el gestor decide con desasignar/cancelar — sin estados nuevos (card #93, error 2 de la prueba) | ✅ done |
| [STORY-970](STORY-970.md) | El chip "Rechaza" cuenta desde eventos (el rechazo pisa `tecnico_id` y el estado vivo no puede contarlo) + la desasignación anula `presupuesto_enviado_en`: el presupuesto del técnico nuevo exige su propio envío y el botón vuelve a "Enviar" (card #93, errores 1/7/8) | ✅ done |
| [STORY-969](STORY-969.md) | Rendición: el picker de fotos ACUMULA entre aperturas (una por ticket, con quitar) en vez de pisar la selección, y los comprobantes quedan visibles para siempre en Actividad sobre el evento de rendición más reciente (card #92, errores de la prueba de STORY-965) | ✅ done |
| [STORY-968](STORY-968.md) | El técnico se entera: notificación al saliente al desasignarlo (sin link, a prueba de 404), refresco en vivo de sus vistas vía INSERT de notificaciones (el UPDATE de gestiones no llega cuando la fila sale de su RLS) y redirect a `/tecnico` en vez de 404 (card #93, errores 3–6 de la prueba) | ✅ done |
| [STORY-967](STORY-967.md) | Cancelación con cargo: post-aceptación del técnico, cargo opcional y libre que pasa por el circuito de Cobro existente y cierra en `cancelada` (cards #22/#93, party mode) | ✅ done |
| [STORY-966](STORY-966.md) | Desasignar técnico a mitad del flujo: retroceso total a Asignación (reasignación y abandono imputado), baja de técnico bloqueada con gestiones operativas, marca de urgencia y fixes de métricas (cards #12/#13/#93, party mode) | ✅ done |
| [STORY-965](STORY-965.md) | Fuera los gastos imprevistos (tabla, UI, evento, notificación): la rendición única es todo el control — total real + fotos MÚLTIPLES de comprobantes (una por ticket) con galería y desvío del lado gestor. Decidida en party mode | ✅ done |
| [STORY-964](STORY-964.md) | Rendición: el técnico rinde un solo total real de la obra (imprevistos incluidos); los gastos imprevistos son evidencia con ticket, no se re-suman; desvío real. Supersede la decisión #1 de STORY-961 — card #88 de Trello | ✅ done |
| [STORY-963](STORY-963.md) | Un CUIL no puede ser de dos personas distintas entre propietarios e inquilinos (bloqueo cruzado inteligente: bloquea si es otro nombre, permite la misma persona en ambos roles) — card #85 de Trello | ✅ done |
| [STORY-962](STORY-962.md) | La gestión no ofrece ni muestra al inquilino cuando su legajo ya está cerrado (`fecha_fin` ≠ null → solo propietario); no se puede mailear al inquilino que se fue — card #86 de Trello | ✅ done |
| [STORY-961](STORY-961.md) | Conformidad: el costo final se calcula (no editable) = materiales + gastos imprevistos + mano de obra; los gastos se suman al total con desglose claro; aprobar conformidad separado del cobro sin etapa nueva (card #82 de Trello) | ✅ done |
| [STORY-960](STORY-960.md) | CUIL obligatorio al cargar/editar propietario e inquilino (client + server, sin migración; reutiliza `errorCuil`) — card #81 de Trello | ✅ done |
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
