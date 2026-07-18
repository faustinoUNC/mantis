# STORY-995 — Visor de fotos único (lightbox) (v0.1 · BORRADOR)

**Estado:** 📝 borrador (espera aprobación de Fausti) · **Origen:** auditoría UX STORY-991 (vista técnico) — las fotos aparecen en 3 lugares del detalle y hasta la 991 cada uno las trataba distinto. La 991 emparchó envolviéndolas en `<a target="_blank">`, pero abrir una pestaña nueva no es el mejor gesto en mobile.

## Problema
Fotos en el detalle de gestión: avance, conformidad firmada, comprobantes. Hoy (post-991) todas abren en pestaña nueva. En mobile (técnico en la calle) lo natural es **tap → overlay a pantalla completa**, sin salir de la app.

## Cambio de contract (bump menor DESIGN.md §Components)
Agregar componente **`visor-foto`**:
> `visor-foto`: tap en cualquier miniatura → overlay a pantalla completa con la foto centrada, fondo `bg-foreground/80`, cerrar con tap fuera / botón × / Escape. Usa la `shadow-overlay` ya permitida. Único patrón para toda foto ampliable del sistema (avance, conformidad, comprobantes, y futuras).

## Alcance (solo presentación)
- Componente `VisorFoto` (client, portal, cero librerías — como el bottom-sheet de `mis-trabajos`). Reutiliza `aparecer` y respeta `prefers-reduced-motion`.
- Reemplazar los `<a target="_blank">` de STORY-991 en `detalle.client.tsx` (avance, conformidad, comprobantes) por el visor.
- Targets ≥44px para el botón de cerrar.

## Fuera de alcance
- Galería/carrusel entre fotos (Regla #0 — una foto a la vez alcanza; se evalúa si hace falta).
- Zoom/pinch — v2 si se pide.

## Verificación
- `tsc` + `eslint` verdes. Recorrido en 390px: tap en foto de conformidad → se ve a pantalla completa y se lee; cierra con × / tap afuera / Escape.

## Dev Agent Record
- _(pendiente)_
