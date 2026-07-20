# Correcciones a la documentación de la Práctica Profesional (v20-FINAL)

> **Propósito de este archivo.** Es el resultado de una auditoría completa de consistencia entre el documento
> `PracticaProfesional-v20-FINAL` (Google Doc) y el sistema MANTIS 2 real (código de este repo + base de datos
> viva de Supabase). Está pensado como **contexto para una IA (o persona) que vaya a corregir el documento**:
> cada problema tiene ubicación, qué dice el doc, qué es lo real (con evidencia `archivo:línea` de este repo)
> y la solución concreta. Leelo entero antes de tocar el doc.
>
> **Método de la auditoría (2026-07-20):** 7 revisiones paralelas por sección (funcionalidades/mandato,
> requerimientos/casos de uso, diagramas/máquina de estados, dominio/DER contra la DB viva, arquitectura,
> indicadores, manuales de usuario) + barrido de terminología + auditoría visual de las 26 imágenes embebidas
> en el docx (extraídas de `word/media/`). Cobertura: 100 % del documento.
>
> **Cómo ubicar cada cita:** las referencias "línea N" corresponden a la exportación del docx a texto plano
> (5.578 líneas) y sirven como orden relativo. Para trabajar sobre el Google Doc, usá el **texto citado** como
> búsqueda (Ctrl+F) — cada ítem incluye una frase búscable.

---

## 0. Verdad del sistema (ground truth — NO redescubrir, usar esto)

Todo lo que sigue fue verificado contra el código de `codigo/` y la DB viva del proyecto Supabase
`ejwokycbyjtlxwusbhtt` el 2026-07-20. Si el doc contradice algo de esta sección, el doc está mal.

### 0.1 Dominio y terminología (reglas del proyecto, innegociables)
- Se dice **"gestión de mantenimiento"**, nunca "incidente". (Excepción tolerable: narrativa histórica de
  sprints/relevamiento que documenta el pasado, y la aclaración "en MANTIS no se habla de incidentes".)
- **Prohibida la palabra "trazabilidad"** → usar **"seguimiento"**. (Zona gris tolerable: "matriz de
  trazabilidad" como término de la norma ISO/IEC 29148 en la sección de metodología.)
- **Inquilinos y propietarios NO tienen usuario ni acceso al sistema.** Son entidades sin login. Reciben
  emails (presupuesto, nota de cobro, resumen de obras, avisos de estado) pero jamás entran.
- **Roles con acceso (4):** Administrador, **Gestor Comercial**, **Gestor Financiero**, Técnico.
  Los enums internos en DB son `administrador | gestor_mantenimiento | gestor_administrativo | tecnico`
  (labels de UI en `codigo/features/auth/types.ts:63-68`). En el documento SIEMPRE usar los nombres de
  presentación **Gestor Comercial / Gestor Financiero**; se puede aclarar UNA vez la equivalencia con los
  enums internos.
- Cada gestor comercial ve SOLO sus gestiones (ownership `gestor_id` + RLS). Las de otros gestores **no las
  ve en absoluto** (no "opacadas"). Lo que se ve atenuado (opacity) son las **columnas/etapas no accionables
  para el rol** dentro de sus propias gestiones (`codigo/components/gestiones/tablero.client.tsx:36-41`).

### 0.2 Funnel de etapas (el corazón del sistema)
Campo explícito `etapa` en la tabla `gestiones` + event log en `eventos_gestion`. Enum `etapa_gestion` (9 valores):

```
ingresado → asignacion → presupuesto → en_ejecucion → conformidad
          → facturacion_cobro → liquidacion_tecnico → finalizado        (+ cancelada, terminal)
```

Transiciones reales — TODAS pasan por la función Postgres `avanzar_etapa()` (copia en `scripts/avanzar_etapa.sql`):
| Transición | Quién / cómo |
|---|---|
| ingresado → asignacion | Gestor, botón manual "Pasar a Asignación →" (`detalle.client.tsx:227`) |
| asignacion → presupuesto | **El técnico ACEPTA la asignación** (RPC `responder_asignacion`) |
| presupuesto → en_ejecucion | Gestor aprueba presupuesto (`resolverPresupuesto`, `gestiones/service.ts:1125`) |
| en_ejecucion → conformidad | Técnico sube conformidad (`subirConformidad`, `service.ts:1489`) |
| conformidad → facturacion_cobro | Gestor aprueba conformidad (`service.ts:1559`) |
| facturacion_cobro → liquidacion_tecnico | GF registra el cobro (`finanzas/service.ts:680`) |
| liquidacion_tecnico → finalizado | GF registra la liquidación (`finanzas/service.ts:876`) |
| presupuesto/en_ejecucion/conformidad → asignacion | Desasignación de técnico, retroceso total (sql:45,98-134) |
| facturacion_cobro → cancelada | Cobro del cargo de cancelación (sql:54) |
| ingresado…conformidad → cancelada | Cancelación sin cargo (sql:57) |

Reglas duras del flujo (gates que el sistema BLOQUEA, no meras convenciones):
- Sin técnicos activos de la especialidad, la gestión **no se puede crear** (`gestiones/service.ts:203-211`).
- El técnico no puede enviar presupuesto **sin inspección propia previa** (`service.ts:995-1008`).
- No se puede aprobar un presupuesto **sin haberlo enviado antes por email al pagador** (STORY-935, `service.ts:1062-1077`).
- "Inquilino" como pagador solo con **legajo vigente** (`service.ts:1080-1094`).
- Para terminar la obra el técnico necesita: **≥1 nota de avance previa** + foto de conformidad firmada +
  **rendición de materiales** (total real + ≥1 foto de comprobante) (`service.ts:1408-1460`).
- El **costo final no lo tipea nadie**: se calcula server-side = materiales rendidos + mano de obra
  presupuestada (`service.ts:1526-1546`).
- Cobro: el monto NO se ingresa (total = costo_final + cargo_admin, congelado); se elige el **medio**
  (o dos medios combinados + recargo % solo sobre la porción con tarjeta) (`finanzas/service.ts:562-694`).
- Liquidación al técnico = materiales rendidos + mano de obra − adelantos. **El fee (gestión administrativa)
  nunca entra en esa cuenta** y no figura en ningún PDF que vea el técnico (`finanzas/pdf.tsx:125-160`).

Flujos reales que EXISTEN y el doc casi no cubre (ver ítems por sección):
cancelación con cargo cobrable, desasignación/reasignación con retroceso, **ampliaciones de presupuesto en
obra con autorización previa del pagador** (STORY-1017, `service.ts:1137/1181`), **adelantos de materiales**
con comprobante obligatorio (STORY-1002) que se descuentan al liquidar, aviso "no puedo continuar" (pausa,
badge "En pausa"), **gestiones vinculadas** (STORY-1001, `gestion_origen_id`), número visible `#N`
(STORY-1009), archivo de finalizadas, reasignación de gestor (solo admin), asistente IA **Walter**
(solo lectura, STORY-1007).

Cosas que NO existen (el doc las promete — eliminarlas o reescribirlas):
- ❌ IA que lee/sintetiza/clasifica reportes o crea gestiones automáticamente.
- ❌ Sugerencia automática del responsable de pago según "causa del deterioro" (eliminada por STORY-943).
- ❌ Campo "causa del deterioro" en inspección o presupuesto.
- ❌ Plazos legales de atención (24 hs urgente / 10 días normal).
- ❌ "Pedido de adelanto" por parte del técnico (el adelanto lo registra la administración directamente).
- ❌ Campo "franja horaria de contacto" en el reporte/gestión.
- ❌ Distinción técnicos "internos/externos".

### 0.3 Stack y estructura real del código
- **Next.js 16.2.10** (no 15), React 19, TypeScript 5, Tailwind CSS 4, Supabase (`@supabase/ssr` + `supabase-js`).
- El código vive en **`codigo/`** (no existe carpeta `frontend/`).
- Carpetas top-level de `codigo/`: `app/`, `components/`, `features/`, `shared/`, `public/`. **No existe `hooks/` top-level.**
- **13 features** en `features/`: asistente, auditoria, auth, cartera, email, empleados, especialidades,
  finanzas, gestiones, inbox, metricas, notificaciones, tecnicos. Convención de archivos: `types.ts` +
  `service.ts` (**sin prefijo** de feature). Varias features tienen archivos extra (gestiones: +`ejecucion.ts`,
  `eventos.ts`, `salientes.ts`; finanzas: +`consultas.ts`, `medios.ts`, `pdf.tsx`; asistente rompe el patrón:
  `config.ts`, `prompt.ts`, `tools.ts`).
- `shared/` real: `lib/supabase/{server,client,admin}.ts` (NO hay `middleware.ts`),
  `hooks/use-paginado.ts` (único hook; NO existe `use-mobile.ts`),
  `utils/{cn,cuil,telefono,duplicados,filtros,nombre,base-url,imagen.client}.ts`
  (NO existen `colors.ts`, `address.ts`, `error-messages.ts` ni carpeta `shared/types/`).
- `ActionResult<T>` vive en **`features/empleados/types.ts:12`** y se importa desde ahí
  (`@/features/empleados/types`). NO existe `@/shared/types`.
- `components/` se organiza **por módulo/feature** (asistente, auditoria, auth, cartera, empleados,
  especialidades, finanzas, gestiones, inbox, metricas, paneles, tecnicos, ui), no por rol.
- Rutas: el detalle de gestión es **`/gestiones/[id]`** (`app/gestiones/[id]/page.tsx`); `/gestion` es el
  Inicio del gestor comercial. Rutas `app/api/` (únicas dos): `api/cron/inbox` (sync Gmail, header
  `x-cron-secret`) y **`api/asistente`** (streaming SSE de Walter — excepción documentada en el propio archivo).
- Storage: buckets `gestiones` (fotos) y **`documentacion-tecnicos`** (docs de enrolamiento).
- Inbox: casilla **compartida** de Gmail filtrada por asunto (query `subject:mantenimiento`), no "exclusiva"
  (`features/inbox/sync.ts:58-60`). Conversión reporte→gestión 100 % manual (`crearDesdeReporte`, `inbox/service.ts:84`).
- Walter: modelo `claude-haiku-4-5` (`features/asistente/config.ts:8`), solo lectura, tools por rol,
  burbuja arrastrable con imán en técnico mobile, chat persistente al navegar (sessionStorage).

### 0.4 Panel de Informes real (11 tarjetas, `codigo/components/metricas/panel-metricas.client.tsx`)
Embebido en el Inicio de cada rol (`components/paneles/inicio-rol.tsx:108`); lo ven admin, GC y GF (técnico no);
al GF se le oculta solo "Cobertura de especialidades". Selector de período (Mes/Trimestre/Año/Todo) gobierna
únicamente la caja "En el período"; el resto lleva pill "ahora" o "histórico". Sin semáforos: rampa continua
teal→ámbar→terracota; el rojo queda para error ("⚠ Sin técnicos").
Tarjetas: 1 Gestiones estancadas · 2 Pendientes de cobro · 3 Orden por valor (fee desc) · 4 Cobertura/Presión
por especialidad · 5 **"Gestiones activas por etapa"** (bloque "Carga por etapa", snapshot AHORA — reemplazó
al "Embudo" en STORY-1004; el comentario del código dice "No es un embudo") · 6 Tiempo de ciclo (resta la
ejecución física) · 7 Cuellos de botella (sin En ejecución) · 8 Ingresos cobrados (técnico vs fee) ·
9 Calificación de técnicos · 10 **"Desvíos de presupuesto"** · 11 **"Desvío de plazo"** (contra el plazo
prometido por el técnico, STORY-921).

### 0.5 Esquema de DB real (21 tablas en `public`, resumen de lo relevante)
`usuarios` (id = auth.users.id, rol enum §0.1) · `tecnicos` (id FK a **auth.users**, no a usuarios; estado
pendiente|aprobado|rechazado, email_verificado, CUIL, doc_dni_path, doc_matriculas_paths) ·
`especialidades` (requiere_matricula) · `tecnico_especialidades` (N:M) · `franjas_disponibilidad`
(dia_semana 0-6, franjas semanales recurrentes — NO calendario por fechas) · `propietarios` / `inquilinos`
(con **cuil**, sin FK a auth = sin login) · `propiedades` (tipo incluye **Duplex**; campo `unidad` STORY-999) ·
`legajos` (fecha_fin null = vigente) · `gestiones` (etapa, urgencia, pagador, gestor_id, tecnico_id,
asignacion_aceptada, presupuesto_enviado_en, aviso_no_continua_en/motivo, costo_final, cargo_admin,
cargo_cancelacion, materiales_total, **adelanto_materiales** (STORY-976), cobrado_monto/fee/en, medio_cobro,
medio_cobro_2 + cobrado_monto_2, recargo_tarjeta_pct/monto, **liq_monto/liq_factura_ref/liq_pagada_en/
liq_medio/liq_comprobante_path**, **numero** (UNIQUE, identificador visible #N), **gestion_origen_id**
(self-FK, gestiones vinculadas), archivada_en, desasignada_en) · `presupuestos` (+tecnico_id autor,
descripcion_trabajo, notas) · `ampliaciones` (STORY-1017; estados con gate `enviada_pagador_en`; su
tecnico_id NO tiene FK enforced) · `avances` (tipo inspeccion|avance, **nota** (no "detalle"), tecnico_id,
foto_path) · `conformidades` (+tecnico_id) · `calificaciones` (gestion_id UNIQUE, estrellas, **tecnico_id,
autor_id, comentario**) · `eventos_gestion` (actor_id **NOT NULL**) · `eventos_sistema` (actor_id nullable) ·
`notificaciones` (**titulo + cuerpo** — no "tipo"; **leida_en** timestamptz — no boolean; gestion_id FK) ·
`emails_enviados` (**para** — no "destinatario"; asunto, error) · `inbox_reportes` (gestion_id nullable SIN
unique → 0..N) · **`matriz_notificaciones`** (config de destinos por evento — falta en el DER del doc).

---

## 1. Correcciones TRANSVERSALES (aplicar en todo el documento)

**T1 — Regenerar el índice (tabla de contenidos).** El TOC actual es el de la versión vieja: lista
"Manual de Usuario — Cliente" (los clientes no tienen acceso), sección "Incidentes", "Máquina de Estados
Completa del Incidente", los diagramas mermaid 6.8.1.x viejos y el módulo de PPIs con semáforos — ninguna de
esas secciones existe ya en el cuerpo. **Solución:** en Google Docs, actualizar/regenerar la tabla de
contenidos al final de todas las correcciones.

**T2 — Unificar nombres de roles.** El cuerpo mezcla: "gestor comercial" ×108 vs "gestor de mantenimiento"
×12; "gestor financiero" ×47 vs "gestor administrativo" ×3 (buscar: "gestor de mantenimiento" y "gestor
administrativo"). Los diagramas UML de §6.8 usan los nombres viejos en las calles ("Gestor de Mantenimiento",
"Administrativo / Finanzas", "Staff (Admin / Gestor de Mantenimiento)"). **Solución:** reemplazar por
**Gestor Comercial** y **Gestor Financiero** en todo el cuerpo y en los diagramas; dejar UNA aclaración (en
§6.9 o §6.11) de que los enums internos de la DB se llaman `gestor_mantenimiento`/`gestor_administrativo`
por razones históricas.

**T3 — "Trazabilidad" → "seguimiento".** Ocurrencias a corregir sí o sí: (a) Mandato ampliado, buscar
"garantizar la trazabilidad de cada gestión" → "garantizar el seguimiento de cada gestión"; (b) historia de
usuario del GF, buscar "trazabilidad financiera" → "seguimiento financiero"; (c) sección de sprints, título
suelto "Trazabilidad". Las menciones de "matriz de trazabilidad" (ISO/IEC 29148, secciones 1.5/1.6) son
jerga metodológica estándar — decisión editorial, pero si se quiere regla pareja, cambiarlas también.

**T4 — "Incidente".** Ya casi todo el cuerpo está bien (los manuales solo lo usan para aclarar que NO se usa,
y hay falsos positivos por "reincidente"). Quedan a corregir: el bloque residual de §4.6/4.7 (ver ítem 2.4) y
el índice (T1). La narrativa histórica de sprints (§7.1, "SISTEMA DE GESTIÓN DE INCIDENTES", bugs #211-#229)
puede quedarse tal cual SI se le antepone una nota de contexto: "esta sección documenta la planificación
histórica del desarrollo, con la terminología de la época".

---

## 2. §4 — Negociación del proyecto (Funcionalidades, Mandato)

**2.1 🔴 GRAVE — La "IA del inbox" no existe.** Buscar: "Asistencia de IA", "lectura del reporte",
"clasificación por especialidad" con IA, "alta automática". El doc promete (en §4.4 y repetido en §4.6, §5.5.1)
que una IA lee el reporte, genera una síntesis, clasifica por especialidad y da de alta la gestión en la
primera etapa. **Real:** la conversión reporte→gestión es 100 % manual (`inbox/service.ts:84` —
`crearDesdeReporte()` con form que completa el gestor); el sync de Gmail solo ingesta los mails. La única IA
es **Walter**, asistente conversacional de solo lectura. **Solución:** reescribir esas menciones como:
"ingesta automática de la casilla de correo al Inbox del sistema; el gestor convierte el reporte en gestión
con un formulario prellenado (asunto y cuerpo del mail), eligiendo propiedad, especialidad y urgencia".
Si se quiere hablar de IA, describir a Walter (asistente de consulta por rol, solo lectura) — no atribuirle
clasificación ni alta de gestiones.

**2.2 🔴 GRAVE — Sugerencia de pagador por "causa del deterioro" (CCyC).** Buscar: "causa del deterioro",
"Código Civil". Aparece en §4.4 ("sugerencia del sistema en base a la causa"), §5.5 ("El técnico carga…la
causa del deterioro") y más abajo en §6.6/§6.7. **Real:** eliminada a propósito por STORY-943
(`features/gestiones/types.ts:16-18` documenta la decisión; `components/gestiones/detalle.client.tsx:707`:
"sin sugerido — el gestor elige explícitamente"). No hay campo "causa" en inspección ni presupuesto.
**Solución:** reemplazar por la regla real: "la responsabilidad de pago la decide la inmobiliaria (gestor
comercial) al aprobar el presupuesto, con la inspección del técnico a la vista; el sistema solo restringe que
'Inquilino' requiere legajo vigente y exige haber enviado el presupuesto por email al pagador antes de aprobar".
Si se quiere conservar la idea original como historia de diseño, moverla a una nota: "en la negociación se
propuso una sugerencia automática según la causa del deterioro; durante el desarrollo se descartó (STORY-943)
por decisión de producto: la decisión es humana, informada por la inspección".

**2.3 🔴 GRAVE — Plazos legales inexistentes.** Buscar: "plazo legal", "24 horas", "10 días". El doc dice que
la urgencia "define el plazo legal de atención (10 días o 24 horas)". **Real:** la urgencia es un flag
`normal | urgente` (`gestiones/types.ts:15`) que prioriza el orden del tablero y marca la tarjeta; no hay
cálculo ni control de plazos legales en ningún lado. **Solución:** "el gestor asigna el nivel de urgencia
(normal o urgente), que prioriza la gestión en el tablero y en las vistas del técnico". Eliminar también el
indicador "cumplimiento de los plazos legales" prometido (ver 2.5).

**2.4 🔴 GRAVE — Bloque residual viejo tras §4.7.6.** Buscar: "desarrollar un sistema de gestión de
incidentes que permita mejorar la eficiencia". Hay un bloque duplicado/viejo (incluye un segundo "Alcance")
con: "incidentes", "ABM de clientes", "aprobación o rechazo por parte de clientes", etapas "En ejecución,
para validar, finalizado". Todo eso contradice el sistema y el resto del doc. **Solución:** BORRAR el bloque
completo (desde esa frase hasta antes de la sección 5). El contenido correcto ya existe en §4.7.

**2.5 🔴 GRAVE — Indicadores prometidos que no existen.** Buscar: "velocidad de primera respuesta",
"calidad de la clasificación". §4.4 promete indicadores de "velocidad de primera respuesta y de resolución
por especialidad, cumplimiento de los plazos legales en gestiones urgentes, y calidad de la clasificación
realizada por la inteligencia artificial". Ninguno existe. **Solución:** reemplazar por los informes reales
(lista completa en §0.4): estancadas, pendientes de cobro, prioridad por valor, cobertura por especialidad,
carga por etapa, tiempo de ciclo, cuellos de botella, ingresos, calificación de técnicos, desvíos de
presupuesto y desvío de plazo.

**2.6 🟡 "Casilla de correo exclusiva".** Buscar: "casilla". **Real:** casilla compartida; el sync filtra por
asunto que contenga "mantenimiento" (`inbox/sync.ts:58-60`) — un reporte sin esa palabra no entra.
**Solución:** describirla como "casilla de correo con filtro por asunto ('mantenimiento')" y mencionar la
condición.

**2.7 🟡 "Franja horaria informada en el reporte".** Buscar: "franja horaria". No existe ese campo; el
contacto se deriva automáticamente del legajo vigente / propietario en cartera (`gestiones/service.ts:103`,
STORY-938). **Solución:** quitar la franja horaria del reporte; explicar que los datos de contacto salen de
la cartera (legajo vigente → inquilino; si no, propietario).

**2.8 🟡 El alcance del §4 se quedó corto respecto del sistema.** El sistema hace MÁS de lo prometido:
cancelación con cargo, desasignación con retroceso, ampliaciones de presupuesto (STORY-1017), adelantos de
materiales, gestiones vinculadas, aviso "no continúa", Walter, archivo, número #N. **Solución:** agregar un
párrafo "alcance finalmente implementado" (o actualizar la lista de funcionalidades) con estos puntos — es
mérito del proyecto, conviene contarlo.

**2.9 🟢 Menores del §4/§5:** (a) "calendario de disponibilidad" del técnico → son franjas horarias
semanales recurrentes, no calendario por fechas; (b) PDF "Resumen de obras": se genera on-demand y el envío
por email es solo al propietario (no "queda indexado" ni va al inquilino); (c) "técnicos internos o externos"
→ el sistema no distingue; (d) tabla de etapas §5.5.8: la transición a Finalizado la ejecuta el **Gestor
Financiero** al registrar la liquidación (no "—"), y ahí el gestor comercial puede calificar al técnico.

---

## 3. §6.2–6.3 — Requerimientos e historias de usuario

**3.1 🔴 RF-02 / HU-02 / EP — clasificación por IA:** mismo problema y misma solución que 2.1.
**3.2 🔴 RF-03 / RF-12 — plazos legales:** mismo problema que 2.3. En RF-12, la métrica real de plazos es
"Desvío de plazo" contra el plazo prometido por el técnico en el presupuesto (STORY-921).
**3.3 🔴 HU-06B — sugerencia de pagador:** mismo problema que 2.2.
**3.4 🔴 HU-11 — calificación de técnicos figura como "planificada, no incluida en v1". FALSO: está
implementada** (STORY-914): `calificarTecnico()` en `gestiones/service.ts:610-645` — estrellas 1-5 +
comentario, solo en etapa finalizado, una por gestión, inmutable; y el picker de asignación ya ordena por
calificación (`service.ts:687-697`). Además el actor está mal: NO califican Admin + Gestor Financiero; la
RLS real (`calificaciones_insert`) permite insertar solo al **administrador o al gestor comercial dueño**;
el GF solo lee. **Solución:** reescribir HU-11 como implementada, con actor correcto y sus reglas.
**3.5 🟡 RF-01/HU-01 — franja horaria y datos de contacto en la gestión:** igual que 2.7. `crearGestion()`
toma solo descripción, propiedad, especialidad, urgencia (`service.ts:191`).
**3.6 🟡 HU-13/RF-12 — "reportes propios de cada rol":** hay UN panel de Informes idéntico para admin/GC/GF
(único filtro por rol: "Cobertura de especialidades" se oculta al GF); la diferencia real es el alcance de
datos vía RLS. **Solución:** reformular como "un panel común cuyo alcance de datos depende del rol".
**3.7 🟢 RNF-05 — emails:** el sistema envía más que "facturas y comprobantes": avisos de estado al
inquilino/propietario (reporte recibido, técnico asignado, resuelto), presupuesto y ampliación al pagador,
resumen de obras, resultado del enrolamiento. Ampliar la lista.
**3.8 🟡 HU/criterio de visibilidad del tablero:** corregir según §0.1 (las ajenas no se ven; lo atenuado
son etapas no accionables). El GF ve todas las gestiones en todas las etapas (solo lectura fuera de
Cobro/Liquidación) — quitar el "únicamente las de Facturación y Liquidación".

---

## 4. §6.4–6.6 — Casos de uso

**4.1 🔴 Diagrama de casos de uso (PlantUML §6.5 + imagen renderizada):** eliminar el actor **"Asistente IA"**
ligado a "Clasificar por Especialidad" (no existe — ver 2.1; si se quiere un actor IA, que sea "Walter
(consulta)" sin flechas de escritura) y eliminar el include **"Registrar Presupuesto → Registrar Causa del
Deterioro"** (ver 2.2). Después de corregir el código PlantUML, **regenerar la imagen** (la actual,
`image21`, tiene ambos errores).
**4.2 🔴 UC "Sugerencia Automática del Responsable de Pago" (6.6.2.8/9):** eliminar el UC completo o
reescribirlo como "Definir responsable de pago" (actor: gestor comercial; reglas reales de §0.2).
**4.3 🔴 UC "Calificar Técnico":** igual que 3.4 (implementado; actor: admin o gestor dueño). Nota curiosa:
el diagrama PlantUML ya lo tiene bien (`Gestor -- UC7_C`) — es la descripción textual la que está mal.
**4.4 🟡 UC "Clasificar Gestión" como paso posterior:** la especialidad y urgencia se eligen
obligatoriamente EN el formulario de creación y no se editan después; en etapa `ingresado` lo único que hay
es el botón "Pasar a Asignación". Reescribir el UC como parte de "Registrar Gestión" (y mencionar el bloqueo
"sin técnicos activos de esa especialidad no se crea").
**4.5 🟡 UC "Realizar Inspección":** la inspección real es **nota de texto libre + foto opcional**
(`registrarAvance`, tipo derivado de la etapa). El "diagnóstico, materiales, tiempo estimado, costo" NO son
campos de la inspección: costo y plazo van en el presupuesto. Sin causa del deterioro.
**4.6 🟡 UC "Aprobar/Rechazar Presupuesto":** agregar los dos gates reales (envío por email al pagador antes
de aprobar; inspección previa del técnico para poder enviar). 
**4.7 🟡 UC "Completar Trabajo y Subir Conformidad" / "Aprobar Conformidad":** agregar requisitos reales
(≥1 avance previo, rendición de materiales con fotos, conformidad = foto JPG/PNG/WebP) y corregir "registra
el costo final" → el costo final se calcula solo (§0.2).
**4.8 🟢 UC "Emitir Nota de Cobro y Registrar Cobro" / "Registrar Liquidación":** montos calculados y fecha
automática; lo que se elige es el medio (o dos combinados + recargo tarjeta). Emisión/envío de la nota son
botones independientes del registro del cobro.
**4.9 🟢 UC "Aceptar Asignación":** el email "técnico asignado" va al inquilino/propietario; el gestor
recibe la notificación in-app (no email).
**4.10 🟢 UC Enrolamiento:** agregar la verificación de email por token (STORY-955; una pendiente sin
verificar es "huérfana" y reemplazable); el dato obligatorio es **CUIL** (el DNI es un archivo adjunto);
no hay campo apellido separado.
**4.11 🟡 Faltan UCs de funcionalidad real importante:** Cancelar gestión (con/sin cargo), Desasignar
técnico, Solicitar ampliación de presupuesto / Resolver ampliación (STORY-1017), Registrar adelanto de
materiales, Avisar "no puedo continuar" / "El técnico continúa", Vincular gestión a otra (STORY-1001),
Reasignar gestor (admin), Archivar. Agregar al menos los primeros cuatro.

---

## 5. §6.7 — Documentación de los diagramas BPMN (texto)

> Contexto clave: los diagramas UML de §6.8 están MUY bien (ver §6 de este archivo). Es el TEXTO de §6.7 el
> que quedó viejo y en varios puntos contradice a sus propios diagramas. Regla práctica para la corrección:
> **cuando §6.7 y el diagrama §6.8 difieren, el diagrama tiene razón.**

**5.1 🔴 §6.7.3 Enrolamiento:** dice que el técnico "define su propia contraseña" y la cuenta queda
utilizable. **Real (STORY-955):** el alta crea el usuario en auth **sin contraseña**; la crea recién al ser
**aprobado**, vía link de creación de contraseña en el email de bienvenida (`tecnicos/service.ts:575-613`).
El propio diagrama 3 lo dice bien. Reescribir el párrafo.
**5.2 🔴 §6.7.7 Presupuesto:** dice "el presupuesto pasa a enviado; la gestión avanza a etapa presupuesto".
**Real:** la gestión YA está en `presupuesto` desde que el técnico aceptó la asignación; `enviarPresupuesto`
no toca la etapa (solo inserta presupuesto + evento). Corregir el disparador y el momento.
**5.3 🔴 §6.7.8:** repite la sugerencia de pagador por causa del deterioro con cita al CCyC → eliminar
(ver 2.2) y agregar el gate real de envío por email antes de aprobar.
**5.4 🔴 §6.7.5:** "reporte recibido en la casilla exclusiva (con clasificación asistida por IA)" → ver 2.1
y 2.6. También menciona "disponibilidad horaria informada" (no existe, ver 2.7) y omite el bloqueo "sin
técnicos de la especialidad no se crea".
**5.5 🟡 §6.7.6 Asignación:** son dos actos separados: (1) el gestor avanza ingresado→asignacion con botón
explícito; (2) `asignarTecnico()` (ya en etapa asignacion) setea el técnico y notifica — NO cambia etapa; la
etapa cambia cuando el técnico ACEPTA. Corregir la secuencia (también en el diagrama 2, que salta el paso 1).
**5.6 🟡 §6.7.9/9.1 Cierre:** (a) el costo final se calcula solo (no "el gestor puede registrar el costo
final"); (b) falta la etapa `liquidacion_tecnico` (el texto funde cobro y liquidación en una sola etapa);
(c) falta la rendición de materiales del técnico; (d) nombrar la etapa `conformidad` del funnel.
**5.7 🟢 §6.7.1/6.7.2 ABMs:** `guardarPropiedad()` no existe (real: `crearAdministracion()`, que crea
propietario + propiedad juntos y la propiedad nace SIN legajo — el legajo es paso aparte, como dice el
diagrama 4); el documento de propietario/inquilino es **CUIL** en ambos (no "CUIT para propietario, DNI para
inquilino").

---

## 6. §6.8 — Diagramas UML (PlantUML)

Estado general: **muy fieles al código** (el de finanzas y el de inbox, casi calcados). Correcciones puntuales:

**6.1 🔴 Falta el diagrama de MÁQUINA DE ESTADOS.** La numeración arranca en "2" (no hay diagrama 1) y el
statechart del funnel — corazón del diseño — no existe en el cuerpo (solo en el índice viejo). **Solución:**
agregar como diagrama 1 un statechart con las 9 etapas y transiciones de la tabla de §0.2 de este archivo.
**6.2 🔴 Falta el flujo de AMPLIACIONES de presupuesto (STORY-1017)** en todos los diagramas: técnico pide
ampliación (una pendiente a la vez) → gestor la envía al pagador por email (gate) → registra autorización o
rechazo con motivo → los montos aprobados se suman al cobro. Agregarlo al diagrama 2 o al 6.
**6.3 🟡 Roles en las calles:** "Gestor de Mantenimiento" / "Administrativo / Finanzas" → "Gestor Comercial"
/ "Gestor Financiero" (ver T2).
**6.4 🟢 Diagrama 2:** agregar la transición manual ingresado→asignacion (ver 5.5); el email al técnico al
liquidar es `detalle_liquidacion` ("Detalle de tu liquidación"), no "comprobante_liquidacion"; "Registrar
adelanto" también lo puede hacer el gestor comercial dueño (no solo finanzas).
**6.5 🟢 Diagrama 3 (enrolamiento):** nota "se bloquea si tiene gestiones en etapas no terminales" → real:
bloquean solo asignacion/presupuesto/en_ejecucion/conformidad; cobro y liquidación NO bloquean (STORY-966,
`tecnicos/service.ts:892-925`).
**6.6 🟢 Diagrama 5 (bajas):** el bloqueo por "legajo vigente" solo aplica a INQUILINOS; propiedad y
propietario bloquean solo por gestiones abiertas (una propiedad con legajo vigente y sin gestiones SÍ se
puede desactivar) (`cartera/service.ts:103-112, 286-307`).
**6.7 🟢 Diagrama 7 (cancelación/desasignación):** la cancelación sin cargo también vale desde `ingresado` y
`asignacion`; al desasignar, además de descartar presupuesto y rendición: la conformidad subida queda
rechazada, las ampliaciones enviadas/aprobadas quedan rechazadas (STORY-1017) y el adelanto se congela como
"adelanto del saliente" y se resetea (STORY-1014).

---

## 7. §6.9–6.10 — Modelo de dominio y DER

**7.1 🔴 §6.10 es una copia idéntica de §6.9.** El doc pega dos veces el mismo diagrama mermaid (hasta el
título interno "modelo de dominio" repetido). **Solución:** dejar §6.9 como modelo de dominio conceptual y
rehacer §6.10 como DER de verdad: con `tecnico_especialidades` como tabla (PK compuesta), las tablas
faltantes y los campos del punto 7.3. Bonus: la copia de §6.9 tiene un **error de sintaxis mermaid** (el
bloque `EVENTOS_SISTEMA { ... }` no cierra la llave antes de `NOTIFICACIONES`) — el diagrama no renderiza;
la copia de §6.10 está bien. Si se conservan ambos, arreglar la llave.
**7.2 🔴 Falta la tabla `matriz_notificaciones`** (config de la matriz de notificaciones: tipo_evento,
a_etapa, destino gestor|tecnico|administrativos|nuevo_gestor, títulos; 19 filas). Agregarla al DER.
**7.3 🟡 Campos de negocio ausentes/incorrectos** (corregir en el mermaid y regenerar la imagen del DER):
- GESTIONES: agregar `numero` (identificador visible #N), `gestion_origen_id` (self-FK, dibujar la relación
  recursiva), `adelanto_materiales`, bloque `liq_*` (5 campos), y opcionalmente el bloque de cobro partido
  (`medio_cobro`, `medio_cobro_2`, `cobrado_monto_2`, `recargo_tarjeta_*`), `archivada_en`, `desasignada_en`.
- NOTIFICACIONES: `tipo` → no existe (real: `titulo` + `cuerpo`); `leida` boolean → real `leida_en`
  timestamptz; agregar `gestion_id` FK y la relación GESTIONES ||--o{ NOTIFICACIONES.
- AVANCES: `detalle` → real `nota`; agregar `tecnico_id` (FK) y `foto_path`; relación TECNICOS ||--o{ AVANCES.
- PRESUPUESTOS: agregar `tecnico_id` (autor — relevante tras reasignaciones), `descripcion_trabajo`, `notas`.
- CALIFICACIONES: agregar `tecnico_id`, `autor_id`, `comentario` (y sus relaciones).
- CONFORMIDADES: agregar `tecnico_id`.
- EMAILS_ENVIADOS: `destinatario` → real `para`; agregar `asunto`, `error`.
- EVENTOS_GESTION: `actor_id` NO es nullable (el nullable es el de `eventos_sistema`).
- TECNICOS: `id` referencia a **auth.users.id** (no a usuarios.id); la relación 1-1 con USUARIOS solo existe
  para técnicos aprobados (hoy hay técnicos pendientes/rechazados sin fila en usuarios) — dibujarla como
  opcional con la nota correcta.
- PROPIEDADES: agregar `unidad` (STORY-999).
- INBOX_REPORTES→GESTIONES: cardinalidad real 0..N (gestion_id nullable sin unique), no 0..1.
- `etapa`: listar las 9 etapas del enum (no la abreviatura "ingresado..finalizado | cancelada").
**7.4 🟢 Lo que está bien (no tocar):** terminología nueva impecable (gestiones, sin logins de clientes,
etapa explícita + event log), usuarios/especialidades/franjas/propietarios/inquilinos/legajos/
tecnico_especialidades/inbox_reportes/eventos_sistema/ampliaciones correctos, ownership gestor_id.

---

## 8. §6.11 — Arquitectura

**8.1 🔴 "Next.js 15" → Next.js 16** (`codigo/package.json:18` → 16.2.10). Buscar: "Next.js 15".
**8.2 🟡 Ruta de detalle:** `/gestion/[id]` → **`/gestiones/[id]`** (`/gestion` es el Inicio del GC).
**8.3 🟡 Lista de features:** son 13, faltan `asistente`, `auth` y `email` (email además es regla explícita
del proyecto: todo email sale por `features/email/service.ts` con log en `emails_enviados`).
**8.4 🟡 Excepciones de `app/api/`:** además de `api/cron/inbox` existe **`api/asistente`** (streaming SSE
de Walter — las server actions no soportan SSE; el propio archivo lo documenta). Completar la enumeración.
**8.5 🟡 "components/{rol}/":** components se organiza por módulo/feature, no por rol. Corregir la frase.
**8.6 🟢 Lista de páginas:** agregar las faltantes: `/finanzas`, `/gestiones` (+ `/gestiones/archivadas`),
`/crear-contrasena`, `/recuperar-contrasena`, `/` (raíz).
**8.7 🟢 Storage:** mencionar el segundo bucket `documentacion-tecnicos`.
**8.8 🟢 Lo que está bien:** anatomía del server action, `ActionResult`, `avanzar_etapa()` vía RPC, clientes
supabase (server/client/admin y sus usos), cliente browser solo para auth+Realtime, cron con secreto — todo
verificado correcto.

---

## 9. §6.12/6.13 — Indicadores / Panel de Informes

**9.1 🔴 "Embudo de gestiones" quedó viejo (STORY-1004).** Buscar: "Embudo". El doc describe un embudo
acumulativo del período ("cuántas gestiones alcanzaron cada etapa o una posterior", nota de canceladas con
porcentaje, esmeralda, dentro de "Flujo del trabajo"/período). **Real:** la card se llama **"Gestiones
activas por etapa"** en el bloque propio **"Carga por etapa"**, es snapshot "ahora" (NO sigue el período),
cuenta por etapa ACTUAL, excluye finalizado/cancelada, colorea con rampa de magnitud (el pico = cuello de
botella) (`panel-metricas.client.tsx:391-404, 760-782`). **Solución:** reescribir la descripción del
informe 5 y su fila en la tabla resumen. Corregir también en los 3 manuales (ver §11).
**9.2 🔴 Archivos citados inexistentes.** Buscar: "metricas-pendientes-a-implementar". El doc dice que los
PPIs no implementados (FPY, reasignación por motivo, absorción) "quedan documentados en
`documentacion/metricas-pendientes-a-implementar.md`" y cita `METRICAS_INFORMES_PROPUESTA.md`. Ninguno
existe en el repo. **Solución:** quitar ambas referencias y dejar: "quedan registrados como trabajo futuro"
(o crear efectivamente esos archivos en el repo, decisión del equipo — si se crean, este ítem se cierra solo).
**9.3 🟡 Alerta de 3 días en Gestiones estancadas:** el doc la describe; en el código la constante existe
pero es visualmente inerte (la rampa pisa el color de urgencia — `panel-metricas.client.tsx:223` vs `:681`).
**Solución recomendada:** arreglar el CÓDIGO (mini-bug, ver §13) y dejar el doc como está; si no, quitar la
frase del doc.
**9.4 🟡 Pastilla "ahora"/"histórico" "en cada tarjeta":** 3 tarjetas no la muestran (estancadas, pendientes
de cobro, orden por fee). Matizar la frase ("en las tarjetas fuera del período que la llevan") o agregar la
pill en el código.
**9.5 🟢 Nombres de cards:** "Cumplimiento de presupuesto/plazo" → reales **"Desvíos de presupuesto"** y
**"Desvío de plazo"**.
**9.6 🟢 "Muestra chica" y "Pocos datos":** la advertencia "Muestra chica" (1-4 casos) aplica solo a 6 de
las 11 tarjetas (ciclo, cuellos, ingresos y las 3 históricas — en el resto está desactivada); y son dos
umbrales distintos: "Pocos datos" salta con <3 cubos con dato (oculta el gráfico), la tendencia requiere ≥6
cubos (con 3-5 se muestra el gráfico sin tendencia y sin aviso). Precisar ambas frases.
**9.7 🟢 "para cada rubro":** el informe de presión por especialidad solo lista especialidades con ≥1
gestión activa (no la lista fija de 8). Matizar.

---

## 10. §7.2 — Estructura del proyecto

**10.1 🔴 Instrucción de instalación rota.** Buscar: "cd frontend". No existe `frontend/`; es
`cd codigo && npm install && cp .env.example .env.local`.
**10.2 🔴 Imports de ejemplo con `@/shared/types`.** Buscar: "shared/types". `ActionResult` se importa de
`@/features/empleados/types` (así lo hace el código real, ej. `features/cartera/service.ts:4`). Ojo: §6.11
lo dice bien — es §7.2 el que está mal (el doc se contradice a sí mismo).
**10.3 🔴 Ejemplo `crearPropiedad()`:** esa función no existe; la real es `crearAdministracion()`
(`features/cartera/service.ts:247`, crea propietario + propiedad juntos). El patrón mostrado (createClient,
ActionResult) es fiel — solo cambiar nombre de función e import.
**10.4 🟡 "hooks/ — Hooks de React" como carpeta principal:** no existe; los hooks viven en `shared/hooks/`
(hoy un solo archivo: `use-paginado.ts`). Las 5 carpetas principales reales: `app`, `components`, `features`,
`shared`, `public`.
**10.5 🟡 "Regla de oro: 2 archivos por feature":** ya no es cierta como regla absoluta (ver §0.3).
Reformular: "toda feature tiene al menos types.ts y service.ts; las grandes suman módulos específicos".
**10.6 🔴 IMÁGENES de §7.2 — varias son de MANTIS 1 (reemplazar, no basta editar el texto):**
- **image20** (árbol de `features/`): muestra `incidentes/`, `asignaciones/`, `inmuebles/`, `usuarios/` con
  `Incidente, CreateIncidenteDTO`, `getIncidentesByCurrentUser` — estructura del sistema VIEJO y término
  prohibido. Reemplazar por el árbol real de 13 features (§0.3). **La peor imagen del documento.**
- **image24** (árbol de `shared/`): dibuja `middleware.ts`, carpeta `types/` (models/enums/database.types) y
  utils (`colors.ts`, `address.ts`, `error-messages.ts`) inexistentes. Reemplazar por el árbol real (§0.3).
- **image13**: `hooks/use-mobile.ts` no existe. Quitar o reemplazar por `shared/hooks/use-paginado.ts`.
- **image15**: convención `nombreFeature.types.ts` → real `types.ts` / `service.ts` sin prefijo.
- **image3**: raíz `frontend/` con `hooks/` top-level → raíz `codigo/`, sin hooks top-level, y falta `public/`.
- **image2**: el flujo está bien, pero la leyenda inferior lista `shared/types/` y `hooks/` → corregir leyenda.
- Las imágenes conceptuales browser/Vercel/Supabase, flujo de lectura, flujo de escritura y RLS
  (image1/22/25/18) están bien — no tocar.
**10.7 🟢 image9 (un DER viejo con muchas tablas, estilo distinto):** aparenta ser el DER de MANTIS 1.
Localizar en qué página del doc quedó pegado; si acompaña a §6.10 como "DER", reemplazar por el DER corregido
(§7 de este archivo); si está en una sección histórica, rotularlo como "modelo de la versión original".

---

## 11. Manuales de usuario

> Estado general: son la parte MÁS fiel del documento (verificados pantalla por pantalla; los textos de UI
> citados son casi todos exactos). Correcciones puntuales:

### 11.1 Manual Administrador
- 🔴 **"Embudo de gestiones"** en Informes → reescribir según 9.1 ("Gestiones activas por etapa", bloque
  "Carga por etapa", foto de hoy, sin % canceladas, el pico señala el cuello de botella).
- 🟡 Badge del tablero **"Técnico no continúa" → "En pausa"** (STORY-1016, `tablero.client.tsx:120-123`).
- 🟡 **Gestiones vinculadas (STORY-1001) omitidas:** agregar al formulario "+ Nueva gestión" el campo
  "¿Surgió de otra gestión? (opcional)" (fija la propiedad a la de la origen), el badge de vínculo en la
  tarjeta, los bloques "Surgió de" / "Gestiones vinculadas" del detalle y el cartel "Hay N gestiones
  vinculadas sin terminar" al aprobar la conformidad.
- 🟡 **Adelanto:** agregar que el comprobante de entrega es OBLIGATORIO (STORY-1002) y que la pantalla
  muestra lo presupuestado en materiales como referencia.
- 🟢 Campos del presupuesto: falta "Mano de obra ($)" en la lista y "Materiales ()" quedó con el paréntesis
  vacío — buscar "Materiales ()" y completar "($)".
- 🟢 Aprobación de presupuesto: lo que desbloquea "Aprobar y ejecutar →" es elegir pagador + haber ENVIADO el
  email ("Ver presupuesto" no es requisito).
- 🟢 Cargo por cancelación: es DESDE la etapa Presupuesto inclusive (no "después de Presupuesto").
- 🟢 Frase inconclusa — buscar "al hacerlo, " (queda cortada): completar "…el gestor anterior deja de ver la
  gestión".
- 🟢 En cobro de cancelación con cargo también están "Ver/Enviar nota de cobro" (STORY-972).
- 🟢 Tipos de propiedad: falta "Duplex".
- 🟢 Buscador del tablero: falta el campo "N°" (búsqueda por número con o sin #); mencionar el `#N` visible
  en cada tarjeta (STORY-1009).

### 11.2 Manual Gestor Comercial
- 🟡 "Embudo de gestiones" → ídem 9.1.
- 🟡 Gestiones vinculadas → ídem 11.1.
- 🟢 Nombres de cards de informes ("cumplimiento" → "desvíos", ver 9.5); buscador "N°"; cargo de cancelación
  desde Presupuesto inclusive.
- ✅ La explicación de ownership ("solo ve sus gestiones, las de otros no aparecen") y de las etapas
  atenuadas es CORRECTA — no tocar.

### 11.3 Manual Gestor Financiero (el que más correcciones necesita)
- 🔴 **"El técnico puede pedir un adelanto… usted ve esas solicitudes":** NO existe la solicitud de adelanto
  (ver §0.2). Reescribir: "cuando un técnico necesita un adelanto (lo pide por fuera del sistema), usted lo
  registra desde el detalle de la gestión, con monto y comprobante de entrega obligatorio; se acumula y se
  descuenta en la liquidación". Quitar también el ejemplo de notificación "cuando un técnico pide un adelanto".
- 🟡 **Fórmula de liquidación:** el doc resta "la gestión administrativa" de más. Real: a liquidar =
  materiales rendidos + mano de obra presupuestada − adelantos. El fee NO participa (se cobra aparte al
  pagador) y NO figura en el PDF del detalle (a propósito — "la comisión no se expone").
- 🟡 **Nota de cobro NO es automática:** generar y enviar la nota son botones independientes ("Ver nota de
  cobro" / "Enviar nota de cobro por email"); registrar el cobro no la emite ni envía. (El envío del detalle
  de liquidación al técnico SÍ es automático al liquidar.)
- 🟡 **Pago combinado:** solo se tipea el monto del medio 2; el "Monto medio 1 (resto)" se autocalcula y es
  de solo lectura. Bloquea si los dos medios son iguales o si monto 2 ≥ total.
- 🟡 **Informes del GF incompletos:** ve el mismo panel que los demás salvo "Cobertura de especialidades"
  (también ve estancadas, orden por valor, carga por etapa y el histórico de técnicos). Y "Embudo" → 9.1.
- 🟢 Pestañas de Finanzas: se llaman "Cobros" y "Liquidaciones" (no "…pendientes") y cada una tiene
  pendientes + cerradas agrupadas por mes con buscador. Mencionar el histórico.
- 🟢 Desglose del cobro en pantalla: "Trabajo realizado" (un número) + "Gestión administrativa" = total (no
  abre materiales/mano de obra).

### 11.4 Manual Técnico
- 🔴 **"Pedir un adelanto de materiales desde el detalle del trabajo":** NO existe ese botón (ver §0.2 y
  11.3). Las acciones reales del técnico en obra: registrar avance (nota + foto), **pedir ampliación de
  presupuesto** (gasto extra a autorizar — cosa distinta al adelanto), terminar/subir conformidad, avisar
  "no puedo continuar". Reescribir la sección y la FAQ correspondiente (el adelanto se gestiona con la
  administración por fuera y aparece descontado en la liquidación).
- 🟡 **Terminar el trabajo:** agregar los requisitos reales: ≥1 nota de avance previa (el botón queda
  deshabilitado con aviso), foto de conformidad firmada + fotos de comprobantes (≥1) + total final gastado
  en materiales.
- ✅ Todo lo demás (registro, verificación de email, nav de 3 accesos, las 11 secciones de trabajos con sus
  labels exactos, agenda de franjas, perfil, y el capítulo entero de Walter) está verificado correcto.

---

## 12. §7.1 — Sprints (histórico)

Sin correcciones obligatorias: es registro de época (menciona "SISTEMA DE GESTIÓN DE INCIDENTES", bugs
#211-#229 del proyecto original). **Recomendación:** anteponer una nota de contexto (ver T4) para que el
lector no confunda esa terminología con el producto final. El título suelto "Trazabilidad" → "Seguimiento" (T3).

---

## 13. Mini-bugs de CÓDIGO detectados de rebote (NO son del doc — decidir aparte)

Estos no se arreglan editando el documento; si se corrigen en el código, el doc queda automáticamente bien:
1. **Alerta ámbar de 3 días inerte en "Gestiones estancadas":** `FilaAccionable` solo aplica
   `text-urgente-fuerte` cuando NO recibe `color`, y estancadas siempre pasa la rampa
   (`components/metricas/panel-metricas.client.tsx:223` vs `:681`). La alerta de 15 días de Cobro sí funciona
   (esa lista no pasa color).
2. **Subtítulo de la pantalla Archivo:** dice "Las gestiones cerradas o canceladas…" pero solo se archivan
   finalizadas (`components/gestiones/archivadas.client.tsx:98` vs `features/gestiones/service.ts:167-169`).
3. **Comentario stale** "8 gráficos" en `features/metricas/service.ts:8` (son 11).
(Recordar la regla del proyecto: cualquier fix de código requiere su STORY en `specs/` primero.)

---

## 14. Checklist de cierre (orden sugerido de trabajo)

1. [ ] Borrar bloque residual §4.6/4.7 (2.4).
2. [ ] Barrer las 4 features fantasma en TODO el doc: IA del inbox (2.1), causa del deterioro/sugerencia de
       pagador (2.2), plazos legales (2.3), pedido de adelanto del técnico (11.3/11.4).
3. [ ] HU-11 calificación: de "planificada" a implementada, actor correcto (3.4).
4. [ ] §6.7: corregir los 4 graves de texto (5.1–5.4) usando los diagramas como referencia.
5. [ ] Agregar diagrama de máquina de estados (6.1) y flujo de ampliaciones (6.2).
6. [ ] Rehacer §6.10 como DER real + campos de 7.3; arreglar la llave mermaid de §6.9.
7. [ ] §6.11/§7.2: Next 16, codigo/, imports, features 13, api/asistente, hooks (8.x, 10.1–10.5).
8. [ ] Reemplazar/regenerar imágenes: image20, image24, image13, image15, image3, image2 (leyenda), image21
       (casos de uso tras corregir PlantUML), image16 (DER tras 7.3), ubicar image9 (10.6–10.7).
9. [ ] Indicadores: Embudo→Carga por etapa (9.1) + quitar archivos citados (9.2) + matices (9.3–9.7).
10. [ ] Manuales: correcciones de 11.1–11.4 (prioridad: adelanto del técnico y fórmula de liquidación del GF).
11. [ ] Transversales: roles (T2) y trazabilidad (T3) con buscar/reemplazar.
12. [ ] Regenerar el índice (T1) — SIEMPRE al final.
13. [ ] Releer §7.1 y decidir nota de contexto histórico (12).
