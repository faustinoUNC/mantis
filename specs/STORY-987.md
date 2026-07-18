# STORY-987 — Asignar técnico: lista compacta en vez de cards con 7 métricas (v1.0)

**Estado:** ✅ done · **Origen:** Fausti sobre la card Trello #48 (+ comentario de Rami: "las especialidades se ven pero no completamente, ¿es a propósito o está mal?"). Dos problemas: (1) la línea de especialidades del técnico se **trunca** cuando tiene varias, y el "sin horarios" queda flotando; (2) cada candidato es una card con **7 métricas** en grilla de 2 columnas → fea, poco minimalista y **no escala a 40 técnicos**. Fausti eligió la dirección "lista compacta".

## Diagnóstico

`ScorecardTecnico` (`components/gestiones/detalle.client.tsx`) renderiza una card por técnico: nombre + radio, `especialidades.join(" · ")` con `truncate` (de ahí el corte), `TiraDias` ("sin horarios") en el header, y una grilla `grid-cols-3` con 7 `ChipStat`. `AccionAsignar` las mete en `grid sm:grid-cols-2`. Con muchos técnicos es un muro de cards.

## Fix (Regla #0 — sin datos nuevos, solo presentación)

Reescribir `ScorecardTecnico` → **fila compacta** (`FilaTecnico`) y `AccionAsignar` → **lista vertical** (contenedor `rounded-lg border divide-y`, `.stagger`):

- **Fila colapsada (2 líneas):**
  - Línea 1: radio + nombre + `★ Calif.` a la derecha (esmeralda si ≥4, muted si s/d).
  - Línea 2 (alineada bajo el nombre): la **especialidad que matchea** como chip esmeralda-soft (`gestion.especialidad`), luego las **otras** especialidades en muted (`· A · B +N`, sin truncar el chip; overflow como `+N`); a la derecha `N en curso · [tira de días / sin horarios]`.
- **Fila seleccionada:** además de resaltar (`bg-brand-soft/40`), muestra una tercera línea con el **detalle** de las métricas restantes: `Presupuesto · Plazo · Hechas · Rechaza · Abandonó` (mismos valores/tonos/ayudas que hoy, inline). El resto de las filas quedan colapsadas → escanear 40 es cómodo.
- Se conservan los `title`/ayudas de cada métrica y `TiraDias` (con su tooltip de horarios).

## Fuera de alcance

- El cálculo de `stats`/`tecnicosDisponibles` no cambia (mismos datos).

## Criterios de aceptación

1. Con un técnico de varias especialidades, se ven **todas** (la que matchea destacada + `+N` para el resto) — nada truncado a mitad de palabra.
2. La lista es una fila por técnico; escanear muchos técnicos no es un muro de cards.
3. Al seleccionar un técnico, su fila muestra el detalle completo de métricas; las demás quedan compactas.
4. El "sin horarios" / la tira de días quedan prolijos en la fila, no flotando.
5. Elegir un técnico y "Enviar solicitud de asignación" sigue funcionando igual. `tsc`/eslint verdes.

## Dev Agent Record

- **Commit:** `8687a5d` (pusheado a main 2026-07-18).
- **Archivos:** `codigo/components/gestiones/detalle.client.tsx` (`ScorecardTecnico`→`FilaTecnico`, `ChipStat`→`Metrica` inline, `AccionAsignar` grilla→lista `divide-y`+`stagger`).
- **Verificación:** `tsc`/eslint verdes. E2E en el navegador (Playwright, admin, gestión en Asignación): la lista renderiza compacta, la especialidad que matchea va como chip esmeralda + resto con `+N` sin truncar, el detalle de métricas aparece solo en la fila seleccionada y cambia al elegir otra (verificado: 1 sola fila con detalle a la vez).
