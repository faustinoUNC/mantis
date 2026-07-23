# STORY-1042 — El técnico no puede terminar la obra con una ampliación de presupuesto pendiente (+ badge en la card) (v1.0)

**Estado:** 🔨 en prueba · **Origen:** pedido de Fausti (2026-07-23). Bug de flujo detectado en el circuito de ampliación de presupuesto (STORY-1017).

## Problema

Cuando el técnico pide una **ampliación de presupuesto** a mitad de obra (STORY-1017), esa ampliación tiene que ser **evaluada por la inmobiliaria** (el gestor la envía al pagador y registra la autorización). Nace con estado `"enviada"` = pendiente de respuesta.

El bug: mientras la ampliación está `"enviada"`, el técnico **igual puede terminar la obra** subiendo la conformidad. `subirConformidad()` (`features/gestiones/service.ts`), cuando la etapa es `en_ejecucion` (`terminando`), llama a `avanzarEtapa(gestionId, "conformidad")` y mueve el funnel `en_ejecucion → conformidad` — sin mirar si hay una ampliación pendiente. Ni el server ni la UI (`AccionConformidadTecnico`, `detalle.client.tsx`) chequean el estado de las ampliaciones. Los dos únicos candados que existen hoy son el aviso "no puedo continuar" (`aviso_no_continua_en`) y la nota de avance obligatoria.

Resultado: el técnico cierra la obra con un gasto extra sin autorizar todavía, dejando a la inmobiliaria fuera de la decisión que le corresponde.

Además, hoy **nada en la card de la gestión** avisa que se pidió una ampliación: el gestor tiene que entrar al detalle para enterarse de que hay algo que evaluar.

## Decisión de diseño

- **Bloquear solo al TERMINAR (Regla #0).** Las ampliaciones solo viven en `en_ejecucion` (`crearAmpliacion` lo exige). El candado aplica únicamente cuando `terminando` (etapa `en_ejecucion` → subir la conformidad que cierra la obra). No toca los avances/notas normales (no mueven el funnel), ni la resubida de una conformidad rechazada en etapa `conformidad`.
- **Server + UI, como los otros candados.** El botón deshabilitado cubre lo visual; el gate en `subirConformidad` es el autoritativo (cubre refresh y carreras), mismo patrón que `aviso_no_continua_en` y la nota de avance.
- **Criterio a nivel gestión, no por técnico.** El índice único parcial `ampliaciones_un_enviada_por_gestion` (sobre `gestion_id WHERE estado='enviada'`) garantiza **una sola ampliación pendiente por gestión**. En el flujo normal esa `enviada` siempre es del técnico actual; si quedara una colgada de un saliente desasignado, conviene igual que el gestor la resuelva antes de cerrar. Chequear "¿esta gestión tiene una ampliación `enviada`?" es más simple y no requiere sumar `tecnico_id` a la query del tablero.
- **Badge "Ampliación" en la card, tono `urgente`.** Es la convención ya establecida para todo lo que necesita atención en la card ("En pausa", "Reasignar", "Falta calificar" — todos `tono="urgente"`, ámbar). Label corto ("Ampliación") que no rompe la columna angosta del tablero. Se muestra en el tablero del gestor (quien la evalúa) y en "Mis trabajos" del técnico (refuerza por qué no puede terminar).

## Alcance

1. **`features/gestiones/service.ts`:**
   - `subirConformidad()`: si `terminando` y existe una ampliación `estado='enviada'` para la gestión, cortar con error antes de subir la conformidad / avanzar la etapa: *"Tenés una ampliación de presupuesto esperando respuesta del pagador — no podés terminar la obra hasta que la resuelvan."*
   - `SELECT_RESUMEN`: sumar `ampliaciones(estado)` al embed.
   - `normalizarFila()`: derivar `ampliacion_pendiente = ampliaciones.some((a) => a.estado === 'enviada')`.
2. **`features/gestiones/types.ts`:** agregar `ampliacion_pendiente: boolean` a `GestionResumen`.
3. **`components/gestiones/detalle.client.tsx`** (`AccionConformidadTecnico`): calcular `ampliacionPendiente = gestion.ampliaciones.some((a) => a.estado === 'enviada')`; cuando aplica y `terminando`, mostrar un cartel explicativo y deshabilitar el botón "Terminar y subir conformidad".
4. **`components/gestiones/tablero.client.tsx`:** `{gestion.ampliacion_pendiente && <Badge tono="urgente">Ampliación</Badge>}` en la fila de badges.
5. **`components/gestiones/mis-trabajos.client.tsx`:** mismo badge en la card del técnico (`TarjetaAccion` / la que aplique).

## Fuera de alcance

- No se toca el circuito de la ampliación en sí (crear/enviar/resolver, STORY-1017/1038/1039).
- No se resuelve el caso de la ampliación pendiente que queda colgada al desasignar un técnico (bug pre-existente, aparte). El criterio a nivel gestión hace que, si pasara, el gestor deba resolverla antes de cerrar — comportamiento aceptable.
- No se bloquean los avances/notas (`registrarAvance`) — no mueven el funnel.
- No se agrega columna ni estado nuevo al funnel; no hay migración de DB (el índice único ya existe).

## Criterios de aceptación

1. **Bloqueo al terminar:** con una ampliación `enviada`, el técnico ve el botón "Terminar y subir conformidad" deshabilitado con el cartel explicativo; si fuerza el submit (carrera/refresh), `subirConformidad` devuelve el error y la etapa NO avanza.
2. **Desbloqueo al resolver:** cuando el gestor aprueba o rechaza la ampliación (deja de estar `enviada`), el técnico puede terminar la obra normalmente.
3. **Avances no bloqueados:** con la ampliación pendiente, el técnico sigue pudiendo registrar notas de avance.
4. **Badge en el tablero:** una gestión con ampliación `enviada` muestra el badge "Ampliación" (ámbar) en la card del tablero del gestor; desaparece al resolverla.
5. **Badge en Mis trabajos:** misma gestión muestra el badge en la card del técnico.
6. **Sin regresión:** el flujo normal (terminar sin ampliación pendiente, resubir conformidad rechazada) sigue igual. `tsc`/eslint verdes.

## Dev Agent Record

- **Commit:** `c6dfe2c` (2026-07-23). Sin migración (el índice único `ampliaciones_un_enviada_por_gestion` ya existía).
- **Archivos:**
  - `codigo/features/gestiones/service.ts`: gate en `subirConformidad` (si `terminando` y hay ampliación `enviada` en la gestión → error, antes de subir/avanzar); `SELECT_RESUMEN` suma `ampliaciones(estado)`; `normalizarFila` deriva `ampliacion_pendiente = ampliaciones.some((a) => a.estado === "enviada")`.
  - `codigo/features/gestiones/types.ts`: `ampliacion_pendiente: boolean` en `GestionResumen`.
  - `codigo/components/gestiones/detalle.client.tsx`: `AccionConformidadTecnico` calcula `ampliacionPendiente` (solo `terminando`), muestra cartel ámbar y deshabilita "Terminar y subir conformidad".
  - `codigo/components/gestiones/tablero.client.tsx`: badge `<Badge tono="urgente">Ampliación</Badge>` en la card del gestor.
  - `codigo/components/gestiones/mis-trabajos.client.tsx`: mismo badge en `TarjetaAccion` (card del técnico).
- **Fix realtime (follow-up):** el badge no aparecía en vivo — el tablero y Mis trabajos solo suscribían `<RefrescoVivo tabla="gestiones" />`, y un INSERT en `ampliaciones` no toca `gestiones`, así que no disparaba `router.refresh()` (el detalle sí funcionaba porque ya suscribe `ampliaciones`). Se agrega `<RefrescoVivo tabla="ampliaciones" />` (sin filtro; la RLS limita las filas) en `tablero.client.tsx` y `mis-trabajos.client.tsx`. `ampliaciones` ya está en la publicación `supabase_realtime`.
- **Verificación:**
  - `tsc --noEmit` y `eslint` verdes sobre los archivos tocados.
  - Click-through en la app pendiente (card de Trello para Giuli).
