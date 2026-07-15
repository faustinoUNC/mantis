# STORY-973 — El cobro combinado se ve completo en Actividad y Auditoría

**Estado:** ✅ done · **Origen:** card Trello #6 (GIULE — combinación de medios de pago), error de la ronda de prueba 2026-07-15 sobre STORY-950.

## El problema

STORY-950 permitió cobrar combinando hasta 2 medios de pago (`medio_cobro` + `medio_cobro_2`/`cobrado_monto_2`), pero el registro visible quedó a medias:

1. **En Actividad solo se muestra el medio principal.** `detalleLegible` renderiza `detalle.medio` e ignora `medio2`/`monto2`. Ramiro lo preguntó textual en la card: *"¿Dónde puedo ver, con el perfil administrativo, si el pago fue realizado por 2 formas de pago o solo 1?"* — hoy la respuesta es "en ningún lado": `medio_cobro_2` se escribe en DB y no se lee en ninguna pantalla.
2. Lo mismo en **Auditoría** (`resumenDetalle`).
3. El medio se muestra crudo (`tarjeta_credito`) en vez de con su label ("Tarjeta de crédito"), y el evento `cobro_registrado` no lleva el total cobrado, así que la línea de Actividad no dice cuánto se cobró.

## La solución

Sin migraciones ni pantallas nuevas (Regla #0): el historial que ya existe cuenta la historia completa.

1. **`registrarCobro` agrega `total` al detalle del evento** `cobro_registrado` (ya estaba calculado en la función). Los eventos viejos no tienen `total` y simplemente no lo muestran.
2. **`detalleLegible` (Actividad) y `resumenDetalle` (Auditoría)**: el medio se traduce con los labels de `medios.ts` (cobro ∪ liquidación — las claves compartidas coinciden), y si hay segundo medio se muestra con su monto: `Total: $ 50.000 · Medio: Efectivo · 2º medio: Transferencia ($ 5.000)`.

## Criterios de aceptación

1. Registrar un cobro combinado (ej. efectivo + transferencia $5.000) → la Actividad de la gestión muestra total, medio principal con label y segundo medio con su monto.
2. Un cobro con un solo medio muestra `Total · Medio: <label>` sin restos del segundo.
3. Auditoría muestra la misma información en la fila de "Cobro registrado".
4. Eventos de cobro anteriores a esta story no rompen (sin total ni medio2 → se muestran como hasta ahora, con label).
5. `tsc` + `eslint` verdes.

## Dev Agent Record

- **Archivos:** `features/finanzas/service.ts` (evento con `total`), `components/gestiones/detalle.client.tsx` (labels + 2º medio en `detalleLegible`), `components/auditoria/auditoria.client.tsx` (ídem en `resumenDetalle`).
- **Verificación:** `tsc`+`eslint` verdes. E2E local (2026-07-15): cobro combinado efectivo + transferencia $5.000 sobre gestión de prueba → Actividad y Auditoría muestran `Total · Medio: Efectivo · 2º medio: Transferencia ($ 5.000)`.
