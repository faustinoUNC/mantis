# Story 4.1 (+4.2/4.3 núcleo): Modelo del funnel, creación de gestiones y tablero Kanban

Status: done
Versión: 1.1.0

> Nota: por cohesión de implementación, esta spec cubre el núcleo del funnel (modelo + `avanzar_etapa()` + creación + tablero). Las stories 4.4–4.8 tienen specs propias (STORY-404…408). Corresponde a las stories 4.1, 4.2 y 4.3 de epics.md.

## Story

Como gestor de mantenimiento,
quiero crear gestiones y verlas avanzar en un tablero Kanban de 8 columnas,
para seguir todo el ciclo de mantenimiento de un vistazo.

## Acceptance Criteria

1. **Given** el form de nueva gestión (descripción, propiedad → legajo vigente auto, especialidad, urgencia, causa), **Then** nace en "Ingresado" con `gestor_id` = creador y pagador SUGERIDO por causa (desgaste→propietario, daño→inquilino, mejora→propietario).
2. **And** el tablero muestra las 8 columnas; el gestor de mantenimiento ve SOLO sus gestiones (RLS por `gestor_id`); el admin ve todas; el gestor administrativo ve todas pero solo acciona en Facturación/Liquidación (tarjetas ajenas opacadas); urgente se distingue de forma inequívoca.
3. **And** TODA transición pasa por `avanzar_etapa()` (Postgres): valida transición permitida + permiso por rol/columna + ownership, actualiza etapa e inserta el evento en `eventos_gestion` — en UNA transacción; un intento sin permiso (aun por RPC directo) es rechazado.
4. **And** el detalle de la gestión muestra su timeline de eventos.

## Tasks / Subtasks

- [ ] Migración `crear_funnel`: enums (etapa, urgencia, causa, pagador), `gestiones` (con gestor_id, tecnico_id, asignacion_aceptada, costo_final), `eventos_gestion`, función `avanzar_etapa()`, RLS por rol (gestor_mantenimiento solo sus filas; técnico solo asignadas; staff-admin/administrativo select all), bucket `gestiones`
- [ ] `features/gestiones/{types,service}.ts`: crearGestion, tableroGestiones, obtenerGestion (+eventos), avanzarEtapa (rpc)
- [ ] UI tablero (columnas con scroll horizontal snap en mobile) + form crear + página detalle con timeline

## Dev Notes

- Matriz de permisos por etapa (en `avanzar_etapa()`): etapas 1–5 → admin o gestor_mantenimiento OWNER; 6–8 → admin o gestor_administrativo. Transiciones válidas: cadena lineal + retrocesos permitidos (presupuesto→asignacion).
- `asignaciones` NO es tabla: `gestiones.tecnico_id + asignacion_aceptada` (Regla #0); los rechazos quedan como eventos.
- `eventos_gestion`: solo inserta la función (revocar insert directo). Es el event log de auditoría (Épica 8) y el trigger de notificaciones (Épica 5).
- Tablero: componente único `Tablero` parametrizado por rol; tarjeta = dirección + especialidad + badge urgencia + días en etapa.

### References

- [Source: epics.md#story-41/42/43] · [Source: PRD §2.1 ownership, §5 funnel] · [Source: ARQUITECTURA §6]

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code, 2026-07-05)

### Completion Notes List

- v1.1.0 (pedido Fausti): **tablero vivo** — suscripción Realtime a cambios de `gestiones` (INSERT/UPDATE) que refresca la vista con router.refresh() debounced; cubre el AC "el tablero se actualiza en tiempo real cuando otra persona mueve una tarjeta" que había quedado sin cablear. Componente TableroVivo montado en tablero y en Mis trabajos del técnico. Requiere `gestiones` en la publicación realtime (RLS decide qué filas ve cada suscriptor).

- E2E del ciclo COMPLETO con 3 roles: Carla creó (urgente, Gas, pagador sugerido propietario) → asignó a Miguel viendo su disponibilidad → Miguel aceptó → inspección + presupuesto → Carla aprobó (pagador) → avance → conformidad con foto → Carla aprobó (costo final $53.000) → admin cerró Facturación → Liquidación → FINALIZADO. Timeline de eventos completo.
- avanzar_etapa() y responder_asignacion() en Postgres (SECURITY DEFINER con matriz de permisos interna); WITH CHECK de presupuestos/conformidades endurecidos tras advisor.

### File List
