# STORY-941 — "Cobro" en vez de "Facturación" + sección Administración con alta/edición unificada en la propiedad (v1.1)

**Estado:** ✅ done (commit `bb70bd6`) · **Origen:** Fausti (2026-07-12), cards 1 y 2 del tablero. Decisiones: (1) la etapa se llama **Cobro** — no emitimos facturas; (2) el menú "Cartera" pasa a **"Administración"** y la pantalla principal se titula **"Administraciones"**; (3) se eliminan los ABMs sueltos de propietarios/inquilinos — **el único camino de alta es la propiedad** (el wizard de STORY-922 ya lo contempla); la edición de datos y los casos "cambia el inquilino / cambia el propietario" de una propiedad existente se resuelven desde el detalle de la propiedad.

## Objetivo

Nomenclatura correcta (Cobro, Administración) y un solo modelo mental para personas: propietarios e inquilinos solo existen ligados a una propiedad — se crean, se editan y se reemplazan desde ahí.

## Alcance y decisiones

### A. Renombrado "Facturación" → "Cobro" (solo etiquetas — el id `facturacion_cobro` de la DB no se toca)

- `features/gestiones/types.ts` → `ETAPAS`: label "Facturación y cobro" → **"Cobro"** (alcanza stepper, tablero, archivadas, auditoría vía `etiquetaEtapa`).
- `components/gestiones/mis-trabajos.client.tsx` → grupo "En facturación" → "En cobro".
- `components/metricas/panel-metricas.client.tsx` → label `facturacion_cobro: "Facturación"` → "Cobro".
- `components/gestiones/detalle.client.tsx` → botón "Aprobar → Facturación" → "Aprobar → Cobro"; texto "interviene en Facturación…" → "interviene en Cobro…".

### B. Renombrado de la sección

- `features/auth/types.ts` → ítem de menú "Cartera" → **"Administración"** (admin y ambos gestores; href queda `/cartera/propiedades` — no se renombran rutas).
- `components/cartera/propiedades.client.tsx` → se elimina el kicker "Cartera"; h1 "Propiedades" → **"Administraciones"**.

### C. Eliminar ABMs sueltos + gestión de personas desde la propiedad

- **Se eliminan**: `app/cartera/propietarios/`, `app/cartera/inquilinos/`, `components/cartera/personas.client.tsx` y las tabs (`tabs.client.tsx` deja de existir; el layout ya no las renderiza — queda una sola pantalla).
- **Se extrae** el formulario de persona a `components/cartera/form-persona.client.tsx` (nombre/correo/teléfono/CUIL, reutiliza `guardarPersona`) para usarlo en el detalle de la propiedad.
- **Detalle de propiedad** (`app/cartera/propiedades/[id]` + componentes):
  - **Editar datos del propietario** (inline, `guardarPersona("propietarios", …)`).
  - **Cambiar propietario** (caso venta): elegir uno existente **o crear uno nuevo** ahí mismo → actualiza `propiedades.propietario_id` (server action nueva `cambiarPropietario` con `RefPersona`, misma forma que el wizard).
  - **Legajos**: al abrir legajo, además del select de inquilinos existentes, modo **"Inquilino nuevo"** (crea la persona y abre el legajo en la misma acción — `abrirLegajo` pasa a aceptar `RefPersona`). Editar datos del inquilino vigente inline.
- La búsqueda de personas sueltas (STORY-925) se pierde con las pantallas — la búsqueda de propiedades ya busca por propietario e inquilino, que es como se llega en el modelo nuevo.

### D. Lo que NO cambia

- Rutas (`/cartera/*` queda como está — solo cambian labels).
- `guardarPersona` / `cambiarEstadoPersona` / wizard `/cartera/nueva` (STORY-922) siguen como están.
- El id de etapa `facturacion_cobro` en DB, eventos históricos y métricas.

## Criterios de aceptación

1. Ninguna pantalla muestra "Facturación" — la etapa se lee "Cobro" en stepper, tablero, home del técnico, informes y detalle.
2. El menú dice "Administración"; la pantalla lista se titula "Administraciones" sin kicker "Cartera"; no existen más las tabs ni las páginas de propietarios/inquilinos sueltos.
3. Desde el detalle de una propiedad puedo: editar datos del propietario, cambiar el propietario (existente o nuevo), abrir legajo con inquilino existente **o nuevo**, y editar los datos del inquilino vigente.
4. `tsc` + eslint + `next build` verdes.

## Dev Agent Record
- **Estado:** ✅ done (2026-07-12). Commit `bb70bd6` en main (rebaseado sobre el trabajo de Giuliano — renumerada desde el número original por choque con sus stories 938-940), deploy automático en Vercel verificado.
- **Archivos:**
  - `features/gestiones/types.ts` — etapa `facturacion_cobro` label "Cobro".
  - `components/gestiones/mis-trabajos.client.tsx` ("En cobro"), `components/metricas/panel-metricas.client.tsx` ("Cobro"), `components/gestiones/detalle.client.tsx` ("Aprobar → Cobro" + textos).
  - `features/auth/types.ts` — menú "Administración" (3 roles).
  - `components/cartera/propiedades.client.tsx` — título "Administraciones", sin kicker.
  - `components/cartera/persona-campos.client.tsx` (NUEVO) — SelectorPersona/CamposPersona/Segmentado/validar/ref extraídos del wizard + `FormEditarPersona`.
  - `components/cartera/alta-administracion.client.tsx` — importa las piezas compartidas; kicker "Administración".
  - `components/cartera/propietario.client.tsx` (NUEVO) — sección Propietario del detalle: editar datos + cambiar propietario (existente o nuevo).
  - `components/cartera/legajos.client.tsx` — abrir legajo con inquilino existente **o nuevo**; datos y edición del inquilino vigente.
  - `features/cartera/service.ts` — `abrirLegajo` acepta `RefPersona`; nueva `cambiarPropietario`; selects de propiedad/legajos con persona completa; revalidates actualizados.
  - `features/cartera/types.ts` — `Legajo.inquilino`.
  - ELIMINADOS: `app/cartera/propietarios/`, `app/cartera/inquilinos/`, `components/cartera/personas.client.tsx`, `components/cartera/tabs.client.tsx`; layout sin tabs.
- **Verificación:** `tsc` + eslint + `next build` verdes. E2E con Playwright: menú "Administración" y título "Administraciones" OK; detalle de propiedad con sección Propietario (editar/cambiar) OK; alta de inquilino NUEVO + apertura de legajo + cierre OK (datos de prueba borrados); wizard `/cartera/nueva` sano tras el refactor; guard de roles intacto. Sin migraciones.

## v1.1 (2026-07-12) — "Total a facturar" → "Total a cobrar" (card #58 reabierta)

Ramiro encontró que en el cuadro de Acción de la etapa Cobro quedaba "Total a
facturar al {pagador}" (components/gestiones/finanzas.client.tsx). Se renombra a
"Total a cobrar al {pagador}". Barrido completo de "factur" en el código: los
únicos restos son legítimos — el enum interno `facturacion_cobro` de la DB (no
visible), la foto de la factura de los gastos imprevistos y la referencia de
factura del técnico en la liquidación (facturas reales, no la etapa).
