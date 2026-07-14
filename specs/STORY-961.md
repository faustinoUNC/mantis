# STORY-961 — Conformidad: costo final calculado (no editable), gastos imprevistos sumados y aprobación separada del cobro

**Estado:** ✅ done · **Origen:** Fausti (2026-07-13, card Trello #82): "Al llegar a la etapa de aprobar la conformidad permite editar los gastos que se liquidan cuando deberían calcularse automáticamente, además no está sumando los gastos extra en el total, además se junta con la aprobación de la conformidad cuando debería aprobarse en dos instancias distintas."

Tres sub-bugs con una raíz común: al aprobar la conformidad el gestor **tipeaba** el costo final en un input libre, ese número no incluía los gastos imprevistos, y en el mismo submit se aprobaba la conformidad + se fijaba la plata + se avanzaba a Cobro.

## Decisiones (Fausti)

1. **Gastos imprevistos van APARTE y se suman.** Hasta hoy el modelo (STORY-936) los usaba como "justificación del exceso" de los materiales rendidos, o sea se asumían **dentro** del `materiales_total`. Fausti define que son un renglón separado que se **suma** al costo de materiales y debe **verse reflejado en el total a pagar, con la suma clara y sin poder editar el valor**. Para evitar doble conteo, el `materiales_total` que rinde el técnico pasa a ser **solo materiales, sin los gastos imprevistos**.
2. **El costo final se calcula, no se tipea:** `costo_final = materiales rendidos + Σ gastos imprevistos + mano de obra (presupuesto aprobado)`. Server-side, no manipulable desde el cliente.
3. **Dos instancias, sin etapa nueva** (Regla #0): como el monto ya no se edita, aprobar la conformidad queda como acto puro (aprobar la firma del cliente y avanzar). El dinero se revisa y se cobra en `facturacion_cobro`, que ya es una etapa e instancia separada a cargo del gestor administrativo. No se toca el enum de etapas ni `avanzar_etapa()`.

## Fórmula única del costo de obra (en los tres lugares)

`costo_obra = (materiales_total ?? materiales_presupuestados) + Σ gastos_imprevistos + mano_de_obra`

- **Conformidad** (`resolverConformidad`): calcula y persiste `gestiones.costo_final` con esa fórmula al aprobar. Ignora cualquier `costo_final` que mande el cliente.
- **Liquidación al técnico** (`registrarLiquidacion`): `materiales_total + Σ gastos + mano_de_obra` (fallback `costo_final` para gestiones viejas sin rendición). Antes no sumaba los gastos.
- **Cobro al pagador** (`registrarCobro`): sin cambios de fórmula — usa `costo_final + cargo_admin`, y `costo_final` ya trae los gastos adentro.

## Implementación

- **`codigo/features/gestiones/service.ts`** (`resolverConformidad`): deja de aceptar `costo_final` del cliente; al aprobar, trae `materiales_total`, `presupuestos(monto_materiales, monto_mano_obra, estado)` y `gastos_imprevistos(monto)`, computa `costo_final` con la fórmula única y lo persiste. El evento `conformidad_aprobada` registra el `costo_final` calculado. Se saca la validación de "costo negativo" (ya no hay input).
- **`codigo/components/gestiones/detalle.client.tsx`**
  - `AccionConformidadGestor`: se reemplaza el `<Input name="costo_final">` editable por un **desglose de solo lectura** (Materiales rendidos + Gastos imprevistos + Mano de obra = **Costo final**). El submit llama `resolverConformidad(subida.id, gestion.id, true, {})` sin costo. Botón "Aprobar → Cobro".
  - `AccionConformidadTecnico`: la rendición se relabela a **"solo materiales, sin los gastos imprevistos"**. Se retira el bloqueo de STORY-936 que exigía que los gastos "cubran" el exceso de materiales (deja de tener sentido con los gastos aparte, y mantenerlo doble-contaría); **se conserva** el avance obligatorio y la foto de todos los comprobantes (control anti-inflado). El desvío de materiales sigue visible para el gestor.
- **`codigo/features/finanzas/service.ts`** (`registrarLiquidacion`): suma `Σ gastos_imprevistos` al monto a liquidar.
- **`codigo/components/gestiones/finanzas.client.tsx`** (etapa `liquidacion_tecnico`): agrega el renglón "Gastos imprevistos" al desglose de "A liquidar al técnico" para que coincida con el nuevo monto.

## Supersede parcial de STORY-936

STORY-936 tenía dos guardas: (a) avance obligatorio para terminar y (b) los gastos imprevistos debían cubrir el exceso de materiales rendidos sobre lo presupuestado. Esta story **retira (b)** — los gastos pasan a ser extras aditivos, no la justificación del exceso de materiales — y **conserva (a)** más la foto obligatoria de comprobantes como control anti-inflado.

## Criterios de aceptación

1. En Conformidad el gestor ya **no puede tipear** el costo final: ve un desglose (materiales + gastos + mano de obra = costo final) de solo lectura y un botón Aprobar.
2. El costo final persistido = materiales rendidos + Σ gastos imprevistos + mano de obra, calculado server-side (no depende de lo que mande el cliente).
3. El total a cobrar al pagador (`costo_final + fee`) y el monto a liquidar al técnico (materiales + gastos + mano de obra) **incluyen los gastos imprevistos**.
4. Aprobar la conformidad no edita plata: solo aprueba y avanza a Cobro; el cobro lo confirma el gestor administrativo en su etapa.
5. El técnico rinde materiales **sin** los gastos imprevistos (label claro); puede terminar aunque los materiales superen lo presupuestado (con avance + foto de comprobantes), sin el bloqueo por gastos.
6. `tsc` + `eslint` verdes.

## Dev Agent Record

- **Archivos:** `codigo/features/gestiones/service.ts` (`resolverConformidad` + rendición de `subirConformidad`), `codigo/components/gestiones/detalle.client.tsx` (`AccionConformidadGestor` + `AccionConformidadTecnico`), `codigo/features/finanzas/service.ts` (`registrarLiquidacion`), `codigo/components/gestiones/finanzas.client.tsx` (etapa liquidación).
- **Verificación:** `tsc --noEmit` + `eslint` verdes. E2E pendiente (una gestión con rendición + gastos imprevistos: verificar que costo final = materiales + gastos + mano de obra, no editable; total a cobrar y a liquidar incluyen los gastos) al pullear.
- **Commit:** `b071d5f` (junto con STORY-960). E2E pendiente de Fausti.
