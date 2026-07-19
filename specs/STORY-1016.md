# STORY-1016 — Tarjeta del tablero rota cuando el técnico no continúa (v1.0)

**Estado:** 🔨 en prueba · **Origen:** card Trello #137 (Fausti, 2026-07-19, https://trello.com/c/3n2ncDim) con captura: en una columna del tablero, el badge "Técnico no continúa" desborda y rompe la tarjeta.

## Problema

En la tarjeta del tablero (`components/gestiones/tablero.client.tsx`) la fila inferior es un `flex items-center` con la especialidad (`truncate`) y los badges de estado. El badge de STORY-976 `<Badge tono="urgente">Técnico no continúa</Badge>` **no tiene `shrink-0` ni `whitespace-nowrap`**: en una columna angosta el `min-width: auto` del flex item lo deja encogerse hasta el ancho de su palabra más larga y el texto **se parte en dos renglones**, inflando una caja ámbar desproporcionada; la especialidad, en cambio, queda aplastada a "G…". La tarjeta se ve rota (ver captura de la card).

Es solo un problema de layout de ese badge: el estado, el dato y el resto del flujo (STORY-976) están bien.

## Alcance

1. **El badge de "no continúa" en la tarjeta del tablero** pasa a ser corto y de una sola línea: texto **"En pausa"** (idéntico a como ya se llama ese estado en la vista del técnico — `mis-trabajos.client.tsx`, etapa `pausa` label "En pausa" — así el vocabulario queda consistente) con `className="shrink-0 whitespace-nowrap"`. Con `shrink-0` la especialidad recupera su espacio y deja de quedar en "G…"; con `whitespace-nowrap` el badge nunca se parte. Sigue en `tono="urgente"` (ámbar = necesita atención, un acento un significado).

Solo se toca la tarjeta del tablero. El badge del **detalle** (`detalle.client.tsx`, header) conserva "Técnico no continúa": ahí hay ancho de sobra y el texto largo aporta contexto. El banner del gestor y el flujo no se tocan.

## Fuera de alcance

- Rediseñar la fila inferior de la tarjeta (wrap general, reordenar badges): no hace falta, el fix puntual alcanza (Regla #0).
- Cambiar el texto en el detalle o en cualquier otra vista.

## Criterios de aceptación

1. En el tablero, una gestión con el técnico "no continúa" muestra un badge ámbar **"En pausa"** en una sola línea, sin partirse ni inflar la tarjeta; la especialidad se ve completa (o truncada con "…" solo si de verdad no entra), no reducida a una letra.
2. El resto de los badges de la tarjeta (Urgente, Reasignar, vínculos) y la fecha ("hoy") quedan alineados como antes.
3. Regresión: el detalle sigue mostrando "Técnico no continúa"; el badge aparece/desaparece con `aviso_no_continua_en` igual que hoy; `tsc`/eslint verdes.

## Dev Agent Record

- **Commit:** _pendiente_
- **Archivos:** `codigo/components/gestiones/tablero.client.tsx` (badge "Técnico no continúa" → "En pausa" con `shrink-0 whitespace-nowrap`), `specs/README.md`, `tasks/PENDIENTES.md`.
- **Verificación:** `tsc`/eslint verdes. E2E navegador (admin, tablero, gestión #188 "Caseros 10" en Presupuesto con aviso activo): antes se veía "G…" + caja ámbar "Técnico no / continúa" en dos renglones; ahora "Gas" completo + badge "En pausa" ámbar en una sola línea, tarjeta sana.
