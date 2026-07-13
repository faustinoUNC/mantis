# STORY-950 — Cobro con medios de pago combinados (v1.1)

**Estado:** ✅ done (migración `medio_cobro_2`/`cobrado_monto_2` verificada aplicada en Supabase el 2026-07-13) · **Origen:** Giuliano: *"Permitir combinación de medios de pago y agregar medio de pago de tarjeta de crédito. Hoy no hay forma de registrar un cobro parcial ni combinar medios, solo se puede marcar 'cobrado' una vez, con un medio único. Como ahora el admin no escribe cuánto es, hacé que solo si marca que va a ser un pago combinado deje escribir, pero deje escribir una y a la otra la autocomplete con lo que falta, además debe validar que no se pase escribiendo de más."*

## Alcance

- Aplica solo al **cobro** (pagador → inmobiliaria, etapa `facturacion_cobro`). La **liquidación** al técnico (STORY-946) no se toca — sigue siendo un solo medio, el usuario no la mencionó y el escenario real que describió ("inquilino/propietario paga mitad efectivo, mitad transferencia") es específicamente del lado del cobro.
- Se puede combinar **como máximo 2 medios** (no N arbitrarios): cubre el caso real pedido ("mitad efectivo, mitad transferencia") sin la complejidad de una lista dinámica de líneas (Regla #0).
- Nuevo medio: **tarjeta de crédito**, agregado a la lista de medios de cobro junto con efectivo/transferencia/otro.
- Modo por defecto (checkbox "Pago combinado" sin marcar): el comportamiento es idéntico a antes — un solo medio, 100% del monto, la administración no tipea nada.
- Modo combinado (checkbox marcado): aparecen 2 selects de medio + 1 campo de monto editable (medio 2) + 1 campo de monto de solo lectura (medio 1 = resto). La administración tipea el monto del medio 2; el medio 1 se autocompleta con `total − monto2`. Si el monto tipeado es mayor o igual al total, o si eligió el mismo medio dos veces, el submit queda bloqueado con mensaje explicativo (client) y el server revalida lo mismo (nunca confía en el cliente para montos).

## Implementación

- **`features/finanzas/service.ts`**:
  - Nuevas `MEDIOS_COBRO` (`efectivo | transferencia | tarjeta_credito | otro`), tipo `MedioCobro` y `MEDIO_COBRO_LABEL` — reemplaza el union literal inline que tenía `registrarCobro` (mismo patrón que `MEDIOS_LIQUIDACION` de STORY-946).
  - `registrarCobro(gestionId, { medio, medio2?, monto2? })`: firma nueva (antes `(gestionId, medio)`). El total (`costo_final + cargo_admin`) se sigue calculando en el servidor, igual que antes. Si viene `medio2`: valida que sea distinto de `medio`, que `monto2` sea un número finito `> 0` y `< total` (estrictamente — si fuera `>= total` no quedaría nada para el primer medio), y recién ahí guarda `medio_cobro_2`/`cobrado_monto_2`. `cobrado_monto` sigue siendo el TOTAL (no cambia de significado); el monto del primer medio es implícito (`cobrado_monto − cobrado_monto_2`), no se agrega una columna nueva para eso.
- **`components/gestiones/finanzas.client.tsx`**: el formulario de cobro se extrae a un componente `FormCobro` con su propio estado (antes leía `medio` de un `FormData` suelto). Un checkbox "Pago combinado" alterna entre el `Select` único de siempre y el layout de 2 medios + 2 montos (uno editable, el resto de solo lectura). Validación espejo del server en el cliente para feedback inmediato (no reemplaza la del server).

## Migración SQL (pendiente de correr en Supabase)

```sql
alter table gestiones add column if not exists medio_cobro_2 text;
alter table gestiones add column if not exists cobrado_monto_2 numeric;
```

Sin backfill: cobros ya registrados antes de este cambio quedan con ambas columnas en `null` (siguen siendo cobros de un solo medio, comportamiento sin cambios).

## Criterios de aceptación

1. Sin marcar "Pago combinado", el formulario de cobro se comporta exactamente igual que antes (un Select, sin campos de monto) y guarda un cobro de un solo medio.
2. Al marcar "Pago combinado" aparecen: Select "Medio 1", monto de solo lectura para el medio 1 (= resto), Select "Medio 2", monto editable para el medio 2.
3. Si la administración tipea un monto para el medio 2, el monto del medio 1 se recalcula solo, en vivo, como `total − monto2`.
4. Si el monto tipeado para el medio 2 es mayor o igual al total, el botón de submit se deshabilita y se muestra un mensaje de error — no se puede "escribir de más".
5. Si elige el mismo medio en ambos selects, también se bloquea el submit con mensaje explicativo.
6. El servidor revalida todo lo anterior de forma independiente del cliente (medio2 distinto de medio, monto2 > 0 y < total) — un POST directo a `registrarCobro` con datos inválidos se rechaza igual.
7. "Tarjeta de crédito" está disponible como medio en ambos selects (solo y combinado).
8. Un cobro combinado exitoso avanza la gestión a `liquidacion_tecnico` igual que uno simple.
9. `tsc`/eslint verdes.

## Dev Agent Record

- **Archivos:** `codigo/features/finanzas/service.ts` (`MEDIOS_COBRO`/`MedioCobro`/`MEDIO_COBRO_LABEL` nuevos, `registrarCobro` cambia de firma), `codigo/components/gestiones/finanzas.client.tsx` (`FormCobro` nuevo componente).
- **Migración:** ver bloque SQL arriba — pendiente de que Giuliano la corra en el SQL Editor de Supabase (no hay MCP vivo en esta sesión).
- **Verificación:** `tsc --noEmit` y `eslint` limpios. Falta probar el flujo end-to-end en la app corriendo (no se hizo en esta sesión).
- **Nota de reconciliación:** esta historia se numeró originalmente STORY-949, pero Faustino pusheó su propio STORY-949 (alta de administración sin inquilino) mientras esta estaba en desarrollo. Se renumeró a STORY-950 tras confirmar que no había overlap de archivos (`git pull --ff-only` limpio).

## v1.1 (2026-07-12) — hotfix: las constantes de medios salen de service.ts

`features/finanzas/service.ts` es un archivo `"use server"` y Next prohíbe que
exporte algo que no sea una función async: los exports `MEDIOS_COBRO`,
`MEDIO_COBRO_LABEL`, `MEDIOS_LIQUIDACION` y `MEDIO_LIQUIDACION_LABEL` rompían el
detalle de gestión con 500 ("A \"use server\" file can only export async
functions, found object"). Se movieron a `features/finanzas/medios.ts` (sin
"use server"); service.ts y finanzas.client.tsx importan de ahí. Sin cambios de
comportamiento.
