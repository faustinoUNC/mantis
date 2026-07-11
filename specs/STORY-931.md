# STORY-931 — Especialidades del técnico en el scorecard de asignación (v1.0)

**Estado:** ✅ done · **Origen:** Fausti: "al momento de asignar técnico, mostrar su especialidad en la card donde se ven sus datos". Regla #0: cambio mínimo, sin tocar el flujo de asignación.

## Insight central

El scorecard de asignación (`ScorecardTecnico` en `detalle.client.tsx`) muestra nombre, disponibilidad y stats, pero no las especialidades del técnico. La lista ya viene filtrada por la especialidad de la gestión, pero un técnico puede tener varias — mostrarlas todas da contexto real (p. ej. "también hace gas") y confirma el match.

## Alcance y decisiones

- `TecnicoDisponible` (features/gestiones/types.ts) suma `especialidades: string[]` (nombres).
- `tecnicosDisponibles()` (features/gestiones/service.ts) trae **todas** las especialidades de cada candidato con un segundo embed aliasado (`todas:tecnico_especialidades(especialidades(nombre))`), porque el embed `!inner` existente queda filtrado por la especialidad de la gestión por el `.eq`. Mismo patrón de nombres que `features/tecnicos/service.ts`.
- `ScorecardTecnico` muestra las especialidades bajo el nombre, en línea chica muted (`nombre1 · nombre2`), truncada. Sin componentes nuevos ni badges.

## Criterios de aceptación
1. En la etapa de asignación, cada card de técnico muestra sus especialidades (todas, no solo la de la gestión) debajo del nombre.
2. El resto del scorecard (radio, TiraDias, stats) queda igual.
3. `next build` verde.

## Dev Agent Record
- **Estado:** ✅ implementado, commiteado y pusheado (2026-07-11, commit `0ebf7e0` en main).
- **Archivos:** `codigo/features/gestiones/types.ts` (`TecnicoDisponible.especialidades`), `codigo/features/gestiones/service.ts` (embed aliasado `todas:tecnico_especialidades(especialidades(nombre))` en `tecnicosDisponibles` + map), `codigo/components/gestiones/detalle.client.tsx` (línea muted bajo el nombre en `ScorecardTecnico`).
- **Verificación:** `next build` verde. Embed probado contra la API REST real: el `.eq` sigue filtrando el `!inner` y `todas` devuelve la lista completa (Raúl Medina → Plomería · Gas; tecnicodos → Carpintería · Climatización · Plomería).
