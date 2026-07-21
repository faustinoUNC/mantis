# STORY-1020 — Volver contextual: el detalle de gestión vuelve a donde estabas, no siempre al tablero (v1.0)

**Estado:** 🔨 implementada y verificada E2E, sin commitear (espera OK) · **Origen:** pedido directo de Fausti (2026-07-21): desde Finanzas, tocar una card de cobros/liquidaciones/adelantos abre la gestión correcta, pero "← Volver" manda al tablero en vez de a la pestaña de Finanzas donde estaba la card. Pidió además barrer si el patrón se repite en otros "volver".

## Problema

El "← Volver" del detalle de gestión está fijado a `/tablero` (o `/tecnico` para el técnico) en `codigo/components/gestiones/detalle.client.tsx:2152`. STORY-916 lo fijó así cuando el tablero era el único origen — hoy una gestión se abre desde **siete** lugares: tablero, Finanzas, archivo, historial de propiedad (cartera), detalle de técnico, Auditoría, inbox (tras convertir) y los botones de Walter. Desde cualquiera de ellos, volver te saca de contexto.

Agravante en Finanzas: la pestaña activa (Cobros/Liquidaciones/Adelantos) es `useState` puro (`finanzas.client.tsx:103`) — ni volviendo a `/finanzas` se recuperaría la pestaña donde estaba la card.

## Alcance

1. **Volver = historial del navegador** (`detalle.client.tsx`): el "← Volver" pasa de `<Link href>` fijo a `router.back()`. Si no hay historial en la pestaña (deep link, pestaña nueva) → fallback al destino de hoy: `/tablero`, o `/tecnico` para el técnico. Cubre los siete orígenes sin tocar ninguno de ellos, y gestión→gestión (links de origen/vinculadas) vuelve a la gestión anterior, que es lo correcto.
2. **Pestaña de Finanzas en la URL** (`finanzas.client.tsx` + `app/finanzas/page.tsx`): al cambiar de pestaña, `history.replaceState` refleja `?tab=liquidaciones|adelantos` (Cobros = sin query, la URL limpia de hoy); la page lee `searchParams` y pasa la pestaña inicial. Así el back del navegador restaura la pestaña exacta. Valor inválido en `?tab=` → Cobros, sin romper.
3. **Barrido del resto del sistema** (hecho en esta story): los otros "volver" son breadcrumbs que nombran su destino — "← Técnicos" (`/tecnicos/[id]`), "← Administración" (`/cartera/propiedades/[id]`) — no mienten y su origen dominante es esa lista. **No se tocan.**

## Fuera de alcance (decisiones conscientes)

- **Query `?volver=` en cada link al detalle**: no — tocaría 7+ archivos y ensucia URLs compartibles; el historial ya sabe de dónde viniste.
- **Persistir búsqueda/orden/scroll de Finanzas**: no — la pestaña es lo que ubica la card; el resto es fricción de más por las dudas.
- **Cambiar los breadcrumbs de técnico/propiedad**: no (ver punto 3).

## Criterios de aceptación

1. Finanzas → pestaña Adelantos → card → detalle → "← Volver" → Finanzas con **Adelantos** activa. Ídem Liquidaciones y Cobros.
2. Tablero → gestión → "← Volver" → tablero (regresión: igual que hoy). Ídem archivo, historial de propiedad, detalle de técnico y Auditoría: se vuelve a esa pantalla.
3. Detalle abierto directo por URL en pestaña nueva → "← Volver" → `/tablero` (técnico: `/tecnico`), nunca sale de la app.
4. Técnico: su home sigue siendo `/tecnico` como fallback; desde su lista de trabajos, volver lo devuelve ahí.
5. `/finanzas?tab=adelantos` pegado a mano abre Adelantos; `?tab=cualquiercosa` abre Cobros sin error.
6. Regresión: `tsc`/eslint verdes; navegación gestión→gestión (origen/vinculada) vuelve a la gestión anterior.

## Dev Agent Record

- **Commit:** _(pendiente — espera OK de Fausti)_.
- **Archivos:** `codigo/components/gestiones/detalle.client.tsx` (el "← Volver" pasa de `<Link href="/tablero|/tecnico">` a botón con `router.back()` y fallback a esos mismos destinos cuando `window.history.length <= 1`); `codigo/components/finanzas/finanzas.client.tsx` (la pestaña deja de ser `useState` y se deriva de `useSearchParams().get("tab")` — Next sincroniza el param con `history.replaceState` y con el back/forward del navegador; `irATab` hace `replaceState` de `?tab=` con Cobros = URL limpia; valor inválido → Cobros). `app/finanzas/page.tsx` sin cambios (se probó pasar `searchParams` como prop y se descartó: el back restaura el payload RSC cacheado del render original y la pestaña volvía a Cobros — la URL vía `useSearchParams` es la única fuente que el back restaura de verdad). Sin migraciones, sin server layer.
- **Verificación:** `tsc --noEmit`, eslint y `next build` verdes (`/finanzas` dinámica — sin queja de Suspense por `useSearchParams`). **E2E navegador** (admin): (1) Finanzas → Adelantos → card → detalle → "← Volver" → `/finanzas?tab=adelantos` con **Adelantos** activa y solo sus secciones visibles; (2) ídem con **Liquidaciones** cambiando de pestaña por click (URL pasa a `?tab=liquidaciones` al toque); (3) regresión tablero → gestión → Volver → `/tablero`; (4) `/finanzas?tab=adelantos` pegada directa abre Adelantos; `?tab=cualquiercosa` abre Cobros sin error. El fallback sin historial (criterio 3) no es reproducible en Playwright (toda pestaña nueva arranca en `about:blank` y ya tiene historial) — la rama es trivial y queda para la prueba manual de Fausti: pegar la URL de una gestión en una pestaña nueva y tocar Volver.
