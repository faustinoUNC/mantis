# STORY-938 — Bug: el técnico no ve quién es el gestor ni el contacto del cliente en el detalle de su gestión (v1.0)

**Estado:** 🚧 en desarrollo (código + RLS aplicados, falta verificación visual) · **Origen:** Giuliano — reporte con captura de la vista mobile del técnico (`/gestiones/[id]`, gestión "Inodoro pierde agua 2"): el campo **Gestor** muestra "—" en vez del nombre, y no hay ningún dato de contacto del cliente para coordinar la visita. Alcance acordado en el chat: (1) el técnico debe ver el nombre del gestor de sus gestiones asignadas; (2) debe ver el contacto (teléfono/email) del inquilino si la gestión tiene uno, y si no (propiedad sin legajo vigente), el del propietario como respaldo.

> Renombrada de STORY-931 a STORY-938 al mergear: el número 931 ya lo había usado Faustino para otra story ("Especialidades del técnico en el scorecard de asignación", no relacionada) que se pusheó mientras esta se desarrollaba en paralelo. Contenido sin cambios, solo la numeración.

## Diagnóstico

### (1) "Gestor: —"
El campo se pide en la query (`SELECT_RESUMEN`, `features/gestiones/service.ts:69`: `gestor:usuarios!gestiones_gestor_id_fkey(nombre)`) y se mapea con fallback `gestor_nombre: gestor?.nombre ?? "—"` (`normalizarFila`, línea 59). El fallback es lo que se ve — indica que el join a `usuarios` vuelve `null` para la sesión del técnico. La RLS base de `usuarios` (STORY-102) es "cada usuario lee solo su propia fila; admin lee todas". STORY-404 sumó `staff_mant_lee_usuarios_tecnicos` (gestor→técnico), pero no existe la política inversa (técnico→gestor). Es el mismo patrón que **STORY-205** ya resolvió para `propiedades` (el técnico no podía leer la dirección de sus propios trabajos por ser staff-only): la solución allá fue una policy acotada `tecnico_lee_propiedades_asignadas`, limitada a las filas de gestiones asignadas a él.

### (2) Sin contacto del cliente
`propietarios` e `inquilinos` ya tienen `telefono`/`email` (`features/cartera/types.ts`, interfaz `Persona` común a ambas), pero **ninguna query de `gestiones/service.ts` los pide** — ni `SELECT_RESUMEN` ni `obtenerGestion()` — para ningún rol, no solo para técnico. Además, aunque se pidieran, `propietarios` e `inquilinos` son staff-only por diseño (STORY-201/STORY-202: "el técnico no puede acceder ni leer (RLS por rol)"), así que el técnico necesita una policy acotada nueva, análoga a `tecnico_lee_propiedades_asignadas` pero sobre estas dos tablas, limitada a los inquilinos/propietarios de SUS gestiones asignadas.

**Dato ya cargado pero no renderizado, distinto del punto anterior:** `GestionResumen` ya trae `propietario_nombre` e `inquilino_nombre` (agregados en STORY-926 para el buscador del tablero) pero `DatosGestion` (`components/gestiones/detalle.client.tsx:109-146`) nunca los muestra — no hay campo "Propietario"/"Inquilino" en la tarjeta de datos, para ningún rol. Falta confirmar contra la base viva (Supabase MCP, no había conexión disponible al escribir esta story) si el técnico ya puede leer esos dos campos hoy (el buscador de STORY-926/927 los usa en el home del técnico) o si también vuelven `null` por RLS — impacta si alcanza con agregar la policy de contacto o si además hace falta ampliar `tecnico_lee_...` para nombre. Verificar al implementar.

### Decisión de negocio (confirmada con el usuario en el chat)
Mostrar el contacto de **inquilino si existe la gestión con legajo vigente; si no, el del propietario** (propiedad desocupada, `legajo_id` null). Mismo criterio pagador/legajo que ya usa el sistema en otros lados (p. ej. STORY-924, `pagador_sugerido` por causa).

## Alcance

- **RLS (Supabase, vía MCP):**
  - Nueva policy `tecnico_lee_gestor_asignado` (o ampliar la existente) sobre `usuarios`: el técnico lee `nombre` (no más) del `gestor_id` de gestiones donde `tecnico_id = auth.uid()`.
  - Nueva policy sobre `propietarios`: técnico lee la fila si es el `propietario_id` de una `propiedad_id` de una gestión asignada a él.
  - Nueva policy sobre `inquilinos`: técnico lee la fila si es el `inquilino_id` de un `legajo_id` de una gestión asignada a él.
  - Seguir el patrón de `tecnico_lee_propiedades_asignadas` (STORY-205) — acotado a gestiones asignadas, no acceso general a cartera.
- **`features/gestiones/service.ts`:**
  - `SELECT_RESUMEN` (o un select nuevo solo para `obtenerGestion`, para no pesar el tablero): agregar `propietarios(email, telefono)` y `legajos(inquilinos(email, telefono))`.
  - `normalizarFila` / `obtenerGestion`: exponer `propietario_contacto: { email, telefono } | null` e `inquilino_contacto: { email, telefono } | null` (o resolver ya en el service cuál de los dos mostrar, siguiendo el criterio inquilino-si-hay-si-no-propietario, y exponer un solo `contacto_cliente`).
- **`features/gestiones/types.ts`:** campo(s) nuevos en `GestionDetalle` (no en `GestionResumen` — no hace falta en el tablero, solo en el detalle).
- **`components/gestiones/detalle.client.tsx`:** `DatosGestion` — agregar campo "Contacto" (nombre + teléfono + email, con `tel:`/`mailto:` si corresponde) y corregir que "Gestor" deje de caer en "—" para el técnico.

## Criterios de aceptación
1. El técnico, en el detalle de una gestión asignada a él, ve el nombre real del gestor (no "—").
2. El técnico ve el contacto (teléfono y/o email) de la persona a coordinar: inquilino si la gestión tiene legajo vigente, propietario si no.
3. Gestor y admin siguen viendo lo mismo que hoy (sin regresión).
4. El técnico NO puede leer cartera fuera de sus gestiones asignadas (las policies nuevas están acotadas, no abren `propietarios`/`inquilinos`/`usuarios` en general).
5. `tsc` verde, eslint verde, `next build` OK.

## Dev Agent Record

**Hecho (código, este PC):**
- `features/gestiones/types.ts`: nueva interfaz `ContactoCliente` + campo `contacto_cliente: ContactoCliente | null` en `GestionDetalle`.
- `features/gestiones/service.ts`: `SELECT_DETALLE` (variante de `SELECT_RESUMEN` solo para `obtenerGestion`, con `propietarios(email, telefono)` y `legajos(inquilinos(email, telefono))` — el tablero no la usa, no pesa la lista). Helper `resolverContacto()` aplica el criterio inquilino-si-hay-si-no-propietario y arma `contacto_cliente`.
- `components/gestiones/detalle.client.tsx`: `DatosGestion` agrega un campo (después de "Propiedad") con nombre + `tel:`/`mailto:` del contacto, solo si `contacto_cliente` no es null.
- Verificado: `tsc --noEmit` limpio, `eslint` limpio, `next build` compila y tipa OK (el build completo no terminó en este entorno por falta de env vars de Supabase para el prerender — no relacionado con este cambio).
- Rebase sobre el trabajo de Faustino (STORY-932 a 937, mismo día): mergeados sin pérdidas `features/gestiones/service.ts` (SELECT_DETALLE + los campos nuevos de él en `obtenerGestion`), `types.ts` y `detalle.client.tsx` (auto-merge limpio).

**RLS aplicada por Giuliano vía SQL Editor de Supabase (2026-07-12)** — las 3 policies de abajo, patrón de `tecnico_lee_propiedades_asignadas` (STORY-205). Sin conexión a Supabase MCP en esta sesión para verificarlo yo directamente; pendiente confirmación visual en la app (técnico de prueba, gestión "Inodoro pierde agua 2") tras el deploy de este commit.

```sql
create policy tecnico_lee_gestor_asignado
on usuarios for select
to authenticated
using (
  exists (
    select 1 from gestiones g
    where g.gestor_id = usuarios.id
      and g.tecnico_id = auth.uid()
  )
);

create policy tecnico_lee_propietarios_asignados
on propietarios for select
to authenticated
using (
  exists (
    select 1 from gestiones g
    join propiedades p on p.id = g.propiedad_id
    where p.propietario_id = propietarios.id
      and g.tecnico_id = auth.uid()
  )
);

create policy tecnico_lee_inquilinos_asignados
on inquilinos for select
to authenticated
using (
  exists (
    select 1 from gestiones g
    join legajos l on l.id = g.legajo_id
    where l.inquilino_id = inquilinos.id
      and g.tecnico_id = auth.uid()
  )
);
```

Falta también: confirmar contra la base viva si `propietario_nombre`/`inquilino_nombre` de `GestionResumen` ya son legibles por el técnico hoy (nota del Diagnóstico §2) — no impacta esta story (usa columnas propias, no esos campos), pero quedaba como duda abierta.
