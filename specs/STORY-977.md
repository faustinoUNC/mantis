# STORY-977 — Adelanto de materiales al técnico (pre-ejecución, se descuenta en la liquidación)

**Estado:** ✅ código y migración listos, pendiente de verificación E2E · **Origen:** Giuliano (2026-07-15). Revive la necesidad de STORY-933 ("adelantos de obra"), descartada por Fausti el 2026-07-11 por complejidad — Giuliano confirma que ahora sí se quiere, pero con el diseño MÁS simple posible (Regla #0): **un solo campo**, no una tabla de adelantos con medio/anulación/notificación como proponía STORY-933 v1.0.

## Objetivo

La inmobiliaria puede darle al técnico plata para comprar materiales **antes de que rinda la obra**. Ese monto:
1. No puede superar el estimado de materiales del presupuesto aprobado.
2. Se resta del total a liquidarle al técnico al final (ya se le dio esa parte).

**No toca la facturación al pagador** — el total a cobrar sigue siendo `costo_final + cargo_admin`, intacto. Solo cambia cuánto queda pendiente de pagarle al técnico.

## Por qué es distinto de STORY-933 (y por qué ahora sí)

STORY-933 proponía una tabla `adelantos` (N entregas por gestión, medio de pago, anulación soft, notificación al técnico, bloqueo de cancelación). Fausti lo descartó por complejidad. Giuliano ahora pide explícitamente **"solo una casilla"** — un único monto, editable, sin historial de entregas parciales ni medio de pago. Eso es sustancialmente más simple y es lo que se implementa acá.

## Alcance y decisiones

### A. Modelo de datos — una columna, no una tabla

- `gestiones.adelanto_materiales numeric null` — el monto adelantado (null/0 = no se adelantó nada).
- Sin tabla nueva, sin RLS nueva: se escribe con el mismo patrón que `cargo_admin`/`materiales_total` (admin client tras validar rol, tal como ya hace todo `features/finanzas/service.ts`).

### B. Ventana de edición y quién la usa

- Lo carga/edita el **gestor administrativo o administrador** (dinero es su rol, mismo criterio que cobro/liquidación).
- Editable desde que el presupuesto está aprobado (`en_ejecucion`) y en las etapas siguientes (`conformidad`, `facturacion_cobro`) — se puede seguir corrigiendo si se dieron adelantos escalonados, ya que es un solo valor regrabable, no un historial.
- Se congela (deja de ser editable) una vez registrada la liquidación (`liq_pagada_en` no nulo) — a partir de ahí es historia.

### C. Tope — validado server-side

- `0 ≤ adelanto_materiales ≤ monto_materiales` del presupuesto **aprobado** de la gestión (no el total con mano de obra: es plata para materiales, ese es su propio techo). Se recalcula en el server, nunca se confía en lo que mande el cliente.

### D. Server action (`features/finanzas/service.ts`, junto a `registrarLiquidacion`)

- `registrarAdelantoMateriales(gestionId, monto)` — rol administrativo/admin (mismo guard `exigirAdministrativo`). Rechaza si la gestión ya fue liquidada o está en etapa terminal. Actualiza la columna y emite evento `adelanto_materiales_registrado` con `{ monto }` (no cambia de etapa — mismo patrón que `materiales_rendidos`).

### E. Liquidación (`registrarLiquidacion`)

- El monto base sigue siendo el de STORY-934/964 (materiales rendidos + mano de obra presupuestada, fallback `costo_final`).
- **Nuevo:** `monto_a_liquidar = max(base − adelanto_materiales, 0)`. Si el adelanto llegó a cubrir todo (o se pasó), se liquida $0 — no se bloquea el cierre de la gestión por eso.
- El guard existente que rechazaba `monto <= 0` pasa a validar la disponibilidad del dato base (rendido/costo_final), no el resultado neto — un neto en 0 por adelanto es válido y debe poder finalizar.

### F. UI

- **Detalle de gestión, header `DatosGestion`** (visible para TODOS los roles, incluido el técnico): si `adelanto_materiales > 0`, una línea de solo lectura "Adelanto de materiales: $ X" — así el técnico también lo ve reflejado en su gestión.
- **Gestor administrativo/admin**, en las etapas `en_ejecucion` / `conformidad` / `facturacion_cobro` (hoy esos roles ven "Sin acciones para tu rol en esta etapa" ahí — pasan a tener esta única acción): input de monto + botón "Guardar adelanto", con el tope de materiales visible y el valor actual si ya se cargó uno.
- **Liquidación** (`finanzas.client.tsx`): el desglose existente (rendido + mano de obra) suma una línea "Adelanto ya entregado" (negativa) y el total pasa a ser el neto.
- **Comprobante PDF** (`pdf.tsx`, tipo `comprobante`): línea "Adelanto de materiales (ya entregado)" en negativo cuando `adelanto_materiales > 0`, antes del total liquidado.

### G. Eventos y auditoría

- Nuevo `adelanto_materiales_registrado` con `{ monto }` — el formateo genérico de `detalleLegible()` (features/gestiones/eventos.ts) ya sabe mostrar `detalle.monto`; solo hace falta el label en `LABEL_EVENTO`.

### H. Fuera de alcance (deliberado, Regla #0)

- Sin historial de entregas parciales, sin medio de pago del adelanto, sin anulación, sin notificación push al técnico (en la práctica el técnico ya sabe que recibió la plata; el campo es para que el sistema la descuente, y queda visible en su detalle igual).
- Sin bloqueo de cancelación por tener adelanto activo (a diferencia de STORY-933 v1.0) — si una gestión con adelanto se cancela, queda como dato suelto en la gestión cancelada; no se agrega esa regla salvo que aparezca un caso real.

## Criterios de aceptación

1. El administrativo/admin carga un adelanto desde `en_ejecucion` en adelante; el server rechaza más de `monto_materiales` del presupuesto aprobado.
2. El técnico (y cualquier rol) ve el adelanto reflejado en el header de la gestión si es `> 0`.
3. La liquidación descuenta el adelanto del monto a pagar (rendido + mano de obra − adelanto, piso en $0) y el comprobante PDF muestra la línea del adelanto.
4. El cobro al pagador no cambia (sigue siendo `costo_final + cargo_admin`).
5. Una vez liquidada la gestión, el adelanto deja de ser editable.
6. Evento `adelanto_materiales_registrado` visible en Actividad y Auditoría con el monto.
7. `tsc` + eslint + `next build` verdes.

## Dev Agent Record

- **Estado:** código completo, migración aplicada por Giuliano (2026-07-15). Sin acceso a Supabase MCP/`.env.local` en esta sesión → no se pudo correr el flujo E2E en navegador. Falta: probar en un entorno con credenciales.

- **Migración aplicada** (por Giuliano, 2026-07-15, directo en Supabase):
  ```sql
  alter table public.gestiones
    add column adelanto_materiales numeric;

  comment on column public.gestiones.adelanto_materiales is
    'STORY-977: adelanto de materiales dado al técnico antes de rendir la obra; se resta en la liquidación.';
  ```
  Sin política RLS nueva: la columna cae bajo el mismo UPDATE de `gestiones` que ya cubre `cargo_admin`/`materiales_total`/`liq_monto` (mismo patrón, sin RLS por columna).

- **Archivos tocados:**
  - `codigo/features/gestiones/types.ts` — campo `adelanto_materiales` en `GestionDetalle`.
  - `codigo/features/gestiones/service.ts` — `obtenerGestion` selecciona y devuelve el campo nuevo.
  - `codigo/features/finanzas/service.ts` — `registrarAdelantoMateriales()` (nueva, valida rol/tope/etapa), `registrarLiquidacion()` resta el adelanto (`Math.max(base - adelanto, 0)`), `datosDocumento()` expone `adelantoMateriales` solo en el comprobante.
  - `codigo/features/finanzas/pdf.tsx` — línea "Adelanto de materiales (ya entregado)" en el comprobante.
  - `codigo/features/gestiones/eventos.ts` — label `adelanto_materiales_registrado`.
  - `codigo/components/gestiones/finanzas.client.tsx` — componente `AdelantoMateriales`, insertado en `en_ejecucion`/`conformidad` (única acción), `facturacion_cobro` y `liquidacion_tecnico` (con el desglose neto).
  - `codigo/components/gestiones/detalle.client.tsx` — línea de solo lectura en el header (`DatosGestion`, todos los roles) + habilita `FinanzasAcciones` en `en_ejecucion`/`conformidad` para el gestor administrativo/admin.

- **Verificación estática:** `tsc --noEmit` limpio, `eslint` limpio en todos los archivos tocados. `next build` compila y tipa OK; falla en el paso de prerender de una página no relacionada (`/registro-tecnico`, `Error: supabaseUrl is required`) — atribuible a la falta de `.env.local` en esta sesión (confirmado ausente desde el arranque), no a este cambio.
- **Pendiente:** probar el flujo en navegador (carga de adelanto, tope, header en las 3 vistas de rol, liquidación neta, PDF) en un entorno con `.env.local`/MCP configurados.

- **v1.1 (2026-07-15):** Giuliano probó el flujo y pidió 5 cambios. (1) El campo pasa de "pisás el valor" a **aditivo**: cada carga SUMA al total ya adelantado (`registrarAdelantoMateriales` ahora hace `total = adelanto_materiales + monto` en vez de sobreescribir) — así se puede dar más de un adelanto. (2) **Se elimina el tope** contra `monto_materiales` del presupuesto: el adelanto puede terminar siendo mayor a lo debido al técnico (decisión de Giuliano — antes bloqueaba, ahora no). (3) Si el adelanto termina superando lo debido, `registrarLiquidacion` calcula `sobrante = max(adelanto - base, 0)` y lo manda en el evento `liquidacion_registrada` (solo si `> 0`); la UI de `liquidacion_tecnico` muestra un aviso ámbar con el monto sobrante. `detalleLegible()` (eventos.ts) suma el caso `detalle.sobrante`. (4) La carga de un adelanto pide confirmación: mismo patrón de 2 pasos que "Rechazar" en `detalle.client.tsx` (paso 1 tipeás el monto, paso 2 "Vas a cargar un adelanto de $X. ¿Confirmás?" con Confirmar/Cancelar) — antes se guardaba directo al submit. (5) Se saca `<AdelantoMateriales>` de las etapas `conformidad` y `facturacion_cobro` (no tiene sentido ahí, es plata del técnico no del cobro al pagador) — queda solo en `en_ejecucion` y en `liquidacion_tecnico` (donde se ve el neto); en `conformidad` el administrativo ahora ve "Sin acciones para tu rol en esta etapa". **Archivos:** `features/finanzas/service.ts` (`registrarAdelantoMateriales`, `registrarLiquidacion`), `components/gestiones/finanzas.client.tsx` (`AdelantoMateriales` con confirmación, removido de `facturacion_cobro`, aviso de sobrante en `liquidacion_tecnico`), `features/gestiones/eventos.ts` (`detalle.sobrante`). `tsc`+`eslint` verdes. Pendiente: probar E2E en navegador (Giuliano/Fausti, no hay `.env.local` en esta sesión).

- **v1.2 (2026-07-15):** Giuliano probó de nuevo y vio que en `liquidacion_tecnico` todavía se podía cargar un adelanto nuevo — no debía ser así, el adelanto es SOLO pre-ejecución. Se saca `<AdelantoMateriales>` (el form) de `liquidacion_tecnico`, dejando ahí solo el desglose de solo lectura (adelanto ya entregado + aviso de sobrante, sin acción para cargar más). El guard server-side de `registrarAdelantoMateriales` también se endurece: ya no acepta "cualquier etapa no terminal/no liquidada", ahora exige `etapa === "en_ejecucion"` (defensa en profundidad, no solo ocultar el botón). Queda un solo punto de entrada para el adelanto en todo el sistema. `tsc`+`eslint` verdes.
