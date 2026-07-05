---
name: MANTIS 2
description: Design contract del sistema de gestión de mantenimiento inmobiliario. Dirección "Esmeralda técnica" — minimalista y moderna. Tailwind 4 CSS-first; los tokens de este archivo SON los del @theme de codigo/app/globals.css.
status: final
updated: 2026-07-05
sources:
  - specs/PRD.md (v1.2.0 §12)
colors:
  background: '#FAFAFA'
  surface: '#FFFFFF'
  surface-2: '#F4F4F5'
  text: '#18181B'
  text-muted: '#71717A'
  border: '#E4E4E7'
  border-strong: '#D4D4D8'
  brand: '#059669'
  brand-hover: '#047857'
  brand-active: '#065F46'
  brand-soft: '#ECFDF5'
  brand-soft-border: '#A7F3D0'
  urgente: '#D97706'
  urgente-soft: '#FFFBEB'
  urgente-soft-border: '#FDE68A'
  error: '#DC2626'
  error-soft: '#FEF2F2'
  error-soft-border: '#FECACA'
typography:
  display:
    fontFamily: 'Archivo'
    fontSize: 24px
    fontWeight: '650'
    lineHeight: '1.2'
    letterSpacing: '-0.02em'
  title:
    fontFamily: 'Archivo'
    fontSize: 17px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: '-0.01em'
  body:
    fontFamily: 'Archivo'
    fontSize: 15px
    fontWeight: '400'
    lineHeight: '1.55'
  label:
    fontFamily: 'Archivo'
    fontSize: 13px
    fontWeight: '500'
    lineHeight: '1.3'
    color: '{colors.text-muted}'
  data:
    fontFamily: 'Fragment Mono'
    fontSize: 13px
    fontWeight: '400'
    note: 'SOLO montos, IDs, fechas técnicas y códigos. Nunca labels ni headings.'
rounded:
  sm: 6px
  md: 8px
  lg: 12px
  pill: 999px
spacing:
  base: 4px
  tap: 44px
components:
  button-primary:
    background: '{colors.brand}'
    foreground: '#FFFFFF'
    radius: '{rounded.md}'
    hover: '{colors.brand-hover}'
    minHeight: '{spacing.tap}'
  button-secondary:
    background: '{colors.surface}'
    foreground: '{colors.text}'
    border: '1px solid {colors.border-strong}'
    radius: '{rounded.md}'
    hover-background: '{colors.surface-2}'
  button-ghost:
    background: 'transparent'
    foreground: '{colors.text-muted}'
    hover-background: '{colors.surface-2}'
  input:
    background: '{colors.surface}'
    border: '1px solid {colors.border-strong}'
    radius: '{rounded.md}'
    focus: 'borde {colors.brand} + ring 3px {colors.brand} al 15%'
    minHeight: '{spacing.tap}'
  card:
    background: '{colors.surface}'
    border: '1px solid {colors.border}'
    radius: '{rounded.lg}'
    shadow: 'ninguna (borde hairline es la elevación)'
  badge:
    radius: '{rounded.sm}'
    tonos: 'brand-soft | urgente-soft | error-soft | neutral (surface-2)'
    borde: '1px del soft-border correspondiente'
  input-editorial:
    uso: 'EXCLUSIVO del login (pantalla de marca)'
    estilo: 'sin caja — subrayado 1px {colors.border-strong}; focus: subrayado {colors.brand} 2px'
    minHeight: '{spacing.tap}'
  select:
    estilo: 'idéntico a input (nativo estilizado, sin librerías)'
    minHeight: '{spacing.tap}'
  table:
    contenedor: 'card'
    header: 'fila {typography.label} con borde inferior {colors.border}'
    filas: 'borde inferior {colors.border}; hover {colors.surface-2}'
---

## Brand & Style

MANTIS 2 es una herramienta de trabajo diaria para una inmobiliaria: el diseño debe **desaparecer** para que el contenido (gestiones, estados, montos) mande. Dirección **"Esmeralda técnica"**: superficies blancas y grises fríos, tipografía sobria, y **un solo color con significado** — el esmeralda de marca. Nada decorativo: ni gradientes, ni ilustraciones, ni texturas, ni la franja de obra de la etapa anterior.

**Los tres criterios rectores (no negociables):**

1. **Un acento, un significado.** El esmeralda `{colors.brand}` significa "acción/marca/foco". El ámbar `{colors.urgente}` significa "urgente". El rojo `{colors.error}` significa "error/peligro". Ningún otro uso, ningún otro color.
2. **El borde es la elevación.** Jerarquía con bordes hairline y fondos (`surface` sobre `background`), no con sombras. Sombra solo en overlays (modal, dropdown, toast).
3. **Consistencia sobre creatividad.** Toda pantalla nueva se compone con los tokens y componentes de este archivo. Si un diseño necesita algo que no está acá, se agrega ACÁ primero (bump de versión) y después se usa.

## Colors

- `background` (#FAFAFA) es el fondo de la app; `surface` (#FFFFFF) el de cards, inputs, header y modales; `surface-2` para hover y zonas hundidas.
- Texto: `text` para contenido, `text-muted` para labels y secundario. Nunca gris más claro que `text-muted` para texto legible.
- **Esmeralda**: botón primario, links, focus ring, estados "activo/ok", el guión del wordmark. Prohibido como fondo de secciones grandes.
- **Ámbar urgente**: exclusivo del estado urgencia (badges, indicadores de plazo). Nunca decorativo.
- Tonos `-soft` + su `-soft-border`: fondos de badges y avisos. Texto del badge siempre en el color pleno correspondiente (`brand-active`, `urgente` oscurecido a #B45309 si hace falta contraste, `error`).

## Typography

- **Archivo** única familia de UI (ya cargada, eje `wdth`). El **wordmark** "MAN—TIS" es el único uso permitido del expandido black uppercase; el resto de la UI usa pesos 400–650 en caja normal.
- Labels de formulario: `label` (13px, medium, `text-muted`, caja normal) — **se retiran las etiquetas mono uppercase** de la etapa anterior.
- **Fragment Mono** queda SOLO para datos: montos, IDs de gestión, fechas técnicas, códigos.
- Jerarquía por peso y color antes que por tamaño: pocos tamaños, bien usados.

## Layout & Spacing

- Escala de 4px (`{spacing.base}`); espaciados comunes: 8 / 12 / 16 / 24 / 32.
- **Target táctil mínimo `{spacing.tap}` (44px)** en toda superficie que use el técnico (crítico, PRD §12) y en botones/inputs de todos los paneles.
- Contenido principal con `max-width` contenida (~72rem) y padding lateral 16px mobile / 32px desktop.
- Densidad: generosa en mobile técnico, media en paneles de gestión (tablas y tablero).

## Elevation & Depth

- Nivel 0: `background`. Nivel 1: `surface` + borde `border`. Hover de items: `surface-2`.
- Sombra ÚNICAMENTE en overlays: `0 4px 24px rgb(0 0 0 / 0.08)`. Nada de sombras en cards en reposo.

## Shapes

- Radios: `sm` 6px (badges), `md` 8px (botones, inputs), `lg` 12px (cards, modales), `pill` para chips de filtro.
- Sin bordes redondeados extremos (nada de rounded-3xl): el sistema es sobrio.

## Components

- **Button**: primario (esmeralda, texto blanco), secundario (surface + borde), fantasma (texto muted, hover surface-2). Alto mínimo 44px, `active:translate-y-px`, focus ring esmeralda.
- **Input**: label arriba (tipo `label`), 44px, focus = borde brand + ring 3px al 15%. Error: borde `error` + mensaje 13px en `error`.
- **Card**: surface + borde hairline + radio `lg`. Sin sombra.
- **Badge**: tonos semánticos (`brand-soft` = ok/activo, `urgente-soft`, `error-soft`, neutral). 12–13px, medium, caja normal (no uppercase).
- **Tarjeta de gestión (Kanban)**: card compacta; urgencia como banda/badge ámbar; fuera de competencia → `opacity-50` + sin acciones (solo lectura).
- **Header de panel**: claro (`surface` + borde inferior `border`), wordmark chico con guión esmeralda, badge de rol, salir como botón fantasma. **Se retira el header oscuro y la franja diagonal.**
- **Login (pantalla de marca — concepto "editorial con pulso")**: única pantalla con licencia propia, definida acá: layout asimétrico anclado a la izquierda (nunca card centrada ni banner lateral — anti-patrón "login de IA"), wordmark gigante con el **guión esmeralda latiendo** (animación `latido`, el pulso del sistema), fondo `fondo-tecnico` (grilla de puntos al 7%), campos `input-editorial` y entrada escalonada con `aparecer`.

## Do's and Don'ts

- ✅ Componer todo con tokens de este archivo; ✅ bordes antes que sombras; ✅ voseo rioplatense en microcopy; ✅ 44px mínimo tocable.
- ❌ Colores fuera de la paleta (ni "un grisecito más"); ❌ esmeralda decorativo en fondos grandes; ❌ ámbar fuera de urgencias; ❌ uppercase tracking-wide en labels; ❌ sombras en cards; ❌ gradientes, glassmorphism, ilustraciones genéricas; ❌ desviarse "porque esta pantalla es especial" — no hay pantallas especiales.
