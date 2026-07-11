# STORY-934 — Rendición de materiales, gastos sin aprobación y liquidación = rendido + mano de obra (v1.1)

**Estado:** 🚧 en desarrollo · **Origen:** Fausti, tras revisar STORY-932 en producción (dos tandas de feedback el 2026-07-11). Regla #0: simplicidad; máximo reciclaje. **v1.1**: se descartan los adelantos (STORY-933) y la liquidación pasa a calcularse desde la rendición.

## Objetivo

1. **Gastos imprevistos sin aprobación**: el técnico los registra (foto de la factura obligatoria, eso queda) y punto — el gestor NO aprueba ni rechaza cada uno. Son evidencia informativa durante la obra.
2. **Rendición de materiales para terminar la ejecución**: al subir la conformidad, el técnico debe subir una **foto general de todos los comprobantes de materiales** (obligatoria) y declarar el **total gastado en materiales ($)**.
3. **La liquidación al técnico sale de la rendición**: lo que se le paga = **materiales rendidos + mano de obra del presupuesto aprobado**. (Los adelantos de obra se DESCARTAN — no nos complicamos: al técnico se le liquida al final contra comprobantes.)
4. **Fee solo lectura en Facturación**: se elimina el input "corregible acá" — `cargo_admin` queda anclado en la aprobación del presupuesto (contradecía la doctrina "fee fijo" y permitía facturar un fee distinto del comunicado).

## El modelo de dinero que queda (una sola cadena)

- **Presupuesto** (técnico propone, gestor aprueba + ancla fee): materiales estimados + mano de obra.
- **Ejecución**: gastos imprevistos como evidencia (foto obligatoria) → **rendición al terminar**: total real de materiales + foto de comprobantes.
- **Conformidad**: costo final **sugerido = materiales rendidos + mano de obra presupuestada** (editable por el gestor, ahí vive el control), con la comparación contra el presupuesto visible (desvío de materiales en $ y %).
- **Facturación**: total al pagador = costo final + fee anclado (solo lectura).
- **Liquidación**: **default = materiales rendidos + mano de obra presupuestada** (fallback `costo_final` para gestiones sin rendición); comprobante PDF con ese desglose.

Así el pagador paga la obra real + fee, el técnico cobra la obra real, y la métrica histórica "parte técnico = cobrado − fee" sigue siendo cierta sin tocar Informes.

## Sobre los desvíos (pregunta de Fausti)

El desvío existente (scorecard + card "Cumplimiento de presupuesto") compara `costo_final` vs presupuesto aprobado y queda igual. Lo nuevo: el **desvío real de materiales** (rendido vs presupuestado) se muestra al gestor **en Conformidad**, donde decide el costo final. No se agrega card a Informes por ahora (Regla #0).

## Alcance y decisiones

### A. Migración (`story_934_gastos_sin_aprobacion_rendicion`, aplicada)

- `gastos_imprevistos`: se eliminan `estado`, `motivo_rechazo`, `resuelto_por`, `resuelto_en` y la policy de resolución. El gasto es un hecho, no una propuesta.
- `matriz_notificaciones`: fuera `gasto_aprobado`/`gasto_rechazado`; queda `gasto_enviado` → gestor (informativa).
- `gestiones`: columnas nuevas `materiales_total numeric` y `materiales_foto_path text` (una rendición por obra).

### B. Server actions

- `resolverGastoImprevisto` eliminada (con sus eventos). `registrarGastoImprevisto` igual.
- `resolverConformidad`: sin bloqueo por gastos (ya no hay estados).
- `subirConformidad` al TERMINAR (etapa `en_ejecucion`): exige **total gastado (> 0)** + **foto de comprobantes** (obligatoria); guarda la rendición (admin client — la RLS no da UPDATE de gestiones al técnico, `exigirTecnicoAsignado` ya validó) y emite evento `materiales_rendidos {total}`. La resubida (etapa `conformidad`) no la vuelve a pedir.
- Finanzas: `emitirNotaCobro`/`descargarDocumento` sin parámetro de fee — la nota usa SIEMPRE el `cargo_admin` de la DB.

### C. UI

- **Técnico**: el form "Terminar y subir conformidad" suma "Total gastado en materiales ($)" y "Foto de todos los comprobantes" (ambos requeridos). El form de gasto queda igual; su lista pierde los chips de estado.
- **Gestor** (en ejecución y conformidad): gastos como lista informativa (foto + monto, sin botones). En Conformidad además: rendición (foto + total) y comparación materiales presupuestados vs rendidos con desvío.
- **Costo final sugerido** = materiales rendidos + mano de obra presupuestada (fallback presupuesto + Σ gastos si no hay rendición).
- **Facturación**: composición con fee solo lectura (sin input).
- **Liquidación**: default = rendido + mano de obra (fallback `costo_final`), con el desglose visible.
- **PDFs** (nota y comprobante): línea "Materiales (rendidos)" con el total real (fallback presupuesto) + "Mano de obra (presupuesto aprobado)". Se quitan las líneas por gasto imprevisto (ya están adentro del rendido — evitan doble lectura).

### D. Eventos y auditoría

- Nuevo `materiales_rendidos` (detalle `{total}`) con labels en detalle y auditoría. Se van los labels de aprobado/rechazado.

### E. Specs relacionadas

- Supersede parcialmente a STORY-932 (fuera la máquina de aprobación y las líneas por gasto en PDFs).
- **STORY-933 (adelantos de obra): DESCARTADA** por decisión de Fausti (2026-07-11) — "no nos complicamos": sin plata adelantada, el técnico rinde comprobantes y cobra todo junto en la liquidación. Queda documentada para no re-proponerla.

## Criterios de aceptación

1. El técnico registra gastos (foto obligatoria) sin flujo de aprobación; el gestor los ve como lista informativa.
2. Para terminar la ejecución es OBLIGATORIO rendir: total gastado (> 0) + foto general de comprobantes; sin eso no avanza a Conformidad. La resubida no lo vuelve a pedir.
3. En Conformidad el gestor ve la rendición y la comparación con desvío de materiales; costo final sugerido = rendido + mano de obra.
4. En Facturación el fee es solo lectura; la nota usa siempre el fee anclado.
5. La liquidación defaultea a rendido + mano de obra y el comprobante PDF muestra ese desglose.
6. Evento `materiales_rendidos` visible en Actividad y Auditoría.
7. `tsc` + eslint + `next build` verdes; métricas de Informes sin cambios.

## Dev Agent Record
- **Estado:** ✅ implementada y verificada E2E (2026-07-11). Sin commitear — Fausti revisa.
- **Migración** (`story_934_gastos_sin_aprobacion_rendicion`, aplicada en remoto): fuera `estado`/`motivo_rechazo`/`resuelto_*` y la policy de resolución de `gastos_imprevistos`; fuera las notificaciones de aprobado/rechazado; columnas `materiales_total` + `materiales_foto_path` en `gestiones`.
- **Archivos:**
  - `features/gestiones/types.ts` — `GastoImprevisto` sin estado; `materiales_total`/`materiales_foto_url` en `GestionDetalle`.
  - `features/gestiones/service.ts` — fuera `resolverGastoImprevisto` y el bloqueo de conformidad; `subirConformidad` exige rendición al terminar (total > 0 + foto de comprobantes; escribe con admin client porque la RLS no da UPDATE al técnico; evento `materiales_rendidos`).
  - `components/gestiones/detalle.client.tsx` — gastos como evidencia (sin chips/botones); form de terminar con rendición obligatoria; conformidad del gestor con rendición + desvío de materiales; sugerido = rendido + mano de obra (fallback presupuesto + gastos).
  - `components/gestiones/finanzas.client.tsx` — fee solo lectura en facturación; liquidación con desglose rendido + mano de obra y default = esa suma (fallback `costo_final`).
  - `features/finanzas/service.ts` + `pdf.tsx` — `emitirNotaCobro`/`descargarDocumento` sin parámetro de fee; línea de materiales con la rendición ("rendidos por el técnico"); fuera las líneas por gasto.
  - `components/auditoria/auditoria.client.tsx` — labels (`materiales_rendidos`; fuera aprobado/rechazado).
- **Verificación:** `tsc` + eslint + `next build` verdes. E2E Playwright con gestión de prueba (borrada al final, DB + bucket): técnico registró gasto sin flujo de aprobación; NO pudo terminar sin rendición; rindió $65.000 + fotos → Conformidad; gestor vio rendición con desvío "+$15.000 (+30%)" y sugerido $145.000 (rendido + MO); facturación sin input de fee, total $165.000; nota PDF con "Materiales (rendidos por el técnico) $65.000"; liquidación con desglose y default $145.000; finalizada. La cadena cierra: cobrado 165.000 − fee 20.000 = liquidado 145.000 = rendido + mano de obra.
