# STORY-965 — Fuera los gastos imprevistos: la rendición única (total + fotos de comprobantes) es todo el control de gastos

**Estado:** ✅ done · **Origen:** Fausti (2026-07-14): "no me convence cómo está implementado el tema de los gastos imprevistos, me parece rebuscado y complejo". Debatido en party mode (Mary/John/Winston/Sally): voto unánime por demoler la feature y compensar con fotos múltiples de comprobantes.

## El problema

Desde STORY-964 los gastos imprevistos **no mueven un peso**: el técnico rinde UN total real de la obra (imprevistos incluidos) y `costo_final = total rendido + mano de obra`. La carga incremental de gastos (`gastos_imprevistos`) quedó como capa paralela puramente informativa: tabla propia + RLS + realtime, dos componentes de UI, validación cruzada `total ≥ Σ gastos` (client y server), evento `gasto_enviado`, fila en `matriz_notificaciones` y sub-líneas "incluye $X de imprevistos" en Conformidad y Liquidación. Todo eso para evidencia que la rendición ya cubre. Además, la alerta de gasto a mitad de obra es una notificación sobre la que el gestor **no puede actuar** (sin aprobación desde la 934) — ruido; para avisar novedades a mitad de obra están las notas de avance.

La única pérdida real al borrarlos es el **detalle por ticket**: la rendición acepta UNA sola foto (`materiales_foto_path`, singular), así que "ver el detalle de cada gasto" hoy significa hacer zoom en un collage de tickets. Eso se compensa con fotos múltiples.

## Decisión (Fausti, con la sala)

1. **Se elimina la feature de gastos imprevistos entera**, con drop de la tabla y sus datos (pre-producción; existe `reset-datos.sh`).
2. **La rendición acepta VARIAS fotos de comprobantes** (una por ticket): el técnico las sube **solo al rendir** (al terminar la obra), no durante la ejecución — el rollo de la cámara es su borrador.
3. Del lado del gestor, la rendición en Conformidad muestra **galería de comprobantes + desvío** (presupuestado vs gastado real, en $ y %) — eso ya existe, solo cambia la foto única por galería.
4. El input del técnico **sigue siendo "Total gastado en la obra"** — el costo final lo calcula el server (doctrina STORY-961/964, sin cambios de fórmula).
5. El desvío de costos del técnico en Informes (STORY-937) **no se toca**: ya compara `materiales_total` vs presupuestado.

## Implementación

### Migración (`story_965_drop_gastos_fotos_multiples`)

- `DROP TABLE gastos_imprevistos` (se lleva RLS y la saca de la publicación realtime).
- `DELETE FROM matriz_notificaciones WHERE tipo_evento = 'gasto_enviado'`.
- `DELETE FROM eventos_gestion WHERE tipo = 'gasto_enviado'` (datos de prueba; sin label huérfano en auditoría).
- `gestiones.materiales_foto_path text` → **`materiales_fotos_paths text[]`** (rename + `USING array[...]` para conservar las rendiciones existentes).

### Código

- **`codigo/features/gestiones/types.ts`**: fuera `GastoImprevisto` y `GestionDetalle.gastos`; `materiales_foto_url` → `materiales_fotos_urls: string[]`.
- **`codigo/features/gestiones/service.ts`**: fuera `registrarGastoImprevisto` y la query de gastos en `obtenerGestion`; `subirConformidad` sube N fotos (`form.getAll("fotos_comprobantes")`, ≥1 obligatoria, mismas validaciones MIME/8MB por foto) y guarda el array; fuera la validación `total ≥ Σ gastos`.
- **`codigo/components/gestiones/detalle.client.tsx`**: fuera `FichaGasto`/`GastosTecnico`/`GastosGestor` y sus montajes; `AccionConformidadTecnico` pide "Fotos de los comprobantes (una por ticket)" con input múltiple; `AccionConformidadGestor` muestra galería de comprobantes (sin sub-línea de imprevistos).
- **`codigo/components/gestiones/finanzas.client.tsx`**: fuera la sub-línea "incluye $X de imprevistos" en Liquidación.
- **`codigo/components/auditoria/auditoria.client.tsx`**: fuera el label `gasto_enviado`.
- **`codigo/components/ui/input-archivo.client.tsx`**: soporte `multiple` (muestra la cantidad elegida; la compresión client-side de STORY-945 ya procesa todos los archivos del input).

## Criterios de aceptación

1. En ejecución, el técnico ve avances + rendición. No existe "Agregar gasto imprevisto" en ninguna etapa.
2. Al terminar la obra, el técnico rinde el total gastado + **una o más** fotos de comprobantes (obligatorio al menos una) + conformidad firmada. Cada foto se comprime client-side y se valida server-side.
3. El gestor en Conformidad ve la galería de comprobantes y el desvío (presupuestado vs real, $ y %). Aprueba y `costo_final = total rendido + mano de obra`, igual que en la 964.
4. Liquidación y Cobro sin renglones ni sub-líneas de imprevistos; los números no cambian respecto de la 964.
5. La tabla `gastos_imprevistos` no existe; no quedan referencias en código (`grep gastos_imprevistos|GastoImprevisto|gasto_enviado` limpio).
6. Las rendiciones existentes conservan su foto (migrada al array).
7. `tsc` + `eslint` verdes.

## Dev Agent Record

- **Migración:** `story_965_drop_gastos_fotos_multiples` aplicada (drop de `gastos_imprevistos`, limpieza de `matriz_notificaciones` y `eventos_gestion`, `materiales_foto_path text` → `materiales_fotos_paths text[]` con las 8 rendiciones existentes migradas al array).
- **Archivos:** `codigo/features/gestiones/types.ts` (fuera `GastoImprevisto` y `gastos`; `materiales_fotos_urls: string[]`), `codigo/features/gestiones/service.ts` (fuera `registrarGastoImprevisto` y la query de gastos; `subirConformidad` sube N fotos con `form.getAll`), `codigo/components/gestiones/detalle.client.tsx` (fuera `FichaGasto`/`GastosTecnico`/`GastosGestor`, label del evento y su `RefrescoVivo`; input múltiple sin `capture` — con `capture` el celular fuerza la cámara y no deja elegir varias del rollo; galería de comprobantes en `AccionConformidadGestor`), `codigo/components/gestiones/finanzas.client.tsx` (fuera sub-línea de imprevistos), `codigo/components/auditoria/auditoria.client.tsx` (fuera label `gasto_enviado`), `codigo/components/ui/input-archivo.client.tsx` (prop `multiple`; la compresión de STORY-945 ya procesaba todos los archivos).
- **Verificación:** `tsc --noEmit` + `eslint` verdes. `grep gastos_imprevistos|GastoImprevisto|gasto_enviado` limpio en `codigo/`. E2E local (2026-07-14, Playwright + Supabase MCP) sobre `[PRUEBA STORY-965]`: en ejecución el técnico NO ve carga de gastos; rindió $75.000 con **2 fotos** de comprobantes (guardadas como array) + conformidad; el gestor vio la galería (2 imágenes con signed URL), el desvío +$25.000 (+50%) sobre $50.000 presupuestados y el costo final calculado $155.000 = 75.000 + 80.000 de mano de obra; al aprobar, el server persistió `costo_final = 155000` y avanzó a Cobro.
