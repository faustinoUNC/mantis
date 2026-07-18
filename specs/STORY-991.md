# STORY-991 — Pulido visual premium dentro del contract (v1.0)

**Estado:** 🚧 en desarrollo · **Origen:** Fausti (UX): "hacer mucho más premium la calidad visual del sistema, sin afectar funcionalidad, solo estilos". Auditoría con 5 agentes expertos (tokens, tipografía, motion/estados, layout, técnico mobile) contra el design contract "Esmeralda técnica".

## Principio

**Premium = ejecución impecable del contract que ya existe**, no capas nuevas. Todo lo de esta story es *cumplimiento del contract* o *consistencia con él*: cero DESIGN.md nuevo, cero animaciones nuevas, cero librerías, cero tablas/estados. Respeta Regla #0. Lo que requeriría evolucionar el contract va en propuesta aparte (no en esta story).

## Alcance (solo estilos — no se toca lógica)

### A. Cumplimiento del contract (prohibiciones que estaban rotas)
1. **Sacar `uppercase tracking-wide` de headings/labels** (el contract lo prohíbe explícito). Pasa a caja normal, misma jerarquía por peso/color:
   - `metricas/panel-metricas.client.tsx:248,756,865`
   - `gestiones/mis-trabajos.client.tsx:156`
   - `ui/combo-filtrable.client.tsx:189` (→ `text-[13px] font-medium text-muted`)
   - `gestiones/detalle.client.tsx:229` (tooltip, mantener color sobre fondo oscuro)
2. **Ring de foco esmeralda en TODO clickable no-`<Button>`** ("foco SIEMPRE visible", a11y floor). Mismo patrón que `button.tsx` (`focus-visible:outline-2 outline-offset-2 outline-brand`), y `group-focus-visible:` donde el hover cambia el estilo:
   - `gestiones/tablero.client.tsx:54`, `gestiones/mis-trabajos.client.tsx:79,109,183,226,291`, `paneles/inicio-rol.tsx:99`, `paneles/sidebar.client.tsx:65`, `paneles/nav-tecnico.client.tsx:25`, `paneles/campana.client.tsx:160`
   - `paneles/campana.client.tsx:117` — sumar `outline-offset-2` (hoy pegado)
3. **`@media (prefers-reduced-motion: reduce)` en `globals.css`** — anula `aparecer`/`stagger`/`latido` infinito. Piso de accesibilidad vestibular.
4. **Hex hardcodeado que YA es token → token:**
   - `gestiones/presencia.client.tsx:81,85` `#B45309`/`stroke` → `text-urgente-fuerte` + `stroke="currentColor"`
   - `ui/mapa.tsx:39` `stroke="#059669"` → `stroke="currentColor"` + `text-brand` en el botón
5. **Radio/scrim fuera de sistema:**
   - `metricas/panel-metricas.client.tsx:754` `rounded-xl` → `rounded-lg` (cards = 12px)
   - `gestiones/mis-trabajos.client.tsx:244` scrim `bg-black/40` → `bg-foreground/40` (token, como `envio-documento`)
6. **Montos en Fragment Mono** (el contract manda mono para plata; hoy la mitad del sistema la usa y la otra no):
   - `finanzas/finanzas.client.tsx:262,297,338,453`, `metricas/panel-metricas.client.tsx:686` → sumar `font-mono`

### B. Técnico mobile — targets ≥44px (crítico, PRD §12) y clímax
7. `ui/input-archivo.client.tsx:119-131` — botón "quitar foto" `size-6` (24px) → `min-h-tap min-w-tap`, lista `gap-1.5` → `gap-2`.
8. `paneles/campana.client.tsx:117` — campana `size-9` (36px) → `size-11` (único acceso a notificaciones del técnico en la calle).
9. `paneles/nav-tecnico.client.tsx:25` — sumar `active:scale-[0.985] transition-transform` (nav más tocada del sistema).
10. `gestiones/detalle.client.tsx:818` — nota de avance/inspección: `Input` de 1 línea → `Textarea` 2-3 filas (flujo clímax "registrar en 20s"; una frase real scrollea en 390px).
11. `gestiones/detalle.client.tsx:1574-1581,1603-1610` — fotos de avance y conformidad envueltas en `<a target="_blank">` igual que los comprobantes (hoy no se pueden agrandar).

### C. Layout — agrupación rota
12. `cartera/legajos.client.tsx:96` — `justify-between` con 3 hijos deja los 2 botones separados por un hueco; envolver "Editar datos" + "Cerrar legajo" en un `<div className="flex items-center gap-2">`.

## Fuera de alcance (van a propuesta de evolución del contract — decisión de Fausti)
- Skeletons de carga por ruta (`loading.tsx`) — más grande, merece su propia story.
- Unificar el tamaño de "header de sección" (hoy 4 tamaños) → token `section-header`.
- Unificar stat cards (Inicio vs Finanzas).
- Formularios de alta multi-columna → variante `form-compacto`.
- Reconciliar la escala micro (11/12px) y el choque 14px (`text-sm`) vs 15px (body).
- Botones de tabla del staff `h-8` (<44px, densidad media deliberada).
- Lightbox único de fotos (`visor-foto`).

## Verificación
- `tsc` + `eslint` verdes.
- Recorrido visual (Playwright) de las pantallas tocadas: foco por teclado visible, montos en mono, targets del técnico, sin uppercase.

## Dev Agent Record
- Implementado 2026-07-18 (12 grupos de cambios en 11 archivos). `tsc --noEmit` ✅ y `eslint .` ✅ verdes.
- Archivos: `app/globals.css`, `ui/input-archivo.client.tsx`, `ui/mapa.tsx`, `ui/combo-filtrable.client.tsx`, `paneles/nav-tecnico.client.tsx`, `paneles/campana.client.tsx`, `paneles/sidebar.client.tsx`, `paneles/inicio-rol.tsx`, `gestiones/presencia.client.tsx`, `gestiones/tablero.client.tsx`, `gestiones/mis-trabajos.client.tsx`, `gestiones/detalle.client.tsx`, `metricas/panel-metricas.client.tsx`, `finanzas/finanzas.client.tsx`, `cartera/legajos.client.tsx`.
- Commit/push: _(pendiente OK de Fausti)_
- Verificación visual E2E (Playwright): _(pendiente — browser ocupado por otra instancia)_
