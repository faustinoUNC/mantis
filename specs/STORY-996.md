# STORY-996 — Simplificar las explicaciones de métricas (card de asignación + Inicio) (v1.0)

**Estado:** ✅ done · **Origen:** Fausti (UX): las explicaciones al hacer hover en los datos de la card del técnico al asignar son largas/confusas y el **tooltip nativo del browser es feo**; y las descripciones de las métricas del **Inicio** también son largas y técnicas para el usuario final. Copy aprobado por Fausti.

## Alcance (Regla #0 — solo copy + estilo de tooltip)

**A. Card del técnico al asignar** (`components/gestiones/detalle.client.tsx`):
- El `title` nativo (feo) de cada dato pasa a un **tooltip estético** (cajita `bg-foreground`, como el del sidebar/TiraDias) vía un helper `ConTooltip`. Para que no lo recorte, la lista de `AccionAsignar` deja de usar `overflow-hidden` (se redondean las filas `first/last` para el fondo del seleccionado).
- Textos cortos: Calif. = "Promedio de estrellas de sus trabajos." · En curso = "Trabajos que tiene abiertos ahora." · Presup. = "Cuánto se pasó de lo presupuestado (+20% = gastó de más)." · Plazo = "Cuánto se pasó del plazo que prometió." · Hechas = "Trabajos que ya terminó." · Rechaza = "% de asignaciones que rechazó." · Abandonó = "Trabajos que dejó a mitad de camino."

**B. Métricas del Inicio** (`components/metricas/panel-metricas.client.tsx`): las descripciones `ayuda` (texto visible bajo el título) se acortan a una línea en criollo, sin jerga ("igual que en Informes", "event log", "circuito"). Una por métrica.

## Fuera de alcance

- No se toca lógica ni datos. No se toca el layout/estilo que ya ajustó STORY-991 (solo el texto `ayuda` y, en la card del técnico, el mecanismo de tooltip).

## Criterios de aceptación

1. En la card del técnico, al pasar el mouse por un dato aparece una cajita prolija (no el tooltip gris del browser) con una frase corta.
2. Las explicaciones del Inicio son de una línea, claras, sin jerga técnica.
3. `tsc`/eslint verdes.

## Dev Agent Record

- **Commit:** `aaeebc5` (pusheado a main 2026-07-18).
- **Archivos:** `codigo/components/gestiones/detalle.client.tsx` (helper `ConTooltip`, `Metrica` y Calif/en-curso con tooltip estético, lista sin `overflow-hidden` + filas `first/last` redondeadas, textos cortos), `codigo/components/metricas/panel-metricas.client.tsx` (10 `ayuda` acortadas).
- **Verificación:** `tsc`/eslint verdes. E2E en el navegador: el tooltip de "Presup." muestra la cajita oscura "Cuánto se pasó de lo presupuestado (+20% = gastó de más)." arriba de la métrica, sin recorte; las 10 descripciones del Inicio renderizan cortas.
