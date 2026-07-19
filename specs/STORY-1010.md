# STORY-1010 — Nuevo logo: ícono de la pestaña + ícono al agregar la app al celular (v1.0)

**Estado:** ✅ done · **Origen:** pedido de Fausti (2026-07-19) — reemplazar el logo que se ve en el ícono de la pestaña del navegador y en el ícono que queda al agregar la app a la pantalla de inicio del celular, por la nueva imagen (cabeza de mantis blanca sobre fondo verde esmeralda, estilo "papel recortado").

## Alcance

Solo assets — Next.js App Router detecta por convención de archivo estos tres en `codigo/app/` y arma automáticamente los `<link rel="icon">`/`<link rel="apple-touch-icon">` sin tocar `layout.tsx`:

1. `codigo/app/icon.png` (512×512) — ícono general (pestaña del navegador, Android al agregar a inicio).
2. `codigo/app/apple-icon.png` (180×180) — `apple-touch-icon` (iOS al agregar a inicio).
3. `codigo/app/favicon.ico` (16/32/48 embebidos como PNG en el contenedor ICO) — fallback legado.

Los tres se generaron redimensionando la misma imagen fuente (1254×1254, cuadrada, sin recorte necesario) con alta calidad (bicúbico + antialiasing).

## Fuera de alcance

- `public/brand/mantis-logo-fondo-blanco.png` — no está referenciado en ningún componente del código (verificado), así que no se tocó.
- `presentacion/index.html` (`mantis-icon.png`) — es un repo/deploy separado con su propio proceso de sync (Regla #6 de CLAUDE.md); no fue lo pedido y se mantiene fuera para no romper el link del jurado sin que Fausti lo revise primero.
- No hay ningún componente de la UI que muestre el logo como imagen inline (se verificó con grep) — el cambio queda acotado a los tres archivos de ícono.

## Criterios de aceptación

1. El ícono de la pestaña del navegador muestra la nueva imagen (puede requerir limpiar caché/hard refresh — los navegadores cachean el favicon agresivamente).
2. Al agregar la app a la pantalla de inicio desde un celular (iOS y Android), el ícono que queda es el nuevo.
3. Los tres archivos son PNG/ICO válidos (verificado: `icon.png` 512×512, `apple-icon.png` 180×180, `favicon.ico` con 3 tamaños embebidos, carga sin error).

## Dev Agent Record

- **Archivos:** `codigo/app/icon.png`, `codigo/app/apple-icon.png`, `codigo/app/favicon.ico` (binarios, reemplazados — sin cambios de código).
- **Verificación:** archivos generados y validados por tamaño/dimensión/carga (PowerShell + System.Drawing). No aplica `tsc`/eslint (no hay cambios de TypeScript). Pendiente: confirmar visualmente en navegador/celular tras el deploy (el favicon cachea fuerte, puede tardar en refrescar).
