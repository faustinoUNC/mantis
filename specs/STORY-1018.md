# STORY-1018 — Tope de adelanto de materiales: aviso con confirmación antes de entregar de más (v1.0)

**Estado:** 🔨 implementada y verificada E2E, sin commitear (espera OK) · **Origen:** card Trello #140 (https://trello.com/c/g62CpqDC). Diseño salido de party mode (15ª sesión, con Fausti en la sala), disparado por la re-verificación E2E de STORY-1014/1017 (2026-07-20): el sistema aceptó en silencio un adelanto de $150.000 con materiales presupuestados por $95.000 — el aviso llegaba recién en la liquidación, cuando la plata ya salió.

## Problema

El adelanto de materiales no tiene ninguna referencia contra el presupuesto al momento de cargarse. `registrarAdelantoMateriales` valida monto, comprobante y etapa, pero ningún tope (`codigo/features/finanzas/service.ts:695-754`). El único aviso existente es el de sobrante en la liquidación (`finanzas.client.tsx:505-510`) — llega tarde por definición: la plata ya está en la mano del técnico.

**Historia previa (citarla, no repetirla):** STORY-977 v1.1 REMOVIÓ un tope duro contra presupuesto (comentario en `service.ts:686-688`) porque bloqueaba casos legítimos. Esta story lo reintroduce **conscientemente en otra forma**: aviso con confirmación, nunca bloqueo. Doctrina aplicable: "aviso, no candado" (STORY-1001/1017) — el "continuar igual" acá es legítimo (comprar materiales antes de un aumento, gestor que sabe lo que hace), por eso NO aplica "una advertencia con 'continuar igual' es un bloqueo que aprendió a mentir" (esa vale cuando el sí no debería existir).

## Alcance

1. **Fórmula del tope** (client, con datos que ya viajan en `GestionDetalle` — cero queries nuevas):
   - `tope = monto_materiales del presupuesto aprobado vigente + Σ ampliaciones aprobadas del técnico ACTUAL`.
   - Presupuesto vigente: patrón existente del propio componente (`finanzas.client.tsx:216-219` — aprobado más reciente). Ampliaciones: patrón exacto del aviso de Cobro (`finanzas.client.tsx:399-408` — `estado==="aprobada" && tecnico_id === gestion.tecnico_id`).
   - **Mano de obra AFUERA** (el adelanto es de materiales; toparlo contra el total habilitaría adelantos gigantes que no son para materiales). **La ampliación suma ENTERA al tope, a sabiendas** — no tiene split materiales/mano de obra y pedirlo sería la burocracia demolida tres veces (932/933/965). Que nadie lo "descubra" como bug.
   - Se compara el **acumulado**: `yaAdelantado + montoNuevo > tope` (la columna suma entregas, `service.ts:731` — el segundo adelanto que cruza el tope también avisa).

2. **Aviso ámbar en el paso de confirmación existente** (`AdelantoMateriales`, `finanzas.client.tsx:238-262`): si el acumulado supera el tope, el bloque de "¿Confirmás?" suma una caja ámbar (tokens `urgente-soft`/`urgente-fuerte`, patrón del aviso de Cobro `:411-425`) con el excedente concreto: "Con este adelanto le habrás entregado $X — son **$Y más** que los materiales autorizados ($tope). ¿Confirmás igual?". Nada de "¿estás seguro?" genérico. El botón sigue siendo "Confirmar adelanto": **cero bloqueo, cero pasos extra** para el caso normal (bajo el tope no cambia nada visible).

3. **Excedente congelado en el evento** (auditable — "un aviso que no deja huella es cortesía, no control"): `registrarAdelantoMateriales` calcula el mismo tope server-side (lee presupuesto aprobado + ampliaciones, mismo criterio) y, si `total > tope`, agrega `excedente_tope` al detalle del evento `adelanto_materiales_registrado` (hoy `{monto, total, comprobante_path}`, `service.ts:751`). `detalleLegible` (`eventos.ts:56-97`) lo muestra: "Excedió lo autorizado en $X". La Auditoría responde "quién autorizó darle de más" sin ninguna pantalla nueva.

4. **El "límite que sigue al presupuesto" NO se programa**: la fórmula lee el presupuesto aprobado vigente y las ampliaciones del técnico actual en el momento de cargar. Desasignación resetea el contador (`avanzar_etapa.sql:114`) y el entrante trae presupuesto propio → el tope acompaña cada ciclo solo, verificado en el E2E del 2026-07-20.

## Fuera de alcance (decisiones conscientes)

- **Bloqueo duro**: descartado — es exactamente lo que la v1.1 de STORY-977 tuvo que remover. El aviso con confirmación es la forma final.
- **Split materiales/mano de obra en ampliaciones**: no — la ampliación infla el tope entera (decisión consciente de la 15ª sesión).
- **Notificación**: ninguna — sin fila nueva en `matriz_notificaciones` (el adelanto nunca notificó, STORY-977).
- **Tope configurable, porcentaje de tolerancia, aprobación de segundo nivel**: nada.

## Criterios de aceptación

1. Adelanto bajo el tope → el paso de confirmación se ve EXACTAMENTE igual que hoy (regresión: cero fricción nueva).
2. Adelanto que cruza el tope (solo materiales presupuestados) → caja ámbar con acumulado, tope y excedente; "Confirmar adelanto" funciona igual; el evento lleva `excedente_tope` y la Actividad/Auditoría lo muestran.
3. Con una ampliación aprobada del técnico actual, el tope sube por su monto completo; una ampliación rechazada o de un técnico saliente NO suma (patrón STORY-1017).
4. Segundo adelanto que recién en acumulado cruza el tope → avisa (compara `yaAdelantado + monto`).
5. Tras desasignar y re-presupuestar, el tope es el del presupuesto nuevo y el acumulado arranca de cero (sin código nuevo — verificar que sigue así).
6. Sin presupuesto aprobado visible (caso teórico — en ejecución siempre hay): no se muestra aviso ni se rompe nada (tope no calculable = sin aviso, comportamiento de hoy).
7. Regresión: `tsc`/eslint verdes; carga de adelanto, liquidación con descuento y sobrante intactos.

## Dev Agent Record

- **Commit:** _(pendiente — espera OK de Fausti)_.
- **Archivos:** `codigo/components/gestiones/finanzas.client.tsx` (`AdelantoMateriales`: cálculo de `topeAdelanto`/`excedenteTope` con los datos que ya viajan en `GestionDetalle` + caja ámbar `role="alert"` en el paso de confirmación, solo si excede); `codigo/features/finanzas/service.ts` (`registrarAdelantoMateriales`: mismo tope server-side — presupuesto aprobado vigente + ampliaciones aprobadas del técnico actual — y `excedente_tope` en el detalle del evento solo cuando `total > tope`); `codigo/features/gestiones/eventos.ts` (`detalleLegible`: "Excedió lo autorizado en $X"). Sin migraciones, sin tablas, sin filas de matriz.
- **Verificación:** `tsc --noEmit` + eslint verdes. **E2E navegador** (gestión sintética #197, materiales aprobados $50.000, técnico tecnicodos, admin operando — creada para el test y borrada al final): (1) adelanto $30.000 (bajo tope) → paso de confirmación idéntico al de siempre, SIN aviso, evento sin `excedente_tope`; (2) segundo adelanto $40.000 (acumulado $70.000) → caja ámbar exacta "Con este adelanto le habrás entregado $ 70.000 — son $ 20.000 más que los materiales autorizados ($ 50.000)" + "Podés confirmarlo igual", confirmó sin bloqueo y el evento quedó con `excedente_tope: 20000` (Actividad: "Excedió lo autorizado en $ 20.000"); (3) ampliación aprobada de $30.000 del técnico actual → tope $80.000: adelanto de $5.000 (acumulado $75.000) ya NO avisa. Criterios 1-4 verificados en vivo; el 5 (re-presupuestación) quedó verificado por el E2E de STORY-1014 del mismo día (la fórmula lee el vigente y el contador arranca en cero).
