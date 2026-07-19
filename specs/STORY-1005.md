# STORY-1005 — Informes: renombrar "Cumplimiento de presupuesto/plazo" a "Desvíos" (v1.0)

**Estado:** ✅ done · **Origen:** reunión con Andres Garcia (Fathom 2026-07-18) — el nombre confundió al lector ("¿estoy viendo lo que cumple o lo que incumple?"). Card Trello #126 (https://trello.com/c/ApUgIGzU).

## Problema

Los dos gráficos por técnico del bloque "Histórico" de Informes se llaman "Cumplimiento de presupuesto" y "Cumplimiento de plazo", pero lo que grafican es el **desvío** (± % contra lo prometido). El nombre "Cumplimiento" invita a leer el signo al revés. Con "Desvíos" el signo se explica solo.

## Alcance

Solo copy, en `panel-metricas.client.tsx`:

1. Título de la card "Cumplimiento de presupuesto" → **"Desvíos de presupuesto"**.
2. Título de la card "Cumplimiento de plazo" → **"Desvío de plazo"**.
3. Comentarios internos que decían "cumplimiento de plazo/presupuesto" se alinean a "desvío" para que el código no contradiga la UI.

## Fuera de alcance

- Las cajas del detalle de gestión ya se corrigieron con STORY-1003 — esto es solo los gráficos de Informes.
- Lógica y datos de los gráficos: sin cambios (ya medían desvío; ver STORY-937). Los textos de `ayuda` ya hablan de "cuánto se pasó" / "cuánto tardó de más", coherentes con "Desvío".

## Criterios de aceptación

1. En Informes → "Histórico · desempeño de técnicos" los títulos leen "Desvíos de presupuesto" y "Desvío de plazo".
2. Los gráficos muestran los mismos datos que antes (solo cambió el rótulo).
3. `tsc`/eslint verdes.

## Dev Agent Record

- **Commit:** `737c81a` (2026-07-19, junto con STORY-1004).
- **Archivos:** `codigo/components/metricas/panel-metricas.client.tsx` (dos títulos de `MetricCard` + tres comentarios internos).
- **Verificación:** `tsc`/eslint verdes. E2E navegador (Admin, `/metricas` → "Histórico · desempeño de técnicos"): los títulos leen **"Desvíos de presupuesto"** y **"Desvío de plazo"**; ya no aparece "Cumplimiento de presupuesto/plazo" en el DOM. Los gráficos muestran los mismos datos.
