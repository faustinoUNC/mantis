# STORY-998 — Técnicos: filtro por estado (Todas / Pendientes / Aprobados / Rechazados) (v1.0)

**Estado:** ✅ done · **Origen:** Fausti (UX): en Técnicos poder filtrar por estado — ver todas, las aprobadas, las rechazadas o las pendientes. Debe ser coherente con lo que la página ya tiene (búsqueda + "Buscar por" + paginado + orden con pendientes primero + badge de solicitudes pendientes).

## Alcance

`components/tecnicos/tecnicos.client.tsx`: se agrega un **control segmentado** (mismo patrón que Auditoría/Finanzas: `flex rounded-md border overflow-hidden w-fit`) con **Todas · Pendientes · Aprobados · Rechazados**, encima del buscador. El estado elegido se suma al `useMemo` de `filtrados` (antes de la búsqueda y el orden), así se combina con el buscador, el "Buscar por" y el paginado ya existentes; al cambiar de estado se resetea la página (igual que consulta/campo).

- Se conserva el orden "pendientes primero" dentro del subconjunto filtrado y el badge global "N solicitudes pendientes" del encabezado (cuenta sobre todos, no sobre el filtro).
- El "Inhabilitado" no es un estado aparte (es un `aprobado` con `esta_activo=false`): cae dentro de "Aprobados", como hoy.
- Mensaje de tabla vacía: pasa de "coincide con la búsqueda" a "coincide con los filtros".

## Fuera de alcance

- No se toca el server/consulta (el filtrado es client, como el buscador actual).

## Criterios de aceptación

1. Hay un segmentado Todas/Pendientes/Aprobados/Rechazados; al elegir uno, la tabla muestra solo esos técnicos.
2. El filtro se combina con el buscador y el "Buscar por" (se aplican juntos) y resetea a la página 1.
3. El badge "N solicitudes pendientes" y el orden pendientes-primero siguen funcionando.
4. `tsc`/eslint verdes.

## Dev Agent Record

- **Commit:** `a869c97` (pusheado a main 2026-07-18).
- **Archivos:** `codigo/components/tecnicos/tecnicos.client.tsx`.
- **Verificación:** `tsc`/eslint verdes. E2E en el navegador: al tocar "Rechazados" la tabla muestra solo los 3 técnicos rechazados y el segmentado marca el activo en esmeralda; se combina con el buscador y el paginado.
