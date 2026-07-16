# STORY-980 — Auditoría de eventos de sistema: el ABM administrativo deja rastro

**Estado:** ✅ done · **Origen:** party mode 2026-07-15 (Mary/John/Winston/Sally + Amelia) convocado por Fausti: "hay eventos clave que no estamos logueando — cuando alguien crea, acepta o rechaza un técnico, ídem la creación de usuarios". Continúa la línea de STORY-974 (la Auditoría es control interno: "quién hizo qué").

## El problema

`eventos_gestion` es el ÚNICO event-log del sistema y está **atado obligatoriamente a una gestión** (`gestion_id NOT NULL`, `actor_id NOT NULL`). Consecuencia: **toda acción administrativa es invisible en la Auditoría** — verificado acción por acción:

- **Técnicos**: postulación pública, alta manual del staff, **aprobación**, **rechazo**, inhabilitación/habilitación — cero eventos (`features/tecnicos/service.ts`).
- **Empleados**: creación, **cambio de rol**, inhabilitación/habilitación, blanqueo de contraseña — cero eventos (`features/empleados/service.ts`).
- `emails_enviados` captura *indirectamente* algunas (porque salió un mail) pero sin actor y sin modelar la acción; `notificaciones` deriva de `eventos_gestion` (mismo sesgo).

Mary (974): "es un log de PERSONAS — y a la mitad de las acciones sobre personas ni las loguea".

## La solución

### 1. Alcance v1: identidad y acceso — 11 tipos (John: "si nadie va a preguntar por un evento, loguearlo es coleccionar, no auditar")

| Empleados | Técnicos |
|---|---|
| `empleado_creado` | `tecnico_postulado` (registro público; `reintento: true` si reabre una rechazada) |
| `rol_cambiado` (de → a congelado) | `tecnico_alta_manual` |
| `empleado_desactivado` / `empleado_reactivado` | `tecnico_aprobado` / `tecnico_rechazado` (motivo congelado) |
| `contrasena_blanqueada` | `tecnico_inhabilitado` / `tecnico_rehabilitado` |

**Afuera por decisión** (no re-proponer sin disparador real): ediciones menores (nombres, especialidades, contacto, agenda) — ruido, no evidencia; cartera/legajos/especialidades — candidata a segunda ola SOLO si aparece una disputa real de "quién paga".

### 2. Modelado: tabla nueva `eventos_sistema` — NO `gestion_id` nullable

Winston (misma doctrina que mató el ledger genérico): "dos logs chicos y explícitos > uno genérico lleno de nulls". Razones concretas contra el nullable:

- `trg_notificar_evento` (AFTER INSERT en `eventos_gestion`) dispararía notificaciones espurias.
- `ON DELETE CASCADE` hacia `gestiones` es correcto para el funnel, letal para auditoría de personas.
- `actor_id NOT NULL` hace imposible la postulación pública (no hay sesión) — dato de Amelia que decidió la sesión.
- Todos los consumidores actuales asumen gestión presente.

```sql
create table eventos_sistema (
  id        uuid primary key default gen_random_uuid(),
  tipo      text not null,
  actor_id  uuid references usuarios(id),  -- NULL = acción pública (postulación)
  detalle   jsonb not null default '{}',   -- hechos congelados
  creado_en timestamptz not null default now()
);
```

- **Hechos congelados aplicado a personas**: el afectado viaja como snapshot en `detalle` (`{afectado, email, rol, de, a, motivo, reintento}` según el tipo), NUNCA como FK que se resuelve en runtime — si después renombran o borran al usuario, la evidencia no cambia. (En acta, Mary: columna `afectado_id` solo si algún día hace falta filtrar por afectado con precisión.)
- RLS habilitada SIN policies (solo service role). Lectura vía `historialSistema()` admin-only; escritura vía helper `registrarEventoSistema()` — módulo **sin** `"use server"` a propósito (escribe con admin client; no debe ser un endpoint invocable). Mismo tratamiento de errores que los inserts de `eventos_gestion` (no voltea la acción).
- Labels centralizados desde el día uno (`LABEL_EVENTO_SISTEMA` + `detalleSistemaLegible`) — lección 974: nunca un slug crudo en la tabla del admin.

### 3. UX: tabs "Gestiones | Sistema" en `/admin/auditoria` (Sally)

- Dos fuentes con columnas distintas NO se mezclan en una tabla ("la columna Gestión vacía en la mitad de las filas es un formulario mintiendo"). Segmentado con el patrón existente de Informes.
- Tab **Gestiones** = la pantalla actual, intacta, default.
- Tab **Sistema**: columnas Evento (label + detalle expandible), Afectado (nombre + email), Quién (actor + rol; actor NULL → "Registro público"), Hora. Separadores por día y count con denominador (Mary), mismo patrón 974.
- Filtros del tab Sistema: búsqueda por nombre del afectado (`ilike` sobre `detalle->>afectado`), persona (mismo `listarActores()`), tipo (desde `LABEL_EVENTO_SISTEMA`), desde/hasta. Server-side + paginación + descarte de respuestas viejas, todo patrón 974. La búsqueda por dirección no aplica acá.
- Deep-link `?tab=sistema`; el botón actualizar (974 v1.1) opera sobre el tab activo.

## Criterios de aceptación

1. Crear un empleado, cambiarle el rol, inhabilitarlo y blanquearle la contraseña generan 4 eventos visibles en el tab Sistema con actor = admin y afectado congelado (nombre/email; el cambio de rol muestra "de → a").
2. El ciclo del técnico deja rastro completo: postulación pública (actor "Registro público"), aprobación y rechazo (con motivo visible), alta manual, inhabilitación/habilitación — cada uno con su label legible, jamás el slug.
3. Los filtros del tab Sistema (afectado, persona, tipo, fechas) filtran EN LA QUERY con count total visible; cambiar un filtro vuelve a página 1.
4. El tab Gestiones queda exactamente como estaba (cero regresión); `?tab=sistema` abre directo el tab Sistema.
5. Los eventos de sistema NO generan notificaciones ni aparecen en Actividad de ninguna gestión.
6. Borrar o renombrar al afectado no altera lo que muestra la Auditoría (snapshot congelado en `detalle`).
7. `tsc` + `eslint` verdes; sin errores de hidratación.

## Dev Agent Record

- **Migración:** `eventos_sistema` (RLS sin policies + índice `creado_en desc`).
- **Archivos:** `features/auditoria/registrar.ts` (NUEVO: `registrarEventoSistema`, sin "use server"), `features/auditoria/eventos-sistema.ts` (NUEVO: labels + detalle legible, client-safe), `features/auditoria/types.ts` (tipos Sistema), `features/auditoria/service.ts` (`historialSistema`), `features/empleados/service.ts` (4 puntos instrumentados), `features/tecnicos/service.ts` (5 puntos), `app/admin/auditoria/page.tsx` (searchParams + fetch de ambos tabs), `components/auditoria/auditoria.client.tsx` (tabs + tabla Sistema).
- **v1.1 (misma noche):** el filtro Persona era una sopa plana de ~35 usuarios ("me hace ruido, es gigantesco" — Fausti). Fix sin componente nuevo (Regla #0): `SelectPersona` compartido agrupa con `<optgroup>` nativo por rol (staff primero, técnicos al final) y cae el sufijo "— rol" de cada opción (el grupo ya lo dice); en el tab **Sistema** los técnicos directamente NO aparecen — nunca son actores ahí (sus acciones logueadas las ejecuta el staff, o el registro público con actor null): 16 opciones en vez de 35. Si algún día un técnico genera eventos de sistema, revisar este filtro.
- **v1.2 (misma noche):** el filtro se renombra "Persona" → **"Usuario"** (Fausti). Además de sonar mejor, es el término correcto del dominio: en MANTIS "persona" ya nombra a propietarios/inquilinos de cartera (que NO tienen usuario) — acá el filtro lista exactamente cuentas de `usuarios`. Componente `SelectUsuario`, opción vacía "Todos".
- **Verificación:** `tsc` + `eslint` verdes. Migración aplicada (`story_980_eventos_sistema`). E2E local (2026-07-15): ciclo técnico completo por UI — postulación pública, rechazo con motivo, **reintento tras rechazo sin sesión → actor "Registro público" + "Reintento tras un rechazo"**, aprobación, inhabilitar/habilitar; ciclo empleado completo — crear, cambio de rol ("Gestor Comercial → Gestor Financiero" visible), blanqueo, inhabilitar/habilitar. Los 11 eventos en el tab Sistema con labels legibles; filtro por tipo → count 1 correcto; búsqueda por afectado → count 6 correcto; `?tab=sistema` abre directo; tab Gestiones intacto (2.030 eventos); consola sin errores de hidratación. Criterio 6 verificado de verdad: se BORRARON los dos usuarios de prueba (auth cascade) y los 11 eventos siguen mostrando nombre/email congelados. Datos de prueba limpiados por marcador propio (emails `+tec980`/`+emp980`), storage y notificaciones incluidos.
