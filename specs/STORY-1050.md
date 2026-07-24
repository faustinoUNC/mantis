# STORY-1050 — Reparto de carga por gestor (informe exclusivo del administrador) (v1.0)

**Estado:** 📋 borrador · **Origen:** pedido de Fausti (2026-07-24): "qué métricas serían de suma utilidad a nivel negocio para el administrador sobre el trabajo/rendimiento de sus gestores". Diseñado en party mode (Mary·John·Winston·Sally·Amelia), con Fausti podando las candidatas en vivo.

## Problema

El panel de Informes (STORY-914/919/920/921) tiene 11 gráficos, pero **ninguno mira al gestor**. Todo el bloque de "desempeño" mide al **técnico** (estrellas, desvío de presupuesto, desvío de plazo) y el resto es por gestión o global. El administrador no tiene **ni una** vista del trabajo de sus **Gestores Comerciales** (`gestor_mantenimiento`), que son quienes conducen el funnel Ingresado→Conformidad.

El pedido es una métrica **exclusiva del admin** sobre sus gestores, con la vara de Fausti: **nada de métricas por poner** — valor 100% real y justificable.

## Qué se descartó en el debate (y por qué) — para no re-proponer

El party mode arrancó con 5 candidatas y Fausti las fue volteando. Queda documentado para que nadie las reviva:

- **SLA de respuesta del gestor (tiempos históricos)** — DESCARTADO. Se veía como el núcleo, pero muere por dos agujeros que encontró Fausti: (1) atribuir por dueño de la gestión castiga al gestor por demoras del **admin** (que carga/asigna) o por **reasignaciones** de gestiones ya avanzadas; (2) aun atribuyendo por `actor_id`, la ventana "presupuesto enviado → aprobado" contiene el tiempo del **pagador** (`presupuesto_enviado_pagador`, 110 en la base) — el gestor espera al inquilino, no está tardando él. Para volverlo "justo" hay que podar tanto (excluir reasignadas, restar el pagador, medianas, umbrales) que queda **incompleto y no representativo**. Reconstruir "cuánto tardó el gestor" en un pasado entreverado entre admin/técnico/pagador nunca es real. No va.
- **Fee generado por gestor** — DESCARTADO del núcleo. Es **vanidad**: el gestor no elige qué gestiones le caen; mide el mix de casos, no al gestor.
- **Tasa de resolución vs cancelación imputable** — DESCARTADO por ahora. Requiere una taxonomía de motivos de cancelación (¿culpa del gestor o el inquilino desistió?) que hoy no existe, y con N chico cualquier ratio baila.
- **Cobertura de Inbox** — a la heladera. `inbox_reportes` tiene ~26 filas; sin volumen real no hay nada que mostrar.
- **Segmentar TODA la carga por "de quién es la pelota"** — DESCARTADO por sobre-diseño (Fausti: "¿para qué me sirve saber de qué lado está la pelota si es un dato de cada gestión?"). La pelota **no** es una métrica ni una segmentación de todo el tablero: sirve para **una** cosa — distinguir, dentro de lo abierto, qué **espera una decisión suya**.

## Decisión de diseño (party mode + Fausti)

**Una card nueva, exclusiva del admin: "Reparto por gestor".** Muestra, por cada Gestor Comercial, **cuánto tiene abierto** (carga activa), con la parte que **espera una decisión suya** resaltada.

Por qué esto y no lo demás (lo que sobrevivió al fuego):

1. **El eje persona es lo único genuinamente nuevo y no duplicado.** Todos los widgets existentes son por gestión o globales. "Cuánto lleva cada gestor" no está en ningún lado. La card "Gestiones estancadas" que ya existe es una **lista plana por días** (`panel-metricas.client.tsx:339-353`), cross-gestor, sin eje persona — no se pisa con esto.
2. **Es lo más real y completo de todo lo discutido.** Estado **presente**, no arqueología: mira el 100% de las abiertas de cada gestor, sin atribución de tiempo, sin reasignaciones que ensucien, sin tiempo del pagador metido adentro. Un `GROUP BY gestor` sobre lo que ya viaja al cliente.
3. **Acciona el trabajo real del admin: rebalancear.** Ve "Juan 30 / Pedro 4" y redistribuye. Hoy lo hace a ojo.
4. **La barra va partida, no lisa.** Lisa vuelve a ser "volumen, no rendimiento". El corte "espera decisión suya" vs "en curso" es lo que la hace accionable: separa al gestor que **está sentado sobre trabajo** del que **está esperando a un tercero** (técnico/pagador). Ese corte, agregado por persona, sí dice algo del gestor ("cuánto de lo que tiene trabado se destraba llamándolo a él").

### "Espera una decisión suya" — definición conservadora, sin contaminación

Se cuenta como **"de su lado"** SOLO los momentos donde el gestor es, sin ambigüedad, el que debe accionar y **nadie más está en el medio** — usando exclusivamente datos que ya viajan en la fila (cero campos nuevos, cero eventos):

- **Etapa `ingresado`**: siempre suya. Nadie tocó la gestión todavía; él clasifica y asigna.
- **Etapa `conformidad` con una conformidad `subida` pendiente** (hay `subida` y no hay `aprobada`): el técnico ya entregó, falta que el gestor valide.

**Deliberadamente NO se cuenta la decisión de presupuesto** (etapa `presupuesto` con presupuesto `enviado`): esa ventana está contaminada por el tiempo del **técnico cotizando** y del **pagador** deliberando (`presupuesto_enviado_pagador` no viaja en la fila, no se puede distinguir "falta que el gestor lo mueva" de "ya lo mandó al pagador y espera"). Contar eso como "de su lado" reintroduce justo la contaminación que hundió el SLA. Se prefiere **subcontar antes que acusar en falso** (vara de Fausti: real y justificable). Ampliable si algún día el service expone el flag de "enviado al pagador".

Todo lo demás abierto (`asignacion`, `presupuesto`, `en_ejecucion`) cuenta como **"en curso"** — la pelota está con el técnico, el pagador o el financiero, o es ambiguo.

## Alcance

**Sin migración. Sin tablas. Sin cambios en el service.** Todo el cómputo es client-side sobre `metricas.filas`, que ya trae `gestorId`, `gestorNombre`, `etapa` y `conformidades[]` (patrón STORY-914: el service entrega granular, el cliente arma el gráfico). La gestión se gatea al rol `administrador`.

### Código

- **`components/metricas/panel-metricas.client.tsx`**:
  - Nuevo `useMemo` `reparto`: filtra `filasEsp` a no-terminales con `gestorId`; agrupa por `gestorId` → `{ nombre, total, deSuLado, enCurso }`. `deSuLado` = etapa `ingresado` **o** (etapa `conformidad` con `conformidades` que incluye `"subida"` y no incluye `"aprobada"`). `enCurso = total - deSuLado`. Ordena por `total` desc. Devuelve `{ data, nGestores }`.
  - Nuevo `<Bloque>` **"Reparto del trabajo"**, gateado con `metricas.rol === "administrador"`, ubicado **después de "Para resolver hoy"** y antes de "Orden por valor".
  - Card "Reparto por gestor", `alcance="ahora"`, `humildad={false}`, `unidad="gestores"`. Barra horizontal apilada por gestor (recharts, layout vertical, mismo estilo que "Gestiones activas por etapa"): serie `deSuLado` en esmeralda (`BRAND` = acción suya) + serie `enCurso` en gris neutro (`#d4d4d8`), `stackId` común. Leyenda manual abajo (patrón card de cobro). Tooltip que desglosa total / espera su decisión / en curso.
  - Ayuda: "Cuánto tiene abierto cada Gestor Comercial. En esmeralda, lo que espera una decisión suya (ingresado o conformidad por validar)."

### Consideraciones

- **Por qué admin-only**: RLS scopea `obtenerMetricas` — el Gestor Comercial solo ve SUS gestiones (se vería a sí mismo, inútil); el administrativo (Financiero) no conduce el funnel. El payload ya trae `rol`; el gate es la misma forma que "Presión por especialidad" (`metricas.rol !== "gestor_administrativo"`, línea 759).
- **Regla #0**: una card, un `useMemo`, cero backend, cero migración. La pelota queda **abajo del capó** (arma el color de la barra), no como métrica ni UI propia — como pidió Fausti.
- No se toca "Gestiones estancadas": responde otra pregunta (qué gestión persigo hoy), esta responde cómo están repartidos los gestores.

## Fuera de alcance / Descartado (documentado para no re-proponer)

- **SLA / tiempos históricos del gestor** — ver arriba. Muerto por contaminación (admin/reasignación/pagador). No revivir sin resolver la atribución de tiempo, que hoy el dato no permite limpio.
- **Fee generado / cancelación imputable / cobertura de Inbox** — ver arriba.
- **Contar la decisión de presupuesto como "de su lado"** — excluida a propósito por contaminación del pagador; no es olvido.
- **Barra lisa (solo total)** — descartada: es volumen, no rendimiento.
- **Umbrales/días de antigüedad por gestor** — no van; eso es "estancadas", que ya existe y es cross-gestor.

## Criterios de aceptación

1. **Admin ve la card**: en Informes del administrador aparece "Reparto por gestor" con una barra por cada Gestor Comercial que tenga ≥1 gestión abierta, ordenadas de mayor a menor carga total.
2. **La barra va partida**: cada barra muestra en esmeralda lo que **espera decisión del gestor** (gestiones en `ingresado`, más las de `conformidad` con una conformidad subida sin aprobar) y en gris el resto de lo abierto; el largo total = carga activa del gestor.
3. **Tooltip**: al pasar por una barra se ve total / espera su decisión / en curso, con el nombre del gestor.
4. **Gestor Comercial y Financiero NO ven la card**: en sus Informes no aparece "Reparto por gestor".
5. **No se pisa con estancadas**: "Gestiones estancadas" sigue igual (lista plana por días), la card nueva es por gestor.
6. **Sin datos**: un gestor sin gestiones abiertas no aparece; si no hay ninguno, la card muestra el vacío estándar.
7. `tsc --noEmit` y `eslint` verdes; `next build` OK.

## Dev Agent Record

- **Commit:** `9347411` (2026-07-24). Sin migración, sin cambios en el service. `tsc --noEmit`, `eslint` y `next build` verdes (Compiled successfully).
- **Verificación E2E** (navegador Playwright, dev local :3000, data real, 2026-07-24):
  - **Admin** → Informes: aparece "Reparto por gestor" con **9 gestores** (Ramiro Zarate, Giuliano Vigetti, GestorComercial Uno, Admin, etc.), barras horizontales apiladas ordenadas por carga total, esmeralda "espera su decisión" + gris "en curso", tooltip con desglose, badge "ahora". ✅
  - **Gestor Comercial** (`ausitesis+gestorcomercialuno`) → Informes: la card **NO aparece** (0 coincidencias de "Reparto"/"Espera su decisión"), pero sí ve el resto de sus Informes (estancadas presente). ✅ Gate `rol === "administrador"` demostrado.
  - "Gestiones estancadas" intacta (no se pisa). ✅
- **Archivos:**
  - `components/metricas/panel-metricas.client.tsx`: `useMemo` `reparto` (agrupa por gestor, `deSuLado` = ingresado ∨ conformidad-subida-sin-aprobar); nuevo `<Bloque>` "Reparto del trabajo" gateado a admin entre "Para resolver hoy" y "Orden por valor"; barra recharts apilada (BRAND + `NEUTRO_CARGA` #d4d4d8) con leyenda y tooltip; se amplió el tipo de `render` de `TooltipCaja` para exponer `payload`.
  - `specs/STORY-1050.md` (esta), `specs/README.md` (índice).
