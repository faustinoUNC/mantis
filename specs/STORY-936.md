# STORY-936 — Terminar la obra: avance obligatorio y gastos que justifican el exceso (v1.1)

**Estado:** ✅ done (commit `473a677`) · **Origen:** Fausti (2026-07-11). Decisiones confirmadas: (1) al menos una nota de avance para poder terminar; (2) los gastos imprevistos siguen cargándose libres durante la ejecución, pero pasan a ser la **justificación obligatoria del exceso de materiales** en la rendición. Regla #0: sin migraciones, todo validación sobre lo existente.

## Objetivo

Cerrar dos huecos del flujo del técnico al terminar la ejecución:

1. Hoy puede terminar la obra sin haber registrado **ningún avance** — el gestor queda ciego durante toda la ejecución.
2. Los gastos imprevistos (STORY-932/934) quedaron **informativos y opcionales**: el técnico puede rendir materiales por mucho más de lo presupuestado sin un solo ticket que lo explique.

## Alcance y decisiones

### A. Al menos una nota de avance para terminar

- **Server** (`subirConformidad`, rama `terminando`): si la gestión no tiene ningún avance de tipo `avance` (las inspecciones de la etapa presupuesto no cuentan), error: "Registrá al menos una nota de avance antes de terminar la obra."
- **UI** (`AccionConformidadTecnico`, `detalle.client.tsx`): con `terminando && avances(tipo avance).length === 0`, botón "Terminar y subir conformidad →" deshabilitado + leyenda que manda a usar el form de avances de arriba.
- La **resubida** de una conformidad rechazada (`terminando === false`) no exige nada nuevo (la obra ya se terminó una vez).

### B. El exceso de materiales se justifica con gastos imprevistos

- Regla: al terminar, si `materiales_total` (rendido) **>** `monto_materiales` del presupuesto aprobado, el exceso debe estar cubierto por gastos imprevistos cargados: `Σ gastos ≥ rendido − presupuestado` (tolerancia de centavos). Cada peso de más tiene su ticket con foto.
- Si rinde **igual o menos** que lo presupuestado: no se exige nada (los gastos siguen siendo opcionales).
- **Server** (`subirConformidad`, rama `terminando`): con exceso sin cubrir, error con los números: rendido, presupuestado, gastos cargados y cuánto falta justificar.
- **UI**: el input "Total gastado en materiales" pasa a controlado; si lo tipeado excede `presupuestado + Σ gastos`, leyenda en vivo ("Estás rindiendo $X de más — cargá gastos imprevistos por el excedente") y botón de terminar deshabilitado. El form de gastos ya está en la misma pantalla, arriba.
- **Guard**: si la gestión no tiene presupuesto aprobado (caso legacy/raro), la validación de exceso se saltea (no hay contra qué comparar). La de avance corre igual.
- Los gastos **no cambian de mecánica**: carga libre en `en_ejecucion`, foto obligatoria, informativos para el gestor (sin aprobación). Solo ganan este rol de justificación al cierre. Doctrina STORY-924: bloqueo, no advertencia.

### B.2 Retoque v1.1 — aclarar el solapamiento de fotos (decisión de Fausti)

La foto por gasto y la foto general de la rendición cumplen roles distintos (ítem puntual en caliente vs. respaldo del total rendido) y se mantienen ambas. Única simplificación: cuando la gestión tiene gastos imprevistos cargados, el label de la rendición pasa a "Foto de todos los comprobantes, **incluidos los de gastos imprevistos** (obligatoria)" para que el técnico no dude si van o no. Sin cambios de lógica.

### C. Sin cambios de datos ni de otros flujos

- Sin migración: se valida con `avances`, `gastos_imprevistos` y `presupuestos` que ya viajan en `GestionDetalle`.
- `resolverConformidad` (gestor), liquidación, nota de cobro y métricas: intactos.

## Criterios de aceptación

1. Técnico en `en_ejecucion` sin avances: no puede terminar (botón deshabilitado con leyenda + rechazo server). Carga un avance → puede.
2. Rinde materiales por más de lo presupuestado sin gastos que cubran el exceso: no puede terminar (leyenda en vivo con los montos + rechazo server). Carga gastos que cubren el excedente → puede.
3. Rinde igual o menos que lo presupuestado: termina sin gastos, como siempre.
4. Resubir una conformidad rechazada no pide avances ni justificación (ya se validó al terminar).
5. Gestión sin presupuesto aprobado: solo se exige el avance.
6. `tsc` + eslint + `next build` verdes.

## Dev Agent Record
- **Estado:** ✅ done (2026-07-11). Commit `473a677` en main, deploy automático en Vercel. Sin migración.
- **Archivos:**
  - `features/gestiones/service.ts` — `subirConformidad` (rama terminando): exige ≥1 avance tipo `avance` y, con presupuesto aprobado, que `Σ gastos ≥ rendido − monto_materiales` (tolerancia de centavos); error con los montos.
  - `components/gestiones/detalle.client.tsx` — `AccionConformidadTecnico`: input de rendición controlado, leyenda de avance faltante, leyenda en vivo del exceso sin cubrir con los montos, botón "Terminar" deshabilitado en ambos casos. La resubida de rechazada no valida nada nuevo.
- **Verificación:** `tsc`, eslint y `next build` verdes. E2E con Playwright como técnico sobre gestión de prueba creada por SQL (en_ejecucion, presupuesto aprobado con materiales $50.000; borrada al final, DB + bucket): sin avances → botón deshabilitado con leyenda; registró avance → se destrabó; rindió $70.000 → leyenda "Estás rindiendo $ 20.000 más… (llevás $ 0)" y botón bloqueado; cargó gasto de $20.000 con ticket → se habilitó; terminó → etapa Conformidad con rendición guardada. Limpieza completa (filas + 3 fotos del bucket vía Storage API).
