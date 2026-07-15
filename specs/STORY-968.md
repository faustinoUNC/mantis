# STORY-968 — El técnico se entera: aviso de desasignación + refresco en vivo de sus vistas + fin del 404

**Estado:** ✅ done · **Origen:** card Trello #93, errores de la ronda de prueba 2026-07-15 (ítems 3, 4, 5 y 6 del reporte). Fix de STORY-966.

## El problema

Cuando el gestor desasigna al técnico (STORY-966) o le rechaza el presupuesto, el técnico no se entera de nada:

1. **Sin aviso**: al desasignar, el service borra las notificaciones del saliente sobre esa gestión (patrón STORY-951, correcto: quedarían linkeando a un 404) pero no crea ninguna nueva. La gestión "desaparece" de su lista sin explicación.
2. **Sin refresco en vivo**: `mis-trabajos` y el detalle escuchan la tabla `gestiones`, pero Supabase Realtime **no entrega eventos de filas que salieron del alcance RLS del suscriptor** — al desasignar, el UPDATE pone `tecnico_id` en NULL y el técnico ya no puede ver la fila, así que el evento nunca le llega. La suscripción a `gestiones` es estructuralmente incapaz de avisar esto. Lo mismo pasa con el rechazo de presupuesto en `mis-trabajos`: el rechazo solo actualiza `presupuestos` (tabla que esa vista no escucha).
3. **404**: la card vieja sigue clickeable; al abrirla, `obtenerGestion` da null (RLS) y la página hace `notFound()`.

### Por qué el trigger outbox no alcanza

`notificar_evento()` lee `gestiones.tecnico_id` para resolver el destino `tecnico` — pero corre después del UPDATE, cuando ya está en NULL. El aviso al saliente solo puede crearlo `desasignarTecnico()`, que captura el `tecnico_id` antes de avanzar la etapa.

## La solución (mínima, sin tocar el trigger ni migraciones)

1. **Aviso al saliente** — `desasignarTecnico()` inserta (admin client, después de la limpieza de STORY-951) una notificación para el técnico saliente con `gestion_id: null` y `ruta: null`: sin link no hay 404 posible (la campanita ya renderiza `div` cuando no hay ruta) y la limpieza por `gestion_id` de futuros flujos no la toca. Título "Ya no estás asignado a esta gestión", cuerpo = descripción truncada (como el trigger).
2. **Señal de refresco universal para el técnico** — sus vistas montan además `RefrescoVivo tabla="notificaciones" filtro="usuario_id=eq.<id>"`: el INSERT de una notificación propia siempre es visible por RLS, así que sirve como señal aunque la gestión haya salido de su alcance. Cubre desasignación (nueva notif del punto 1), rechazo de presupuesto (notif `presupuesto_rechazado` ya existente en la matriz) y cualquier evento futuro que notifique al técnico.
   - `mis-trabajos.client.tsx` (nueva prop `usuarioId` desde `app/tecnico/page.tsx`).
   - `detalle.client.tsx`, solo para rol técnico (los gestores ya refrescan por `gestiones` filtrada y una señal global de notificaciones les refrescaría el detalle por actividad ajena).
3. **Fin del 404** — `app/gestiones/[id]/page.tsx`: si el usuario es técnico y la gestión no está visible → `redirect("/tecnico")` en vez de `notFound()`. Cubre el click en la card vieja y el refresh en vivo estando parado en el detalle (la página re-renderiza, la gestión ya no está, vuelve a su home donde la campanita explica qué pasó). Para los demás roles nada cambia.

## Criterios de aceptación

1. Con el técnico mirando su home, el gestor desasigna: la card desaparece sola (≤ ~1 s) y en la campanita aparece "Ya no estás asignado a esta gestión" (sin link — clickearla no navega).
2. Con el técnico parado en el detalle de esa gestión, el gestor desasigna: la pantalla vuelve sola a `/tecnico`, sin 404.
3. Click en una card vieja de una gestión ya desasignada: aterriza en `/tecnico`, nunca en 404.
4. Con el técnico mirando su home, el gestor rechaza el presupuesto: la card pasa sola de "Presupuesto enviado" a "A presupuestar" y llega la notificación existente.
5. Las notificaciones del saliente sobre la gestión se siguen borrando (STORY-951 intacto); las del gestor no se tocan; aceptar/rechazar asignación sigue igual.
6. `tsc` + `eslint` verdes.

## Dev Agent Record

- **Sin migraciones** — todo en app (la tabla `notificaciones` ya estaba en la publicación realtime y la campanita ya renderiza sin link cuando `ruta` es null).
- **Archivos:** `features/gestiones/service.ts` (`desasignarTecnico` selecciona también `descripcion` e inserta la notificación al saliente — admin client, `gestion_id`/`ruta` null — después de la limpieza STORY-951), `components/gestiones/mis-trabajos.client.tsx` (prop `usuarioId` + `RefrescoVivo` sobre `notificaciones` filtrado al usuario), `app/tecnico/page.tsx` (pasa `usuario.id`), `components/gestiones/detalle.client.tsx` (misma señal solo para rol técnico), `app/gestiones/[id]/page.tsx` (técnico sin gestión visible → `redirect("/tecnico")`).
- **Verificación:** `tsc`+`eslint` verdes. E2E local 2026-07-15 (Playwright + Supabase MCP, técnico logueado MIRANDO mientras se disparaba cada evento): (1) desasignación de "Gas" → la card desapareció sola de la home (≈1 s) y la campanita marcó 1 sin leer con el aviso SIN link; (2) desasignación con el detalle abierto → la pestaña volvió sola a `/tecnico`; (3) URL de gestión ya desasignada → aterrizó en `/tecnico`, sin 404; (4) rechazo de presupuesto → la card saltó en vivo de "Presupuesto enviado" a "A presupuestar"; (5) `desasignarTecnico` real desde la UI (admin, modal con motivo) → notificación en DB con `gestion_id`/`ruta` null y cuerpo con la descripción, viejas borradas (STORY-951 intacto).
