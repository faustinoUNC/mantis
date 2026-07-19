# STORY-1011 — El gestor de mantenimiento (comercial) puede cargar adelantos en ejecución (v1.0)

**Estado:** 🟡 implementado, falta `tsc`/`eslint` + E2E (sin Node en este entorno) · **Origen:** pedido de Fausti (2026-07-19): "que el gestor comercial pueda dar adelantos de dinero en la ejecución". Hoy la carga del adelanto de materiales (STORY-977) era exclusiva del administrativo/admin — el gestor de mantenimiento (nombre de pantalla "Gestor Comercial", ver `NOMBRE_ROL`) es quien está en contacto con el técnico durante la obra y muchas veces la administración no está a mano para adelantarle plata.

## Alcance

1. **Server** (`features/finanzas/service.ts`) — `registrarAdelantoMateriales` pasa de exigir `exigirAdministrativo()` (solo administrador/gestor_administrativo) a un guard nuevo `exigirAdelanto(gestionId)`: administrador o gestor_administrativo (sin ownership, igual que antes) **O** gestor_mantenimiento dueño de esa gestión (`gestion.gestor_id === actual.id`, mismo patrón de `exigirMantenimiento`/PRD §2.1 — cada gestor solo opera sus gestiones). `exigirAdministrativo()` sigue intacta y se sigue usando para cobro/liquidación/documentos (eso NO cambia — "dinero es su rol" sigue valiendo para esas acciones).
2. El UPDATE final de `adelanto_materiales` pasa de usar el cliente de sesión a `createAdminClient()` — mismo patrón ya usado en el resto del service (`exigirMantenimiento` + escrituras subsiguientes) y en `subirConformidad`/rendición: el permiso ya lo validó `exigirAdelanto()` en la app, así que no hace falta depender del trigger Postgres `proteger_gestiones_update` (su whitelist de columnas de finanzas está pensada para `gestor_administrativo` — ver STORY-1000 — y no hay evidencia en el repo de que contemple a `gestor_mantenimiento`; ese trigger no está versionado en `codigo/`, así que no se puede verificar ni tocar desde acá).
3. **Cliente** (`components/gestiones/detalle.client.tsx`) — en la etapa `en_ejecucion`, el bloque que mostraba `<FinanzasAcciones>` (el formulario de adelanto) solo a `esAdministrativo` ahora también se muestra a `esGestorOwner` (admin o gestor de mantenimiento dueño). Se elimina el texto informativo redundante "El técnico está trabajando — los avances aparecen abajo apenas los registra" que antes veía `esGestorOwner` en esa etapa (los avances se siguen viendo más abajo en la misma pantalla; el texto quedaba huérfano una vez que el gestor tiene una acción real que hacer ahí).

## Fuera de alcance

- Cobro, liquidación, documentos/PDFs de finanzas: siguen siendo exclusivos de administrador/gestor_administrativo (`exigirAdministrativo`, sin cambios).
- No se toca la whitelist del trigger `proteger_gestiones_update` en Supabase (no versionada, no accesible desde este entorno) — se bypasea con admin client en vez de depender de que alguien la actualice ahí.
- No se agrega ningún estado ni columna nueva (Regla #0) — mismo campo `adelanto_materiales`, mismo evento `adelanto_materiales_registrado`.

## Criterios de aceptación

1. Un gestor de mantenimiento, dueño de una gestión en `en_ejecucion`, ve el formulario "Adelanto de materiales" (monto + comprobante) en el detalle — antes solo veía "El técnico está trabajando…".
2. Ese mismo gestor puede cargar un adelanto con comprobante y el monto se refleja en el header/caja de la gestión (mismo comportamiento que cuando lo carga el administrativo).
3. Un gestor de mantenimiento que NO es dueño de la gestión sigue sin poder cargar el adelanto (permiso rechazado server-side).
4. El administrativo/admin siguen pudiendo cargar el adelanto exactamente igual que antes (regresión).
5. Cobro y liquidación (etapas `facturacion_cobro`/`liquidacion_tecnico`) siguen siendo exclusivos del administrativo/admin — el gestor de mantenimiento sigue viendo el mensaje "En manos de la administración…" ahí (regresión, sin cambios).
6. `tsc`/eslint verdes.

## Dev Agent Record

- **Archivos:** `codigo/features/finanzas/service.ts` (`exigirAdelanto` nuevo, `registrarAdelantoMateriales`), `codigo/components/gestiones/detalle.client.tsx` (gate de `en_ejecucion`).
- **Verificación:** no se pudo correr `tsc`/`eslint` ni probar en navegador en este entorno (sin Node/npm instalado). **Pendiente: correr `tsc`/`eslint` y probar E2E** — en particular confirmar que el UPDATE con admin client efectivamente pasa para un usuario `gestor_mantenimiento` real (no se pudo verificar contra la DB de Supabase desde acá) y que un gestor NO dueño sigue recibiendo "No tenés permiso.".
