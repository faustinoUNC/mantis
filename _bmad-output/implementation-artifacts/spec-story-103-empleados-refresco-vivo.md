---
title: 'STORY-103 v1.1 — refresco en vivo del listado de empleados'
type: 'bugfix'
created: '2026-07-15'
status: 'done'
route: 'one-shot'
---

# STORY-103 v1.1 — refresco en vivo del listado de empleados

## Intent

**Problem:** La creación/edición/inhabilitación de empleados no se reflejaba en tiempo real: `/admin/empleados` era la única lista "viva" del sistema sin `RefrescoVivo`, y `revalidatePath` solo refresca a la sesión que ejecutó la acción — otra sesión con la lista abierta no veía nada hasta recargar a mano.

**Approach:** Montar `<RefrescoVivo tabla="usuarios" />` en el componente de Empleados, espejo exacto del patrón de Técnicos (STORY-957). Sin cambios de DB: `usuarios` ya estaba en la publication `supabase_realtime` y la policy `admin_lee_todo` le entrega los eventos al admin (la página es solo-admin).

## Suggested Review Order

1. [codigo/components/empleados/empleados.client.tsx](../../codigo/components/empleados/empleados.client.tsx) — el fix entero: import + mount de `RefrescoVivo` (2 líneas + comentario). Comparar con `tecnicos.client.tsx:201`.
2. [specs/STORY-103.md](../../specs/STORY-103.md) — spec patch v1.1.0: motivo, verificación de DB y trade-offs asumidos (refrescos de más por actividad de técnicos; edición inline puede desmontarse si un evento ajeno reacomoda filtro/paginación).
3. [deferred-work.md](deferred-work.md) — hallazgo preexistente diferido de la review: last-write-wins entre dos admins editando al mismo empleado.
