# STORY-1036 — Pago compartido: dos notas de cobro y dos cobros independientes (v1.0)

**Estado:** 🔨 en prueba · **Origen:** pedido de Fausti (2026-07-22) — "que se emitan dos notas de cobro y se registren dos cobros distintos; la inmobiliaria registra cada cobro cuando efectivamente fue realizado". Dispara el caso que la STORY-1031 dejó explícitamente para diseñar recién cuando hiciera falta ("si algún día hace falta rastrear 'el inquilino ya pagó su parte', se diseña recién entonces") — llegó el caso, con reporte de Giuliano en la card #160.

## Problema

Con pagador `compartido` (STORY-1031) el reparto es solo informativo: se manda UNA nota (el mismo PDF a los dos) y se registra UN cobro total, como si una persona pagara todo junto. En la práctica el inquilino y el propietario pagan **por separado y en momentos distintos**, y la inmobiliaria registra cada cobro cuando la plata efectivamente entró. Hoy no puede: o registra todo junto (mintiendo la fecha/medio de una de las partes) o no registra nada.

## Decisión de diseño

**Supera el "Fuera de alcance" de la STORY-1031** (que decía "el cobro sigue siendo uno solo") SOLO para `pagador = compartido`. El circuito de pagador único no se toca. Cero tablas y cero migraciones: cada cobro parcial es un evento `cobro_registrado` con `parte` (hechos congelados, patrón STORY-973 — el evento cuenta el cobro completo); los snapshots de la gestión (`cobrado_en`, `cobrado_monto`, `cobrado_fee`) se congelan al completarse el SEGUNDO cobro, así métricas, cartera y Walter no cambian ni una línea.

- **Dos notas de cobro**: con compartido, "Enviar nota" genera un PDF por parte — la nota del inquilino cobra SU monto (su % del total, mismo redondeo de la 1031) y la del propietario el suyo. Cada PDF muestra "Total a cobrar (su parte, X%)" + el bloque "Gasto compartido" con el total de la obra como contexto. Un email a cada uno con su propia nota. El gate `nota_emitida_en` sigue siendo uno (enviado = enviado a ambos).
- **Dos cobros independientes**: la card de cobro muestra un bloque por parte ("Cobro del inquilino — $X" / "Cobro del propietario — $Y"), cada uno con el `FormCobro` de siempre (medios combinados STORY-950 y recargo tarjeta STORY-975 aplican por parte, sobre el monto de esa parte). Cada registro inserta su evento con `parte`, medio(s), recargo y total efectivo de la parte.
- **La etapa espera a los dos**: la gestión sigue en `facturacion_cobro` hasta que ambas partes pagaron; la parte ya cobrada se muestra con constancia verde (fecha + medio) en lugar del form. Al registrar la segunda: snapshots congelados (`cobrado_monto` = suma de lo efectivamente cobrado con recargos, `cobrado_fee` como siempre) y `avanzarEtapa` como hoy (liquidación técnico, o `cancelada` si era cargo por cancelación — que también se reparte por el mismo %, igual que su nota en la 1031).
- **Estado por parte derivado en el server** (regla del PRD: nada de estados derivados en componentes): función única en `features/finanzas/consultas.ts` que lee los eventos y dice qué parte ya cobró; la usan la página del detalle (prop) y la pestaña Cobros. El server valida contra los mismos eventos que una parte no se cobre dos veces.
- **Finanzas → Cobros**: una gestión compartida cobrada muestra **una fila por parte** (quién, cuándo y con qué medio — lo que pedía Giuliano). Las compartidas cobradas ANTES de esta story (un solo cobro histórico, sin eventos con `parte`) conservan su fila única. Con una sola parte cobrada, la gestión sigue en Pendientes con la marca de lo que falta.
- **Columnas `medio_cobro`/`medio_cobro_2`/`recargo_tarjeta_*`**: quedan `null` en compartido (los medios por parte viven en los eventos); su único lector es la fila de Cobros, que para compartido lee de los eventos.

## Fuera de alcance

- Cambios al circuito de pagador único (idéntico al actual).
- Recordatorios/avisos de "falta que pague X" (el pendiente se ve en Cobros).
- Pagos parciales DENTRO de una parte (cada parte se cobra entera de una vez, con hasta 2 medios como siempre).

## Criterios de aceptación

1. Compartido: "Enviar nota" manda DOS emails, cada uno con SU PDF (montos por parte que suman exacto el total; la nota muestra el % y el total de la obra como contexto). Vista previa disponible para las dos notas.
2. La card de cobro muestra los dos bloques con sus montos; registrar el cobro de una parte deja constancia (evento en Actividad con parte, medio, recargo y total efectivo) y la gestión SIGUE en facturación con la otra parte pendiente y la cobrada en verde.
3. Registrar la segunda parte congela `cobrado_en`/`cobrado_monto` (suma efectiva)/`cobrado_fee` y avanza a Liquidación técnico (o `cancelada` si era cargo de cancelación). Informes y cartera leen lo mismo que siempre.
4. Finanzas → Cobros: la compartida cobrada aparece con una fila por parte (rotulo, fecha y medio propios); una compartida cobrada antes de esta story conserva su fila única; con una sola parte cobrada sigue en Pendientes indicando qué parte falta.
5. El server rechaza: cobrar dos veces la misma parte, `parte` en gestión no compartida y compartido sin `parte`. El recargo de tarjeta se calcula solo sobre la porción con tarjeta DE ESA PARTE.
6. Regresión: pagador único (inquilino O propietario) idéntico a hoy — una nota, un cobro, mismos eventos y snapshots; `tsc`/eslint verdes.

## Dev Agent Record

- **Implementación (2026-07-22):** 9 archivos, cero tablas/migraciones.
  - `features/finanzas/consultas-types.ts`: `ParteCobro` + `PARTE_COBRO_LABEL` + `CobroParcial`; `FilaCobroCerrado` gana `gestionId` (la clave de fila puede ser `{gestion}:{parte}`); `FilaCobroPendiente.parcialLabel`.
  - `features/finanzas/consultas.ts`: `partesCobradasPorGestion()` (LA derivación: eventos `cobro_registrado` con `parte`) + `cobrosParcialesDeGestion()` para la card del detalle; `listarCobros()` marca "Falta el X" en pendientes y abre una fila por parte en cerrados (fallback: compartidas cobradas pre-story conservan fila única).
  - `features/finanzas/service.ts`: `registrarCobro` con `parte` — valida compartido⇄parte, re-deriva el monto de la parte (mismo redondeo 1031), rechaza la parte ya cobrada (contra eventos), medios combinados y recargo tarjeta sobre el monto DE LA PARTE; primer parcial = solo evento; segundo = snapshots (`cobrado_monto` = suma efectiva, medios null — viven en los eventos) + `avanzarEtapa`. `datosDocumento`/`descargarDocumento` con `parteNota` (destinatario y total = esa parte); `emitirNotaCobro` genera un PDF por parte y manda un email a cada una (cancelación con cargo compartida incluida).
  - `features/finanzas/pdf.tsx`: "Total a cobrar (su parte, X%)" + label "Gasto compartido — total de la obra: $X".
  - `features/gestiones/eventos.ts`: `detalleLegible` con "Pagó: inquilino/propietario".
  - `components/gestiones/finanzas.client.tsx`: `CobroPorPartes` (bloque por parte: form o constancia ✓ fecha+medio; CTA final recién con la otra parte cobrada) + `NotasCobroCompartido` (vista previa por parte, un solo envío que manda las dos) — en las ramas normal y de cancelación; `envio-documento.client.tsx` gana `etiquetaEnvio`; `detalle.client.tsx` + `app/gestiones/[id]/page.tsx` traen `cobrosParciales` server-side.
  - `components/finanzas/finanzas.client.tsx`: pendientes con "· Falta el X"; cerrados linkean por `gestionId` (clave de fila ≠ id de gestión).
- **Verificación (2026-07-22, `tsc`+eslint verdes, E2E navegador como admin sobre la gestión #215, compartido 50% — total $1.042):** vista previa "nota del inquilino" → PDF a Santiago Reynoso con "Total a cobrar (su parte, 50%): $521,00" y total de la obra $1.042 como contexto ✓; "Enviar las dos notas" → 2 emails `enviado` en `emails_enviados` (inquilino y propietario) ✓; cobro del inquilino (transferencia) → constancia "Cobrado el 22/7/2026 — Transferencia ($521)", la gestión SIGUE en Cobro, evento "Total: $521 · Pagó: inquilino · Medio: Transferencia", Finanzas→Pendientes "· Falta el propietario", CTA restante pasó a "Registrar cobro → Liquidación" ✓; cobro del propietario (efectivo) → avanzó a Liquidación técnico, snapshots `cobrado_monto=1042`/`cobrado_fee=1`/medios null ✓; Cobrados con DOS filas "Compartido — pagó el inquilino/propietario", cada una con su fecha y medio ✓.
