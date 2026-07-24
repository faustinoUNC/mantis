# PLAN — Reset total + siembra realista para la presentación de la tesis

> **Documento CRÍTICO y vivo.** Es la fuente de verdad del operativo "limpiar la base y
> repoblarla con casos realistas que luzcan las métricas" para la presentación.
> Construido el **2026-07-24** contra el **esquema vivo** (`ejwokycbyjtlxwusbhtt`) y el
> **código actual**, NO contra el `demo-seed.sql` viejo (ver §9, drift).
>
> Estado: **fase de análisis/plan** — todavía NO se borró ni sembró nada. Los scripts se
> escriben en la fase de ejecución (cuando existan los casos reales cargados a mano).

---

## 0. El operativo, en una frase

Dejar la base con **un solo usuario** (Giuliano Vigetti, admin) → cargar **a mano** los
usuarios reales, la cartera real y **unos pocos casos "patrón"** → yo aprendo la anatomía
EXACTA de esos casos → genero un seed paramétrico que los **clona con variedad**
(descripciones, montos, fechas, técnicos) **distribuidos en el tiempo** para que las 13
métricas —incluido el indicador de reincidencias (STORY-1051)— se luzcan.

### Flujo por etapas

| Fase | Quién | Qué |
|---|---|---|
| **1. Borrado total** | Yo (con OK) | Vaciar TODO menos Giuliano admin. §4 |
| **2. Carga manual** | Fausti | Usuarios (gestores, administrativos, técnicos), cartera (propietarios/inquilinos/propiedades/legajos), y **N casos "patrón"** end-to-end desde la UI |
| **3. Aprender anatomía** | Yo | Leer esos casos reales en DB, extraer su forma exacta (montos típicos, textos, tiempos, quién califica, etc.) |
| **4. Siembra masiva** | Yo (con OK) | Seed paramétrico que clona la forma con variedad + distribución temporal §7 |
| **5. Verificación** | Yo | Abrir Informes y confirmar que las 13 cards + la bandeja de fondo lucen §6/§8 |

---

## 1. Decisiones tomadas (confirmadas con Fausti 2026-07-24)

1. **Admin único: Giuliano Vigetti.**
   - Email: **`ausitesis+admingiulianovigetti@gmail.com`** (corregido: Fausti había escrito
     `.com.ar`; se usa `.com` para que el `+alias` entregue en `ausitesis@gmail.com` y el
     sistema le pueda mandar mails de verdad).
   - Password: `admingiulianovigetti123`.
   - Rol: `administrador`, `esta_activo = true`.
   - ⚠️ Hoy ya existe un `ausitesis+admingiuliano@gmail.com` distinto — este es **nuevo** y
     el resto se borra (incluido ese).
2. **Especialidades: borrar TODAS y recrearlas** en el seed (wipe 100% real; incluye tirar
   la basura `"Categoria Vacia"`). El catálogo se recompone en la fase de siembra con las 12
   legítimas (§5).
3. **Alcance de este MD: solo análisis/plan.** Los scripts de borrado y de seed se escriben
   después, cuando estén cargados los casos reales a imitar.

---

## 2. Estado actual de la base (foto 2026-07-24)

| Entidad | Hoy | Tras el borrado |
|---|---|---|
| `usuarios` | 39 (6 admin · 9 gestor_mant. · 5 gestor_adm. · 19 técnico) | **1** (Giuliano) |
| `gestiones` | 251 (130 `[DEMO]` + 121 reales) | 0 |
| `eventos_gestion` | 3407 | 0 |
| `tecnicos` | 24 (19 aprob · 2 pend · 3 rech) | 0 |
| `propietarios / inquilinos / propiedades / legajos` | 15 / 17 / 27 / 27 | 0 |
| `presupuestos · avances · conformidades · ampliaciones · calificaciones` | 238 · 284 · 170 · 34 · 76 | 0 |
| `inbox_reportes · notificaciones · emails_enviados` | 26 · 3832 · 911 | 0 |
| `especialidades` | 13 (incl. basura `Categoria Vacia`) | recrear 12 |
| `matriz_notificaciones` | 19 | conservar (config) |
| `revisiones_fondo` | 0 | 0 |

**Admins actuales que se borran:** `ausitesis+admin@`, `+adminfaustino@`, `+admingiuliano@`,
`+adminjuliocesar@`, `+adminrami@`, `+adminramiro@`.

---

## 3. Modelo de datos — mapa de tablas (para el borrado y la siembra)

Tablas `public` y su rol. Las **hijas de `gestiones`** cascadean al borrar la gestión.

```
usuarios ──< gestiones.gestor_id           especialidades ──< gestiones.especialidad_id
tecnicos ──< gestiones.tecnico_id          propietarios ──< propiedades ──< gestiones.propiedad_id
tecnicos ──< tecnico_especialidades                          propiedades ──< legajos >── inquilinos
tecnicos ──< franjas_disponibilidad        legajos ──< gestiones.legajo_id

gestiones ──< presupuestos                 gestiones ──< eventos_gestion
          ──< avances                                 ──< notificaciones (gestion_id)
          ──< conformidades                gestiones.gestion_origen_id ──> gestiones (self)
          ──< ampliaciones                 revisiones_fondo >── propiedades, especialidades, gestiones
          ──< calificaciones (UNIQUE)
          ──< emails_enviados (gestion_id)  inbox_reportes.gestion_id ──> gestiones

CONFIG (no operativo): especialidades, matriz_notificaciones
BUCKETS storage: `gestiones` (fotos avance/conformidad/materiales/reporte), `documentacion-tecnicos` (DNI/matrícula)
```

---

## 4. PARTE A — El borrado total (fase 1)

> El `scripts/reset-total.sh` existente **NO sirve tal cual**: conserva el admin viejo
> (`ausitesis+admin@gmail.com`) y **conserva especialidades**. Acá queremos crear un admin
> **nuevo** (Giuliano) y **recrear** especialidades. El script de la fase 1 se deriva de
> `reset-total.sh` con estos cambios.

### 4.1 Orden de borrado (respetando FK)

1. `del gestiones` → cascadea `avances, conformidades, eventos_gestion, presupuestos,
   ampliaciones, calificaciones, notificaciones(gestion_id)`.
2. `del notificaciones` (las sin gestión), `del inbox_reportes`, `del emails_enviados`.
3. `del tecnicos` → cascadea `tecnico_especialidades, franjas_disponibilidad`.
4. Cartera: `del legajos` → `del propiedades` → `del inquilinos` → `del propietarios`.
5. `del usuarios` (TODOS — no dejamos ninguno del viejo; el nuevo admin se crea después).
6. `del especialidades` (recrear en §5).
7. **auth.users**: borrar TODOS los logins (GoTrue Admin API), sin excepción.
8. **Storage**: vaciar buckets `gestiones` y `documentacion-tecnicos`.

### 4.2 Crear el admin único Giuliano

```
# 1) Login en auth (GoTrue admin API), email confirmado
POST /auth/v1/admin/users
  { email: "ausitesis+admingiulianovigetti@gmail.com",
    password: "admingiulianovigetti123", email_confirm: true }
  → devuelve el uuid  := :giuliano

# 2) Fila en usuarios (MISMO uuid que auth)
insert into usuarios (id, nombre, email, rol, esta_activo, creado_en)
values (:giuliano, 'Giuliano Vigetti',
        'ausitesis+admingiulianovigetti@gmail.com', 'administrador', true, now());
```

> El trigger que autocrea la fila en `usuarios` al registrarse por la UI **no** aplica acá
> (creamos vía API); insertar la fila a mano con el mismo uuid.

### 4.3 Resetear la secuencia de `numero`

`gestiones.numero` sale de `gestiones_numero_seq` (hoy en 258). Para que los casos nuevos
arranquen en `#1`:

```sql
alter sequence gestiones_numero_seq restart with 1;
```

### 4.4 Checklist post-borrado

- [ ] `select count(*) from usuarios` = 1 (solo Giuliano).
- [ ] `select count(*) from gestiones` = 0 (y todas las hijas).
- [ ] `select count(*) from auth.users` = 1.
- [ ] Login OK en la UI con Giuliano / `admingiulianovigetti123`.
- [ ] Buckets `gestiones` y `documentacion-tecnicos` vacíos.
- [ ] `gestiones_numero_seq` reiniciada.

---

## 5. Catálogo de especialidades a recrear (12)

Las 12 legítimas (se descarta `Categoria Vacia`). Nombres EXACTOS — los usa el pool de
técnicos y las descripciones del seed:

`Plomería` · `Gas` · `Electricidad` · `Albañilería` ·
`Pintura e impermeabilización` · `Carpintería` · `Herrería y cerrajería` ·
`Climatización` · `Techos y zinguería` · `Vidriería` · `Control de plagas` · `Otros`

---

## 6. PARTE B — Anatomía EXACTA de un caso (molde de la siembra)

> Fuente: `features/gestiones/{types.ts,service.ts}`, `features/finanzas/service.ts`,
> `scripts/avanzar_etapa.sql`, esquema vivo. Es lo que hay que **clonar con variedad**.

### 6.1 El funnel — enum `etapa_gestion`

`ingresado → asignacion → presupuesto → en_ejecucion → conformidad → facturacion_cobro →
liquidacion_tecnico → finalizado` · fuera del stepper: **`cancelada`**.
Terminales (en UN lugar, `types.ts:31-34`): **`{finalizado, cancelada}`**.

Otros enums: `urgencia_gestion = normal|urgente` · `pagador_gestion = inquilino|propietario|**compartido**`
(compartido usa `pagador_pct_inquilino`) · `rol_usuario = administrador|gestor_mantenimiento|gestor_administrativo|tecnico`.

### 6.2 Transiciones válidas (`avanzar_etapa()`, SECURITY DEFINER)

Único camino de cambio de etapa; cada transición inserta **un evento `tipo='transicion'`**
con `de_etapa/a_etapa/actor_id/detalle`:

- `ingresado→asignacion` · `asignacion→presupuesto` · `presupuesto→en_ejecucion` ·
  `en_ejecucion→conformidad` · `conformidad→facturacion_cobro` ·
  `facturacion_cobro→liquidacion_tecnico` · `liquidacion_tecnico→finalizado`
- Desasignar (retroceso total): `{presupuesto|en_ejecucion|conformidad}→asignacion` (congela
  saliente en el detalle, resetea técnico/materiales/costo — ver §6.5).
- Cancelar sin cargo: `{ingresado|asignacion|presupuesto|en_ejecucion|conformidad}→cancelada`.
- Cancelar con cargo: `{presupuesto|en_ejecucion}→facturacion_cobro` con `detalle.cancelacion='true'`,
  luego `facturacion_cobro→cancelada` (requiere `cargo_cancelacion is not null`).
- Efecto SIEMPRE: `etapa=nueva`, limpia `aviso_no_continua_*`; si `nueva=cancelada` setea `archivada_en=now()`.

### 6.3 Secuencia end-to-end (columnas · hijos · eventos)

| Etapa / paso | Muta en `gestiones` | Hijo creado | Evento(s) |
|---|---|---|---|
| **Crear (ingresado)** | `descripcion, especialidad_id, urgencia, propiedad_id, legajo_id(auto), gestor_id`; `numero`(seq), `cargo_admin=0` | — | `creada` |
| → `asignacion` | `tecnico_id, tenencia_desde=now()`, `asignacion_aceptada=null` | — | `transicion(ingresado→asignacion)`, `asignacion_solicitada{tecnico}` |
| técnico acepta | — | — | `asignacion_aceptada` |
| → `presupuesto` | — | — | `transicion(asignacion→presupuesto)` |
| inspección (req.) | — | `avances(tipo='inspeccion', nota)` | — |
| enviar presupuesto | — | `presupuestos(monto_materiales, monto_mano_obra, descripcion_trabajo, plazo_dias, estado='enviado', tecnico_id)` | `presupuesto_enviado{total,plazo_dias}` |
| enviar al pagador | **ancla** `pagador, pagador_pct_inquilino, cargo_admin, presupuesto_enviado_en` | — | `presupuesto_enviado_pagador` |
| aprobar presup. | `presupuestos.estado='aprobado'` | — | `presupuesto_aprobado{pagador,cargo_admin}` |
| → `en_ejecucion` | — | — | `transicion(presupuesto→en_ejecucion)` |
| avances (≥1 req.) | — | `avances(tipo='avance', nota, foto_path?)` | — |
| (opc.) adelanto | `adelanto_materiales += monto` | — | `adelanto_materiales_registrado{monto,total}` |
| (opc.) ampliación | — | `ampliaciones(monto, motivo, estado='enviada', tecnico_id)` | `ampliacion_solicitada` → `ampliacion_aprobada/_rechazada` |
| terminar (rendir) | `materiales_total, materiales_fotos_paths[]` | `conformidades(foto_path, estado='subida', tecnico_id)` | `materiales_rendidos{total}`, `transicion(en_ejecucion→conformidad)` |
| aprobar conf. | **`costo_final`** = `materiales_total + monto_mano_obra` (server-side); `conformidades.estado='aprobada'` | — | `conformidad_aprobada{costo_final}`, `transicion(conformidad→facturacion_cobro)` |
| nota de cobro | `nota_emitida_en=now()` | — | `nota_cobro_enviada{total,para}` |
| registrar cobro | **congela** `cobrado_en, medio_cobro(_2), cobrado_monto(_2), cobrado_fee(=cargo_admin), recargo_tarjeta_*` | — | `cobro_registrado{medio,total}`, `transicion(facturacion_cobro→liquidacion_tecnico)` |
| liquidar | **congela** `liq_monto, liq_medio, liq_pagada_en, liq_comprobante_path, liq_factura_ref` | — | `liquidacion_registrada{monto}`, `transicion(liquidacion_tecnico→finalizado)` |
| calificar (opc.) | — | `calificaciones(estrellas, comentario, autor_id, tecnico_id)` — 1 por gestión | — |
| archivar | `archivada_en` | — | `archivada` |

### 6.4 Identidades de plata (deben cerrar en todo caso finalizado)

- `costo_final = materiales_total + monto_mano_obra`
- `cobrado_monto = costo_final + cargo_admin` · `cobrado_fee = cargo_admin`
- fee de la casa (`cargo_admin`) = 15–22 % del presupuesto (franja realista, STORY-919)
- `liq_monto` = base − `adelanto_materiales` (si hubo adelanto)

### 6.5 Hechos congelados (doctrina STORY-914 — las históricas leen ESTO)

`pagador, pagador_pct_inquilino, cargo_admin, presupuesto_enviado_en` (al enviar presup.) ·
`costo_final` (aprobar conf.) · `materiales_total, materiales_fotos_paths` (rendir) ·
`nota_emitida_en` (nota) · `cobrado_en, medio_cobro(_2), cobrado_monto(_2), cobrado_fee,
recargo_tarjeta_*` (cobro) · `cargo_cancelacion(_pagador)` (cancelar con cargo) ·
`liq_monto, liq_medio, liq_pagada_en, liq_comprobante_path` (liquidar) · `archivada_en`.

### 6.6 La nota de inspección (clave para patrones de fondo)

`avances`: `tecnico_id NOT NULL`, `tipo ('inspeccion'|'avance')`, `nota NOT NULL` (prosa
libre, sin campos estructurados), `foto_path?`. La **inspección** se carga en etapa
`presupuesto` (requisito antes de presupuestar). El indicador de fondo **NO** parsea la nota
para detectar (agrupa por `propiedad_id + especialidad_id`); la nota es el **corpus que
lee Walter** en la Fase 2 para juzgar si es la misma causa raíz. → Sembrar notas de
inspección **con diagnóstico** ("tablero sulfatado", "humedad de cimientos") en las
propiedades "calientes", no genéricas.

### 6.7 INSERT mínimo de un caso "finalizado" (referencia)

Ver el bloque completo parametrizado en el reporte del explorador y el molde vivo en
`scripts/demo-seed.sql:363-619`. Resumen del orden por FK: `gestiones` → `presupuestos`
(aprobado) → `avances` (≥1 inspección + ≥1 avance) → `conformidades` (aprobada) →
`calificaciones` (opc.) → `eventos_gestion` (la cadena completa; cada `transicion` con
+2s de offset). `numero` NO se inserta (seq). `actor_id` de cada evento = uuid real de
`usuarios` (el del técnico es su fila en `usuarios` rol tecnico).

---

## 7. PARTE C — Las 13 métricas de Informes y qué necesita cada una

> Panel: `components/metricas/panel-metricas.client.tsx`. Constantes que definen "se ve
> pobre": **`N_MINIMO=5`** (con 1–4 filas la card se atenúa "Muestra chica"),
> **`MIN_CUBOS_TENDENCIA=6`** (línea de tendencia), **`MIN_CUBOS_SERIE=3`** (dibuja la serie),
> `DIAS_COBRO_AMBAR=15`. Selector de período default = **"Año" (365 d, granularidad mes)**.

| # | Card | Qué mide | Cuenta si… | ¿Tiempo? | Para que luzca |
|---|---|---|---|---|---|
| 1 | **Gestiones estancadas** | activas frenadas ≥1 día en su etapa | no terminal Y ≥1 día sin transición | días en etapa (no período) | algunas activas paradas ≥1 día (≥3 → ámbar) |
| 2 | **Pendientes de cobro** | $ por cobrar (trabajo vs fee) + antigüedad | `etapa=facturacion_cobro` | días en etapa | varias en Cobro, algunas ≥15 d, alguna con `cargo_cancelacion` |
| 3 | **Propiedades con rubro repetido** (STORY-1051) | patrones crónicos por propiedad+rubro | ≥N obras NO canceladas del mismo `especialidad_id` en ventana | `creado_en` de obras | **varias props con la misma especialidad ≥3 veces**, obras esparcidas en años §8 |
| 4 | **Reparto por gestor** (admin) | gestiones activas por Gestor Comercial | no terminal Y `gestorRol='gestor_mantenimiento'` | snapshot | **≥2–3 gestores_mant.** como `gestor_id`, reparto desigual (admin como gestor NO cuenta) |
| 5 | **Orden por fee** | abiertas ordenadas por `cargo_admin` | no terminal Y `cargo_admin>0` | snapshot | varias en ≥presupuesto con fee variado |
| 6 | **Presión por especialidad** | carga activa / técnicos disponibles | activa suma a su especialidad | snapshot | especialidades con carga desigual + capacidad dispar (una sin técnicos → rojo) |
| 7 | **Activas por etapa** | dónde están hoy (cuello) | etapa ∉ terminales | snapshot | activas repartidas entre varias etapas |
| 8 | **Tiempo de ciclo** | días ingreso→fin, sin obra | tiene evento `aEtapa=finalizado` | **por mes de `fin`** | **finalizadas repartidas en ≥6–7 meses**, con paso por `en_ejecucion` |
| 9 | **Cuellos de botella** | días promedio por etapa | está en el período; última visita de cada etapa; excl. `en_ejecucion` | sigue período | event log rico (varias transiciones, gaps de días) |
| 10 | **Ingresos cobrados** | $ cobrados por mes (fee vs técnico) | `cobrado_en` presente | **por mes de `cobrado_en`** | **cobradas en ≥6–7 meses**, `cobrado_fee < cobrado_monto` |
| 11 | **Calificación de técnicos** | ★ prom. + obras + abandonos | técnico con obra/calif/abandono | histórico | **varios técnicos** finalizados con filas en `calificaciones`, promedios distintos |
| 12 | **Desvíos de presupuesto** | % pasado en materiales, por técnico | `matPresupuestada>0` Y **conf. aprobada** Y reales≥0 | histórico | presup. aprob. + conf. aprobada + `materiales_total`; reales que difieran (+% y −%) |
| 13 | **Desvío de plazo** | % pasado del `plazo_dias`, por técnico | `plazo_dias>0` Y obra salió a `conformidad` Y pct>0 | histórico | presup. con `plazo_dias` + ejecución real que **exceda** el plazo (solo se ven los que se pasaron) |

**Nota:** salvo #8, #9 y #10 (que recortan por período), TODAS las cards leen `filasEsp`
(todas las filas, ignoran el selector). Las de período necesitan data en los últimos ~12
meses repartida en ≥6–7 de ellos.

---

## 8. PARTE D — El indicador de reincidencias / "Patrones de fondo" (STORY-1051)

> Feature nueva (rama `story-1051-patrones-de-fondo`, **Fase 1 implementada sin commitear**,
> Fase 2 = Walter sin empezar). Tabla `revisiones_fondo` ya creada en prod (RLS, append-only).
> Spec completa: `specs/STORY-1051.md`. Módulo puro: `features/patrones-fondo/patrones.ts`.

### 8.1 Cómo detecta (Fase 1, sin IA)

- **Candidata** = `(propiedad_id, especialidad_id)` con **≥N obras NO canceladas** dentro de
  la ventana. `N` = filtro en vivo, **default 3** (mín 2). Ventana = filtro en vivo, **default
  todo el histórico** (paso 1 año).
- **Orden peor-arriba**: cantidad desc → span más apretado (fechas más juntas) → más reciente.
  Sin fórmula con constantes ocultas (`patrones.ts:171-181`).
- **Ciclo de vida** (`patrones.ts:96-150`): una fila en `revisiones_fondo` con `atendida_en`
  ≥ obra más nueva **oculta** el patrón; una obra nueva posterior lo **reaparece** con badge
  "Volvió" + motivo. `gestion_iniciada` cuya gestión de fondo se canceló NO oculta. Si
  reaparece tras una gestión de fondo **terminada** → "el arreglo de fondo no aguantó".

### 8.2 Qué sembrar para que se luzca

1. **Propiedades "calientes"** (como las props 1 y 4 del seed viejo): elegir **2–3
   propiedades** donde la MISMA especialidad se repita **≥3 veces** (ideal 4), con obras NO
   canceladas y `especialidad_id` poblado.
2. **Distribuir esas obras en el tiempo** con un patrón visible: un clúster reciente y denso
   (p. ej. 3 obras de electricidad en 4 meses) pesa más que 3 espaciadas en años → sembrar
   ambos tipos para que el orden por severidad se vea.
3. **Notas de inspección con diagnóstico de causa raíz** en esas obras (§6.6) — es lo que la
   Fase 2 (Walter) va a leer. Que las 3–4 obras de una propiedad mencionen el MISMO origen
   ("tablero sulfatado", "tendido viejo") para el caso "es de fondo"; y sembrar UN falso
   patrón (p. ej. 3 pintura por mudanza + 2 por filtración) donde las notas dejen claro que
   NO es lo mismo, para lucir la abstención.
4. **Reaparición / "no aguantó"**: sembrar una fila en `revisiones_fondo` (`atendida_en` pasado,
   `resultado='gestion_iniciada'`, `gestion_fondo_id` → una gestión de fondo **finalizada**) y
   LUEGO una obra nueva del mismo rubro con `creado_en` posterior a `atendida_en`.

---

## 9. PARTE E — Estrategia de siembra masiva

### 9.1 ⚠️ El seed viejo quedó desactualizado (drift)

`scripts/demo-seed.sql` es de **STORY-918/919** (jul-2025) y NO conoce ~130 stories
posteriores. Columnas de `gestiones` que **usa el sistema hoy y el seed NO toca**:
`materiales_total, materiales_fotos_paths, presupuesto_enviado_en, cargo_cancelacion,
cargo_cancelacion_pagador, adelanto_materiales, pagador_pct_inquilino, cobrado_monto_2,
medio_cobro_2, recargo_tarjeta_*, aviso_no_continua_*, gestion_origen_id, liq_medio,
liq_comprobante_path, tenencia_desde, fotos_reporte_paths, desasignada_en, archivada_en`.
Además la tabla **`ampliaciones` entera es nueva**, y `presupuestos.tecnico_id` /
`conformidades.tecnico_id` se agregaron.

**Regla:** el seed viejo se usa **solo como molde de forma/enfoque** (máquina de estados +
backdateo + triggers off). El seed nuevo se **regenera desde cero** contra el esquema vivo,
poblando TODAS las columnas congeladas §6.5 y validando contra `information_schema` antes de
correr.

### 9.2 Enfoque técnico del seed nuevo (heredado de lo que SÍ funciona)

- **Un `DO $$` en plpgsql** con helpers `pick/rint/d` y `setseed()` para reproducibilidad.
- **Triggers de notificación OFF** durante la siembra (`trg_notificar_evento`,
  `trg_notificar_inbox`, `trg_notificar_solicitud_tecnico`) y notificaciones insertadas a mano
  replicando `matriz_notificaciones` (si no, todo cae con fecha de hoy). Reactivarlos al final.
- **Backdateo por etapa**: `t0` calculado hacia atrás según cuántas etapas recorrió; `m1..m9`
  encadenados con duraciones por etapa. Clamp: ninguna gestión antes del "alta del negocio".
- **Marcador** para poder revertir (el viejo usaba `[DEMO]` / `ausitesis+demo%`). Para la
  presentación quizá NO queramos marcador visible → decidir en fase 4 (ver §11).

### 9.3 Parámetros de distribución (derivados de §7 y §8)

- **Ventana temporal:** arrancar el "negocio" **~9–10 meses atrás** y esparcir `creado_en` /
  `cobrado_en` / `fin` en **≥7 meses distintos** (para tendencia #8 y #10, que necesitan ≥6
  cubos mensuales completos).
- **Volumen:** apuntar a **≥5–8 gestiones por técnico y por dimensión** que use humildad
  (calificación, desvíos) para que no se atenúen (`N_MINIMO=5`).
- **Reparto de etapas** (como el viejo, ajustado): mayoría **finalizadas** (alimentan ciclo,
  ingresos, calificación, desvíos) + un colchón en cada etapa activa (estancadas, funnel,
  presión, reparto, orden por fee) + algunas **canceladas** (con y sin cargo).
- **Sesgo persistente por técnico** en la duración de obra y en las estrellas (unos cumplen,
  otros se pasan) → así "Desvío de plazo" (#13) y "Calificación" (#11) muestran un espectro,
  no todo igual. El viejo lo hacía con un multiplicador por técnico (`demo-seed.sql:316-320`).
- **Fee 15–22 %** del presupuesto; `cobrado_fee < cobrado_monto` siempre (barra apilada #10).
- **Cobertura de especialidades desigual**: dejar 1 rubro **sin técnico aprobado** para el
  rojo de "Presión por especialidad" (#6).
- **Gestores**: repartir `gestor_id` entre los **≥2–3 gestores_mant.** creados a mano, desigual
  (para #4). Nunca poner al admin como `gestor_id` de gestiones activas (no cuentan en #4).
- **Propiedades calientes** para #3 (§8.2).

### 9.4 Cartera e inquilinos

Se siembran **espejando la cartera real** que cargue Fausti a mano (mismos tipos de
propiedad, proporción con/sin legajo vigente). Reglas de integridad: pagador `inquilino` o
`compartido` **solo** con legajo vigente (`fecha_fin is null`); sin legajo → pagador
`propietario`. Emails de personas con patrón `ausitesis+<algo>@gmail.com` (entregan todos en
`ausitesis@gmail.com`).

---

## 10. PARTE F — Riesgos y gotchas

1. **Email `.com.ar`** → corregido a `.com` (§1). Verificar que el login y los `+alias`
   entreguen antes de la demo.
2. **`gestiones_numero_seq`** → reiniciar a 1 tras el borrado, o los casos nuevos arrancan en #259.
3. **`revisiones_fondo` NO se borra al descartar la rama STORY-1051** — la tabla vive en prod.
   Al hacer wipe, vaciarla también (revert de la feature = `drop table` aparte, NO tocar acá).
4. **Rama activa `story-1051-patrones-de-fondo`**: la bandeja de fondo (#3) solo se ve si el
   código de la rama está desplegado. Confirmar en qué rama corre la demo antes de sembrar
   patrones (si la demo corre en `main`, la card #3 no existe todavía).
5. **Triggers de notificación**: si se siembra con triggers ON, TODO cae con fecha de hoy y
   las series temporales colapsan. OFF durante la siembra, notis a mano, ON al final.
6. **`costo_final` es server-side** (se calcula al aprobar conformidad). En el seed hay que
   escribir el valor coherente a mano (`materiales_total + monto_mano_obra`), no queda un
   trigger que lo compute.
7. **Fotos**: las métricas no dependen de fotos reales, pero los `foto_path` apuntan a objetos
   del bucket que no existirán (se ven rotos en la UI de detalle). Para la demo, si se abre una
   gestión, la foto faltará — decidir si sembrar placeholders en el bucket.
8. **Numeración de stories con Giuliano** (CLAUDE.md §1): este operativo no crea stories, pero
   si en fase 4 se documenta como STORY, `git fetch` + revisar `origin` antes.

---

## 11. Decisiones abiertas (resolver antes de la fase 4)

- [ ] ¿La demo corre en `main` o en la rama `story-1051-...`? (define si la bandeja de fondo existe).
- [ ] ¿Los datos sembrados llevan marcador (`[DEMO]`/`+demo`) o son "limpios" sin marca?
      (Sin marca = más creíble en la demo, pero no hay revert fácil por marcador → confiar en
      el wipe total para deshacer).
- [ ] ¿Sembramos placeholders de fotos en los buckets para que el detalle no muestre rotos?
- [ ] Cantidad final de: gestores_mant., gestores_adm., técnicos, propiedades, y total de
      gestiones (se define al ver los casos reales cargados a mano).
- [ ] ¿Cuántos casos "patrón" carga Fausti a mano en fase 2, y de qué rubros?

---

## 12. Referencias

- Anatomía de caso: `features/gestiones/{types.ts,service.ts}`, `features/finanzas/service.ts`,
  `scripts/avanzar_etapa.sql`.
- Métricas: `components/metricas/panel-metricas.client.tsx`, `features/metricas/service.ts`,
  `features/gestiones/ejecucion.ts`.
- Reincidencias: `specs/STORY-1051.md`, `features/patrones-fondo/{patrones.ts,service.ts}`,
  `components/metricas/bandeja-fondo.client.tsx`.
- Molde de seed (forma, NO columnas): `scripts/demo-seed.sql`, `scripts/demo-borrar.sql`.
- Reset base: `scripts/reset-total.sh` (adaptar), `scripts/reset-datos.sh` (liviano).
