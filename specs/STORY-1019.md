# STORY-1019 — Ciclo de vida de los adelantos: pestaña "Adelantos" en Finanzas, saldado y visibilidad por técnico (v1.0)

**Estado:** 🔨 implementada y verificada E2E · **Origen:** card Trello #141 (https://trello.com/c/Z6vVAHDB). Diseño salido de party mode (15ª sesión, con Fausti en la sala), disparado por dos hallazgos de la re-verificación E2E del 2026-07-20: (1) la constancia "quedan $X a resolver" es eterna e inmutable — si el técnico devuelve la plata después, el sistema miente para siempre; (2) al MISMO técnico reasignado se lo liquidó por $200.000 sin ningún recordatorio de que debía $100.000 de esa misma gestión. Reencuadre final de Fausti que simplificó y amplió a la vez: **registrar TODOS los adelantos** (no solo los congelados) — el camino feliz se salda solo al liquidar; lo que queda pendiente es exactamente lo que la obra no concretó.

## Problema

El adelanto es plata en la mano del técnico (doctrina STORY-1014), pero el sistema solo la muestra fragmentada: la columna viva en el detalle, la constancia congelada del saliente en la gestión, el sobrante en una línea de la liquidación. Nadie responde "¿cuánta plata está en la calle y en manos de quién?" ni puede registrar que una deuda se arregló.

**Cambio de decisión consciente** (citar siempre): STORY-1014 §fuera de alcance dijo "sin marcar como resuelto, sin lista global de adelantos a recuperar". La 15ª sesión lo revierte con caso real en la mano (el E2E encontró la liquidación ciega el mismo día). Lo que NO se revierte: "el sistema da constancia y visibilidad, no cobranza" — el saldado es un hecho que se registra, no un flujo de recupero.

## Alcance

### 1. Derivación de estados en UN solo lugar (read-model, cero tablas)

Nueva consulta en `codigo/features/finanzas/` (patrón `listarLiquidaciones`, `consultas.ts:162-235`) que deriva **tres estados** desde columna + eventos existentes. La derivación vive SOLO acá; pestaña, perfil del técnico y aviso de liquidación leen de acá (regla del PRD: nada de estados derivados repetidos en componentes — esto es un read-model sobre hechos congelados, patrón historial STORY-985):

- **En obra** (curso normal, informativo): gestión no cancelada, sin `liq_pagada_en`, con `adelanto_materiales > 0` (etapas `en_ejecucion` → `liquidacion_tecnico` pre-liquidación).
- **A resolver** (acá vive la acción) — tres orígenes, todos ya congelados en eventos:
  a. **Desasignación**: eventos con `adelanto_saliente` y `pendiente = adelanto_saliente − devolucion_adelanto > 0` (mismo cálculo de la constancia, `detalle.client.tsx:190-212`), sin evento de saldado.
  b. **Cancelación con adelanto**: gestión `cancelada` con `adelanto_materiales > 0` (la columna NO se resetea al cancelar — `avanzar_etapa.sql`: el bloque de reset solo corre hacia `asignacion`; decisión documentada en STORY-1014 §fuera de alcance), sin evento de saldado.
  c. **Sobrante de liquidación**: eventos `liquidacion_registrada` con `sobrante > 0` en el detalle (`service.ts:826,870-875`), sin evento de saldado. Caso que hoy muere en una línea ámbar y se pierde.
- **Saldado** (piedra): por **liquidación** (automático — `liq_pagada_en` marcada y sin sobrante: el descuento `max(base − adelanto, 0)` ES el saldado, verificado E2E "−$80.000"; no requiere acción ni evento nuevo) o **manual** (evento nuevo, punto 2).

### 2. Evento `adelanto_saldado` (el único escrito nuevo)

- Tipo nuevo en `eventos_gestion`, insertado vía el patrón `registrarEvento` existente (`features/finanzas/service.ts:241-251` — sin tocar RLS ni el RPC). Guard `exigirAdministrativo` (admin + gestor administrativo: es plata).
- Detalle congelado: `{tecnico_id, tecnico_nombre, monto, origen: "desasignacion"|"cancelacion"|"sobrante", origen_evento_id (null para cancelación), nota}`. La **nota es obligatoria** ("sin evidencia no existe": cómo se arregló — devolvió efectivo, materiales quedaron en la obra, se descontó de otra cosa).
- **Saldado binario, total** — sin parciales, sin cuotas, sin estados intermedios (Regla #0). La devolución parcial en el acto ya existe en el modal de desasignación (STORY-1014) y define el `pendiente`; el saldado cierra ese pendiente completo.
- Label en `LABEL_EVENTO` + caso en `detalleLegible` (`eventos.ts`). **Sin fila en `matriz_notificaciones`** → no notifica (correcto: el que salda es el que registra).
- Los hechos congelados NO se editan: el estado cambia **agregando un evento**, como todo en este sistema.

### 3. Pestaña "Adelantos" en Finanzas (read-only)

Tercera pestaña junto a Cobros | Liquidaciones (`components/finanzas/finanzas.client.tsx:32,106-109`), mismo público (layout ya exige admin + gestor administrativo, `app/finanzas/layout.tsx:6-16`), calcada de `TabLiquidaciones`:

- **A resolver** ARRIBA (es LA sección): agrupado por técnico con **total en el encabezado** y filas "monto · gestión #N (link) · origen · hace X días". Antigüedad con umbral ámbar `DIAS_ALERTA = 8` existente (`consultas-types.ts:59`), contada desde el evento de origen.
- **En obra** al medio: informativo, gris, SIN alarmas ni antigüedad ni acciones (técnico, monto, gestión, link). Es contexto, no pendiente.
- **Saldados** ABAJO por mes (patrón `HistorialMensual`, un mes por vez): automáticos ("saldado al liquidar") y manuales ("saldado el {fecha}: {nota}").
- **La pestaña no escribe nada** ("segunda puerta, misma cerradura"): lista, suma y linkea al detalle de la gestión. Sin realtime — fetch al entrar, como toda Finanzas.

### 4. Botón "Marcar saldada" en la gestión

- Vive donde vive la constancia, con su contexto: en el bloque de constancia del detalle (`DatosGestion`, `detalle.client.tsx:188-214`) para desasignaciones; línea equivalente (con el mismo botón) para gestión cancelada con adelanto y para sobrante de liquidación en gestión finalizada.
- Visible solo para admin + gestor administrativo; pide la nota y confirma. Tras saldar, la constancia pasa a: "recibió $X — devolvió $Y — **saldado el {fecha}: {nota}**" (deja de decir "a resolver": la evidencia vuelve a ser verdadera).

### 5. Visibilidad donde se decide

- **Perfil staff del técnico** (`app/tecnicos/[id]/page.tsx`): card nueva "Adelantos a resolver: $X en N gestiones" con links (solo si > 0). Fuente: la misma derivación del punto 1 filtrada por técnico. Es donde se decide "¿le doy otra obra / más plata a este técnico?".
- **Aviso ámbar en la pantalla de liquidación** (`finanzas.client.tsx:463-510`): si el técnico que se está liquidando tiene ítems "a resolver" abiertos (de CUALQUIER gestión), caja ámbar: "{técnico} tiene $X a resolver de la gestión #N — tenelo en cuenta antes de liquidar". **Solo aviso, no bloquea ni descuenta** (estilo de la casa; el descuento cross-gestión sería cobranza).

### 6. Walter aprende a responderlo (misma lectura, cero queries propias)

Caso real (2026-07-20): Fausti le preguntó a Walter "¿qué técnicos desasigné pero antes les había dado un adelanto?" y Walter no pudo — sus tools no cubren la pregunta, y la redirección que improvisó ("Finanzas → Liquidaciones") es imprecisa porque esa vista hoy no existe. Con la doctrina de la sesión de Walter intacta (**el asistente nunca sabe más que las pantallas del rol; sus tools envuelven services existentes, jamás queries propias**):

- La tool de finanzas de Walter (roles admin + gestor administrativo — los mismos que ven la pestaña) se extiende para envolver la derivación del punto 1: responde "cuánta plata está en la calle", "qué técnicos tienen adelantos a resolver y de qué gestiones", "¿le debo plata a alguien / me deben?" con los tres estados y links a las gestiones (deep links whitelisted, patrón existente).
- Para gestor de mantenimiento y técnico la tool NO existe (no ven Finanzas — "si no puede entrar a /finanzas, su asistente tampoco sabe de adelantos").
- Sin evidencia no existe: Walter solo afirma montos que vengan del tool result, con denominadores ("$100.000 a resolver en 1 gestión de 2 técnicos con deuda").

## Fuera de alcance (decisiones conscientes)

- **Escritura desde la pestaña**: nada — el botón vive en la gestión.
- **Saldado parcial, cuotas, intereses, mora, export**: nada de módulo contable (Regla #0; "MANTIS no es un sistema de recupero de deudas" — eso sigue vigente).
- **Descuento automático cross-gestión en la liquidación**: no — el aviso informa, el humano decide.
- **Tabla de adelantos por técnico** (STORY-933): sigue muerta — todo esto es lectura de columna + eventos que ya existen.
- **Notificaciones nuevas**: ninguna.

## Criterios de aceptación

1. **En obra**: gestión activa con adelanto → aparece en la sección "En obra" de la pestaña; al liquidarla (descuento completo) pasa sola a "Saldados" del mes, sin que nadie toque nada.
2. **Desasignación**: adelanto $150.000 con devolución en el acto $50.000 → ítem "a resolver" de $100.000 (neto), agrupado por técnico, con antigüedad. Dos desasignaciones en la misma gestión → dos ítems independientes.
3. **Mismo técnico reasignado**: su deuda vieja (evento) queda separada de su adelanto nuevo (columna) — el ítem "a resolver" no se mezcla con "en obra" (verificado el aislamiento en el E2E del 2026-07-20).
4. **Cancelada con adelanto** → ítem "a resolver" con origen cancelación. **Sobrante de liquidación** → ítem "a resolver" por el sobrante exacto.
5. **Saldar**: botón en la constancia (solo admin/gestor administrativo; el gestor de mantenimiento y el técnico NO lo ven), nota obligatoria → evento `adelanto_saldado` congelado, constancia actualizada a "saldado el {fecha}: {nota}", ítem sale de "A resolver" y entra a "Saldados" del mes. Auditoría lo muestra con `detalleLegible`.
6. **Perfil del técnico**: con deudas abiertas muestra la card con total y links; sin deudas, no aparece nada.
7. **Liquidación con deuda abierta** (misma u otra gestión): aviso ámbar con monto y gestión de origen; la liquidación se registra igual y descuenta SOLO el adelanto propio de esa gestión (regresión STORY-1014).
8. **Derivación única**: pestaña, perfil, aviso y la tool de Walter leen la misma función de `features/finanzas/` — la lógica de los tres estados no está repetida en ningún lado.
8b. **Walter**: como admin, "¿qué técnicos desasigné que tenían adelanto?" → responde con técnico, monto a resolver y gestión (del tool result, con denominadores). Como gestor de mantenimiento o técnico, la pregunta no expone datos de Finanzas (tool ausente del catálogo del rol).
9. Regresión: Cobros y Liquidaciones intactas (pestañas, stat cards, historial mensual); constancia existente intacta cuando no hay saldado; `tsc`/eslint verdes.

## Dev Agent Record

- **Archivos:** `features/finanzas/consultas-types.ts` (tipos + `ORIGEN_ADELANTO_LABEL`), `features/finanzas/consultas.ts` (`derivarAdelantos()` — LA derivación única — + `listarAdelantos` gated admin/administrativo + `adelantosAResolverDeTecnico` staff), `features/finanzas/service.ts` (`marcarAdelantoSaldado` — recalcula monto/técnico del hecho de origen, guard doble-saldado, nombre congelado), `features/gestiones/eventos.ts` (label + detalleLegible de origen/nota), `components/finanzas/finanzas.client.tsx` (pestaña Adelantos: A resolver por técnico con antigüedad ámbar / En obra informativo / Saldados por mes), `app/finanzas/page.tsx`, `components/gestiones/detalle.client.tsx` (`SaldarAdelanto` + constancias con saldado para desasignación/cancelada/sobrante + prop `deudasTecnico`), `components/gestiones/finanzas.client.tsx` (aviso ámbar pre-liquidación), `app/gestiones/[id]/page.tsx` (fetch deudas solo en liquidación), `app/tecnicos/[id]/page.tsx` (card con links), `features/asistente/tools.ts` (tool `adelantos_tecnicos`, solo roles con Finanzas). Cero migraciones, cero tablas.
- **Verificación (2026-07-21, E2E navegador como admin sobre la gestión #102 del test de la 1014):** pestaña con las 3 secciones ✓ (tecnicodos $100.000 "Técnico desasignado" en A resolver; adelantos vivos en En obra); aviso ámbar en la pantalla de liquidación con montos y gestión ✓; perfil del técnico "Adelantos a resolver: $100.000 en 1 gestión" con link ✓; "Marcar saldada" + nota → constancia "saldado el {fecha}: {nota}", evento "Adelanto saldado con el técnico" en Actividad, aviso de liquidación desaparece ✓; liquidar → el adelanto de $80.000 pasa solo a Saldados "Al liquidar" ✓; la derivación destapó dos casos reales preexistentes (desasignación #110 de Raúl Medina y una CANCELADA con adelanto de $50.000) ✓; Walter (admin): "¿qué técnicos desasigné con adelanto?" → respuesta con técnicos, montos, orígenes y total, distinguiendo En obra ✓. `tsc` + eslint verdes. Sin caso de sobrante en datos (rama verificada por código, misma mecánica que desasignación).
