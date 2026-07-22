# STORY-1032 — Liquidación: descontar las deudas del técnico (adelantos "A resolver") del pago (v1.0)

**Estado:** 🔨 en prueba · **Origen:** pedido de Fausti (2026-07-21) — "al liquidar al técnico poder cobrar de la liquidación la deuda del técnico, que quede en el timeline, y que los carteles de deuda digan de dónde viene". Diseño resuelto en party mode (16ª sesión, a puertas cerradas). Decisiones de Fausti post-sesión: **descuento PARCIAL desde el día uno** y **el técnico VE el descuento aclarado** en su liquidación.

## Problema

El técnico puede deber plata (adelantos que quedaron "A resolver": desasignado con adelanto dado, gestión cancelada con adelanto, sobrante de liquidación). Cuando ese mismo técnico llega a la liquidación de OTRA gestión, el sistema tiene la plata en la mano y solo muestra un aviso ámbar que dice "es un aviso, no descuenta ni bloquea" (STORY-1019). El administrativo no puede cobrar la deuda desde ahí: paga completo y la deuda sigue eterna. Además, varios carteles de deuda no dicen de qué gestión viene la plata (sin link al origen).

## Decisión de diseño (party mode)

**Cero tablas, cero migraciones.** El descuento reusa la maquinaria de la 1019: por cada deuda descontada se inserta un evento `adelanto_saldado` en la gestión de ORIGEN y `derivarAdelantos()` (features/finanzas/consultas.ts) cierra/reduce solo. El sistema sigue sin ser cobranza (doctrina 13ª sesión): esto es UNA opción dentro de un acto de pago que ya existe.

- **Superficie**: el aviso ámbar pre-liquidación (finanzas.client.tsx, rama `liquidacion_tecnico`) se vuelve accionable — cada deuda "A resolver" del técnico es una línea con checkbox "Descontar de esta liquidación", monto pendiente y descripción de la gestión de origen **linkeada**. Todo arranca **destildado** (cobrar es una decisión, no un default).
- **Desglose vivo**: `Base − adelanto de esta obra − deudas seleccionadas = A pagar`. Con "a pagar" $0 (sobrante propio) los checkboxes se deshabilitan.
- **Parcial desde el día uno** (decisión de Fausti, revierte el "saldado binario" de la 1019 para esta vía): si la deuda no entra completa, se descuenta lo que alcance — `descontado = min(pendiente, restante a liquidar)` — y la deuda queda "A resolver" con el pendiente reducido. Con varias deudas tildadas se descuenta por antigüedad (la más vieja primero), orden fijado server-side.
- **Server-side** (`registrarLiquidacion`, features/finanzas/service.ts): re-deriva las deudas con `derivarAdelantos()` — jamás montos del cliente —, valida que cada seleccionada exista, esté pendiente y sea del técnico liquidado, y reusa el guard anti doble-saldado.
- **Derivación con parciales** (`derivarAdelantos`): el pendiente de un ítem pasa a ser `monto_original − devolución en el acto − Σ montos de sus adelanto_saldado`. "A resolver" mientras pendiente > 0; "Saldado" cuando llega a 0. El "Marcar saldada" manual NO cambia: sigue siendo total (cierra el pendiente restante de ese momento).
- **Orden de escritura ante fallos** (dirección segura): primero la liquidación, después los saldados. Si un insert de saldado falla, la deuda sigue "A resolver" (molesta dos veces, nunca pierde plata en silencio) y queda el saldado manual como red; el error se reporta.

## Timeline / eventos (hechos congelados)

- `adelanto_saldado` en la gestión de ORIGEN, detalle: `{ monto: descontado, origen, origen_evento_id?, tecnico_id, tecnico, via: 'liquidacion', gestion_liquidacion_id, nota: "Descontado de la liquidación de «{descripción gestión Y}»" }`.
- `liquidacion_registrada` en la gestión que liquida suma `deudas_descontadas: [{ gestion_id, descripcion, monto }]` (congeladas). `liq_monto` sigue siendo **lo efectivamente pagado**.
- `detalleLegible` (features/gestiones/eventos.ts): la liquidación muestra el descuento aclarado — monto pagado + "Descontado por adelantos pendientes: $Y (de «{gestión}»)"; el saldado vía liquidación muestra de qué liquidación vino.
- **El técnico LO VE** (decisión de Fausti, matiza la 1029 solo en la gestión que liquida): en su Actividad la liquidación aparece con el desglose claro — se liquidó todo, con el descuento por deuda deducido y explicado. La constancia y los eventos de la gestión de ORIGEN siguen internos para el técnico (STORY-1029 intacta ahí).
- Pestaña Finanzas → Adelantos → Saldados: el medio distingue "Descontado al liquidar" de "A mano" (y del "Al liquidar" del adelanto propio).

## Links de origen (tercer pedido)

- Aviso pre-liquidación: cada deuda linkea a `/gestiones/{id}` de origen.
- Tarjetas de la pestaña Adelantos ("A resolver" y "Saldados"): link a su gestión.
- Constancia en la gestión de origen saldada/reducida vía liquidación: link a la gestión liquidadora ("Descontado de la liquidación de …").
- El perfil staff del técnico ya linkea (STORY-1019): queda como está.

## Fuera de alcance (decisión explícita)

- Flujo de cobranza/recupero fuera del acto de liquidación (sigue siendo asunto humano).
- Cuotas, planes de pago o saldado manual parcial (el manual sigue total).
- Tabla de deudas o columnas nuevas (todo sigue derivado de eventos).

## Criterios de aceptación

1. Liquidando a un técnico con deudas "A resolver" de otras gestiones, el administrativo puede tildar cuáles descontar; el desglose muestra en vivo base, adelanto propio, descuentos y "A pagar"; cada deuda linkea a su gestión de origen.
2. Deuda mayor que lo disponible → se descuenta lo que alcanza y queda el pendiente reducido "A resolver"; deuda cubierta completa → pasa a "Saldados". Varias tildadas → se descuentan por antigüedad.
3. En la gestión de ORIGEN queda el evento `adelanto_saldado` con `via: liquidacion` y link a la gestión liquidadora; en la liquidadora, `liquidacion_registrada` lleva `deudas_descontadas` y la Actividad muestra el descuento. `liq_monto` = lo efectivamente pagado.
4. El técnico ve en su Actividad la liquidación con el descuento deducido y aclarado (qué se le descontó y por qué); NO ve las constancias internas de la gestión de origen (regresión 1029).
5. El server rechaza montos/keys inventados del cliente (re-deriva), y una deuda ya saldada a mano en simultáneo no se descuenta dos veces.
6. Regresión: liquidar sin deudas o sin tildar nada queda idéntico a hoy (mismo desglose, mismos eventos); el "Marcar saldada" manual sigue funcionando igual.

## Dev Agent Record

- **Implementación (2026-07-21/22):** 8 archivos, cero tablas/migraciones.
  - `features/finanzas/consultas-types.ts`: `claveDeuda()` (clave estable cliente↔server) + modo `"descuento"` en `FilaAdelantoSaldado`.
  - `features/finanzas/consultas.ts` (`derivarAdelantos`): los saldados pasan de "existencia que cierra" a **suma de montos** — pendiente = original − devolución − Σ saldados; el ítem sigue "A resolver" mientras pendiente > 0.
  - `features/finanzas/service.ts`:
    - `registrarLiquidacion`: recibe claves `deuda` del form, re-deriva con `adelantosAResolverDeTecnico()` (jamás montos del cliente), valida que cada seleccionada siga pendiente, retiene `min(pendiente, restante)` por antigüedad, `liq_monto` = lo efectivamente pagado. Orden de escritura seguro: update de la liquidación → eventos `adelanto_saldado` en las gestiones de ORIGEN (detalle: `via:'liquidacion'`, `gestion_liquidacion_id`, nota auto) → evento `liquidacion_registrada` con `deudas_descontadas` congeladas (antes del email, para que el PDF las lea) → `avanzarEtapa`. Si un insert de saldado falla, la deuda sigue "A resolver" y se reporta (red = saldado manual).
    - `marcarAdelantoSaldado`: ahora resta los saldados previos (parciales) — cierra el RESTO; el guard de doble saldado pasó a ser numérico (pendiente ≤ 0).
    - `datosDocumento("detalle")`: lee `deudas_descontadas` del último evento de liquidación → el PDF del técnico muestra cada descuento y el total cierra (también al re-descargar).
  - `features/finanzas/pdf.tsx`: líneas "Adelanto pendiente descontado («desc»)  − $X" en el desglose del detalle.
  - `features/gestiones/eventos.ts` (`detalleLegible`): "Descontado por adelantos pendientes: $X de «desc» · …" — visible también para el técnico (decisión de Fausti).
  - `components/gestiones/finanzas.client.tsx`: el aviso ámbar pre-liquidación pasó de informativo a accionable — checkbox por deuda (arranca destildado), descripción linkeada a la gestión de origen, aviso de retención parcial por ítem y desglose vivo (− Deudas de otras gestiones = A liquidar). El texto "no descuenta ni bloquea" murió con la feature.
  - `components/gestiones/detalle.client.tsx`: constancia parcial-aware (Adelanto / Devolvió / **Recuperado** / Pendiente; resuelto = pendiente ≤ 0) + `LineasSaldado` con "Ver liquidación" (link a la gestión liquidadora). El filtro de rol técnico de la 1029 no cambia.
  - `components/finanzas/finanzas.client.tsx`: medio "Descontado al liquidar" en Saldados.
- **E2E (Playwright + SQL, gestiones sintéticas `E2E-1032%` borradas al final):** dos deudas ($30.000 vieja y $150.000 nueva) contra liquidación de $120.000 → preview vivo exacto ("Se retienen $90.000 — quedan $60.000"), liquidación en $0, origen A **Saldado** con link, origen B **A resolver** con Recuperado $90.000/Pendiente $60.000, "Marcar saldada" manual cerró exactamente los $60.000 restantes, pestaña Adelantos con los 3 saldados bien etiquetados, evento con `deudas_descontadas` congeladas, email del detalle enviado, el técnico ve el descuento aclarado en su Actividad y sigue sin ver las gestiones de origen (regresión 1029 OK). `tsc` + `eslint` verdes.
- **Commit:** `af5a4e0` (2026-07-22, con OK de Fausti).
