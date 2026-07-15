# STORY-976 — El aviso "no puedo continuar" se hace ver y pone la obra en pausa

**Estado:** ✅ done · **Origen:** card Trello #93, tercera ronda de prueba 2026-07-15 (2 errores nuevos sobre STORY-971).

## El problema (lo que documentaron los testers)

1. **Notificación insuficiente.** Cuando el técnico avisa que no puede continuar, el gestor solo recibe la campanita y un renglón en Actividad. En etapa Presupuesto la administración espera un presupuesto — y nada en la pantalla principal ni en el encabezado del detalle le avisa que ese presupuesto no va a llegar. Hay que bajar hasta el timeline para enterarse.
2. **El técnico puede seguir operando después de avisar.** Manda el aviso ("no puedo continuar") y el sistema le deja igual subir presupuesto, registrar avances y terminar la obra. El aviso no cambia nada para él — es contradictorio y confunde al gestor (¿sigue o no sigue?).

## Causa raíz

STORY-971 implementó el aviso como **un evento suelto** (`tecnico_no_continua` en `eventos_gestion`): no queda NINGÚN estado en la gestión. Por eso (a) no hay nada que el tablero o el encabezado puedan mostrar, (b) no hay nada que bloquee las acciones del técnico, y (c) hasta la tarjeta "aviso enviado" del técnico era estado local de React — con recargar la página podía mandar el aviso infinitas veces.

## Decisión de diseño (Regla #0 + regla de dominio)

El aviso pasa a ser **un campo explícito en la gestión** (`aviso_no_continua_en` + `aviso_no_continua_motivo`), igual que el precedente `desasignada_en` de STORY-966 — nada de derivar el estado desde los eventos en runtime (regla #2 del dominio). Semántica simple:

- **Mientras el aviso está activo, la obra está en pausa para el técnico**: no puede presupuestar, ni registrar avances, ni subir conformidad (UI bloqueada + guard server-side). Puede ver todo.
- **El gestor lo ve sin buscarlo**: banner ámbar prominente en el detalle (con el motivo y las salidas) + badge "Técnico no continúa" en la tarjeta del tablero.
- **El aviso vive dentro de la etapa**: CUALQUIER transición del funnel (desasignar, cancelar, aprobar) lo limpia — toda transición es una decisión del gestor que lo supersede. Sin estados nuevos ni flujos paralelos.
- **Salida sin mover el funnel**: si el gestor lo resuelve hablando ("al final puede seguir"), botón **"El técnico continúa"** → limpia el aviso + evento `aviso_resuelto` + notificación al técnico por la matriz de siempre.

## La solución

1. **Migración `story_976_aviso_no_continua_persistente`**:
   - `gestiones` += `aviso_no_continua_en timestamptz`, `aviso_no_continua_motivo text`.
   - `avanzar_etapa()`: el UPDATE final de etapa limpia ambos campos (toda transición resuelve el aviso).
   - `matriz_notificaciones` += fila `aviso_resuelto` → destino `tecnico`, título "El gestor resolvió tu aviso — seguís asignado al trabajo".
2. **Service (`features/gestiones/service.ts`)**:
   - `avisarNoPuedoContinuar`: rechaza si ya hay aviso activo; estampa los campos (admin client, patrón rendición: la RLS no da UPDATE al técnico pero `exigirTecnicoAsignado` ya validó que es SU gestión) + evento como hasta ahora.
   - Nueva `resolverAvisoTecnico(gestionId)`: gestor owner/admin limpia los campos (cliente de sesión — la RLS decide) + evento `aviso_resuelto` (la matriz notifica al técnico).
   - Guards de pausa en `enviarPresupuesto`, `registrarAvance` y `subirConformidad`: con aviso activo → error "Avisaste que no podés continuar — el trabajo está en pausa hasta que el gestor decida."
3. **Tipos/queries**: `aviso_no_continua_en` en `GestionResumen` (+ ambos selects + `normalizarFila`); `aviso_no_continua_motivo` en `GestionDetalle`.
4. **UI**:
   - `tablero.client.tsx`: badge urgente "Técnico no continúa" en la tarjeta.
   - `detalle.client.tsx`: badge en el encabezado; banner ámbar para el gestor con motivo, fecha y las tres salidas (desasignar / cancelar — abajo como siempre — o botón "El técnico continúa"); vista técnico: las acciones de la etapa se reemplazan por "El trabajo está en pausa" y la card del aviso muestra "aviso enviado" persistido (ya no re-enviable tras recargar).
   - `mis-trabajos.client.tsx`: badge "En pausa" en la tarjeta del técnico.
   - `eventos.ts`: label `aviso_resuelto`.

Realtime: el UPDATE de `gestiones` dispara los `RefrescoVivo` existentes (tablero y detalle) — banner y badges aparecen/desaparecen solos en ambas puntas.

## Criterios de aceptación

1. Técnico avisa → en el detalle del gestor aparece el banner ámbar arriba (motivo + fecha) y en el tablero la tarjeta muestra "Técnico no continúa", sin recargar.
2. Con aviso activo el técnico NO puede presupuestar/avanzar/terminar/resubir conformidad (UI bloqueada Y server action rechaza); la card del aviso dice "ya avisaste" incluso tras recargar; su lista muestra "En pausa".
3. "El técnico continúa" → banner y badges desaparecen (ambas puntas, sin recargar), el técnico recibe la notificación y recupera sus acciones; queda `aviso_resuelto` en Actividad/Auditoría.
4. Desasignar o cancelar con aviso activo → el aviso queda limpio (una reasignación posterior no arrastra el banner).
5. Reintentar el aviso con uno activo → error claro, sin evento duplicado.
6. `tsc` + `eslint` verdes.

## Dev Agent Record

- **Migración:** `story_976_aviso_no_continua_persistente` (columnas + limpieza en el UPDATE final de `avanzar_etapa` + fila `aviso_resuelto` en la matriz). Aplicada 2026-07-15.
- **Archivos:** `features/gestiones/service.ts` (marca persistida en `avisarNoPuedoContinuar` con rollback si el evento falla, nueva `resolverAvisoTecnico`, guards `ERROR_EN_PAUSA` en `enviarPresupuesto`/`registrarAvance`/`subirConformidad` — `enviarPresupuesto` además pasó a exigir técnico asignado), `features/gestiones/types.ts`, `features/gestiones/eventos.ts`, `components/gestiones/detalle.client.tsx` (banner, badge, pausa, card de aviso persistida), `components/gestiones/tablero.client.tsx` (badge), `components/gestiones/mis-trabajos.client.tsx` (sección "En pausa").
- **Verificación:** `tsc`+`eslint` verdes. E2E local 2026-07-15 (Playwright, técnico *tecnicouno* + gestor *gestorcomercialuno*, gestión `bae73b15`): aviso con motivo → badge y pausa aparecen EN VIVO en la vista del técnico y persisten tras recargar (formularios de inspección/presupuesto reemplazados por el mensaje de pausa; el botón de aviso ya no se puede reenviar); su home lo muestra en "En pausa"; el gestor ve el badge "Técnico no continúa" en la tarjeta del tablero y el banner ámbar arriba del detalle con motivo y fecha; "El técnico continúa" limpia banner/badge, deja `aviso_resuelto` en Actividad y el técnico recibe "El gestor resolvió tu aviso — seguís asignado al trabajo" (con link, verificado en DB); aviso activo + desasignar → campos limpios en DB (verificado por SQL) con el badge "Reasignar" de siempre.
