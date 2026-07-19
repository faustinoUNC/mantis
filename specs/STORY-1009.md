# STORY-1009 — Número identificador visible de gestión (v1.0)

**Estado:** ✅ done · **Origen:** card Trello #128 (https://trello.com/c/7AyEqCgG). Una propiedad puede tener dos gestiones por problemas similares documentadas de forma parecida ("Pérdida en el baño" dos veces en la misma casa) y hoy no hay forma de distinguirlas ni de referirse a una sin ambigüedad. El comentario de Fausti en la card fija la solución: **un ID para las cards de la gestión, visible de afuera (tarjeta del tablero) y de adentro (detalle)**.

## Contexto

- La única identidad de una gestión es su `id` UUID. El detalle ya mostraba un "N°" pero era el prefijo del UUID (`N° 3F2A8B91`) — ilegible, imposible de dictar por teléfono y ausente en el tablero. El mismo prefijo se usaba como número de documento en los PDF de finanzas.
- Regla #0: la solución es un **número secuencial corto** (#1, #2, #3…) — nada de códigos compuestos, prefijos por año ni formatos configurables.

## Alcance

1. **Migración `story_1009_gestiones_numero`**: columna `numero integer` en `gestiones`, backfill por orden de `creado_en` (la historia queda numerada cronológicamente), secuencia `gestiones_numero_seq` como default (`OWNED BY` la columna), `NOT NULL` + `UNIQUE`. El número lo asigna SIEMPRE la DB al insertar — nunca viaja del cliente ni se edita. Sin cambios de RLS (misma tabla) ni de triggers (`proteger_gestiones_update` sale temprano fuera del rol `authenticated`, el backfill de la migración pasa).
2. **Tipos y fetch** (`features/gestiones/types.ts` + `service.ts`): `GestionResumen` gana `numero: number`; `SELECT_RESUMEN`/`SELECT_DETALLE` lo suman; `normalizarFila` lo mapea.
3. **Tablero** (`tablero.client.tsx`): la tarjeta muestra `#N` en mono junto a la dirección; campo de búsqueda "N°" en el buscador (matchea `#37` y `37`); las opciones del combo "¿Surgió de otra gestión?" se prefijan con `#N` (dos gestiones con la misma descripción dejan de ser indistinguibles justo donde más dolía).
4. **Detalle** (`detalle.client.tsx`): el `N° {uuid.slice(0,8)}` del header pasa a ser `Gestión #N`.
5. **Vistas hermanas**: mis-trabajos del técnico (card mobile y fila desktop) y archivadas muestran el mismo `#N`; en ambas se puede buscar por N°.
6. **PDF de finanzas** (`features/finanzas/service.ts`): el número de documento de nota/presupuesto/detalle pasa del prefijo UUID al mismo `#N` (el select de `datosDocumento` suma `numero`) — el papel que recibe el propietario referencia la misma gestión que ve el gestor en pantalla.

## Fuera de alcance (documentado para no re-proponer)

- Códigos con formato (año, sufijo por propiedad, prefijos): un entero alcanza.
- Detección/aviso de gestiones "parecidas" al crear (otra feature; la card solo pide identificador).
- Renumerar al cancelar/borrar: los huecos que dejen los borrados de prueba son aceptables — el número identifica, no cuenta.
- Enseñar el `#N` a las tools de Walter (si hace falta, story aparte).

## Criterios de aceptación

1. Toda gestión nueva recibe automáticamente el siguiente número; dos gestiones jamás comparten número.
2. Las existentes quedan numeradas por orden de creación.
3. El `#N` se ve en: tarjeta del tablero, header del detalle, mis-trabajos del técnico y archivadas.
4. Buscar por número (con o sin `#`) encuentra la gestión en tablero, mis-trabajos y archivadas.
5. Los PDF de nota/presupuesto/detalle salen con `N° {numero}` secuencial.
6. `avanzar_etapa()`, triggers, RLS y notificaciones sin cambios. `tsc`/eslint verdes.

## Dev Agent Record

- **Commit:** `fc4907d` (2026-07-19).
- **Archivos:** migración `story_1009_gestiones_numero` + `codigo/features/gestiones/types.ts`, `codigo/features/gestiones/service.ts`, `codigo/features/finanzas/service.ts`, `codigo/components/gestiones/tablero.client.tsx`, `codigo/components/gestiones/detalle.client.tsx`, `codigo/components/gestiones/mis-trabajos.client.tsx`, `codigo/components/gestiones/archivadas.client.tsx`
- **Verificación:** `tsc`/eslint verdes. Migración aplicada: 192 gestiones numeradas 1–192 por `creado_en`; INSERT de prueba con ROLLBACK confirmó que la DB asigna el siguiente número sola. E2E navegador: técnico (mis-trabajos con `#N · hace X` en cards mobile y filas, búsqueda `#145` → 1 resultado, detalle "Gestión #145"), admin (tablero con `#N` junto a la dirección en todas las cards, búsqueda `#103` → 1 card, combo "¿Surgió de otra gestión?" con labels `#N · dirección — descripción`, archivadas con `#N` y opción de búsqueda "N°").
