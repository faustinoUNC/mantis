# STORY-912 — Consolidar Métricas dentro del Inicio (un dashboard, menos menú) (v1.0)

**Estado:** 🚧 en desarrollo · **Fecha:** 2026-07-08
**Origen:** Fausti, revisando el Inicio: (1) en los tiles financieros "Por cobrar"/"Por liquidar a técnicos" no le convence el número (cantidad) a la izquierda del importe; (2) duda del valor de la sección "Gestiones en curso" (se pisa con el tablero). Propone: **que lo que hoy vive en /metricas se vea directamente en el Inicio y sacar "Métricas" del menú lateral.**

## Objetivo

Un solo lugar: el **Inicio** pasa a ser el dashboard completo (accionables + rendimiento + gráficos). Se elimina la página `/metricas` y su ítem del menú (3 roles con panel). Se saca el contador a la izquierda de los importes.

## Decisiones (Regla #0 + design contract)

- **Tiles financieros:** mostrar solo el importe `$ X` (se quita el `cantidad ·` de la izquierda) en "Por cobrar" y "Por liquidar a técnicos".
- **Inicio = accionables + Rendimiento:**
  - Fila **accionable** (arriba, como hoy): lo que requiere acción — activas, urgentes +24 h, inbox, solicitudes, por cobrar, por liquidar (según rol).
  - Sección **"Rendimiento"** (reemplaza a "Gestiones en curso"): tiles de análisis (medianas + mes) + gráficos, según rol:
    - Operativa (admin, gestor de mantenimiento): "Primera respuesta (mediana)", "Resolución (mediana)" + gráficos "Gestiones por etapa" y "Resolución mediana por especialidad".
    - Finanzas (admin, gestor administrativo): "Resueltas este mes", "Cobrado este mes", "Fee inmobiliaria este mes".
- **Se elimina "Gestiones en curso"** (era un espejo parcial del tablero, sin valor accionable claro — el tablero está a un click).
- **Menú:** se quita "Métricas" de los 3 roles. `/metricas` **redirige** al Inicio del rol (`RUTA_POR_ROL`) para no romper enlaces viejos.

## Alcance

### `components/paneles/inicio-rol.tsx`
- Props: se quitan `acciones`/`tituloAcciones`/`vacioAcciones`; se agrega `metricas`. Debajo de los tiles accionables, renderiza `<PanelMetricas metricas={metricas} />`.

### Nuevo `components/metricas/panel-metricas.client.tsx`
- Encabezado "Rendimiento" + tiles de análisis (role-aware por `metricas.rol`) + los dos gráficos (recharts) — refactor del contenido de `dashboard.client.tsx` (sin los tiles accionables, que ya están arriba).

### `app/admin/page.tsx`, `app/gestion/page.tsx`, `app/administracion/page.tsx`
- Pasan `metricas` a `InicioRol`; se quitan los args de `acciones`. En `administracion`, los tiles "Cobrado este mes" y "Fee inmobiliaria este mes" salen de la fila accionable (pasan a "Rendimiento").

### `features/auth/types.ts`
- Se quita `{ href: "/metricas", label: "Métricas" }` de `administrador`, `gestor_mantenimiento`, `gestor_administrativo`.

### `app/metricas/page.tsx`
- Pasa a redirigir a `RUTA_POR_ROL[rol]`. Se elimina `components/metricas/dashboard.client.tsx` (queda sin uso; su lógica de gráficos vive ahora en `panel-metricas`).

## Criterios de aceptación
1. En el Inicio de cada rol se ven los gráficos y métricas de rendimiento que antes estaban en /metricas, sin duplicar los tiles accionables.
2. "Métricas" ya no aparece en el menú lateral de ningún rol; entrar a `/metricas` redirige al Inicio del rol.
3. "Por cobrar" y "Por liquidar a técnicos" muestran solo el importe (sin el número de la izquierda).
4. "Gestiones en curso" ya no está.
5. `npx tsc --noEmit` verde y sin errores de eslint en los archivos tocados.

## Fuera de alcance
- Cambiar el cálculo de las métricas (service intacto).
- Nuevos gráficos o KPIs.

## Dev Agent Record
- **Commit:** _(pendiente)_
- **Archivos:** nuevo `components/metricas/panel-metricas.client.tsx`; `components/paneles/inicio-rol.tsx` (props: `metricas` en vez de `acciones`; embebe PanelMetricas); `app/{admin,gestion,administracion}/page.tsx` (pasan `metricas`, sin `acciones`; administración saca cobrado/fee de arriba); `features/auth/types.ts` (Métricas fuera del nav en 3 roles); `app/metricas/page.tsx` (redirect a `RUTA_POR_ROL`); eliminado `components/metricas/dashboard.client.tsx`.
- **Verificación (navegador real, sesión admin):** Inicio muestra fila accionable (Gestiones activas, Urgentes, Inbox, Solicitudes, Por cobrar $ 0, Por liquidar $ 0) + sección "Rendimiento" (Primera respuesta, Resolución, Resueltas/Cobrado/Fee del mes) + los 2 gráficos. Menú sin "Métricas"; sin "Gestiones en curso"; importes sin el número a la izquierda. `/metricas` redirige a `/admin`. `tsc`+`eslint` verdes. (Único error de consola: "unique key prop" en SidebarStaff, preexistente y ajeno.)
