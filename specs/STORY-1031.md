# STORY-1031 — Pago compartido: el gasto se divide por porcentaje entre inquilino y propietario (v1.0)

**Estado:** 🔨 en prueba · **Origen:** pedido de Fausti (2026-07-21) — "ver si podemos establecer con porcentaje cuánto paga cada parte y permitir compartir los gastos, evaluando el impacto en el resto del sistema". Diseño resuelto en party mode (undécima sesión).

## Problema

Hoy `pagador` es binario (`inquilino` | `propietario`): una obra la paga entera una sola parte. En la práctica hay arreglos donde el gasto se comparte (mitad y mitad, u otra proporción acordada). El sistema no puede reflejarlo: el gestor tiene que elegir a uno y el otro queda fuera de los documentos, los emails y los números de la propiedad.

## Decisión de diseño (party mode)

**El split es informativo/contractual, NO contable.** La inmobiliaria sigue cobrando UN total por gestión y registrando UN cobro (como hasta ahora); lo que cambia es cómo se informa y reparte ese total entre las dos partes. Se descartó explícitamente el modelo de "dos deudas / dos cobros / saldos por persona" (dos notas, pagos parciales por parte, tabla de pagos): duplica el circuito de cobro entero y viola la Regla #0. Si algún día hace falta rastrear "el inquilino ya pagó su parte", se diseña recién entonces.

- DB: valor nuevo `compartido` en el enum `pagador_gestion` + columna `gestiones.pagador_pct_inquilino integer` (1–99; solo tiene sentido con `pagador = 'compartido'`). El % del propietario se deriva (100 − pct), nunca se guarda.
- La elección sigue viviendo donde siempre (etapa Presupuesto, STORY-943) y se ancla igual que hoy al enviar/aprobar.
- Reglas de validación: `compartido` exige legajo vigente (mismo criterio que `inquilino`, STORY-962) y % entero entre 1 y 99. Para enviar documentos, exige email de AMBAS partes.
- Los montos por parte se calculan siempre desde el total con redondeo a centavos y el propietario absorbe el resto (suma exacta = total).

## Alcance

- **UI (etapa Presupuesto):** opción "Compartido" en el select "Paga" (solo si hay inquilino) + campo "% inquilino" (default 50) con el % del propietario derivado a la vista. El total de la vista previa muestra el reparto.
- **Documentos (presupuesto y nota de cobro):** cuando es compartido, el PDF muestra el reparto bajo el total ("Inquilino Ana (30%): $X / Propietario Pedro (70%): $Y") y el destinatario pasa a "Inquilino y propietario". Aplica también a la nota de cancelación con cargo (mismo % sobre el cargo). El detalle del técnico no cambia (nunca ve pagador).
- **Emails (presupuesto, nota de cobro, ampliación STORY-1017):** con compartido se envía el MISMO documento a los dos (un email por persona, con su nombre en el saludo). El gate de STORY-935/1017 no cambia: enviado = enviado a ambos.
- **Ampliación (gasto extra):** el aviso llega a los dos; la autorización se registra una sola vez como hoy (el gestor confirma que ambas partes acordaron).
- **Cobro (Finanzas):** sin cambios de circuito. La tabla muestra rótulo "Compartido" con ambos nombres y el % en la fila.
- **Cartera (historial de la propiedad + resumen PDF):** los totales "Pagó inquilino / Pagó propietario" reparten el costo de las obras compartidas por su % (dejan de ser sumas binarias).
- **Actividad/eventos y Walter:** el evento de aprobación guarda el % y el timeline lo muestra; la tool `detalle_gestion` expone el pagador con el reparto.

## Fuera de alcance (decisión explícita)

- Registrar pagos parciales por persona / saldos por parte — el cobro sigue siendo uno solo.
- Split entre más de dos partes o partes externas (solo inquilino + propietario).
- % con decimales (enteros alcanzan para acuerdos reales).
- Métricas/gráficos por pagador (hoy no existen; no se agregan).

## Criterios de aceptación

1. En Presupuesto se puede elegir "Compartido" con un % de inquilino (1–99, default 50); sin inquilino vigente la opción no aparece y el server la rechaza.
2. El PDF de presupuesto y la nota de cobro de una gestión compartida muestran el reparto con nombres, % y montos que suman exacto el total; el email llega a ambas partes (dos registros en `emails_enviados`).
3. Aprobar sin enviar sigue bloqueado (gate STORY-935 intacto); con compartido el envío exige email de las dos partes.
4. El flujo normal (pagador único) queda idéntico: mismos textos, un solo email, sin % en documentos.
5. La pestaña Cobros muestra "Compartido" con ambos nombres; el cobro se registra una sola vez como siempre.
6. En el historial de la propiedad y el resumen PDF, una obra compartida reparte su costo por % entre "Pagó inquilino" y "Pagó propietario".
7. `tsc`/eslint verdes.

## Dev Agent Record

- **Commit:** `a8c2c7b` (2026-07-21).
- **DB:** migración `story_1031_pagador_compartido` aplicada en el proyecto (`alter type pagador_gestion add value 'compartido'` + columna `gestiones.pagador_pct_inquilino integer check (1–99)`).
- **Archivos:** `features/gestiones/types.ts` (tipo `Pagador` + campo + helper `etiquetaPagador`), `features/gestiones/service.ts` (`obtenerGestion` + `resolverPresupuesto`: validación % y legajo vigente, anclaje, evento con `pct_inquilino`), `features/finanzas/service.ts` (`datosDocumento`: resolución dual de destinatarios + `envios[]` + `split` calculado con redondeo a centavos; `errorPctInquilino`; envío en loop a ambas partes en presupuesto/nota/ampliación con error si falta un email), `features/finanzas/pdf.tsx` (bloque "Gasto compartido" bajo el total), `features/finanzas/consultas.ts` (+`consultas-types.ts` comentario) (`resolverPagador` con rótulo "Compartido" y ambos nombres con %), `components/gestiones/detalle.client.tsx` (opción Compartido + input "% inquilino" + reparto en la vista previa + rótulos legibles), `components/gestiones/finanzas.client.tsx` (rótulos + reparto en la card de facturación), `features/cartera/historial.ts` (helper `parteObra`) + `cartera/service.ts` + `resumen-pdf.tsx` + `components/cartera/historial.client.tsx` (totales por parte proporcionales), `features/asistente/tools.ts` (Walter informa el reparto), `features/gestiones/eventos.ts` (timeline con reparto).
- **Verificación:** `tsc` y eslint verdes. E2E navegador (2026-07-21): gestión #119 — Compartido 30% + fee $20.000 → vista previa $849.000 = $254.700 + $594.300, envío del presupuesto generó DOS emails (inquilina Ana + propietaria Silvia, ambos `enviado` en `emails_enviados`), pagador/% anclados al enviar, "Aprobar y ejecutar" pasó a En ejecución con "Paga: compartido (inquilino 30% / propietario 70%)" en datos y Actividad. Gestión #93 (facturación, seteada compartido 40% vía SQL) — card de cobro $384.000 = $153.600 + $230.400, nota de cobro a los DOS emails, tabla de Cobros "Compartido: Federico Torres (40%) + Sucesión de Elena Marchetti (60%)", historial de la propiedad "Pagó inquilino $1.545.600 · propietario $2.025.400" (suma exacta del invertido $3.571.000). Flujo de pagador único visualmente intacto (filas Inquilino/Propietario de Finanzas sin cambios).
