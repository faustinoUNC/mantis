# STORY-943 — Presupuestación: fuera la "Causa", pagador explícito (sin sugerido, sin inquilino inexistente) e inspección obligatoria (v1.0)

**Estado:** ✅ done (commit `bb70bd6`) · **Origen:** Fausti (2026-07-12), cards 4, 5 y 6. Decisión de dominio: **la responsabilidad de pago se determina en la etapa Presupuesto**, cuando la inmobiliaria analiza la inspección del técnico — no al crear la gestión. La "Causa" (desgaste/daño/mejora) y el `pagador_sugerido` que derivaba eran una decisión anticipada sin sustento: se eliminan. Si el análisis del técnico no alcanza, la inmobiliaria le rechaza el presupuesto hasta que especifique.

## Objetivo

Que la etapa Presupuesto sea el único lugar donde se decide quién paga, con la información necesaria: inspección del técnico obligatoria, elección explícita del gestor, y sin ofrecer un inquilino que la propiedad no tiene.

## Alcance y decisiones

### A. Eliminar "Causa" y `pagador_sugerido` (migración + código)

- **Migración** `story_943_sin_causa`: `alter table gestiones drop column causa, drop column pagador_sugerido; drop type causa_gestion;` (verificar dependencias antes con la DB).
- `features/gestiones/types.ts`: fuera `Causa`, `LABEL_CAUSA`, `PAGADOR_POR_CAUSA`; `GestionDetalle` pierde `causa` y `pagador_sugerido`.
- `crearGestion` (`features/gestiones/service.ts`) e `inbox/service.ts`: sin `causa` en la firma ni `pagador_sugerido` en el insert.
- Formularios de creación (`tablero.client.tsx`, `inbox.client.tsx`): fuera el select "Causa".
- `obtenerGestion`: fuera `causa`/`pagador_sugerido` del select.
- `features/metricas/service.ts`: fuera `causa` (dato muerto — ningún gráfico lo usa).
- `features/finanzas/service.ts`: el fallback `pagador ?? pagador_sugerido` desaparece — sin `pagador` definido no hay destinatario (el flujo lo garantiza: se elige antes de enviar).
- `scripts/demo-seed.sql`: fuera `causa`/`pagador_sugerido` (que siga corriendo tras la migración).
- Eventos históricos que mencionen causa en `detalle` JSON: quedan como están (historia).

### B. Detalle de la gestión: "Paga" solo cuando está decidido

- `DatosGestion`: fuera el dato "Causa"; el dato "Paga" se muestra **solo si `gestion.pagador` existe** (ya no hay "(sugerido)"). Antes de eso, esa celda muestra "A definir en presupuesto" o directamente no aparece.

### C. Selector de pagador explícito y acotado (etapa Presupuesto, `EvaluacionPresupuesto`)

- El select "Paga" arranca **vacío** (placeholder "Elegí quién paga…") — sin default. Enviar el email del presupuesto y aprobar exigen elección hecha (UI deshabilita + backend valida).
- Si la gestión **no tiene inquilino** (`legajo_id` null → `inquilino_nombre` null), la opción "Inquilino" **no se renderiza**.
- Backend (`enviarPresupuestoEmail`, `resolverPresupuesto`): rechazar `pagador` ausente, y rechazar `pagador = "inquilino"` si la gestión no tiene `legajo_id` (cubre carreras y requests directos).

### D. Inspección obligatoria antes de presupuestar (card 4)

- El técnico no puede enviar presupuesto sin al menos **una inspección registrada** (`avances` con `tipo = "inspeccion"` de esa gestión — se registran en la etapa Presupuesto, flujo existente).
- UI (`FormPresupuestoTecnico`): si no hay inspección, en lugar del formulario un aviso "Registrá primero la inspección — el gestor decide quién paga en base a lo que encuentres".
- Backend (`enviarPresupuesto`): valida contra la DB que exista la inspección (cubre refresh/carreras).

## Criterios de aceptación

1. No queda rastro de "Causa" en formularios, detalle ni tipos; la migración corrió y el seed demo sigue funcionando.
2. El detalle no muestra "Paga" hasta que el gestor lo definió en Presupuesto.
3. En Presupuesto: el select arranca vacío; sin elección no se puede enviar email ni aprobar; sin inquilino en la propiedad la opción no existe y el backend la rechaza igual.
4. El técnico no puede enviar presupuesto sin inspección previa (UI y backend).
5. `tsc` + eslint + `next build` verdes; flujo E2E completo (crear → asignar → inspección → presupuesto → aprobar) sano.

## Dev Agent Record
- **Estado:** ✅ done (2026-07-12). Commit `bb70bd6` en main (rebaseado sobre el trabajo de Giuliano — renumerada desde el número original por choque con sus stories 938-940), deploy automático en Vercel verificado. ⚠️ **Migración en 2 fases**: fase 1 aplicada (`story_940_causa_fase1_convivencia` — quedó con el número viejo: se aplicó antes de renumerar la story por el choque con las 938-940 del remoto: `pagador_sugerido` nullable — el código viejo en prod convive hasta el deploy). **Fase 2 APLICADA** (2026-07-12, migración `story_943_causa_fase2_drop`, con el deploy `bb70bd6` ya vivo en Vercel): columnas `causa`/`pagador_sugerido` y type `causa_gestion` eliminados; prod verificada después del drop.
- **Archivos:**
  - `features/gestiones/types.ts` — fuera `Causa`/`LABEL_CAUSA`/`PAGADOR_POR_CAUSA`; `GestionDetalle` sin `causa`/`pagador_sugerido`.
  - `features/gestiones/service.ts` — `crearGestion` sin causa ni sugerido; `obtenerGestion` sin esas columnas; `enviarPresupuesto` exige inspección en DB; `resolverPresupuesto` rechaza inquilino sin legajo.
  - `features/inbox/service.ts` + `components/inbox/inbox.client.tsx` — crear desde reporte sin causa.
  - `components/gestiones/tablero.client.tsx` — form de creación sin select Causa.
  - `components/gestiones/detalle.client.tsx` — Dato "Causa" eliminado; "Paga" = "Se define al presupuestar" hasta que exista; selector Paga arranca vacío (placeholder), sin opción Inquilino si la propiedad no tiene; envío/aprobación bloqueados sin elección; gate del técnico: sin inspección no hay form de presupuesto; label "Inspección · obligatoria antes de presupuestar".
  - `features/finanzas/service.ts` — sin fallback `pagador_sugerido`; `errorPagador()` valida elección + inquilino existente en `descargarPresupuestoPDF`/`enviarPresupuestoEmail`.
  - `features/metricas/service.ts` — `causa` eliminada (dato muerto).
  - `scripts/demo-seed.sql` — sin causa/pagador_sugerido (compatible post-drop).
- **Verificación:** `tsc` + eslint + `next build` verdes. E2E con Playwright (datos de prueba borrados): creación de gestión sin Causa OK (insert con sugerido nullable); detalle muestra "Paga: Se define al presupuestar" y stepper "Cobro"; gestión sin inquilino → selector solo "Propietario" y Aprobar deshabilitado; al elegir Propietario aparece el envío por email y el PDF se genera; técnico sin inspección ve el aviso y el form aparece recién al registrar la inspección.
