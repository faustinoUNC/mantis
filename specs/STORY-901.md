# Story 9.1: Mejoras post-MVP — inbox vivo, dashboards por rol, navegación mobile del técnico

Status: done
Versión: 1.0.0

> Batch de mejoras pedidas por Fausti tras las primeras pruebas reales (2026-07-05).

## Alcance

1. **Inbox vivo (bug)**: la campana avisa el reporte nuevo pero la lista del inbox no se actualiza sola — suscripción realtime a `inbox_reportes` que refresca la vista (mismo patrón del tablero vivo).
2. **Inbox sin "Procesados"**: esa sección no corresponde ahí — el inbox muestra SOLO pendientes (lo procesado vive en sus gestiones y en la auditoría).
3. **Dashboards por rol**: el Inicio de admin / gestor de mantenimiento / gestor administrativo deja de ser el Kanban crudo y pasa a ser un dashboard: saludo + tiles clave del rol + "Requiere tu acción" (gestiones accionables, urgentes primero) — el tablero completo se muda a `/tablero` (ítem propio en la nav).
4. **Vista técnico mobile-first real**: navegación inferior fija con íconos SVG (Trabajos, Agenda) en lugar del menú de texto arriba; header mínimo (marca + campana + salir).
5. **Alta de técnicos SOLO en Técnicos**: el mantenedor de Empleados no permite crear/editar hacia rol técnico (validado también server-side) y no lista técnicos.
6. **Usuarios**: gestoruno → `gestormantenimientouno` / gestormantenimientouno123; nuevo `gestoradministrativouno` / gestoradministrativouno123 (gestor administrativo).

## Dev Notes

- Inbox vivo: `inbox_reportes` a la publicación realtime; RLS ya limita a staff de mantenimiento. Componente con getSession+setAuth antes de suscribirse (patrón obligado del proyecto).
- Dashboards: componen datos de services existentes (tableroGestiones RLS-scoped, obtenerMetricas, inbox y solicitudes pendientes) — sin services nuevos (Regla #0). TableroVivo montado para que "Requiere tu acción" también sea vivo.
- Bottom nav: componente `nav-tecnico` agregado al design contract — fija abajo, íconos SVG propios (sin librerías), labels 10px, activo en esmeralda, targets ≥44px, safe-area inset.

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code, 2026-07-05)

### Completion Notes List

- **Verificado E2E**: sidebar staff con íconos SVG (desktop) + dashboard admin con tiles y "Gestiones en curso"; técnico mobile con nav inferior (Trabajos/Agenda/Perfil, activo esmeralda) + página Perfil con datos y especialidades; registro público con las 12 especialidades visibles COMO ANÓNIMO (fix: la RLS exige authenticated → especialidadesParaRegistro con admin client) y sin la palabra "enrolar" en ninguna vista.
- Inbox: vivo (RefrescoVivo sobre inbox_reportes, publicación realtime agregada) + solo pendientes (adiós sección Procesados; el service filtra).
- RefrescoVivo generaliza el tablero vivo (tabla parametrizada) — un solo componente para gestiones e inbox.
- InputPassword con ojito (variantes caja y editorial) en login, empleados y registro/alta de técnicos.
- Empleados: sin rol técnico en el form (UI + rechazo server-side en crear/editar) y el listado excluye técnicos.
- Usuarios: gestormantenimientouno / gestormantenimientouno123; nuevo gestoradministrativouno / gestoradministrativouno123. Ruta /enrolamiento → /registro-tecnico.
- Design contract: sidebar-nav, nav-tecnico, input-password e iconos agregados.

### File List

- components/ui/{iconos.tsx, input-password.client.tsx} · components/refresco-vivo.client.tsx
- components/paneles/{sidebar.client.tsx, nav-tecnico.client.tsx, inicio-rol.tsx, panel-shell.tsx (rewrite)}
- app/tablero/* · app/{admin,gestion,administracion}/page.tsx (dashboards) · app/tecnico/perfil/* · app/registro-tecnico/*
- features/{auth/types (NAV+iconos), empleados/service (guards), inbox/service (pendientes), tecnicos/service (registro público + miPerfilTecnico)}
- Migración: realtime inbox_reportes (en execute) · DESIGN.md v+
