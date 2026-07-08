# STORY-910 — Búsqueda, filtros y paginación en listados de alto volumen + fix de scroll del tablero (v1.0)

**Estado:** 🚧 en desarrollo · **Fecha:** 2026-07-07
**Origen:** Prueba de carga (50 gestiones / 50 técnicos / 50 especialidades sembradas con marcador `[CARGA]`). Con volumen alto, los listados (técnicos, especialidades, empleados) se vuelven una tira larga sin forma de buscar/acotar, y el **tablero** tiene un bug de scroll: cuando una columna tiene muchas tarjetas, la barra de scroll horizontal queda al fondo de la página y **no se puede desplazar de costado sin bajar hasta el final**.

## Objetivo

Que el sistema siga siendo usable con mucha data: poder **buscar** y **acotar por fecha** en los listados, **paginar** las tablas largas, que el **admin** pueda filtrar el tablero por **gestor asignado**, y que el **scroll horizontal del tablero** sea siempre alcanzable (columnas con scroll vertical propio, barra horizontal a la vista).

## Decisiones de diseño (Regla #0 — lo más simple que cumple)

- **Filtrado client-side.** Los listados ya cargan el set completo desde el server. A la escala del proyecto (cientos de filas) filtrar/paginar en el cliente con `useMemo` es lo más simple y evita sumar params de servidor, queries de `count` y estados de carga. Si algún día hay miles de filas se revisa; hoy no hace falta.
- **Sin abstracción nueva grande.** Se comparte solo lo justo para no repetir/derivar: un `Paginador` presentacional, una barra `FiltrosLista` (búsqueda + rango de fecha opcional + slot `extra` para controles propios), un hook `usePaginado` (matemática de página) y dos helpers puros de filtrado. Todo compuesto con los átomos `Input`/`Select` existentes.
- **Tablero sin paginador.** Es un kanban; la "paginación" natural es el scroll vertical por columna. El pedido de paginador fue para las tablas (técnicos/especialidades/empleados), no para el tablero.
- **Filtro de fecha "donde corresponda".** Se agrega donde hay una fecha con sentido para el usuario: tablero (fecha de ingreso), técnicos (fecha de registro), empleados (fecha de alta). **Especialidades no lleva filtro de fecha** (no hay una fecha relevante que se muestre) — solo búsqueda + paginación.

## Alcance

### Nuevo — helpers puros `shared/utils/filtros.ts`
- `coincideTexto(consulta: string, ...campos: (string | null | undefined)[]): boolean` — normaliza (minúsculas, sin acentos) y devuelve si la consulta aparece en alguno de los campos. Consulta vacía → `true`.
- `enRangoFecha(fechaISO: string, desde: string, hasta: string): boolean` — compara la fecha (parte `YYYY-MM-DD`) contra el rango; extremos vacíos = sin límite. `hasta` es inclusivo.

### Nuevo — `components/ui/paginador.client.tsx`
- Componente presentacional puro: props `{ pagina, totalPaginas, total, desde, hasta, onAnterior, onSiguiente }`.
- Muestra "**{desde}–{hasta} de {total}**" + `{pagina}/{totalPaginas}` + botones **Anterior** / **Siguiente** (átomo `Button` `variante="secundario"`, deshabilitados en los extremos). No se renderiza si `total` cabe en una página. Respeta el design contract (sin sombras, mobile-first).

### Nuevo — `components/ui/filtros-lista.client.tsx`
- Barra de filtros reutilizable: input de **búsqueda** (controlado), **rango de fecha** opcional (dos `<input type=date>` Desde/Hasta) y un slot `extra` para controles propios de la pantalla (p. ej. el select de gestor del tablero).

### Nuevo — `shared/hooks/use-paginado.ts`
- Hook `usePaginado(items, porPagina=12)`: centraliza el cálculo de página (slice, clamp, rango) y devuelve `{ pageItems, setPagina, paginadorProps }`. Cada pantalla resetea a página 1 vía `useEffect` cuando cambian sus filtros.

### `components/tecnicos/tecnicos.client.tsx`
- Barra de filtros sobre la tabla: **búsqueda** (nombre / correo / especialidades), **rango de fecha** (fecha de registro = `creado_en`).
- **Paginación** (12 por página) bajo la tabla con `<Paginador>`.
- Orden actual (pendientes primero) se mantiene sobre el set filtrado; el badge "N solicitudes pendientes" sigue contando el **total** (no la página).
- Cambiar cualquier filtro resetea la página a 1.

### `features/tecnicos/service.ts` + `features/tecnicos/types.ts`
- Agregar `creado_en: string` a `TecnicoResumen` y al `select`/map de `listarTecnicos` (la columna ya existe en la tabla). Único cambio de datos de la story.

### `components/especialidades/especialidades.client.tsx`
- Barra de filtros: **búsqueda** (nombre). Sin filtro de fecha.
- **Paginación** (12 por página) con `<Paginador>`.

### `components/empleados/empleados.client.tsx`
- Barra de filtros: **búsqueda** (nombre / correo / rol vía `NOMBRE_ROL`), **rango de fecha** (fecha de alta = `creado_en`, ya disponible en `Empleado`).
- **Paginación** (12 por página) con `<Paginador>`.

### `components/gestiones/tablero.client.tsx`
- Barra de filtros sobre las columnas: **búsqueda** (descripción / dirección / especialidad / técnico), **rango de fecha** (`creado_en`), y **filtro por gestor asignado** — un `Select` con las opciones = gestores distintos presentes en las gestiones (por `gestor_nombre`), **visible solo si `rol === "administrador"`**.
- El filtro se aplica al set antes de repartir en columnas; los contadores por columna reflejan el set filtrado.
- **Fix de scroll horizontal:** la fila de columnas pasa a tener alto acotado al viewport (`h-[calc(100dvh-…)]`) y cada columna es `flex flex-col` con la lista de tarjetas en un contenedor `overflow-y-auto` propio. Así el board nunca supera el alto de la pantalla y la barra horizontal queda siempre a la vista, sin bajar hasta el final. El encabezado de cada columna (título + contador) queda fijo arriba de su scroll.

### Sin cambios en
- Servicios de especialidades, empleados y gestiones (salvo el `creado_en` de técnicos): el filtrado/paginado es UI.
- Lógica de negocio, RLS, `avanzar_etapa`, permisos por rol.

## Criterios de aceptación

1. **Técnicos:** la búsqueda filtra por nombre/correo/especialidad; el rango de fecha acota por fecha de registro; la tabla pagina de a 12 con "Anterior/Siguiente" y contador "X–Y de Z". El badge de pendientes cuenta el total.
2. **Especialidades:** la búsqueda por nombre filtra; la tabla pagina de a 12.
3. **Empleados:** búsqueda por nombre/correo/rol + rango de fecha de alta + paginación de a 12.
4. **Tablero:** búsqueda y rango de fecha filtran las tarjetas y actualizan los contadores por columna. Con sesión **admin** aparece el filtro por **gestor**; con gestor/otro rol **no** aparece.
5. **Scroll del tablero:** con muchas tarjetas en una columna, se puede desplazar horizontalmente entre columnas **sin** tener que bajar al fondo; cada columna scrollea vertical por su cuenta.
6. Todos los controles respetan el design contract (átomos existentes, sin sombras, un acento por significado) y funcionan en mobile (targets ≥44px). Cambiar filtros resetea a la página 1.
7. `npx tsc --noEmit` verde y sin errores de eslint en los archivos tocados.

## Fuera de alcance (Regla #0)
- Paginación/filtrado en el **servidor** (params, `count`, cursores): no hace falta a esta escala.
- Paginador en el **tablero** (es kanban → scroll por columna).
- Filtro de **estado** en las tablas (activo/pendiente/etc.) o de **etapa/urgencia** en el tablero: no se pidió; se puede sumar después si hace falta.
- Filtro de fecha en **especialidades**: no hay fecha relevante mostrada.
- Guardar/persistir filtros en la URL o entre sesiones: no se pidió.

## Dev Agent Record
- **Commit:** _(pendiente — sin commitear todavía)_
- **Archivos:**
  - Nuevos: `shared/utils/filtros.ts` (`coincideTexto`, `enRangoFecha`), `shared/hooks/use-paginado.ts` (`usePaginado`), `components/ui/paginador.client.tsx`, `components/ui/filtros-lista.client.tsx`.
  - `features/tecnicos/types.ts` + `features/tecnicos/service.ts`: `creado_en` en `TecnicoResumen`/`TecnicoDetalle` y en los `select`/map de `listarTecnicos` y `obtenerTecnico`.
  - `components/tecnicos/tecnicos.client.tsx`, `components/especialidades/especialidades.client.tsx`, `components/empleados/empleados.client.tsx`, `components/gestiones/tablero.client.tsx`: barra de filtros + paginación / filtro por gestor + fix de scroll.
- **Verificación (navegador real, sesión admin, dev server + Supabase prod, con la carga de prueba `[CARGA]`):**
  - **Tablero:** barra Buscar / Gestor / Desde / Hasta; buscar "termotanque" filtra a 5 tarjetas y los contadores por columna se recalculan. Fix de scroll medido en runtime: `document.scrollHeight - innerHeight = 0` (la página no scrollea vertical), fondo del board (708px) dentro del viewport (736px) → barra horizontal alcanzable sin bajar; `scrollWidth 2132 > clientWidth 912` (scroll X activo); columnas con `overflow-y-auto` propio (scroll vertical por columna). ✅
  - **Técnicos:** "1–12 de 52", Anterior deshabilitado en pág 1, Siguiente → "13–24 de 52"; búsqueda "tecnico 45" → 1 resultado y **resetea a pág 1** (paginador se oculta al caber en una página); badge "16 solicitudes pendientes" cuenta el total. ✅
  - **Especialidades:** "1–12 de 62", búsqueda por nombre, **sin** inputs de fecha (correcto). ✅
  - **Empleados:** barra con búsqueda + 2 inputs de fecha; tabla + paginación operativas. ✅
  - `npx tsc --noEmit` verde; `eslint` de los archivos tocados sin errores. (El único error de consola —"unique key prop" en `SidebarStaff`— es preexistente y ajeno a esta story.)
