# STORY-918 — Carga demo realista (80 gestiones) para probar métricas + reversión completa (v1.0)

**Estado:** 🚧 en desarrollo · **Fecha:** 2026-07-08
**Origen:** Fausti — poblar el sistema con datos consistentes y reales "como si estuviera en uso" para ver el comportamiento real del dashboard de métricas (STORY-914/915/917). Debe poder revertirse por completo, incluso si después las gestiones demo se mueven de etapa o se editan.

## Objetivo

Sembrar en la base (`ejwokycbyjtlxwusbhtt`) un historial operativo verosímil de ~3,5 meses (20-mar-2026 → 08-jul-2026): gestores, técnicos, cartera y **80 gestiones** repartidas en todas las etapas, con **exactamente los mismos datos que deja el flujo natural** (eventos, presupuestos, avances, conformidades, calificaciones, notificaciones, emails, inbox, fotos). Y dejar preparada la **reversión total** al estado actual.

## Marcadores de datos artificiales (innegociables)

| Qué | Marcador |
|---|---|
| Gestiones | `descripcion` empieza con **`[DEMO] `** |
| Usuarios (gestores/administrativa/técnicos) | email **`ausitesis+demo…@gmail.com`** (patrón de siempre; password = `usuario123`) |
| Propietarios / inquilinos | email **`ausitesis+demo…@gmail.com`** |
| Inbox | `gmail_message_id` empieza con **`demo-`** |
| Cartera (propiedades/legajos) | sin campo marcable → se identifican **por FK a propietarios/inquilinos demo** |

⚠️ La reversión **NO depende** del `[DEMO]` ni de la etapa: se ancla en que **toda gestión demo vive en una propiedad demo** (y no hay feature para mover una gestión de propiedad). Editarlas, avanzarlas, cancelarlas o cargarles datos nuevos no rompe el borrado.

## Qué se crea

### Personas (11 usuarios auth, creados vía GoTrue Admin API como el alta real)

**Staff** (rol en `usuarios`):
- Valentina Suárez — `ausitesis+demogestorvalentina@gmail.com` / `demogestorvalentina123` — gestor_mantenimiento
- Marcos Gutiérrez — `ausitesis+demogestormarcos@gmail.com` / `demogestormarcos123` — gestor_mantenimiento
- Laura Benítez — `ausitesis+demoadministrativolaura@gmail.com` / `demoadministrativolaura123` — gestor_administrativo

**Técnicos aprobados y activos** (fila en `tecnicos` + `usuarios` + especialidades + franjas + doc DNI en storage; matrícula donde la especialidad la exige):
| Técnico | Usuario | Especialidades |
|---|---|---|
| Raúl Medina | demotecnicoraul | Plomería, Gas (matrícula) |
| Sergio Álvarez | demotecnicosergio | Electricidad (matrícula), Climatización |
| Pablo Castro | demotecnicopablo | Albañilería, Pintura e impermeabilización |
| Andrea Roldán | demotecnicaandrea | Pintura e impermeabilización, Carpintería |
| José Luna | demotecnicojose | Herrería y cerrajería, Vidriería |
| Darío Peralta | demotecnicodario | Techos y zinguería, Albañilería |

**Técnicos sin acceso** (solo `tecnicos`, como el enrolamiento real): Federico Ibáñez (demotecnicofede, **pendiente**), Gastón Vera (demotecnicogaston, **rechazado** con motivo).

Los técnicos reales (Tecnico Uno, tecnicodos) también reciben gestiones demo para que su scorecard (STORY-915) tenga historia. Control de plagas y Otros quedan **sin técnico** a propósito (gap de cobertura visible en la métrica).

### Cartera
- 6 propietarios demo, 14 propiedades (direcciones de Córdoba), 10 inquilinos demo, 10 legajos vigentes (4 propiedades sin legajo → gestiones sin inquilino).
- 2 propiedades "calientes" concentran gestiones (alimenta reincidencia STORY-917).

### 80 gestiones — distribución por etapa

| Etapa | Cant. | Variantes incluidas |
|---|---|---|
| finalizado | 30 | ~75 % calificadas (1–5⭐ con sesgo por técnico), desvíos de presupuesto ±, con/sin nota de cobro, medios de cobro variados, algunas con conformidad o presupuesto rechazados en el camino |
| cancelada | 6 | canceladas desde ingresado/asignación/presupuesto/en_ejecucion, con motivo |
| ingresado | 6 | 1 estancada (~18 días) |
| asignacion | 8 | sin técnico, solicitada sin respuesta, rechazada por el técnico (con y sin re-solicitud), 1 estancada (~35 días) |
| presupuesto | 8 | esperando presupuesto (con inspección), enviado pendiente, rechazado + re-enviado, 1 estancada |
| en_ejecucion | 9 | avances con y sin foto |
| conformidad | 5 | 1 con conformidad rechazada esperando re-subida |
| facturacion_cobro | 5 | con y sin nota emitida, 1 estancada (~30 días, envejece la cobranza) |
| liquidacion_tecnico | 3 | cobradas, esperando liquidación |

~20 % urgentes · causas 55 % desgaste / 30 % daño / 15 % mejora (pagador según regla CCyC, ~15 % con pagador confirmado distinto del sugerido) · gestores: Gestor Comercial Uno ~40 %, Valentina ~30 %, Marcos ~30 %.

### Fidelidad con el flujo natural (lo que replica la siembra)

1. **Eventos** (`eventos_gestion`) con la misma secuencia y shape de `detalle` que el código real: `creada` → `transicion` ingresado→asignacion → `asignacion_solicitada {tecnico}` → `asignacion_aceptada` + `transicion` → `presupuesto_enviado {total, plazo_dias}` → `presupuesto_aprobado {pagador, cargo_admin}` + `transicion` → `transicion` a conformidad → `conformidad_aprobada {costo_final}` + `transicion` → [`nota_cobro_enviada {total, para}`] → `cobro_registrado {medio}` + `transicion` → `liquidacion_registrada {monto, factura_ref}` + `transicion` a finalizado. Rechazos (`asignacion_rechazada`, `presupuesto_rechazado`, `conformidad_rechazada`) y cancelaciones (`transicion → cancelada {motivo}`) con sus motivos. Actores correctos por rol (gestor dueño / técnico asignado / Laura o admin en finanzas).
2. **Campos de la gestión** coherentes con su etapa: `pagador` + `cargo_admin` desde la aprobación, `costo_final` desde la conformidad, snapshots congelados `cobrado_monto = costo_final + cargo_admin` y `cobrado_fee = cargo_admin` al cobro (contract STORY-914), `liq_*` al liquidar, `nota_emitida_en` si hubo nota.
3. **Timestamps backdateados** en TODO (gestiones, eventos, presupuestos, avances, conformidades, calificaciones, notificaciones, emails, usuarios y técnicos) con duraciones de etapa verosímiles; urgentes se mueven más rápido.
4. **Notificaciones**: los triggers `trg_notificar_evento`, `trg_notificar_inbox` y `trg_notificar_solicitud_tecnico` se **deshabilitan durante la siembra** (si no, todo caería con fecha de hoy) y las notificaciones se insertan a mano replicando la `matriz_notificaciones` (destinatario correcto, sin auto-notificarse), con `creado_en` del evento y `leida_en` verosímil (las viejas leídas, las recientes mayormente no).
5. **Emails** (`emails_enviados`): reporte_recibido / tecnico_asignado / resuelto (al inquilino, solo si hay legajo), presupuesto y nota_cobro (al pagador), comprobante_liquidacion (al técnico) — mismos asuntos que produce `features/email/service.ts`, estado `enviado`, fecha del evento. **No se envía ningún email real** (solo el log, que es lo que consume el sistema).
6. **Inbox**: 10 reportes (`canal='email'`, remitente = inquilino demo): 6 gestionados y vinculados a gestiones demo, 2 pendientes, 2 descartados con motivo.
7. **Fotos reales en storage**: placeholders PNG subidos al bucket `gestiones` para cada conformidad (obligatoria en el flujo real) y ~la mitad de los avances, y al bucket `documentacion-tecnicos` (DNI y matrículas) — con los mismos paths que generan los services (`<gestionId>/conformidad-<ms>.png`, `<tecnicoId>/dni.png`).

## Reversión — `scripts/demo-borrar.sql`

Orden (defensivo, sobrevive a cualquier edición posterior de las gestiones demo):
1. Borrar `emails_enviados` de gestiones demo o con destinatario demo (el FK es SET NULL: hay que borrarlos explícitamente).
2. Borrar `inbox_reportes` demo (`gmail_message_id LIKE 'demo-%'`) y desvincular `procesado_por` demo en reportes reales.
3. Borrar **gestiones demo por relación**: propiedad demo ∨ gestor demo ∨ técnico demo ∨ `[DEMO]` en descripción (cascade limpia eventos, presupuestos, avances, conformidades, calificaciones y notificaciones asociadas).
4. Borrar objetos de storage de esas gestiones (bucket `gestiones`) y de los técnicos demo (`documentacion-tecnicos`).
5. Borrar `auth.users` con email `ausitesis+demo%` (cascade → usuarios, tecnicos, tecnico_especialidades, franjas, notificaciones).
6. Borrar cartera demo: legajos → inquilinos → propiedades → propietarios (por email/FK demo).
7. Verificación: todos los conteos demo en 0 y conteos reales intactos.

Cómo correrlo: pedirle a Claude «corré `scripts/demo-borrar.sql`» (o pegarlo en el SQL Editor). Igual que `scripts/borrar-carga.sql` (precedente [CARGA]).

## Criterios de aceptación
1. 80 gestiones demo repartidas según la tabla; el tablero, el detalle de cualquiera de ellas (timeline completo) y el home del técnico se ven idénticos a datos cargados a mano.
2. El dashboard de métricas muestra las 8+3 métricas con datos ricos: funnel con cancelaciones, tiempos por etapa, cobranza envejecida, reincidencia, cobertura con gap (Control de plagas), scorecards de técnicos con ⭐/desvío/rechazos.
3. Ninguna notificación/email demo aparece con fecha de hoy salvo las recientes por diseño; la campana no explota con cientos de no-leídas (las viejas quedan leídas).
4. `scripts/demo-borrar.sql` deja la base exactamente con los datos reales previos (7 gestiones, 4 usuarios, 2 técnicos, cartera original) aunque las gestiones demo hayan sido movidas/editadas después de la siembra.
5. No se toca ni una línea de `codigo/` (solo datos + scripts + specs).

## Dev Agent Record
- **Estado:** ✅ sembrado en `ejwokycbyjtlxwusbhtt` el 2026-07-08 (18:13 UTC). Sin cambios en `codigo/`.
- **Scripts:**
  - `scripts/demo-seed.sql` — siembra (guard anti-doble-ejecución; los 11 `auth.users` se crean antes vía GoTrue Admin API porque el SQL no puede insertar en `auth`). Reproducible: `setseed(0.42)`.
  - `scripts/demo-borrar.sh` — **reversión completa en un comando** (fotos del storage + base + `auth.users` vía Admin API). Correr este para revertir.
  - `scripts/demo-borrar.sql` — reversión de la base solamente (equivalente, sin fotos; para el SQL Editor).
  - `scripts/demo-manifest.json` — IDs de los 11 usuarios demo + conteos sembrados + estado real previo.
- **Conteos sembrados:** 80 gestiones (30 fin / 6 cancel / 6 ingr / 8 asign / 8 presup / 9 ejec / 5 conf / 5 factur / 3 liquid), 824 eventos, 66 presupuestos, 81 avances, 47 conformidades, 23 calificaciones, 454 notificaciones, 185 emails (log), 10 inbox, 86 fotos en storage. 11 usuarios auth, 8 técnicos (6 aprobados + 1 pendiente + 1 rechazado), 6 propietarios, 14 propiedades, 10 inquilinos, 10 legajos.
- **Verificación:**
  - Integridad temporal: 0 eventos/notificaciones en el futuro; 0 eventos anteriores a su gestión; rango de creación abr→jul 2026; snapshots `cobrado_monto = costo_final + cargo_admin` correctos en el 100 %.
  - Fidelidad: secuencia de eventos y shape de `detalle` idénticos al flujo real; notificaciones al destinatario correcto (triggers off durante la siembra + réplica manual de `matriz_notificaciones`); 57 no-leídas totales (las viejas quedaron leídas → la campana no explota).
  - Reversión probada con transacción + ROLLBACK: deja exactamente 7 gestiones reales, 4 usuarios, 2 técnicos, cartera original, 22 emails reales, 0 notificaciones huérfanas. No depende del estado de las gestiones demo.
