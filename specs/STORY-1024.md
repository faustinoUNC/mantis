# STORY-1024 — El tiempo en pausa no cuenta contra el plazo del técnico (v1.0)

**Estado:** ✅ hecha (commit `08b68e0`) · **Origen:** sospecha de Fausti (2026-07-21): "revisar si mientras la gestión está pausada corren los días perjudicando métricas del técnico a causa de demora de la obra". **Confirmada en el análisis previo: corren.**

## Problema

La pausa ("no puedo continuar", STORY-971/976) no cambia la etapa: la gestión sigue en `en_ejecucion` con `aviso_no_continua_en` seteado, esperando una decisión del gestor. La métrica de **cumplimiento de plazo por técnico** (STORY-921/984) mide `real = span de calendario entrada→salida de en_ejecucion` (`ejecucion.ts:38-52`, `ejecucionParaPlazoDias`) **sin descontar nada**: si el técnico avisa que está bloqueado y el gestor tarda N días en resolver, esos N días inflan el desvío del técnico en la card de Informes (`panel-metricas.client.tsx:564-577`) y en el % "Plazo" del picker de asignación (`gestiones/service.ts:834-836`). Una demora administrativa lo puede meter en la lista de "se pasaron del plazo".

Los datos para corregirlo ya existen en `eventos_gestion`: cada pausa deja un evento `tecnico_no_continua` y cada reanudación un `aviso_resuelto` (`service.ts:1318-1323`, `:1355`) o la `transicion` que la limpia (`avanzar_etapa.sql:138-142`).

## Alcance

1. **Helper compartido** (`codigo/features/gestiones/ejecucion.ts`): `ejecucionParaPlazoDias()` recibe además los eventos de pausa y resta del span los intervalos `tecnico_no_continua → (aviso_resuelto | siguiente transicion)` que caen dentro de la ejecución (recortados al span; una pausa aún abierta se recorta al fin del span). Soporta múltiples pausas por gestión. El piso `max(1, …)` y la regla "solo cierra contra conformidad" (STORY-984) no cambian.
2. **Informes** (`features/metricas/service.ts:83-86`): el fetch de eventos suma `tecnico_no_continua` y `aviso_resuelto` al filtro `tipo='transicion'`, y la card de cumplimiento de plazo pasa los eventos de pausa al helper. Retroactivo: el histórico ya tiene los eventos.
3. **Picker de asignación** (`features/gestiones/service.ts:782-798`): misma corrección en el cálculo de `desvioPlazoPct` del scorecard.
4. `ultimaEjecucionDias` (tiempo de ciclo, métrica de circuito) **no se toca**: mide el circuito completo, y descontarle la pausa ocultaría un problema real del circuito.
5. **Descubierto al verificar — eventos truncados a 1000 filas**: `eventos_gestion` ya superó las 1000 transiciones (1027 al 2026-07-21) y PostgREST corta en 1000 por request → el panel YA calculaba métricas con historial incompleto en silencio. Se paginan los fetch de eventos (Informes y picker) con `range()` + orden estable.

## Fuera de alcance

- Descontar pausas en cuellos de botella / tiempo de ciclo / estancadas: son métricas del circuito, no puntúan al técnico; la espera administrativa ahí es información, no injusticia.
- Cambiar el modelo de pausa o agregar columnas: los eventos alcanzan.

## Criterios de aceptación

1. Gestión con pausa de N días dentro de la ejecución: el desvío de plazo del técnico se calcula sobre `real − N`, en Informes y en el picker (mismos números en ambos).
2. Gestión con dos pausas: se descuentan ambas.
3. Pausa resuelta por transición de etapa (sin `aviso_resuelto`): también se descuenta.
4. Gestión sin pausas: números idénticos a los de hoy (regresión).
5. Pausa vigente al momento de consultar (aún sin resolver, obra en curso): no rompe el cálculo de las terminadas ni el scorecard.
6. `tsc` + eslint verdes; el tiempo de ciclo y cuellos de botella no cambian.

## Dev Agent Record

- **Commit:** `08b68e0`.
- **Archivos:** `codigo/features/gestiones/ejecucion.ts` (`EventoPausa`, `msPausado()` — cada inicio cierra con el primer `fin`/transición posterior, recortado al span y sin doble conteo; `ejecucionParaPlazoDias(transiciones, pausas)`); `codigo/features/metricas/service.ts` (`EventoMetrica.tipo`; `todosLosEventos()` paginado que trae `transicion` + eventos de pausa); `codigo/components/metricas/panel-metricas.client.tsx` (memo de ejecución separa pausas por gestión y las pasa al helper — los demás consumidores ignoran los eventos de pausa por su guard de `aEtapa`); `codigo/features/gestiones/service.ts` (picker: fetch paginado con pausas + pase al helper).
- **Verificación:** `tsc --noEmit`, eslint y `next build` verdes. **Unit** (tsx, 11 casos): sin pausas, pausa con `aviso_resuelto`, dos pausas, pausa cerrada por transición, pausa fuera del span (antes y después), piso de 1 día, reasignación con pausa vieja, cancelada no computa, ciclo intacto — todos ✅. **E2E con datos sintéticos**: gestión `[TEST-1024]` (plazo 5 días, ejecución 12 días calendario con pausa de 6 adentro) → la card "Desvío de plazo" de Informes mostró **+20%** exactos (real efectivo 6 vs 5; sin el fix habría sido +140%); borrada tras verificar, cascade limpio. La paginación además recuperó historial que ya se truncaba (la card pasó de 59 a 60 gestiones con los mismos datos).
