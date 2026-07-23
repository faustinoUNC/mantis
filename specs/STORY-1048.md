# STORY-1048 — El técnico no ve el contacto del propietario en una propiedad desocupada (v1.0)

**Estado:** 📋 borrador · **Origen:** pedido de Fausti (2026-07-23). Diseñado en party mode (Mary·John·Winston·Sally·Amelia). Revisión conceptual de STORY-938/962 (contacto para coordinar la visita).

## Problema

En el detalle de una gestión, el técnico ve una tarjeta de contacto para coordinar la visita. La regla actual (`resolverContacto`, `features/gestiones/service.ts:124-144`, STORY-938/962): legajo vigente → **inquilino**; si no → **propietario**; si ninguno → nada.

El caso conflictivo es **propiedad desocupada** (sin legajo vigente): ahí el sistema le entrega al técnico el **teléfono y email personal del propietario** (`tel:`/`mailto:` clickeables, `detalle.client.tsx:284-313`).

Eso está mal por dos razones:

1. **El técnico no coordina con el dueño.** Cuando la propiedad está vacía, quien tiene las llaves y coordina el acceso es la **inmobiliaria**, no el propietario. Al dueño no hay que molestarlo — es una decisión de negocio de Fausti.
2. **Exposición de datos.** El técnico es un contratista externo. Entregarle el dato de contacto personal de alguien que ni siquiera participa de la coordinación de la visita es exponer un dato que no le corresponde.

La STORY-938 preguntó "¿a quién muestro?" y respondió "al que queda cuando no hay inquilino". Nunca preguntó si el técnico **debe** tener ese contacto. Esta story corrige eso.

## Decisión de diseño (party mode + Fausti)

En la **vista del técnico**, cuando la propiedad está desocupada, el contacto del propietario se **reemplaza por una línea de coordinación genérica** — sin nombre, sin teléfono, sin email:

> 🔑 **Propiedad desocupada · Coordiná el acceso con la inmobiliaria**

1. **Solo afecta al técnico.** Gestor y admin **siguen viendo al propietario** con sus datos, igual que hoy — porque para ellos el dueño de una propiedad vacía **es el pagador** de la obra (le mandan el presupuesto y le cobran, STORY-943/1037). Ocultárselo rompería el circuito de presupuesto/cobro. Esto rompe **a propósito** la simetría "todos ven el mismo contacto" que la 938 dejó como criterio de regresión.

2. **Mensaje genérico, sin nombrar a nadie** (decisión de Fausti vía AskUserQuestion, 2026-07-23). Se evaluó nombrar al gestor responsable (ya viaja en la gestión, gratis) pero se eligió el mensaje impersonal por Regla #0. Nota de implementación: **el sistema no guarda teléfono de empleados** (`usuarios` es `nombre` + `rol`; no hay columna `telefono` en empleados/auth) — aunque quisiéramos mostrar "el número de la inmobiliaria", no existe. La coordinación pasa por el canal interno (el gestor que asignó al técnico, notificaciones).

3. **Sin datos, sin botones.** La línea de coordinación **no** es una tarjeta de contacto: no lleva `tel:` ni `mailto:` (no hay a qué linkear). Es un texto tranquilo con el tono del contract (ícono de acceso, nada de rojo — no es un error).

4. **La propiedad ocupada no cambia para nadie.** Con legajo vigente, todos (incluido el técnico) siguen viendo al **inquilino**, como hoy.

## Alcance

**Sin migración. Sin tablas. Cero cambios de datos.** Es una regla de derivación en un solo lugar + una rama de render.

### Código

- **`features/gestiones/types.ts`** (`ContactoCliente`, ~línea 170): sumar el caso centinela `{ tipo: "inmobiliaria" }` (sin `nombre`/`telefono`/`email`). Se convierte en unión discriminada:
  ```ts
  export type ContactoCliente =
    | { tipo: "inquilino" | "propietario"; nombre: string; telefono: string | null; email: string | null }
    | { tipo: "inmobiliaria" }; // STORY-1048: técnico + propiedad desocupada
  ```
- **`features/gestiones/service.ts`** (`resolverContacto`, líneas 124-144): recibe el **rol** del que mira (ya disponible: `obtenerUsuarioActual()` se llama en `obtenerGestion`, `service.ts:386`). En la rama del propietario, si `rol === "tecnico"` devolver `{ tipo: "inmobiliaria" }` en vez de los datos del propietario. El resto de los roles y la rama del inquilino, sin cambios. La llamada en `service.ts:433` pasa `actual?.rol`.
- **`components/gestiones/detalle.client.tsx`** (`DatosGestion`, líneas 284-313): antes del bloque actual, una rama para `tipo === "inmobiliaria"` que renderiza la línea de coordinación (label "Acceso" + texto "Propiedad desocupada · Coordiná el acceso con la inmobiliaria", sin `tel:`/`mailto:`). El bloque inquilino/propietario existente queda igual para los demás casos.

### Consideraciones

- La derivación vive en **un solo lugar** (`resolverContacto`): nadie mete un `if (rol === "tecnico")` suelto en el componente (doctrina Winston).
- `gestor_id` nunca es null en este flujo (el gestor asigna antes de que exista un técnico), así que "propiedad vacía vista por un técnico" siempre tiene un responsable detrás por el canal interno — aunque no lo nombremos.

## Fuera de alcance / Descartado (documentado para no re-proponer)

- **Nombrar al gestor responsable** en la línea (`gestor_nombre` ya viaja): evaluado y **descartado** por Fausti a favor del mensaje genérico (Regla #0, 2026-07-23). Se retoma solo si un técnico real se queja de no saber a quién buscar.
- **Mostrar teléfono/email de la inmobiliaria o del responsable:** no hay teléfono de empleados en el modelo; sumar el email del gestor al SELECT se evaluó y se dejó afuera (mensaje impersonal elegido).
- **Ocultar el propietario también a gestor/admin:** descartado — el dueño es el pagador de la obra en propiedad vacía; gestor/admin lo necesitan.
- **Caso "el técnico sí necesita al dueño"** (dueño chico que abre su propia puerta): por política, la inmobiliaria coordina el acceso siempre. Documentado como **decisión consciente**, no olvido — que nadie lo "arregle" en seis meses.

## Criterios de aceptación

1. **Técnico + propiedad desocupada:** en el detalle de una gestión asignada de una propiedad **sin inquilino vigente**, el técnico ve la línea "Propiedad desocupada · Coordiná el acceso con la inmobiliaria" — **sin** nombre, teléfono ni email del propietario, y **sin** botones de llamar/escribir.
2. **Técnico + propiedad ocupada:** con inquilino vigente, el técnico sigue viendo al **inquilino** con su teléfono/email clickeables (STORY-938 intacta).
3. **Gestor/Admin + propiedad desocupada:** ven al **propietario** con nombre, teléfono y email, igual que hoy (sin cambios).
4. **Gestor/Admin + propiedad ocupada:** ven al inquilino, igual que hoy.
5. **Sin contacto:** si no hay ni inquilino vigente ni propietario, no aparece bloque de contacto para nadie (igual que hoy).
6. `tsc`/eslint verdes.

## Dev Agent Record

- **Commit:** `42c439a` (2026-07-23). Sin migración. `tsc --noEmit` y `eslint` verdes.
- **Verificación E2E** (navegador, dev local, data real, 2026-07-23):
  - Técnico + #108 **desocupada** (Ituzaingó 1435): "Propiedad desocupada · Coordiná el acceso con la inmobiliaria"; sin nombre/tel/email del propietario Alberto Sánchez; cero `tel:`/`mailto:`. ✅
  - Técnico + #120 **ocupada** (Belgrano 1288): "Inquilino: Paula Giordano" con `tel:351-7701309` + mailto (STORY-938 intacta). ✅
  - Admin + la **misma** #108 desocupada: "Propietario: Alberto Sánchez · 351-5551201 · email" (gestor/admin siguen viendo al dueño). ✅
  - La divergencia por rol quedó demostrada sobre la misma gestión.
- **Archivos:**
  - `features/gestiones/types.ts`: `ContactoCliente` pasó a unión discriminada — suma el centinela `{ tipo: "inmobiliaria" }` (sin datos).
  - `features/gestiones/service.ts`: `resolverContacto(g, rol)` recibe el rol; en la rama del propietario, `rol === "tecnico"` → `{ tipo: "inmobiliaria" }`. La llamada en `obtenerGestion` pasa `actual?.rol ?? null` (el usuario ya se resuelve ahí para la tenencia STORY-1040).
  - `components/gestiones/detalle.client.tsx` (`DatosGestion`): rama nueva para `tipo === "inmobiliaria"` → label "Acceso" + "Propiedad desocupada · Coordiná el acceso con la inmobiliaria", sin `tel:`/`mailto:`. El bloque inquilino/propietario queda igual para el resto.
  - `features/asistente/tools.ts` (**hallado por `tsc`**): la tool `contacto_para_visita` de Walter también leía `.nombre/.telefono` → con el centinela devuelve `{ tipo: "inmobiliaria", nota: "…coordinar el acceso con la inmobiliaria" }`. Coherente con la doctrina "el asistente nunca sabe más que la pantalla del rol" (STORY-1019): a un técnico, Walter tampoco le filtra al propietario.
