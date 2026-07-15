# STORY-975 — Recargo por tarjeta de crédito al cobrar + UX del formulario de cobro (v1.0)

**Estado:** 🚧 en desarrollo (falta correr la migración SQL) · **Origen:** Giuliano: *"Agregar lógica de recargo por tarjeta de crédito a la hora de liquidar [cobrar], además mejorar la UX y además formatear a currency el importe del medio de pago número 2 que no lo tiene y el 1 sí."*

## Alcance

Aclarado con Giuliano antes de tocar código (afecta lógica financiera real):

1. El recargo aplica **al cobrar al pagador** (`FormCobro` / `registrarCobro`), no al liquidar al técnico — `tarjeta_credito` solo existe como medio de *cobro* (`MEDIOS_COBRO`), nunca como medio de *liquidación* (`MEDIOS_LIQUIDACION`), así que la ubicación es la única que tiene sentido con el modelo actual.
2. El porcentaje **lo tipea la administración en cada cobro** (varía según financiera/promoción del día) — no es un valor fijo en código.
3. El recargo calculado **se suma al total que se le cobra al pagador** (no queda absorbido por la inmobiliaria).

### Cálculo

El recargo se calcula **solo sobre la porción efectivamente pagada con tarjeta**, no sobre el total del cobro — relevante en un cobro combinado (STORY-950), donde la tarjeta puede ser el medio 1 o el medio 2 y el resto puede ir por otro medio sin recargo. Se recalcula 100% server-side (nunca se confía en un monto que mande el cliente, mismo criterio que el resto de `registrarCobro`).

Aplica igual en el circuito de cargo por cancelación (STORY-967/972), que reusa el mismo `FormCobro`/`registrarCobro` — ahí `total` es el cargo de cancelación en vez de trabajo+fee, pero la lógica de recargo es idéntica (se calcula sobre lo mismo que se llame "total" en ese momento).

### UX

- El campo "Recargo tarjeta (%)" solo aparece cuando el medio elegido (o el medio 2, en combinado) es "Tarjeta de crédito" — nada nuevo en pantalla si no aplica.
- Con recargo cargado, se muestra en vivo debajo del formulario: `Recargo tarjeta: $X — Total a cobrar al {pagador}: $Y`, antes de confirmar — la administración ve el total real antes de registrar el cobro.
- El monto del medio 2 (`monto2`) ahora se muestra con separador de miles mientras se tipea (`formatearPesos()`, mismo criterio que `plata()`), igualando la UX del medio 1 (que ya se mostraba formateado por ser de solo lectura). No se tocó la precisión: sigue siendo pesos (sin decimales en la máscara, igual que el resto de los importes de este formulario).

## Implementación

- **Migración SQL**: agrega `gestiones.recargo_tarjeta_pct numeric null` y `gestiones.recargo_tarjeta_monto numeric null` (ver bloque abajo). No se reutiliza `cobrado_fee` (esa columna es el fee de gestión administrativa, un concepto distinto) — se agregan columnas propias para poder mostrar/auditar el recargo por separado más adelante (comprobantes, métricas) sin tener que derivarlo.
- **`cobrado_monto`** pasa a incluir el recargo cuando aplica (antes era siempre `costo_final + cargo_admin`, ahora es eso + el recargo si se cobró con tarjeta). Es un cambio de significado coherente: la columna ya se usa en cartera (`features/cartera/service.ts`) y métricas (`features/metricas/service.ts`) como "lo efectivamente cobrado" — con recargo, el pagador realmente pagó más, y el resumen de obras al propietario (STORY-942) debe reflejarlo.
- **`features/finanzas/service.ts`** (`registrarCobro`): nuevo parámetro `recargoPct?: number`. Calcula `montoTarjeta` (la porción pagada con tarjeta, considerando medio/medio2), valida el % (0–100), calcula `recargoMonto = round(montoTarjeta * pct) / 100`, y persiste `cobrado_monto` ya con el recargo sumado + las dos columnas nuevas. El evento `cobro_registrado` (STORY-973) ahora también lleva `recargoPct`/`recargoMonto` en el detalle.
- **`components/gestiones/finanzas.client.tsx`** (`FormCobro`, compartido entre el cobro normal y el de cancelación con cargo): agrega estado `recargoPct`, muestra el input condicionalmente, calcula el resumen en vivo, y manda `recargoPct` en el submit. `monto2` pasa a mostrarse formateado con `formatearPesos()` (nueva función, mismo patrón que `plata()`) manteniendo el estado interno como dígitos crudos.
- **Sin cambios** en `emitirNotaCobro`/`descargarDocumento` (la nota se emite ANTES de elegir medio de pago — el recargo no existe todavía en ese momento) ni en `registrarLiquidacion` (la liquidación al técnico no tiene relación con cómo pagó el pagador).

## Migración SQL (pendiente de correr en Supabase)

```sql
alter table gestiones add column if not exists recargo_tarjeta_pct numeric;
alter table gestiones add column if not exists recargo_tarjeta_monto numeric;
```

Sin backfill: los cobros ya registrados quedan con ambas columnas en `null` (no tenían recargo — comportamiento correcto, no hace falta reconstruir nada).

## Criterios de aceptación

1. Al elegir "Tarjeta de crédito" como medio de cobro (solo o como medio 2 de un combinado) aparece el campo "Recargo tarjeta (%)".
2. Si se deja en 0 o vacío, no se cobra recargo (columnas quedan `null`, `cobrado_monto` es el de siempre) — el recargo es opcional, no obligatorio.
3. Con un % cargado, el resumen en vivo muestra el monto del recargo y el total final antes de confirmar.
4. En un cobro combinado, el recargo se calcula solo sobre el monto asignado al medio que es tarjeta (no sobre el total).
5. El total registrado en `cobrado_monto` incluye el recargo; `recargo_tarjeta_pct`/`recargo_tarjeta_monto` quedan grabados para auditoría.
6. El medio 2 se ve con separador de miles mientras se tipea, igual que el medio 1.
7. El circuito de cargo por cancelación (STORY-967) admite el mismo recargo sin romper su cierre en `cancelada`.
8. `tsc`/eslint verdes.

## Dev Agent Record

- **Archivos:** `codigo/features/finanzas/service.ts` (`registrarCobro`: parámetro, cálculo y persistencia del recargo), `codigo/components/gestiones/finanzas.client.tsx` (`FormCobro`: input condicional, resumen en vivo, máscara de moneda en `monto2`, prop `pagador` nueva en ambos call-sites).
- **Migración:** ver bloque SQL arriba — pendiente de que Giuliano la corra en el SQL Editor de Supabase (no hay MCP vivo en esta sesión). Son 2 `alter table ... add column` simples, sin `not null` ni default, así que no rompe filas existentes ni requiere backfill.
- **Verificación:** `tsc --noEmit` y `eslint` limpios. Falta probar el flujo end-to-end en la app corriendo (no se hizo en esta sesión). **No pushear/deployar el código sin correr antes la migración** — mientras no exista `recargo_tarjeta_pct`/`recargo_tarjeta_monto`, el `update` de `registrarCobro` va a fallar (columna inexistente) y el cobro deja de poder registrarse para todos.
