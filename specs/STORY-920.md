# STORY-920 — Unificación de la card de cobro, prioridad por valor (fee) y limpieza del dashboard (v1.0)

**Estado:** 🚧 en desarrollo (aprobado en party mode 2026-07-09, Mary/John/Winston/Sally) · **Origen:** Fausti, tras usar el tablero de STORY-919. Regla #0: la solución más simple que cumpla. Contract "Esmeralda técnica" respetado.

## Objetivo

Simplificar el bloque "Para resolver hoy" del dashboard (`codigo/components/metricas/panel-metricas.client.tsx`), agregar un lente de **priorización por plata** (fee) que hoy no existe, y limpiar tres molestias visuales (pills "ahora", filtro de especialidad, hueco de la card de composición). **Sin tocar el service** — todos los datos ya vienen en `FilaMetrica`.

## Alcance y decisiones

### A. Unificar "Pendientes de cobro" + "Dinero pendiente" en una sola card
El bloque "Para resolver hoy" tenía 3 cards (Estancadas · Pendientes de cobro · Dinero pendiente). Se fusionan las dos últimas en **una** card titulada **"Gestiones pendientes de cobro"** (consistente con "Gestiones estancadas" al lado). Layout, jerarquía resumen→detalle:
1. **Resumen de plata** (ex "Dinero pendiente"): línea "Por cobrar · N · $total" + la **barra apilada CSS** (A técnicos = BRAND, Fee de la casa = AMBAR) + leyenda. Se mantiene tal cual, solo cambia de contenedor.
2. **Divisor**.
3. **Lista de gestiones en cobro** (las `FilaAccionable` actuales de `cobranza`: monto + días esperando, alerta ámbar ≥15 días, scroll `max-h-72`).
4. **Footer muted** (bajo divisor): "Por liquidar a técnicos · N · $x — ya cobradas, esperando el pago al técnico". No se pierde el dato.

Resultado: "Para resolver hoy" queda con **2 cards** → llena el grid `cols=2` sin hueco. La barra "Por cobrar" es exactamente la descomposición de la lista que queda debajo (resumen que explica el detalle).

### B. Renombrar y quitar las pills "ahora"
- "Pendientes de cobro" → **"Gestiones pendientes de cobro"**.
- Se **quitan** los tres `alcance="ahora"` (Estancadas, Cobro, ex-Dinero). Confunden y no aportan.
- Se **conservan** los `alcance="historico"` (Calificación, Cumplimiento): esos sí avisan que la card ignora el selector de período dentro de la caja "En el período".

### C. NUEVA card "Prioridad por valor" (idea de Fausti — priorizar por plata)
Lo que Fausti sentía que faltaba: **qué gestiones le van a dejar más plata a la inmobiliaria, para priorizarlas**. Hoy todo se ordena por *tiempo* (días estancada / días esperando cobro); falta el lente de *plata*.
- **Qué es:** lista de gestiones **NO terminales** (etapa ≠ `finalizado` y ≠ `cancelada`) con **fee ya determinado** (`cargoAdmin > 0`), ordenadas de **mayor a menor fee**.
- **Cuándo hay fee (modelo de datos):** el `cargo_admin` se **carga en la etapa `presupuesto`** (borrador si se generó el PDF) y se **ancla firme al aprobar el presupuesto**, que pasa la gestión a `en_ejecucion` (`gestiones/service.ts:609→622`). Por eso el filtro `cargoAdmin > 0` lista naturalmente **de `en_ejecucion` en adelante** (+ algún `presupuesto` con borrador); las de `ingresado`/`asignacion` no aparecen porque todavía no tienen fee — correcto, es lo pedido ("las que **ya tienen fee determinado**").
- **Qué muestra por fila:** dirección (principal), `etapa · descripción` (secundario), **fee** (dato, en BRAND = plata para la casa). Linkea al detalle (`FilaAccionable`). Scroll `max-h-72`.
- **Alcance "ahora"** (estado actual, no sigue el período) → va en la zona de arriba, después de "Para resolver hoy".
- **Full-width** (bloque `cols=1`) → sin hueco en el grid. Da aire para mostrar dirección + etapa + fee cómodos.
- **Sobre la redundancia (decisión de la sala):** incluye las que están en cobro a propósito — son las que más plata dejan y el punto es *priorizar por plata*, un orden distinto al de las otras cards (por días). La columna de etapa hace transparente el solapamiento. Excluirlas contradiría "las que más plata dejan".

### D. Quitar el filtro de especialidad
Se elimina el `<select>` de especialidades del header (arriba a la derecha). El dashboard deja de filtrar por especialidad: `filasEsp` pasa a ser `metricas.filas` sin filtrar. El período (caja "En el período") sigue igual. El service queda **intacto** (sigue devolviendo `especialidades`, inofensivo; no se toca por Regla #0).

### E. "Composición del trabajo" a lo ancho
Su bloque "Perfil del trabajo" tenía una sola card en un grid `cols=2` → dejaba la mitad derecha vacía. Pasa a `cols=1` (full-width). Los dos donuts (causa · pagador) ganan aire.

## Criterios de aceptación
1. "Para resolver hoy" tiene 2 cards: **Gestiones estancadas** y **Gestiones pendientes de cobro** (unificada), sin hueco.
2. La card unificada muestra, en orden: barra "Por cobrar" (A técnicos / Fee) → divisor → lista de gestiones en cobro (por días) → footer "Por liquidar a técnicos".
3. No aparece ninguna pill "ahora"; se conservan las "histórico".
4. Nueva card **"Prioridad por valor"** full-width: gestiones no terminales con fee > 0, ordenadas de mayor a menor fee, con dirección/etapa/fee y link al detalle.
5. No hay filtro de especialidad en el header.
6. "Composición del trabajo" ocupa todo el ancho.
7. `tsc` + eslint + `next build` verdes; sin regresiones en las demás métricas; service sin cambios.

## Dev Agent Record
- **Estado:** ✅ implementado (2026-07-09). Sin commitear (Fausti revisa en local).
- **Archivos:** `codigo/components/metricas/panel-metricas.client.tsx` (único — service intacto).
  - Quitado el estado `esp`/`setEsp` y el `<select>` de especialidad; `filasEsp` pasa a ser `metricas.filas` directo. Header simplificado (solo "Métricas").
  - Bloque "Para resolver hoy": de 3 cards a **2**. "Gestiones estancadas" (sin pill). Nueva card unificada **"Gestiones pendientes de cobro"** = barra "Por cobrar" (A técnicos/Fee) → lista de cobro (por días) → footer muted "Por liquidar a técnicos". Se fusionaron las ex "Pendientes de cobro" + "Dinero pendiente".
  - Quitados los 3 `alcance="ahora"`; conservados los `alcance="historico"`.
  - Nuevo `useMemo` `porFee` (no terminales con `cargoAdmin > 0`, orden fee desc) + nueva card full-width **"Prioridad por valor"** (bloque `cols={1}`), fee en BRAND, link al detalle.
  - "Composición del trabajo": bloque a `cols={1}` (full-width); donuts con más aire (`max-w-2xl`, height 180).
- **Verificación:** `tsc --noEmit` + `eslint` + `next build` verdes. Falta la pasada visual en navegador (la sesión de Fausti tenía el browser tomado; con `next dev` el Fast Refresh ya aplica — refrescar `/admin`).
