# STORY-932 — Gastos imprevistos del técnico en ejecución (v1.0)

**Estado:** 🚧 implementada y verificada E2E — sin commitear (Fausti revisa) (diseño en party mode 2026-07-11, Mary/John/Winston/Sally; decisiones confirmadas por Fausti: fee fijo, foto de ticket obligatoria) · **Origen:** Fausti. Regla #0: la solución más simple; máximo reciclaje del código existente.

## Objetivo

Durante la etapa **En ejecución**, el técnico puede registrar **gastos imprevistos** (materiales extra, etc.) que, una vez **aprobados por el gestor de mantenimiento**, entran al costo final de la obra y por lo tanto a la facturación al pagador y a la liquidación del técnico.

**Idea rectora: un gasto imprevisto es un mini-presupuesto.** Se recicla entera la máquina de `presupuestos` (`enviado → aprobado/rechazado`, el técnico propone, el gestor decide). El invariante actual se preserva: **el técnico nunca fija dinero, solo lo propone**.

## Alcance y decisiones

### A. Modelo de datos — tabla nueva `gastos_imprevistos`

Espejo del patrón `presupuestos` (N por gestión):

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid pk | |
| `gestion_id` | uuid fk → gestiones | |
| `tecnico_id` | uuid | quién lo cargó |
| `monto` | numeric NOT NULL, > 0 | |
| `descripcion` | text NOT NULL | qué se compró y por qué |
| `foto_path` | text NOT NULL | **foto del ticket OBLIGATORIA** ("sin evidencia no existe") — bucket `gestiones`, como los avances |
| `estado` | text default `'enviado'` | `enviado` / `aprobado` / `rechazado` (mismo vocabulario que `presupuestos`) |
| `motivo_rechazo` | text | |
| `resuelto_por` / `resuelto_en` | uuid / timestamptz | quién y cuándo decidió |
| `creado_en` | timestamptz default now() | |

RLS desde la primera migración, calcada de `presupuestos`: el técnico asignado inserta/lee los de sus gestiones; gestores/admin leen todo; solo gestor de mantenimiento owner o admin actualizan (resolver).

### B. Server actions (en `features/gestiones/service.ts`, junto a sus gemelas)

- **`registrarGastoImprevisto(gestionId, {monto, descripcion, foto})`** — valida: etapa `en_ejecucion`, caller = técnico asignado, monto > 0, foto presente. Sube la foto reutilizando el mismo camino que `registrarAvance` (bucket `gestiones`). Inserta + evento `gasto_enviado` (detalle: monto, descripción).
- **`resolverGastoImprevisto(gastoId, decision, motivo?)`** — espejo de `resolverPresupuesto`: gestor owner o admin; aprueba o rechaza (rechazo con motivo obligatorio); escribe `resuelto_por/en` + evento `gasto_aprobado` / `gasto_rechazado`. Un gasto rechazado queda documentado y **no suma**; el técnico puede cargar otro.

### C. Cómo entra al dinero (sin tocar ninguna fórmula existente)

- **Ventana**: los gastos se cargan SOLO en `en_ejecucion`. Cerrada la etapa, no hay más gastos.
- **Bloqueo duro**: `resolverConformidad` (aprobar) **falla si hay gastos en estado `enviado`** — ActionResult con la cantidad pendiente ("Hay N gastos imprevistos sin resolver"). Doctrina STORY-924: bloqueo, no advertencia.
- **`costo_final` absorbe los gastos**: el input de costo final al aprobar la conformidad (`detalle.client.tsx`) pasa a defaultear a **(mat + mo del presupuesto aprobado) + Σ gastos aprobados**. El gestor puede seguir editándolo, como hoy. Con eso la nota de cobro, el snapshot del cobro, la liquidación y TODAS las métricas capturan los gastos **sin cambiar ni una fórmula** (`total = costo_final + cargo_admin` intacto).
- **Fee ANCLADO (decisión de Fausti)**: `cargo_admin` NO se recalcula sobre los gastos. Si un caso lo amerita, el administrativo ya puede retocarlo en la nota (`guardarCargoAdmin`).

### D. Nota de cobro con desglose

`datosDocumento` (`finanzas/service.ts`) suma los gastos aprobados como líneas del detalle: trabajo presupuestado + cada gasto imprevisto (descripción + monto) + cargo administrativo. Mismo PDF/email de siempre.

### E. UI

- **Técnico (móvil, etapa `en_ejecucion`)**: botón "Agregar gasto imprevisto" junto a "Registrar avance" en el detalle — form calcado de `FormAvance` (monto, descripción, foto obligatoria; targets ≥44px). Debajo, su lista de gastos con chip de estado (enviado/aprobado/rechazado + motivo).
- **Gestor de mantenimiento**: sección "Gastos imprevistos" en el detalle con aprobar/rechazar por gasto (mismo patrón UI que resolver presupuesto: foto visible, motivo en el rechazo).

### F. Eventos, notificaciones y auditoría

- Eventos nuevos (tipo texto libre, **sin migración de enum**): `gasto_enviado`, `gasto_aprobado`, `gasto_rechazado`.
- `matriz_notificaciones`: `gasto_enviado` → notifica al gestor owner; `gasto_aprobado`/`gasto_rechazado` → notifican al técnico.
- Labels legibles en `auditoria.client.tsx` (patrón STORY-928).

### G. Métricas — deuda documentada, sin cambios de código

`costo_final` absorbe los gastos → cero cambios en `features/metricas`. Deuda aceptada (Mary): la card "Cumplimiento de presupuesto" ahora mezcla "presupuestó mal" con "imprevistos legítimos aprobados por el gestor". Si molesta, se desglosa después — los gastos quedan en su propia tabla.

## Criterios de aceptación

1. El técnico asignado, solo en `en_ejecucion`, carga un gasto con monto, descripción y **foto obligatoria** (sin foto no envía).
2. El gestor owner (o admin) aprueba/rechaza cada gasto; el rechazo exige motivo; todo queda en `eventos_gestion` y notifica al que corresponde.
3. La conformidad NO se puede aprobar con gastos `enviado` pendientes (error con la cantidad).
4. El input de `costo_final` al aprobar conformidad defaultea a presupuesto aprobado + Σ gastos aprobados (editable).
5. La nota de cobro (PDF y email) desglosa los gastos aprobados como líneas; total = `costo_final + cargo_admin` sin cambios.
6. `cargo_admin` no cambia por gastos.
7. RLS activa en `gastos_imprevistos` desde la migración; el técnico no puede resolver ni tocar gastos ajenos.
8. `tsc` + eslint + `next build` verdes; métricas sin cambios de código.

## Dev Agent Record
- **Estado:** ✅ implementada y verificada E2E (2026-07-11). Sin commitear — Fausti revisa.
- **Migración** (`story_932_gastos_imprevistos`, aplicada en remoto): tabla `gastos_imprevistos` (check `monto > 0`, `foto_path` NOT NULL, estado enviado/aprobado/rechazado) + RLS calcada de `presupuestos` (técnico asignado inserta solo en `en_ejecucion`; resuelve admin/gestor owner; lee quien ve la gestión) + alta en publicación realtime + 3 filas en `matriz_notificaciones` (enviado→gestor, resolución→técnico).
- **Archivos:**
  - `features/gestiones/types.ts` — interface `GastoImprevisto` + `gastos` en `GestionDetalle`.
  - `features/gestiones/service.ts` — `registrarGastoImprevisto` (foto obligatoria vía `subirFoto`, evento `gasto_enviado`), `resolverGastoImprevisto` (espejo de `resolverPresupuesto`, motivo obligatorio al rechazar, eventos `gasto_aprobado/rechazado`), gastos en `obtenerGestion`, y bloqueo en `resolverConformidad` (aprobar falla con gastos `enviado` pendientes).
  - `components/gestiones/detalle.client.tsx` — `FichaGasto` + `GastosTecnico` (form móvil con foto, junto a avances) + `GastosGestor` (aprobar/rechazar, visible en `en_ejecucion` y `conformidad`); costo final sugerido = presupuesto aprobado + Σ gastos aprobados; labels de eventos; `RefrescoVivo` de `gastos_imprevistos`.
  - `features/finanzas/service.ts` + `pdf.tsx` — gastos aprobados como líneas de desglose en nota de cobro y comprobante (`datos.gastos`).
  - `components/auditoria/auditoria.client.tsx` — labels de los 3 eventos nuevos.
- **Verificación:** `tsc`, eslint y `next build` verdes. E2E con Playwright sobre gestión de prueba (luego borrada, DB + bucket): técnico cargó gasto $15.000 con foto → "Esperando al gestor"; subió conformidad; gestor bloqueado al aprobar con gasto pendiente (mensaje "1 gasto imprevisto sin resolver"); aprobó gasto → costo final sugerido pasó de $130.000 a $145.000; aprobó conformidad → nota de cobro con desglose verificado en el PDF (materiales 50.000 + mano de obra 80.000 + gasto 15.000 + fee 20.000 = $165.000); notificaciones correctas (gasto→gestor, aprobación→técnico); eventos con monto en Actividad y Auditoría. Fee intacto ($20.000 anclado).
