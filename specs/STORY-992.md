# STORY-992 — Token `section-header`: un solo estilo para encabezados de sección (v0.1 · BORRADOR)

**Estado:** 📝 borrador (espera aprobación de Fausti) · **Origen:** auditoría UX STORY-991 — hoy el mismo nivel jerárquico ("header de una sección dentro de un panel") usa **4 tamaños distintos** según el archivo, y varios con `uppercase tracking-wide` (prohibido).

## Problema

Mismo rol visual, cuatro ejecuciones:
- `cartera/legajos.client.tsx:84` → `text-lg` (~18px)
- `finanzas/finanzas.client.tsx` (EncabezadoGrupo/HistorialMensual) → `text-sm`
- `gestiones/detalle.client.tsx` + `metricas/panel-metricas.client.tsx` (MetricCard) → `text-[15px]`
- `metricas/panel-metricas.client.tsx` (Bloque/"En el período"/"Histórico") + `gestiones/mis-trabajos.client.tsx` → `text-[13px]` (antes uppercase; STORY-991 ya sacó el uppercase)

El contract no tiene un token para "header de sección", por eso el goteo.

## Cambio de contract (bump DESIGN.md)

Agregar a §Components / Typography un token **`section-header`**:
> `section-header`: 13px, weight 600, `text-muted`, caja normal, `mb-3`. Encabezado de una sección dentro de un panel. No confundir con `title` (17px, contenido) ni `label` (13px/500, etiqueta de campo).

(Recomendado 13px/600 muted — es el que ya usan métricas y mis-trabajos tras STORY-991; es el más discreto y "hace desaparecer" el diseño, alineado con la doctrina.)

## Alcance
- Definir la convención en `DESIGN.md` (bump menor).
- Migrar los 4 lugares al mismo estilo. Sin lógica.

## Fuera de alcance
- Los `title` de página (h1, 24px) y los `label` de formulario — ya están bien.

## Verificación
- `tsc` + `eslint` verdes. Recorrido visual: los headers de sección se leen iguales entre Legajos, Finanzas, Métricas y Detalle.

## Dev Agent Record
- _(pendiente)_
