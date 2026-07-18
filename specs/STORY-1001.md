# STORY-1001 — Gestiones vinculadas: camino para trabajo adicional descubierto durante la ejecución (v1.0)

**Estado:** ✅ done · **Origen:** card Trello #19 (https://trello.com/c/qaMAFpGd) + party mode 2026-07-18. El técnico abre una pared por una filtración y encuentra cables pelados: hoy no hay forma de modelar ese trabajo adicional (el presupuesto solo existe en la etapa Presupuesto y no hay camino hacia atrás desde En ejecución). La card original proponía gestiones madre/hija con **bloqueo** de la madre y un **visor gráfico** de dependencias; el comentario posterior de Fausti simplificó: crear una gestión nueva normal indicando al cargarla que "surgió de" otra. El party convergió en la versión simple, con argumentos: el bloqueo genera la espiral hija-cancelada-traba-la-madre y el caso real más común (descubrimiento durante la **inspección**, en etapa Presupuesto) quedaba afuera de la regla "solo En ejecución" de la card original.

## Decisiones de diseño (party 2026-07-18, aprobadas por Fausti)

- **Vínculo informativo, NO bloqueo.** La gestión de origen ("madre") nunca queda trabada por el estado de la vinculada ("hija"). `avanzar_etapa()` NO se toca — el aviso es presentación pura (acta de Winston: que nadie lo "mejore" metiéndolo como validación en la función Postgres, porque por ahí vuelve el bloqueo y con él la hija cancelada que traba todo).
- **Aviso, no candado:** cartel ámbar informativo al aprobar la **conformidad** de la madre si hay vinculadas aún en curso. Vinculada cancelada o finalizada (etapa terminal) → sin cartel (confirmado por Fausti).
- **Una sola puerta de entrada:** el alta normal del tablero, con un combo opcional (idea de Fausti). Nada de botones paralelos ni formularios nuevos.
- **Relación visible en todo momento en el tablero** (pedido de Fausti): chip de vínculo permanente en las cards + anillo esmeralda en la(s) contraparte(s) al hacer hover. Sin contorno permanente de color (con 2 parejas en el tablero no se sabe cuál va con cuál, y compite con el ámbar de urgente — contract) y sin visor gráfico (un grafo para una arista).
- El vínculo se fija **al crear** y no se edita — hecho congelado.

## Alcance

1. **Migración `gestiones_gestion_origen_id`**: `alter table gestiones add column gestion_origen_id uuid references gestiones(id) on delete set null` + índice parcial sobre la columna. `ON DELETE SET NULL` para que los borrados masivos (reset-datos.sh, demo-borrar.sh) nunca dependan del orden. Sin cambios en RLS (misma tabla), sin tocar triggers (`proteger_gestiones_update` es BEFORE UPDATE y esto se escribe en el INSERT), sin eventos nuevos.

2. **Tipos y fetch** (`features/gestiones/types.ts` + `service.ts`):
   - `GestionResumen` gana `propiedad_id`, `gestion_origen_id`, `origen: { id, descripcion, etapa } | null` (embed to-one por la columna) y `vinculadas_ids: string[]` (embed to-many de ids). `SELECT_RESUMEN`/`SELECT_DETALLE` suman esos embeds; `normalizarFila` los mapea.
   - `GestionDetalle` gana `vinculadas: { id, descripcion, etapa, especialidad }[]` (query aparte en el `Promise.all` de `obtenerGestion`, junto a eventos/presupuestos/etc.).

3. **Alta** (`FormNueva` en `components/gestiones/tablero.client.tsx`): ComboFiltrable opcional **"¿Surgió de otra gestión?"** listando las gestiones del tablero en etapa NO terminal (`ETAPAS_TERMINALES`), etiqueta `dirección — descripción`. Al elegir una, la **propiedad se autocompleta y se bloquea** (la hija es de la misma propiedad por definición); al deselegir, se libera. `crearGestion` acepta `gestion_origen_id` opcional y valida server-side: el origen existe y no está en etapa terminal; la `propiedad_id` se toma DEL ORIGEN (autoritativo). El legajo vigente se sigue derivando de la propiedad como siempre (línea existente — la hija toma el inquilino ACTUAL, no un snapshot copiado de la madre).

4. **Tablero** (`tablero.client.tsx`): chip permanente con ícono de eslabón (nuevo ícono `vinculo` en `components/ui/iconos.tsx`) en toda card vinculada — en la madre con el conteo (`🔗 2`), en la hija solo el eslabón; `title` nativo como respaldo textual ("Surgió de: …" incluso si la contraparte ya salió del tablero). Al hacer **hover** sobre una card vinculada, sus contrapartes presentes en el tablero levantan un anillo esmeralda (`ring-brand`); estado local del tablero, cero derivación en server.

5. **Detalle** (`detalle.client.tsx`): en la hija, línea "Surgió de: {descripción}" (link al detalle del origen + su etapa) bajo el título; en la madre, sección **"Gestiones vinculadas"** (fila simple: descripción linkeada + especialidad + badge de etapa). En `AccionConformidadGestor`, si hay vinculadas en curso, cartel ámbar informativo arriba de las acciones: "Hay una gestión vinculada sin terminar: {descripción} — {etapa}". No deshabilita nada.

## Fuera de alcance (documentado para no re-proponer)

- **Bloqueo de la madre** por estado de la hija (descartado — espiral de reglas, caso hija-cancelada).
- **Visor gráfico de dependencias** (descartado — la relación real es 1 a 1 o 1 a 2).
- Vincular gestiones YA existentes entre sí a posteriori, editar/quitar el vínculo, UI de árboles multi-nivel (la columna banca cadenas; la UI muestra solo la relación directa).
- Alta vinculada desde el **inbox** de reportes (v1 solo el alta del tablero).
- Costo agrupado por problema raíz en historial/informes (acta de Mary, segunda ola).
- La hija **cuenta como gestión normal en Informes** (ingresadas +1) y aparece como obra propia en el historial de la propiedad — es un trabajo real con su plata; NO es un bug.

## Criterios de aceptación

1. En el alta del tablero se puede elegir opcionalmente una gestión de origen (solo no terminales); al elegirla la propiedad queda fijada a la del origen. La gestión creada guarda `gestion_origen_id`.
2. Sin elegir origen, el alta funciona exactamente igual que hoy (regresión).
3. En el tablero, madre e hija muestran el chip de vínculo; hover sobre una resalta a la(s) otra(s) con anillo esmeralda; si la contraparte ya no está en el tablero, el `title` del chip lo cuenta.
4. En el detalle: la hija muestra "Surgió de" con link; la madre lista sus vinculadas con etapa; los links cruzados navegan bien.
5. Al aprobar conformidad de la madre con una vinculada en curso aparece el cartel ámbar (informativo — se puede aprobar igual); con la vinculada finalizada o cancelada, no aparece.
6. `avanzar_etapa()`, triggers, RLS y notificaciones quedan sin cambios. `tsc`/eslint verdes.

## Dev Agent Record

- **Commit:** `7b9f893` (2026-07-18).
- **Archivos:** `codigo/features/gestiones/types.ts`, `codigo/features/gestiones/service.ts`, `codigo/components/gestiones/tablero.client.tsx`, `codigo/components/gestiones/detalle.client.tsx`, `codigo/components/ui/iconos.tsx` (ícono `vinculo`) + migración `story_1001_gestiones_gestion_origen_id` (aplicada).
- **Verificación:** `tsc`/eslint verdes. E2E navegador (Admin): alta con combo "¿Surgió de otra gestión?" → propiedad autocompletada y bloqueada → creada con vínculo; tablero con chip en ambas cards (madre "1", title "Surgió de: …"/"1 gestión surgió de esta") y anillo esmeralda en la madre al hover sobre la hija; detalle hija con "Surgió de: … · Asignación" linkeado; detalle madre con sección "Gestiones vinculadas · 1"; cartel ámbar en Conformidad con vinculada viva (botones Aprobar/Rechazar habilitados — informa, no bloquea). Embed self-join de PostgREST validado por curl antes de cablear. Dato de prueba borrado.
