# STORY-993 — Skeletons de carga por ruta (v0.1 · BORRADOR)

**Estado:** 📝 borrador (espera aprobación de Fausti) · **Origen:** auditoría UX STORY-991 — hoy **no hay un solo skeleton ni `loading.tsx`** en toda la app. Al navegar entre paneles o abrir el detalle, la pantalla queda con la vista vieja (o en blanco) hasta que el server component resuelve. El contract lo manda explícito y ausente.

## Contract (ya lo pide, no hace falta bump)
- EXPERIENCE.md §State Patterns: "**Cargando**: skeletons del layout final (no spinners a pantalla completa)."
- DESIGN.md §Motion: reutilizar `Card` + un pulso sutil; sin animación nueva.

> Nota: esto es **cumplimiento**, no evolución — pero es más grande que un retoque de estilo, por eso va como STORY propia y no entró en la 991.

## Alcance (solo presentación)
Agregar `loading.tsx` (o `<Suspense fallback>`) con **skeletons del layout final** en las rutas pesadas:
1. **Detalle de gestión** `app/(...)/gestiones/[id]` — el salto más visible (se abre desde tablero/mis-trabajos).
2. **Tablero** (Kanban) — columnas con 2-3 cards skeleton.
3. **Informes/Métricas** — cards de gráfico con placeholder.
4. **Finanzas** — tabla/stat cards skeleton.
5. **Inbox** — 1-2 cards skeleton mientras `sincronizando && pendientes.length === 0` (hoy queda el cuerpo en blanco bajo "Buscando mails…").

Patrón único: un componente `SkeletonCard` (surface + borde + bloques `bg-surface-2` con un pulso muy sutil, respetando `prefers-reduced-motion` de STORY-991). Reutiliza `Card`. Cero librerías.

## Fuera de alcance
- Optimistic UI de datos (ya resuelto donde corresponde con botón disabled + texto).
- Rutas livianas (login, perfil) — no lo necesitan.

## Decisión pendiente
- ¿`loading.tsx` por ruta (App Router, gratis en navegación) o `<Suspense>` puntual? Recomendado: `loading.tsx` por ruta pesada — es lo que da el feedback en la navegación misma.

## Verificación
- `tsc` + `eslint` verdes. Recorrido: abrir detalle / cambiar de panel muestra el esqueleto del layout final, nunca pantalla vieja ni blanca.

## Dev Agent Record
- _(pendiente)_
