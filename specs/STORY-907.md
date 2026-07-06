# STORY-907 — Refinamiento UX/UI: identidad y vida (técnico primero) (v1.0)

**Estado:** ✅ done · **Fecha:** 2026-07-06
**Origen:** Revisión UX/UI de Fausti: "falta el nombre del técnico en el home, las cards son muy básicas, al sistema le falta vida en general". Evaluación con navegador real (390px y 1440px) sobre todas las vistas.

## Objetivo

Darle identidad y calidez al sistema sin romper la dirección "Esmeralda técnica"
ni la Regla #0: el técnico se siente saludado y sabe qué le espera; las cards
comunican jerarquía (qué necesita acción vs. qué espera); los paneles ganan
micro-vida (stagger de entrada, hover, avatares) con los tokens existentes.

## Hallazgos de la evaluación

1. **Home técnico sin identidad**: H1 fijo "Mis trabajos", ningún nombre ni fecha; el saludo con nombre existe solo en los paneles de staff.
2. **Cards del técnico planas**: sin agrupación visual entre "requiere acción" y "en espera" (solo cambia el orden), etapa como texto suelto, sin tiempo transcurrido, CTA angosto para pulgar.
3. **Sin estados vacíos con carácter** en el home técnico (texto suelto, sin la grilla `fondo-tecnico` que el login sí usa).
4. **Detalle viola el contract**: labels `uppercase tracking-wide` en Datos/Presupuesto/Actividad (DESIGN.md los prohíbe expresamente).
5. **Input de archivo nativo desborda** en 390px ("Sin archiv...ccionados").
6. **Bug real de consola**: la campana se renderiza 2 veces (sidebar desktop + barra mobile) y ambas abren el mismo canal realtime → error `cannot add postgres_changes callbacks after subscribe()`.
7. **Paneles staff correctos pero fríos**: tiles sin affordance de link, cards de "Requieren tu acción" sin tiempo ni pin de dirección, pie del sidebar plano.

## Alcance

### Design contract (DESIGN.md → v2026-07-06, cambios ADITIVOS)
- **avatar**: círculo de iniciales `brand-soft` + borde `brand-soft-border`, texto `brand-active`; tamaños 28/32/48.
- **stagger**: entrada escalonada de listas (delay 30ms por hijo sobre `aparecer`), única animación nueva.
- **input-archivo**: reemplazo del file input nativo — botón secundario con ícono cámara + nombre del archivo elegido.
- Íconos nuevos al set propio: `pin`, `reloj`, `chevron`, `camara`, `check`.

### Técnico (mobile-first)
- **Header**: campana + avatar con iniciales (link a Perfil). "Salir" se muda a Perfil como acción explícita "Cerrar sesión" (el header queda limpio).
- **Home**: saludo "Hola, {nombre}" + fecha completa es-AR + resumen accionable ("Tenés N trabajos que te esperan"). Secciones **"Te esperan (N)"** (cards con CTA a lo ancho, urgentes primero) y **"En espera"** (cards compactas, tono quieto). Empty state con `fondo-tecnico` + mensaje útil. Stagger de entrada. Cards con feedback táctil (`active:scale`), dirección con pin, etapa como badge y tiempo transcurrido en mono.
- **Perfil**: avatar 48 + nombre; botón "Cerrar sesión" al pie.
- **Detalle**: labels a caja normal (13px medium muted — contract), heading "Actividad" normal, `input-archivo` en avance y conformidad.

### Staff
- **Inicio**: saludo contextual por hora (Buen día / Buenas tardes / Buenas noches) + fecha; tiles linkeables con chevron y hover-lift; cards de acción con pin + tiempo en etapa; empty state con `fondo-tecnico`; stagger.
- **Sidebar**: pie con avatar + nombre + rol (más humano, mismo espacio).

### Fixes
- **Campana**: canal realtime con sufijo único por instancia (2 instancias ya no chocan).

## Fuera de alcance (decisión)
- Tablero Kanban: ya tiene hover-lift y contadores; no se toca (Regla #0).
- Badge de count en la nav inferior del técnico: exigiría query extra en el layout; no ahora.
- Dark mode, librerías de íconos/animaciones: prohibido por contract.

## Dev Agent Record
- **Commit:** ea414f0
- **Archivos:** `globals.css` (stagger + `--radius-pill` que faltaba — `rounded-pill` no generaba nada), `ui/avatar.tsx` (nuevo), `ui/input-archivo.client.tsx` (nuevo), `ui/iconos.tsx` (pin/reloj/chevron/camara/check), `mis-trabajos.client.tsx` (rediseño), `tecnico/page.tsx`, `tecnico/perfil/page.tsx`, `panel-shell.tsx`, `inicio-rol.tsx`, `detalle.client.tsx`, `campana.client.tsx`, DESIGN.md (bump aditivo).
- **Extra encontrado y corregido:** (a) token `--radius-pill` inexistente pese a usos previos de `rounded-pill`; (b) error de hidratación preexistente en el detalle — `toLocaleString` emite U+202F distinto entre Node y navegador → `fechaHora()` manual 24h.
- **Verificación:** capturas 390px (home/perfil/detalle técnico) y 1440px (inicio admin) después del cambio; consola limpia (sin el error de la campana ni la hidratación); `npm run build` verde.
