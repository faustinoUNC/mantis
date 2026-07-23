# STORY-1041 — Las gestiones canceladas quedan en el Archivo (auto-archivado al cancelar) (v1.0)

**Estado:** 🔨 en prueba · **Origen:** card Trello #167 ("Revisar a dónde están quedando las gestiones canceladas y luego hacer que queden en finalizadas", label Bug). Decisión de destino confirmada por Fausti (2026-07-23): que queden en el **Archivo**, no en la columna Finalizado del tablero.

## Problema

Al cancelar una gestión (etapa terminal `cancelada`, STORY-914) la gestión **desaparece de toda vista**:

- El **tablero** arma sus columnas desde `ETAPAS` (`types.ts`), que **no incluye `cancelada`** → la gestión se sigue trayendo (`tableroGestiones` filtra `archivada_en IS NULL`) pero **no tiene columna donde renderizarse** → se cae del tablero.
- El **Archivo** (`/gestiones/archivadas`) solo muestra `archivada_en NOT NULL`, y a una `cancelada` **nunca se le setea** `archivada_en`: `archivarGestion()` exige `etapa = 'finalizado'`, y una cancelada jamás pasa por el tablero para archivarla a mano.

Resultado: quedan en un limbo, accesibles solo por URL directa. Verificado en DB (`ejwokycbyjtlxwusbhtt`): **21 gestiones `cancelada`, todas con `archivada_en = null`**. La ironía es que el Archivo ya se describe a sí mismo como "las gestiones cerradas **o canceladas**" — estaba pensado para recibirlas, pero el mecanismo nunca las lleva ahí.

## Decisión de diseño

- **Auto-archivar en el punto terminal único (Regla #0).** Toda transición a `cancelada` pasa por el RPC `avanzar_etapa` (Regla #2: las transiciones SOLO van por esa función) — por los dos caminos: sin cargo (directo a `cancelada`) y con cargo (`facturacion_cobro` → cobro cierra en `cancelada`, `finanzas/service.ts`). Setear `archivada_en = now()` **en el mismo `update` final** de `avanzar_etapa` cuando `p_nueva = 'cancelada'` cubre ambos caminos y cualquiera futuro, atómicamente, en un solo lugar. No se toca la capa de servicio (ni `cancelarGestion` ni el cobro).
- **El Archivo es el destino natural.** Ya está descripto como "cerradas o canceladas" y la RLS/queries de archivadas son las mismas que el tablero (cada rol ve lo suyo). Cero infraestructura nueva.
- **Distinguir cancelada de finalizada en la UI del Archivo.** Hoy la tarjeta de archivada no muestra la etapa → una cancelada se vería idéntica a una finalizada. Se agrega un badge "Cancelada" (tono neutro, igual que el detalle, `detalle.client.tsx:2523`).
- **Sin "Desarchivar" para canceladas.** El botón llama a `archivarGestion(id, false)`, que exige `etapa = 'finalizado'` → en una cancelada **fallaría** ("No se pudo desarchivar"), y además desarchivar no tiene sentido (no hay columna del tablero a la que volver). Se oculta el botón cuando `etapa = 'cancelada'`.

## Alcance

1. **DB — migración** (`mcp__supabase apply_migration`, proyecto `ejwokycbyjtlxwusbhtt`):
   - Recrear `avanzar_etapa`: en el `update public.gestiones set etapa = p_nueva …` final, agregar `archivada_en = case when p_nueva = 'cancelada' then now() else archivada_en end`. Sin otros cambios de lógica.
   - **Backfill** de las canceladas existentes: `update gestiones set archivada_en = <fecha> where etapa = 'cancelada' and archivada_en is null`, donde `<fecha>` = `creado_en` del evento `tipo='transicion'` con `a_etapa='cancelada'` de esa gestión (la fecha real de cancelación); fallback `now()` si no hubiera evento.
   - RLS: sin cambios.
2. **`archivadas.client.tsx`**:
   - En `TarjetaArchivada`: si `gestion.etapa === "cancelada"`, mostrar `<Badge tono="neutro">Cancelada</Badge>` en la fila de metadatos y **ocultar** el botón "Desarchivar".
   - `GestionResumen` ya trae `etapa` — no hay cambios de tipos ni de query (`SELECT_RESUMEN` ya incluye `etapa`).

## Fuera de alcance

- No se toca el tablero (`tablero.client.tsx`): las canceladas ya no lo tocan porque pasan a estar archivadas (`tableroGestiones` filtra `archivada_en IS NULL`).
- No se agrega columna `cancelada` a `ETAPAS`.
- No se toca `cancelarGestion` ni el flujo de cobro (`finanzas/service.ts`) — el archivado vive en `avanzar_etapa`.
- No se cambia el gate de calificación de `archivarGestion` (aplica a finalizadas archivadas a mano; una cancelada no pasa por ahí).

## Criterios de aceptación

1. **Cancelar sin cargo → al Archivo:** cancelar una gestión activa (sin cargo) la lleva a `/gestiones/archivadas` con badge "Cancelada" y desaparece del tablero.
2. **Cancelar con cargo → al Archivo al cobrar:** una cancelación con cargo pasa por Cobro (sigue en el tablero como Cobro); al registrarse el cobro y cerrar en `cancelada`, queda archivada.
3. **Backfill:** las 21 canceladas preexistentes aparecen en el Archivo con su fecha de cancelación real, sin regresión sobre las finalizadas ya archivadas.
4. **Sin Desarchivar en canceladas:** la tarjeta de una cancelada no ofrece "Desarchivar"; las finalizadas archivadas lo mantienen.
5. **Finalizadas intactas:** archivar/desarchivar una finalizada sigue igual (gate de calificación incluido).
6. `tsc`/eslint verdes.

## Dev Agent Record

- **Commit:** _(pendiente — se completa post-push)_; migración `story_1041_cancelada_auto_archiva` aplicada en Supabase (`ejwokycbyjtlxwusbhtt`).
- **Archivos:**
  - Migración `story_1041_cancelada_auto_archiva`: recrea `avanzar_etapa` con `archivada_en = case when p_nueva = 'cancelada' then now() else archivada_en end` en el update final + backfill de canceladas huérfanas (fecha del evento de transición a `cancelada`, fallback `now()`). Backfill: 21 canceladas → archivadas.
  - `scripts/avanzar_etapa.sql`: copia de referencia del repo sincronizada con el mismo cambio.
  - `codigo/components/gestiones/archivadas.client.tsx`: `const cancelada = etapa === "cancelada"` → badge "Cancelada" + oculta "Desarchivar" (con "Cancelada el" en vez de "Archivada el").
- **Verificación:**
  - `tsc --noEmit` y `eslint` verdes.
  - Datos reales (SQL espejo de `gestionesArchivadas`): 25 archivadas totales = 21 canceladas + 4 finalizadas, **0 canceladas en limbo** (antes 21).
  - E2E navegador: **bloqueado por el entorno** — el dev server Next 16 (Turbopack) no completa el handshake del websocket HMR en la sesión de Playwright y aborta el runtime de cliente → la app no hidrata (el login cae a submit GET nativo). Ajeno a este cambio. Click-through pendiente en navegador normal (pasos en la card #167, movida a "En prueba").
