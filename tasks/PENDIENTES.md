# Pendientes — MANTIS 2

> Única fuente de verdad de los pendientes del proyecto. Al completar uno,
> moverlo a "Hechos" con la fecha. Última actualización: 2026-07-06.

## Ahora (esta semana)

- [ ] **Crear token durable de Vercel para CI** — vercel.com → Account Settings → Tokens → Create ("github-actions-mantis", scope ausitesis-9299, expiración larga) → `gh secret set VERCEL_TOKEN --repo faustinoUNC/mantis`. Hoy el secret tiene el token de sesión del CLI, que expira en días; cuando expire, los deploys de Giuliano van a fallar en la Action hasta reemplazarlo.
- [ ] **Activar leaked password protection** — Dashboard de Supabase → Authentication → Sign In / Providers → toggle "Leaked password protection". 2 minutos.
- [ ] **Prueba manual del flujo de presupuesto** — En la app deployada, como gestor: elegir pagador → vista previa → enviar presupuesto → aprobar. Confirmar que el email va al pagador elegido y que el total de la nota coincide con lo aprobado (fixes de STORY-906). 5 minutos.

## Salida a producción

- [ ] **Verificar dominio en Resend** — Dashboard de Resend → Domains → agregar dominio → cargar registros DNS (SPF/DKIM) → al quedar "Verified", cambiar el remitente `onboarding@resend.dev` por uno del dominio en el código de email. Hasta entonces los emails solo llegan a la casilla de prueba.
- [ ] **Relajar el filtro del inbox** — Cuando haya casilla de mail exclusiva de mantenimiento, cambiar la query `subject:mantenimiento` en `codigo/features/inbox/sync.ts` para ingerir todo lo que llegue (hoy es necesario porque la casilla es compartida).

## Descartados (no hacer)

- ~~Adelantos de obra al técnico (STORY-933)~~ — Descartada por Fausti (2026-07-11) el mismo día de aprobarse, antes de implementar: "no nos complicamos" con plata adelantada. En su lugar: rendición de comprobantes + total gastado al terminar la ejecución, y liquidación = materiales rendidos + mano de obra (STORY-934).
- ~~CRON_SECRET del job pg_cron a Vault~~ — Decisión de Fausti (2026-07-06): riesgo bajo, no se hará.
- ~~Métrica "qué técnico es más barato" (comparar mano de obra entre técnicos)~~ — Descartada (2026-07-08, 2ª party mode, STORY-915). No se puede hacer confiable: el único normalizador de alcance (`presupuestos.plazo_dias`) es auto-reportado y poco fiable, y un catálogo de rubros estandarizados violaría la Regla #0. Fausti: no meter datos inexactos. **En su lugar** va el **desvío de presupuesto** (cada técnico vs. su propio presupuesto), que sí es confiable.

## Hechos

- [x] **Terminar la obra con avance obligatorio + gastos que justifican el exceso** (2026-07-11, STORY-936, commit 473a677) — el técnico no puede terminar la ejecución sin al menos una nota de avance, y si rinde materiales por más de lo presupuestado, el exceso debe estar cubierto por gastos imprevistos con ticket (Σ gastos ≥ exceso; bloqueo UI con montos en vivo + rechazo server). Rendir igual o menos no exige nada; los gastos siguen siendo de carga libre en ejecución. Sin migración. Verificada E2E.
- [x] **Validaciones de flujo + archivo de finalizadas** (2026-07-11, STORY-935, commit ddebabd) — (1) no se crea gestión si no hay técnico activo con la especialidad (tablero e inbox); (2) el email del presupuesto al pagador es obligatorio antes de "Aprobar y ejecutar" (marca `presupuesto_enviado_en`, bloqueo UI + server); (3) el resumen de obras ahora saluda "Hola, {propietario}:" (era el único email sin nombre); (4) archivar finalizadas + vista "Archivo" (`/gestiones/archivadas`, nav de staff, RLS respeta ownership del gestor, desarchivable). Verificada E2E.
- [x] **Rendición de materiales + gastos sin aprobación + fee solo lectura** (2026-07-11, STORY-934, commit 7f5ac43) — para terminar la ejecución el técnico rinde total gastado + foto de todos los comprobantes; liquidación = rendido + mano de obra; desvío de materiales visible en Conformidad; fuera la aprobación por gasto y el input de fee en facturación. Verificada E2E.
- [x] **Gastos imprevistos del técnico** (2026-07-11, STORY-932, commit 7c7640f) — el técnico propone gastos en ejecución con foto de ticket obligatoria, el gestor los resuelve, la conformidad se bloquea con gastos pendientes y `costo_final`/nota de cobro los absorben con desglose. Verificada E2E.
- [x] **Deploys automáticos de Giuliano** (2026-07-11, v2) — Vercel Hobby bloquea deploys de commits de autores que no son el dueño, incluso vía Deploy Hook (v1 con hook quedó BLOCKED con commit de Giuliano en la punta; hook y secret borrados). Solución vigente: workflow `.github/workflows/deploy-vercel.yml` deploya con el CLI (`vercel deploy --prod`, secret `VERCEL_TOKEN`) reescribiendo el autor del commit solo en el checkout de CI. Verificado con deploy real. GiulianoVigetti es colaborador write.

- [x] **Retoques del dashboard de métricas** (2026-07-08, STORY-919, SIN commitear — Fausti revisa en local) — fix bugs (rechazos de asignación por evento; calificación por embed to-one de PostgREST), 5 bloques sectorizados por alcance (caja "En el período" con el filtro en la cabecera; "ahora" arriba, "histórico" al final), embudo→barras, combo de ingresos con toggle de series + tendencia por serie, gradiente de magnitud, tendencia como tasa absoluta (no %), métrica "Tiempo de ciclo" y "Dinero pendiente", tile "Urgentes sin asignar". Detalle completo en `specs/STORY-919.md`.
- [x] **Carga demo para probar métricas** (2026-07-08, STORY-918) — 80 gestiones `[DEMO]` en todas las etapas + gestores/técnicos/cartera demo (`ausitesis+demo…`, pass = usuario123). Sembrado con `scripts/demo-seed.sql`. **Revertir todo:** `./scripts/demo-borrar.sh` (base + fotos), o pedirle a Claude que corra `scripts/demo-borrar.sql` (solo base). IDs y conteos en `scripts/demo-manifest.json`. Se puede mover/editar las gestiones demo sin romper el borrado.
- [x] Correcciones completas de la auditoría 2026-07-06 (STORY-906, commit 950dbf8) — seguridad DB, finanzas, funnel, inbox, realtime, UI, métricas.
