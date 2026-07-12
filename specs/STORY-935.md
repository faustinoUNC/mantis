# STORY-935 — Validaciones de flujo + saludo en emails + archivo de finalizadas (v1.1)

**Estado:** ✅ implementada y verificada E2E (2026-07-11, sin commitear — Fausti revisa) · **Origen:** Fausti (2026-07-11, cuatro pedidos puntuales). Regla #0: máximo reciclaje de lo existente, sin abstracciones nuevas.

## Objetivo

Cuatro mejoras chicas sobre flujos que ya existen:

1. **No crear gestiones imposibles**: al presionar "Crear gestión", si no hay ningún técnico con la especialidad elegida, avisar y no crear.
2. **Presupuesto: el mail primero**: no se puede "Aprobar y ejecutar" sin haber enviado antes el presupuesto por email al pagador.
3. **Todos los emails saludan por nombre**: el único que no lo hacía era el resumen de obras al propietario.
4. **Archivar gestiones finalizadas** + una vista "Archivo" para verlas (con la misma división por roles del resto del sistema).

## Alcance y decisiones

### A. Validación de especialidad al crear gestión

- `crearGestion()` (`features/gestiones/service.ts`) valida ANTES del insert reutilizando **`tecnicosDisponibles(especialidad_id)`** — el mismo criterio exacto de la pantalla de asignación (técnico `aprobado` + usuario activo + especialidad en `tecnico_especialidades`). Si devuelve 0: `{ ok:false, error }` y no se crea nada.
- La validación es server-side → cubre las DOS puertas de creación: el form del tablero (`FormNueva`) y la conversión de reportes del inbox (`features/inbox/service.ts`). Ambas UIs ya muestran el `error` del ActionResult (rol `alert` en el form).
- Sin cambios de UI ni de DB. Doctrina STORY-924: bloqueo, no advertencia.

### B. Envío del presupuesto obligatorio antes de aprobar

- **Migración** (`story_935_presupuesto_enviado_y_archivo`): `gestiones.presupuesto_enviado_en timestamptz` (patrón `nota_emitida_en` — hoy el envío solo vivía en un estado local de React que se perdía al recargar).
- `enviarPresupuestoEmail()` (`features/finanzas/service.ts`): tras mandar el email, marca `presupuesto_enviado_en = now()` (idempotente en reenvíos).
- `resolverPresupuesto(..., aprobar=true)` (`features/gestiones/service.ts`): **bloqueo server-side** — si la gestión no tiene `presupuesto_enviado_en`, error "Enviá el presupuesto al pagador por email antes de aprobar." (validar antes de escribir, como el resto de la función).
- UI (`EvaluacionPresupuesto` en `detalle.client.tsx`): "Aprobar y ejecutar →" deshabilitado hasta que haya envío (persistido o recién hecho), con leyenda muted explicando por qué. `EnvioDocumento` gana prop opcional `onEnviado` (callback al enviar OK) y el presupuesto ahora le pasa `yaEnviado` persistido, como ya hace la nota de cobro.
- Edge documentado: si el pagador no tiene email cargado, el envío falla con su error ya existente → se carga el email en Cartera y se reintenta. Igual que la nota de cobro (que ya exige email).

### C. Nombre del destinatario en todos los emails

- Auditoría de plantillas: TODOS los emails ya pasan `destinatario` (estado al inquilino, resultado al técnico, presupuesto, nota de cobro, comprobante de liquidación) **salvo el resumen de obras al propietario**.
- Fix de una línea: `enviarResumenObras()` (`features/cartera/service.ts`) pasa `destinatario: r.datos.propietario` → la plantilla base agrega el "Hola, {nombre}:" como en el resto.

### D. Archivar gestiones finalizadas + vista "Archivo"

- **Migración** (misma de B): `gestiones.archivada_en timestamptz` (null = activa). Sin tabla nueva ni estado del funnel — archivar NO es una etapa, es ordenar el tablero. `finalizado` sigue siendo el estado terminal; las métricas/informes NO cambian (los hechos congelados siguen contando archivadas).
- **Server actions** (`features/gestiones/service.ts`): `archivarGestion(id, archivar: boolean)` — update por cliente de sesión (la RLS ya decide: admin, gestor owner y administrativo tienen UPDATE; el técnico no) con guard `.eq("etapa", "finalizado")`. Registra evento `archivada` / `desarchivada` (tipo texto libre, sin migración de enum).
- **Tablero**: `tableroGestiones()` filtra `.is("archivada_en", null)` → las archivadas salen de la columna Finalizado (y de la home del técnico, que usa la misma query — un trabajo archivado ya no aparece en su lista).
- **Vista "Archivo"**: página `app/gestiones/archivadas/page.tsx` (staff; el técnico no la tiene en su nav y la página lo rebota) + `gestionesArchivadas()` con el mismo `SELECT_RESUMEN` por cliente de sesión → **la RLS aplica la misma división por roles que el tablero** (el gestor de mantenimiento ve solo las suyas). Cards con el patrón del tablero + buscador `FiltrosLista` + botón "Desarchivar".
- **Detalle**: en etapa `finalizado`, card punteada "Archivar gestión" (patrón `CancelarGestion`) para gestor owner / administrativo / admin. Si está archivada: badge "Archivada" y botón para desarchivar.
- **Nav** (`NAV_POR_ROL`): item "Archivo" (`/gestiones/archivadas`, ícono nuevo `archivo` en `iconos.tsx`) para administrador, gestor_mantenimiento y gestor_administrativo.
- Labels de los eventos nuevos en `detalle.client.tsx` y `auditoria.client.tsx` (patrón STORY-928).

### E. Fix extra (v1.1) — warning preexistente de React keys en el sidebar

Detectado durante la verificación: `Each child in a list should have a unique "key" prop` en `SidebarStaff` (solo en dev). Causa: los slots `marca`/`campana`/`pie` se crean en `PanelShell` (server) y cruzan la frontera hacia `SidebarStaff` (client) — al deserializarse, React pierde la optimización de hijos estáticos y valida `{marca}{campana}` / `{campana}{pie}` como lista. Fix: `key` en los tres elementos al crearlos (`panel-shell.tsx`). Preexistente — no lo introdujo esta story.

## Criterios de aceptación

1. Crear gestión con una especialidad sin técnicos (aprobados y activos) → alerta "no hay técnicos con esa especialidad" y NO se crea (tablero e inbox).
2. En etapa Presupuesto, "Aprobar y ejecutar" está deshabilitado hasta enviar el presupuesto por email; el server también lo rechaza (refresh/carrera incluidos). Tras enviar (o si ya se envió antes, aun recargando), se puede aprobar. El botón de envío muestra "Reenviar" cuando ya se envió.
3. El email de resumen de obras llega con "Hola, {propietario}:". El resto de los emails ya saludaban y siguen igual.
4. Una gestión en Finalizado se puede archivar (gestor owner, administrativo o admin); desaparece del tablero y aparece en "Archivo". Desarchivar la devuelve. El técnico no puede archivar ni ve la vista.
5. En "Archivo" cada rol ve exactamente lo que la RLS le permite (gestor de mantenimiento: solo sus gestiones).
6. Archivar/desarchivar queda en `eventos_gestion` y legible en Actividad y Auditoría.
7. Informes/métricas sin cambios de código ni de números.
8. `tsc` + eslint + `next build` verdes.

## Dev Agent Record
- **Estado:** ✅ implementada y verificada E2E (2026-07-11). Sin commitear — pendiente de revisión de Fausti.
- **Migración** (`story_935_presupuesto_enviado_y_archivo`, aplicada en remoto): `gestiones.presupuesto_enviado_en timestamptz` + `gestiones.archivada_en timestamptz`. Sin cambios de RLS (el update de archivado pasa por las políticas existentes: admin/gestor owner/administrativo sí, técnico no).
- **Archivos:**
  - `features/gestiones/service.ts` — guard de especialidad en `crearGestion` (reusa `tecnicosDisponibles`, cubre tablero e inbox); bloqueo server-side en `resolverPresupuesto` (aprobar exige `presupuesto_enviado_en`); `tableroGestiones` filtra archivadas; `gestionesArchivadas()` y `archivarGestion(id, bool)` nuevas (+ eventos `archivada`/`desarchivada`); columnas nuevas en `obtenerGestion`.
  - `features/gestiones/types.ts` — `presupuesto_enviado_en` y `archivada_en` en `GestionDetalle`.
  - `features/finanzas/service.ts` — `enviarPresupuestoEmail` persiste `presupuesto_enviado_en`.
  - `features/cartera/service.ts` — `enviarResumenObras` pasa `destinatario` (saludo "Hola, {propietario}:").
  - `components/gestiones/envio-documento.client.tsx` — prop `onEnviado`.
  - `components/gestiones/detalle.client.tsx` — "Aprobar y ejecutar" deshabilitado sin envío (con leyenda), `yaEnviado` persistido del presupuesto, card `ArchivarGestion` en Finalizado, badge "Archivada", labels de eventos.
  - `components/gestiones/archivadas.client.tsx` + `app/gestiones/archivadas/page.tsx` — vista Archivo (staff, buscador, desarchivar, RefrescoVivo).
  - `features/auth/types.ts` — item "Archivo" en NAV de admin/mantenimiento/administrativo; `components/ui/iconos.tsx` — ícono `archivo`.
  - `components/auditoria/auditoria.client.tsx` — labels `archivada`/`desarchivada`.
  - `components/paneles/panel-shell.tsx` — (v1.1) `key` en los slots `marca`/`campana`/`pie` que cruzan al client component: mata el warning preexistente de React keys en `SidebarStaff` (verificado: consola limpia, sidebar intacto, probado empíricamente con `git stash` que el warning existía sin los cambios de esta story).
- **Verificación:** `tsc`, eslint y `next build` verdes. E2E con Playwright sobre dev local (datos revertidos al terminar): crear gestión "Control de plagas" (0 técnicos) → alerta y no se crea; con Plomería → se crea (borrada después). Gestión demo en Presupuesto: "Aprobar y ejecutar" deshabilitado con leyenda → envío del email (llegó a `emails_enviados`, evento registrado) → botón habilitado, "Reenviar" + "Enviado por email"; persistió tras recargar; aprobar avanzó a En ejecución (revertido). Finalizada archivada desde el detalle → desapareció del tablero y apareció en /gestiones/archivadas; admin ve archivadas de todos, el gestor solo las suyas (RLS); desarchivar desde la card la devolvió al tablero; eventos `archivada`/`desarchivada` en la base.
