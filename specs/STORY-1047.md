# STORY-1047 — El pagador del cargo por cancelación se elige independiente del pagador de la obra (v1.0)

**Estado:** 🔨 en prueba · **Origen:** pedido de Fausti (2026-07-23). Diseñado en party mode (Mary·John·Winston·Sally·Amelia·Paige). Continuación conceptual de STORY-967/972 (cargo por cancelación) y STORY-1031/1037 (pagador de obra anclado).

## Problema

Al cancelar una gestión con un **cargo por cancelación** (etapas `presupuesto`/`en_ejecucion`/`conformidad`, STORY-967), la gestión pasa por **Cobro** y el cargo se le factura al **pagador de la obra** (`gestiones.pagador`). Eso mezcla dos decisiones distintas:

1. **Acople conceptual.** `pagador` es el pagador de la **obra**, y se **ancla al enviar/aprobar el presupuesto** (STORY-1037/943). Es un invariante que describe quién paga el trabajo. "Quién paga la cancelación" es otra decisión administrativa puntual, que puede no coincidir (p. ej. la cancelación la pide y la absorbe una parte distinta de la que iba a pagar la obra).

2. **Bug del pagador `null`.** Si se cancela en `presupuesto` **antes** de que se elija el pagador de la obra —el caso normal: `pagador` recién se ancla al enviar el presupuesto—, `gestion.pagador` es `null`. Entonces la pantalla de Cobro muestra el destinatario como *"responsable"/"pagador"* (fallback), el "Paga" del detalle dice **"Se define al presupuestar"** y la nota de cobro (STORY-972) se emite a un destinatario **indefinido**. Se está facturando un cargo a nadie.

   `etiquetaPagador(null)` devuelve `null` (`features/gestiones/types.ts:24`); las ramas de cancelación en `components/gestiones/finanzas.client.tsx` (`…?? "responsable"` / `…?? "pagador"`) y `components/gestiones/detalle.client.tsx:329` heredan ese vacío.

3. **Efecto lateral latente.** El bloque de cobro de cancelación usa `cobroDividido(gestion, cargo)`, que mira `gestion.pagador === "compartido"`. Si la obra era **compartida**, hoy el cargo de cancelación se **parte en dos** (dos notas, dos cobros) — cuando conceptualmente una cancelación se le cobra a **una** parte.

## Decisión de diseño (party mode + Fausti)

El pagador del cargo por cancelación se **elige explícito e independiente** de `pagador`, en el modal de cancelación.

1. **Columna nueva, no overload de `pagador`.** `gestiones.cargo_cancelacion_pagador pagador_gestion NULL`, con **CHECK** que solo admite `'inquilino'` o `'propietario'` (nunca `'compartido'`). No se toca `pagador` (anclado, ~19 consumidores). El *cuánto* (`cargo_cancelacion`) y el *a quién* (`cargo_cancelacion_pagador`) viven como dos columnas hermanas.

2. **Obligatorio en el modal cuando el cargo > 0.** El select aparece apenas el cargo pasa de cero y es **requerido**. Así el bug del `null` no se parchea: se vuelve **inconstruible** — no se puede llegar a Cobro con un cargo sin destinatario. Cargo = 0 → cancelación gratis directa, sin select (camino actual intacto).

3. **Solo inquilino o propietario.** Sin `compartido` (un cargo de cancelación no es un consorcio — Regla #0). Sin opción "la inmobiliaria absorbe": si la casa lo absorbe, el cargo es 0 y se usa el camino gratis existente. *Documentado-afuera:* si aparece el caso real "obra compartida cancelada con reparto del cargo", se diseña recién ahí.

4. **Default editable.** Si el pagador de la obra ya existe y es soltero (`inquilino`/`propietario`), el select arranca **pre-elegido en ese valor pero editable**. Si `pagador` es `null` o `compartido`, el select arranca **vacío** (y requerido).

5. **El destinatario de la cancelación lee la columna nueva.** Todo el circuito de Cobro de una cancelación (display "Paga", cartel del cargo, destinatario del cobro, nota PDF de STORY-972, email) usa `cargo_cancelacion_pagador` en vez de `pagador`. Como nunca es `compartido`, el cobro de cancelación es **siempre de una sola parte**: `cobroDividido` deja de aplicar en esa rama (se elimina el reparto del cargo).

## Alcance

### Migración (`story_1047_cargo_cancelacion_pagador`)
- `gestiones` + columna `cargo_cancelacion_pagador pagador_gestion NULL`.
- `CHECK (cargo_cancelacion_pagador IS NULL OR cargo_cancelacion_pagador IN ('inquilino','propietario'))`.
- Sin backfill: las gestiones ya canceladas quedan `null` (la columna solo se exige de aquí en más, en el modal).

### Código
- **`features/gestiones/service.ts`** — `cancelarGestion(gestionId, motivo, cargo?, cargoPagador?)`: con `cargo > 0`, validar que `cargoPagador ∈ {inquilino, propietario}` y persistirlo junto a `cargo_cancelacion` (mismo `UPDATE`, cliente de sesión / RLS gestor owner). Sin cargo, camino actual sin cambios.
- **`features/gestiones/service.ts`** (SELECT_DETALLE, ~línea 332): agregar `cargo_cancelacion_pagador` al select y al mapeo del tipo `GestionDetalle`.
- **`features/gestiones/types.ts`**: `GestionDetalle.cargo_cancelacion_pagador: Pagador | null`.
- **`features/finanzas/service.ts`** (`datosDocumento`, ~líneas 182-221): en `esCancelacion`, el `pagadorEfectivo` es `g.cargo_cancelacion_pagador` (una sola parte), sin pasar por el reparto de obra. Ajustar el SELECT para traer la columna.
- **`components/gestiones/detalle.client.tsx`**: en el modal `CancelarGestion` (~línea 1855), agregar el `Select` de pagador del cargo, visible/requerido solo cuando `admiteCargo` y el input de cargo > 0; default al `gestion.pagador` si es soltero. Pasar el valor a `cancelarGestion`. El "Paga" del detalle (línea 322-330) para una gestión en Cobro de cancelación debe mostrar `cargo_cancelacion_pagador`, no `pagador`.
- **`components/gestiones/finanzas.client.tsx`**: en la rama `cargo_cancelacion != null` (~línea 596), el cartel "Cargo por cancelación a cobrar al …", el `destinatarioEtiqueta` de `EnvioDocumento` y el `pagador` del `FormCobro` leen `gestion.cargo_cancelacion_pagador`. Quitar el `cobroDividido(gestion, cargo)` de esa rama: siempre `FormCobro` de una parte.

## Fuera de alcance

- **Compensación al técnico por su tiempo.** El flujo de cancelación con cargo hoy **saltea la liquidación** (el técnico cobra $0, el cargo es 100% de la casa — STORY-967 decisión #3). Fausti confirmó dejarlo **fuera de esta story** (2026-07-23): es un rediseño del flujo de liquidación, no un cambio de destinatario. Se retoma con un caso real si aparece.
- **Compartido / reparto del cargo de cancelación** (ver decisión #3). *Idea diferida (Fausti, 2026-07-23, tras el E2E):* cuando la obra ya era compartida, ofrecer una 3ª opción "inquilino y propietario" que reparta el cargo por el mismo `pagador_pct_inquilino` reutilizando `repartoGestion`/`cobroDividido`/`CobroPorPartes`. Se dejó fuera por ahora ("si ya está listo, dejémoslo como está") — se retoma si hace falta.
- **Opción "la inmobiliaria absorbe"** como semántica de pago explícita (se cubre con cargo = 0).

## Criterios de aceptación

1. **Independencia:** al cancelar con cargo > 0 en `presupuesto`/`en_ejecucion`/`conformidad`, el modal exige elegir **inquilino o propietario** para el cargo. La elección **no** depende ni modifica `pagador` (el de la obra).
2. **Bug del `null` resuelto:** cancelar en `presupuesto` con `pagador` aún `null` y cargo > 0 → en Cobro el "Paga"/destinatario muestra la parte elegida (nunca "Se define al presupuestar" ni "responsable"); la nota PDF y el email salen a esa parte con su email.
3. **Default editable:** si la obra ya tiene pagador soltero, el select del cargo viene pre-elegido en ese valor y se puede cambiar. Si es `null`/`compartido`, arranca vacío y es requerido.
4. **Obra compartida cancelada:** el cargo se cobra a **una** parte (la elegida), en **un** solo `FormCobro`/nota — no se parte en dos.
5. **Sin cargo intacto:** cancelar con cargo 0/vacío sigue igual (sin select, directo a `cancelada`).
6. **Cobro cierra igual:** registrar el cobro del cargo deja la gestión `cancelada` con `cobrado_monto = cobrado_fee = cargo` (STORY-967 sin cambios en la imputación económica).
7. `tsc`/eslint verdes.

## Dev Agent Record

- **Commit:** `d06c4ec` (2026-07-23).
- **Migración:** `story_1047_cargo_cancelacion_pagador` aplicada — columna `gestiones.cargo_cancelacion_pagador public.pagador_gestion` + `CHECK (… IN ('inquilino','propietario'))`. Sin backfill.
- **Archivos:**
  - `features/gestiones/types.ts`: `GestionDetalle.cargo_cancelacion_pagador: Pagador | null`.
  - `features/gestiones/service.ts`: `cargo_cancelacion_pagador` en el SELECT del detalle + tipo de fila + mapeo; `cancelarGestion(gestionId, motivo, cargo?, cargoPagador?)` valida `cargoPagador ∈ {inquilino, propietario}` cuando hay cargo, lo persiste con `cargo_cancelacion` y lo limpia en el rollback.
  - `features/finanzas/service.ts` (`datosDocumento`): `cargo_cancelacion_pagador` en el SELECT; en `esCancelacion` no se calcula `reparto` (no se divide) y `pagadorEfectivo = cargo_cancelacion_pagador` (con fallback a propietario si el inquilino ya no está).
  - `components/gestiones/detalle.client.tsx`: modal `CancelarGestion` con `Select` "¿A quién se le cobra el cargo?" (visible/requerido solo con cargo > 0; opciones propietario + inquilino si hay; default editable al pagador de obra soltero); el "Paga" del detalle muestra `cargo_cancelacion_pagador` ("Paga la cancelación") en una cancelación con cargo.
  - `components/gestiones/finanzas.client.tsx`: la rama `cargo_cancelacion != null` lee `cargo_cancelacion_pagador` en el cartel, `EnvioDocumento` y `FormCobro`; se eliminó `cobroDividido`/`CobroPorPartes` de esa rama (el cargo es siempre de una parte).
  - `features/finanzas/service.ts` (`registrarCobro`): **fix hallado en el E2E** — `esRepartido` ahora exige `cargoCancelacion == null`. Antes, cancelar una obra **compartida** con cargo llegaba a Cobro y `registrarCobro` calculaba el reparto sobre el pagador de la OBRA (compartido) → pedía "Indicá qué parte está pagando" y no dejaba cobrar. Una cancelación nunca se cobra dividida.
- **Verificación:** `tsc --noEmit` y `eslint` verdes. **E2E en navegador (2026-07-23, admin, data real):**
  - #85 (`presupuesto`, `pagador` null): el detalle mostraba "Se define al presupuestar"; al cancelar con cargo $5.000 apareció el select requerido (arrancó vacío, sin opción "Compartido"), se eligió Propietario → Cobro mostró "Paga la cancelación: Propietario", cartel/nota "a cobrar al propietario"; registrado → `cancelada`, `cargo_cancelacion_pagador='propietario'`, `cobrado_monto=cobrado_fee=5000`, `pagador` sigue null, auto-archivada.
  - #119 (obra `compartido` 30/70): al cancelar con cargo $8.000 el select arrancó **vacío** (sin default) y ofreció **Propietario + Inquilino, sin Compartido**; se eligió Inquilino → Cobro mostró **un solo** `FormCobro` "a cobrar al inquilino" (no dividido); registrado → `cancelada`, `cargo_cancelacion_pagador='inquilino'`, `cobrado 8000`, `pagador='compartido'` intacto. (Este escenario destapó el fix de `registrarCobro`.)
