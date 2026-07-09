# STORY-927 — Selector "Buscar por" unificado en todos los buscadores (v1.0)

**Estado:** ✅ done · **Fecha:** 2026-07-09
**Origen:** Fausti — "no deberíamos mezclar la dirección con propietarios e inquilinos: algo al lado de cada buscador donde el user marque en base a qué busca; amigable, estético, consistente y unificado (con los campos de cada pantalla)".

## Objetivo

Cada buscador del sistema tiene al lado un selector **"Buscar por"** (por defecto **Todo**) que acota la búsqueda a un campo concreto. Mismo componente y comportamiento en todas las pantallas; cada una define sus campos.

## Decisión (Regla #0)

- Se extiende **`FiltrosLista`** (ya es el componente compartido de filtros, STORY-910) con un `Select` "Buscar por" — mismo estilo que los selects que ya conviven en esa barra (Orden/Gestor del tablero). Nada nuevo de UI.
- Helper `coincideCampo` en `shared/utils/filtros.ts`: cada pantalla declara sus campos como `{ id, label, de(x) → valores }`; con "Todo" busca en todos (comportamiento actual), con un campo elegido solo en ese.
- Los buscadores que eran un `Input` suelto (propiedades, personas, home del técnico) migran a `FiltrosLista` — unificación visual además de funcional.
- Especialidades busca por un solo campo → sin selector (no hay qué elegir).
- Placeholders pasan a un genérico corto ("Escribí para filtrar…"): el selector ya dice por qué se busca.

## Campos por pantalla
| Pantalla | Campos |
|---|---|
| Tablero (kanban) | Todo · Descripción · Dirección · Propietario · Inquilino · Especialidad · Técnico |
| Propiedades | Todo · Dirección · Propietario · Inquilino |
| Propietarios / Inquilinos | Todo · Nombre · Correo · Teléfono · CUIL |
| Técnicos | Todo · Nombre · Correo · Especialidad |
| Empleados | Todo · Nombre · Correo · Rol |
| Home del técnico (mis trabajos, mobile) | Todo · Descripción · Dirección · Especialidad |

## Alcance
- `components/ui/filtros-lista.client.tsx` — select "Buscar por" opcional.
- `shared/utils/filtros.ts` — `CampoBusqueda<T>` + `coincideCampo`.
- `components/gestiones/tablero.client.tsx`, `components/cartera/propiedades.client.tsx`, `components/cartera/personas.client.tsx`, `components/tecnicos/tecnicos.client.tsx`, `components/empleados/empleados.client.tsx`, `components/gestiones/mis-trabajos.client.tsx` — campos propios + migración a `FiltrosLista` donde había Input suelto.

## Criterios de aceptación
1. Todos los buscadores muestran el mismo select "Buscar por" al lado del input, con "Todo" por defecto (= comportamiento actual).
2. Elegir un campo acota la búsqueda a ese campo (p. ej. "juan" en Propietario no matchea un inquilino Juan).
3. En mobile (home del técnico) el control es usable con dedos (Select nativo, min-h-tap).
4. `tsc` verde, eslint verde, `next build` OK.

## Dev Agent Record
- **Commit:** _(este commit)_
- **Archivos:** `components/ui/filtros-lista.client.tsx` (select "Buscar por") · `shared/utils/filtros.ts` (`CampoBusqueda` + `coincideCampo`) · `tablero.client.tsx`, `propiedades.client.tsx`, `personas.client.tsx`, `tecnicos.client.tsx`, `empleados.client.tsx`, `mis-trabajos.client.tsx` (campos propios; los tres últimos Input suelto → `FiltrosLista`).
- **Verificación:** `tsc` verde · eslint verde · `next build` OK · E2E Playwright: tablero con "vigetti" por Propietario = 7 gestiones, por Inquilino = 0 (ya no mezcla), "pieroni" por Inquilino = 6; capturas desktop (tablero, inquilinos) y mobile 390px (home del técnico, selector debajo del input con target táctil) revisadas contra el design contract.
