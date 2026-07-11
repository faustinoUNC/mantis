# STORY-933 — Adelantos de obra al técnico (v1.0)

**Estado:** 📋 aprobada — pendiente de implementación (diseño en party mode 2026-07-11, Mary/John/Winston/Sally; decisiones confirmadas por Fausti: cancelación bloqueada con adelantos) · **Origen:** Fausti. Regla #0: la solución más simple; máximo reciclaje. Depende de STORY-932 solo en la fórmula del tope (si se implementa antes, el tope usa solo el presupuesto aprobado).

## Objetivo

La inmobiliaria puede darle al técnico **adelantos de dinero** (para comprar materiales) desde que el presupuesto está aprobado. Al liquidar, esos adelantos **ya están pagados y se descuentan**: el saldo a pagar es `costo_final − Σ adelantos`.

**Clave conceptual (Winston): el adelanto vive en el eje inmobiliaria↔técnico y NO toca la facturación al pagador.** El total a cobrar sigue siendo `costo_final + cargo_admin`, intocado. Solo cambia cuánto *queda* por pagarle al técnico.

## Alcance y decisiones

### A. Modelo de datos — tabla nueva `adelantos`

N adelantos por gestión (el inicial + los que habiliten los gastos imprevistos aprobados). **Sin earmarking** adelanto↔gasto ("no modelar sobres de plata" — John): son entregas contra la gestión, punto.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid pk | |
| `gestion_id` | uuid fk → gestiones | |
| `monto` | numeric NOT NULL, > 0 | |
| `medio` | text | transferencia / efectivo / otro (mismo vocabulario que `medio_cobro`) |
| `creado_por` | uuid | quién lo registró |
| `creado_en` | timestamptz default now() | |
| `anulado_en` / `anulado_por` | timestamptz / uuid, null | **anulación soft** — hechos congelados, nada se borra |

"Adelantos activos" = `anulado_en IS NULL`. RLS: escribe gestor administrativo/admin; leen los roles internos y el técnico los de sus gestiones.

### B. Server actions (en `features/finanzas/service.ts` — es plata, es del administrativo)

- **`registrarAdelanto(gestionId, {monto, medio})`** — rol `gestor_administrativo` o admin (dinero es su rol aunque la gestión esté en etapa 4). Ventana: desde presupuesto aprobado (`en_ejecucion`) hasta antes de registrar la liquidación. **Tope**: Σ adelantos activos + nuevo ≤ (mat + mo del presupuesto aprobado) + Σ gastos imprevistos aprobados — se rechaza lo que exceda (evita liquidación negativa). Evento `adelanto_registrado`.
- **`anularAdelanto(adelantoId)`** — mismo rol; solo si la gestión aún no fue liquidada; marca `anulado_en/por` + evento `adelanto_anulado`. Nada se borra.

### C. Liquidación con descuento

- El input de liquidar (`finanzas.client.tsx`) pasa de defaultear `costo_final` a defaultear el **saldo = `costo_final − Σ adelantos activos`**, con el desglose visible arriba (costo final − adelantos = saldo).
- `registrarLiquidacion` no cambia de estructura: `liq_monto` = lo pagado en la liquidación (el saldo). Total percibido por el técnico = Σ adelantos + `liq_monto`.
- **Comprobante PDF del técnico** (`datosDocumento`): desglose costo final − cada adelanto (fecha + monto) = saldo pagado.

### D. Cancelación bloqueada (decisión de Fausti)

`cancelarGestion` **falla si la gestión tiene adelantos activos** (mensaje con cantidad y monto total) — extiende la regla existente "no cancelar cuando entró plata" (hoy etapas 6-7) al momento en que entra el primer adelanto. Patrón de bloqueo duro STORY-924.

### E. UI

- **Administrativo**: sección "Adelantos" en el detalle (junto a `FinanzasAcciones`), visible desde `en_ejecucion`: lista de adelantos (fecha, monto, medio, anulados tachados) + form registrar (monto, medio) + tope restante visible + anular.
- **Técnico (móvil)**: ve sus adelantos en el detalle, solo lectura.
- **Liquidación**: desglose + default del saldo (punto C).

### F. Eventos, notificaciones y auditoría

- Eventos nuevos (texto libre, sin migración de enum): `adelanto_registrado`, `adelanto_anulado`.
- `matriz_notificaciones`: `adelanto_registrado` → notifica al técnico.
- Labels en `auditoria.client.tsx`.

### G. Métricas — un solo ajuste honesto

- El cobro no cambia → "Ingresos cobrados" y snapshots congelados intactos (la parte del técnico ahí es el *costo* del trabajo, no el timing de sus pagos).
- **"Por liquidar" debe descontar adelantos** (si no, sobreestima lo que falta pagar): `FilaMetrica` suma un campo `adelantos` (Σ activos) y las dos vistas que muestran "por liquidar" (tile `montoPorLiquidar` en `metricas/service.ts` y footer "Por liquidar a técnicos" de la card de cobro) pasan a Σ (`costo_final − adelantos`). Nada más se toca.

## Criterios de aceptación

1. El administrativo (o admin) registra adelantos desde `en_ejecucion` hasta antes de liquidar; nunca por encima del tope (presupuesto aprobado + gastos aprobados − ya adelantado).
2. El técnico recibe notificación de cada adelanto y los ve en su detalle.
3. La liquidación defaultea al saldo (`costo_final − adelantos activos`) y el comprobante PDF muestra el desglose con cada adelanto.
4. La nota de cobro y el cobro al pagador NO cambian (total = `costo_final + cargo_admin`).
5. Una gestión con adelantos activos no se puede cancelar (error con cantidad y monto).
6. Anular un adelanto es soft (queda la fila + evento) y solo antes de liquidar.
7. Tile "Monto por liquidar" y footer "Por liquidar a técnicos" descuentan adelantos.
8. RLS activa en `adelantos` desde la migración; el técnico no puede registrar ni anular adelantos.
9. `tsc` + eslint + `next build` verdes.

## Dev Agent Record
- **Estado:** ⏳ no iniciada.
