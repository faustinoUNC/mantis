# STORY-989 — Sidebar del staff colapsable a rail de íconos (v1.0)

**Estado:** ✅ done · **Origen:** Fausti (UX): agregar al panel izquierdo una flechita para colapsarlo contra el borde, quedando solo los íconos y aprovechando más pantalla.

## Alcance (Regla #0)

Sidebar de staff (`components/paneles/sidebar.client.tsx`, desktop `md:` únicamente — el mobile no cambia). Agregar un botón "flechita" (chevron) que colapsa el sidebar de `w-56` a un **rail de `w-16`** con solo íconos, y lo expande de vuelta. El estado **persiste** en `localStorage` (sobrevive navegación y reload).

- **Toggle:** botón con el ícono `chevron` (rota 180° = "«" para colapsar; "»" para expandir), con `title` "Colapsar"/"Expandir". Ubicado bajo el encabezado; alineado a la derecha cuando está expandido, centrado cuando está colapsado.
- **Colapsado (`w-16`):**
  - Links de navegación: solo ícono, centrados, con `title` = label (tooltip nativo).
  - Se oculta el wordmark; la campana queda centrada arriba.
  - Pie: avatar centrado + ícono de salir; se ocultan el nombre/rol y el texto "Salir".
- **Expandido (`w-56`):** igual que hoy.
- Transición suave de ancho (`transition-[width]`). El `main` aprovecha el espacio (ya es `flex-1`).
- El estado colapsado se expone como `data-colapsado` en el `<aside class="group/side">`; el nombre/rol y el texto "Salir" del pie (que llegan como prop desde `panel-shell.tsx`) se ocultan con `group-data-[colapsado=true]/side:*` — sin lógica nueva del lado server.

## Fuera de alcance

- El header del técnico (mobile-first, sin sidebar) no cambia.
- No hay atajo de teclado ni animación de los íconos: solo el colapso.

## Criterios de aceptación

1. En desktop, la flechita colapsa el sidebar a un rail angosto con solo íconos y lo vuelve a expandir.
2. Colapsado: los links muestran solo el ícono, con tooltip del nombre al pasar el mouse; el `main` ocupa el espacio liberado.
3. El estado (colapsado/expandido) se recuerda al navegar entre páginas y al recargar.
4. En mobile la navegación superior queda igual que antes.
5. `tsc`/eslint verdes.

## Dev Agent Record

- **Commit:** `6d5eb31` (pusheado a main 2026-07-18).
- **Archivos:** `codigo/components/paneles/sidebar.client.tsx` (estado de colapso vía `useSyncExternalStore` sobre localStorage — sin setState-en-effect ni mismatch de hidratación; toggle + rail), `codigo/components/paneles/panel-shell.tsx` (pie oculta nombre/rol + "Salir" y centra con `group-data-[colapsado=true]/side:*`).
- **Verificación:** `tsc`/eslint verdes. E2E en el navegador (Playwright, admin): colapsa a `w-16` con solo íconos (10 links, 0 con texto), expande de vuelta, y el estado persiste al navegar de `/admin` a `/tablero` (`data-colapsado=true`, localStorage `1`). Sin errores de hidratación.
