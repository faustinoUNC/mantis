# STORY-981 — ComboFiltrable en todos los selects que crecen con los datos

**Estado:** ✅ done · **Origen:** pedido de Fausti tras STORY-980 v1.3 ("quedó muy bueno — fijate en dónde más del sistema podríamos aplicar esto"). Barrido completo de los desplegables de la app + modo formulario para el componente. Giuliano ya había migrado por su cuenta el selector de Propiedad de Crear gestión (commit `feb8805`) — esta story lo integra y corrige.

## Criterio de selección (barrido completo de la app)

**Se migra** todo select cuya lista **crece con datos reales de la DB** y hoy no tiene búsqueda. **NO se migra** lo fijo y chico (urgencia 2, roles 3, medios de cobro 4 / liquidación 7, períodos 4, días 7, orden 2, "buscar por") ni los pickers con otro patrón: técnico al asignar (tarjetas con scorecard), especialidades del técnico (checkboxes multi), etapa del técnico (bottom-sheet mobile). **Especialidad** en Crear gestión queda como select nativo: catálogo acotado (~12), no duele (Regla #0).

## 1. ComboFiltrable — modo formulario

El componente nació para filtros (STORY-980 v1.3) donde "Todos" es una opción real. En un campo de formulario requerido esa opción vacía no tiene sentido — el workaround de `feb8805` (`textoTodos="Buscar por dirección…"`) dejaba una **opción falsa** en el desplegable que además limpiaba la selección, y un encabezado "Propiedades" redundante en una lista homogénea. Cambios de API (retrocompatibles):

- `textoTodos?: string | null` — `null` = **sin opción vacía** (campo de formulario). Default `"Todos"` (filtros, como hasta ahora).
- `placeholder?: string` — separado del label de la opción vacía. Default: `textoTodos ?? "Buscar…"`.
- `opciones?: Opcion[]` — atajo para lista plana **sin encabezados de grupo** (equivale a `grupos=[{label:"", …}]`; un grupo con `label: ""` no renderiza encabezado).

La validación de requerido queda en el form (patrón de `feb8805`: error visible si no se eligió), no en el componente.

## 2. Dónde se aplica

| Pantalla | Campo | Lista (crece con) | Modo |
|---|---|---|---|
| Crear gestión — tablero (`FormNueva`) | Propiedad | cartera completa | formulario (fix del uso de `feb8805`) |
| Crear gestión — inbox (desde reporte) | Propiedad | cartera completa | formulario |
| `SelectorPersona` (cubre **3** pantallas: alta de administración → propietario, legajos → inquilino, cambiar propietario) | Persona | personas de cartera | formulario, placeholder "Buscar por nombre…" |
| Tablero (admin) | Filtro Gestor | empleados-gestores | filtro, "Todos los gestores" |
| Detalle de gestión (admin) | Reasignar gestor | empleados-gestores | formulario, placeholder "Elegir…" |

Cambio de comportamiento aceptado en `SelectorPersona`: el estado del id arranca **vacío** (antes se inicializaba en la primera persona para calzar con el select nativo — que igual mostraba a alguien que el estado no tenía si el init era ""). Con placeholder explícito, elegir es una decisión consciente; `validarPersona` ya cubre el vacío ("Elegí un {quien} de la lista.").

## Criterios de aceptación

1. En Crear gestión (tablero e inbox) se tipea parte de la dirección y la lista se achica; el desplegable NO tiene opción vacía ni encabezado de grupo; enviar sin elegir muestra error claro.
2. Propietario/inquilino en cartera (las 3 pantallas) se eligen tipeando el nombre; sin selección el submit avisa; el modo "Cargar nuevo" no cambia.
3. El filtro Gestor del tablero (admin) filtra tipeando y conserva la opción "Todos los gestores"; reasignar gestor en el detalle funciona igual que antes pero buscable.
4. Los filtros de Auditoría (STORY-980) siguen exactamente iguales (retrocompatibilidad de la API).
5. Los selects fijos (urgencia, roles, medios, períodos, especialidad de Crear gestión) quedan como estaban.
6. `tsc` + `eslint` verdes.

## Dev Agent Record

- **Archivos:** `components/ui/combo-filtrable.client.tsx` (modo formulario: `textoTodos` nullable, `placeholder`, `opciones` plano), `components/gestiones/tablero.client.tsx` (fix Propiedad + filtro Gestor), `components/inbox/inbox.client.tsx` (Propiedad), `components/cartera/persona-campos.client.tsx` (`SelectorPersona`), `components/cartera/{alta-administracion,legajos,propietario}.client.tsx` (init de id a `""`), `components/gestiones/detalle.client.tsx` (`ReasignarGestor`).
- **Verificación:** `tsc` + `eslint` verdes. E2E en navegador (2026-07-16): Crear gestión → "urqu" filtra a "justo jose de urquiza 193", sin opción falsa ni encabezado; filtro Gestor del tablero → "uno" filtra, conserva "Todos los gestores" y el kanban re-filtra al elegir; Cambiar propietario → "mar" encuentra "María del Carmen" y "Sucesión de Elena Marchetti" (sin tildes), y Confirmar sin elegir muestra "Elegí un propietario de la lista."; Reasignar gestor renderiza el combo con el botón deshabilitado hasta elegir. Auditoría sin regresión. Consola limpia.
