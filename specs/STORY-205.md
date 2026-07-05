# Story 2.5: Ubicación de la propiedad en Google Maps

Status: done
Versión: 1.0.0

> Extensión de la Épica 2 pedida por Fausti (2026-07-05): el técnico debe poder abrir la ubicación del inmueble en Google Maps, y al cargar la dirección debe verse el mapa para validarla visualmente.

## Story

Como técnico (y como gestor al cargar una propiedad),
quiero ver la ubicación del inmueble en un mapa y abrirla en Google Maps,
para llegar sin pedir indicaciones y validar la dirección al cargarla.

## Acceptance Criteria

1. **Given** el form de nueva propiedad, **When** el gestor escribe la dirección (al salir del campo), **Then** aparece un **mapa embebido** con el pin en esa dirección — validación visual antes de guardar.
2. **And** el detalle de la propiedad muestra el mapa.
3. **Given** una gestión con propiedad, **When** el técnico (o cualquier rol) abre el detalle, **Then** hay un botón **"Abrir en Google Maps"** (target _blank) que abre la app/sitio de Maps con la dirección — en mobile dispara la app nativa con navegación.

## Dev Notes

- **Regla #0 — sin API key**: se usan las URLs públicas de Google Maps: embed `https://maps.google.com/maps?q={dir}&output=embed` (iframe, gratis, sin key) y link `https://www.google.com/maps/search/?api=1&query={dir}` (URL oficial de Maps URLs, abre la app en mobile). Nada de Geocoding API ni billing de Google Cloud.
- La "validación" es visual: el gestor VE el pin al cargar — si el mapa apunta mal, corrige la dirección antes de guardar. Sin validación dura server-side (requeriría Geocoding API — se documenta como mejora futura si hace falta).
- Componente único `MapaDireccion` (iframe con `loading="lazy"`) + helper `urlGoogleMaps(direccion)`. Se agregan al design contract como componente de mapa (borde hairline, radio lg — mismo tratamiento que Card).
- Tip de carga: conviene cargar direcciones con ciudad (ej. "Av. Colón 1234, Córdoba") para que el pin sea inequívoco — placeholder del form actualizado.

### References

- [Source: pedido de Fausti 2026-07-05] · [Source: DESIGN.md — card/borde como elevación]

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code, 2026-07-05)

### Completion Notes List

- E2E: mapa embebido con pin correcto en el detalle de la propiedad (Av. Colón, Córdoba) + preview en el form al salir del campo dirección + botón "Abrir en Google Maps" en el detalle de gestión (verificado en mobile 390px con la URL correcta).
- **Bug de RLS encontrado y corregido**: el técnico no podía leer la dirección de sus propios trabajos (propiedades era staff-only → "—"). Nueva policy `tecnico_lee_propiedades_asignadas` acotada a inmuebles de gestiones asignadas a él. GOTCHA SQL: el `id` sin calificar en el EXISTS se resolvió a `g.id` — siempre calificar `propiedades.id` en policies con subquery.
- Sin API key (Regla #0): embed `maps.google.com/maps?q=...&output=embed` + link oficial Maps URLs (abre la app nativa en mobile). Validación = visual (el gestor ve el pin antes de guardar).
- Componente `mapa` agregado al design contract.

### File List

- components/ui/mapa.tsx (MapaDireccion, BotonGoogleMaps, urlGoogleMaps)
- components/cartera/propiedades.client.tsx (preview en form) · app/cartera/propiedades/[id]/page.tsx (mapa) · components/gestiones/detalle.client.tsx (botón)
- Migraciones: tecnico_lee_propiedades_asignadas + fix_policy_tecnico_propiedades
