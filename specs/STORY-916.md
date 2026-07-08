# STORY-916 — Bug: "Volver" desde el detalle de una gestión lleva al Inicio, no al tablero (v1.0)

**Estado:** 🚧 en desarrollo · **Fecha:** 2026-07-08
**Origen:** Fausti — al entrar a la card de una gestión y tocar "← Volver", en vez de volver al **tablero** (de donde venís), te lleva al **Inicio** del rol. Comportamiento inesperado.

## Objetivo

Que "Volver" desde el detalle de una gestión devuelva al lugar natural de origen: el **tablero** para los roles que operan desde ahí, y el home del técnico para el técnico.

## Causa

En `components/gestiones/detalle.client.tsx`, la variable `volver` apunta al **Inicio** de cada rol (`/admin`, `/gestion`, `/administracion`), no al tablero. Como las gestiones se abren desde `/tablero`, la vuelta rompe la expectativa.

## Decisión (Regla #0)

- Técnico → `/tecnico` (su home = su lista de trabajos, de donde abre las gestiones).
- Admin / gestor de mantenimiento / gestor administrativo → `/tablero` (de donde abren las gestiones).

Ruta explícita y determinística (no `router.back()`, que es frágil ante deep-links).

## Alcance
- `components/gestiones/detalle.client.tsx` — la constante `volver` pasa a `/tecnico` para técnico y `/tablero` para el resto.

## Criterios de aceptación
1. Desde el detalle de una gestión, "← Volver" lleva al `/tablero` (admin y gestores) o `/tecnico` (técnico).
2. `tsc` verde, eslint verde.

## Dev Agent Record
- **Commit:** _(pendiente — Fausti revisa en local)_
- **Archivos:** `components/gestiones/detalle.client.tsx` — `volver` = `/tecnico` (técnico) o `/tablero` (resto), en vez del Inicio por rol.
- **Verificación:** `tsc` verde · eslint verde · `next build` OK.
