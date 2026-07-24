# STORY-1050 — Reparto de carga por gestor (informe exclusivo del administrador) (v1.1)

**Estado:** 🔨 en prueba · **Origen:** pedido de Fausti (2026-07-24): "qué métricas serían de suma utilidad a nivel negocio para el administrador sobre el trabajo/rendimiento de sus gestores". Diseñado en party mode (Mary·John·Winston·Sally·Amelia), con Fausti podando las candidatas en vivo.

**v1.1 (2026-07-24, feedback de Fausti en prueba):** (1) la barra pasó de **partida** (esmeralda "espera su decisión" / gris "en curso") a **lisa** — solo cuántas gestiones activas tiene cada gestor. El corte confundía y estaba mal planteado (la etapa `presupuesto` también sería "de su lado" pero es mixta técnico/gestor). (2) Se **excluyen del reparto los dueños que no son Gestor Comercial** (el admin puede quedar como `gestor_id` de una gestión, pero no es un Gestor Comercial y no debe aparecer en la lista).

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

**Una card nueva, exclusiva del admin: "Reparto por gestor".** Muestra, por cada Gestor Comercial, **cuántas gestiones activas tiene** — una barra lisa. Nada más.

Por qué esto y no lo demás (lo que sobrevivió al fuego):

1. **El eje persona es lo único genuinamente nuevo y no duplicado.** Todos los widgets existentes son por gestión o globales. "Cuánto lleva cada gestor" no está en ningún lado. La card "Gestiones estancadas" que ya existe es una **lista plana por días** (`panel-metricas.client.tsx:339-353`), cross-gestor, sin eje persona — no se pisa con esto.
2. **Es lo más real y completo de todo lo discutido.** Estado **presente**, no arqueología: mira el 100% de las abiertas de cada gestor, sin atribución de tiempo, sin reasignaciones que ensucien, sin tiempo del pagador metido adentro. Un `GROUP BY gestor` sobre lo que ya viaja al cliente.
3. **Acciona el trabajo real del admin: rebalancear.** Ve "Juan 30 / Pedro 4" y redistribuye. Hoy lo hace a ojo.

### Solo Gestores Comerciales

El reparto cuenta **solo dueños con rol `gestor_mantenimiento`** (Gestor Comercial). El admin (u otros roles) puede quedar como `gestor_id` de una gestión, pero **no es un Gestor Comercial** y no debe aparecer en la lista. La fila de métricas no traía el rol del dueño → se suma al SELECT del gestor (`gestor:usuarios(nombre, rol)`) y se expone `gestorRol` en `FilaMetrica`; el cliente filtra por él.

### v1.0 → v1.1: por qué la barra ya no va partida (descartado)

La v1.0 partía la barra en esmeralda "espera su decisión" (etapa `ingresado` + `conformidad` por validar) vs gris "en curso". **Fausti lo rechazó en prueba** y tiene razón: el corte confundía (no se entendía qué medía el esmeralda) y estaba mal planteado — la etapa `presupuesto` también debería contar como "de su lado", pero es **mixta** (una parte depende del técnico que cotiza, otra del gestor que decide), así que quedaba en gris y volvía el criterio incoherente. Distinguir bien esos casos exige datos que la fila no trae (`presupuesto_enviado_pagador`). Conclusión: **barra lisa, solo el total** — como se había dicho al final del party mode antes de sobre-diseñar. La segmentación por "de quién es la pelota" queda **descartada** (ver Fuera de alcance).

## Alcance

**Sin migración. Sin tablas.** Un solo agregado al service (traer `rol` del gestor); el resto es client-side sobre `metricas.filas` (patrón STORY-914). La card se gatea al rol `administrador`.

### Código

- **`features/metricas/service.ts`**: el SELECT del gestor pasa de `gestor:usuarios!...(nombre)` a `(nombre, rol)`; el tipo `G.gestor` suma `rol`; `FilaMetrica` suma `gestorRol: string | null` y el map lo puebla (`g.gestor?.rol ?? null`). Es el único cambio de backend.
- **`components/metricas/panel-metricas.client.tsx`**:
  - Nuevo `useMemo` `reparto`: filtra `filasEsp` a no-terminales con `gestorId` **y `gestorRol === "gestor_mantenimiento"`**; agrupa por `gestorId` → `{ nombre, total }`. Ordena por `total` desc. Devuelve `{ data, nGestores }`.
  - Nuevo `<Bloque>` **"Reparto del trabajo"**, gateado con `metricas.rol === "administrador"`, ubicado **después de "Para resolver hoy"** y antes de "Orden por valor".
  - Card "Reparto por gestor", `alcance="ahora"`, `humildad={false}`, `unidad="gestores"`. Barra horizontal lisa por gestor (recharts, layout vertical, mismo estilo que "Gestiones activas por etapa"): una sola serie `total` en esmeralda (`BRAND`). Tooltip: "N gestiones activas". Sin leyenda.
  - Ayuda: "Cuántas gestiones activas tiene cada Gestor Comercial. Para ver cómo está repartida la carga."

### Consideraciones

- **Por qué admin-only**: RLS scopea `obtenerMetricas` — el Gestor Comercial solo ve SUS gestiones (se vería a sí mismo, inútil); el administrativo (Financiero) no conduce el funnel. El payload ya trae `rol`; el gate es la misma forma que "Presión por especialidad" (`metricas.rol !== "gestor_administrativo"`, línea 759).
- **Regla #0**: una card, un `useMemo`, un campo nuevo en el payload. Nada más.
- No se toca "Gestiones estancadas": responde otra pregunta (qué gestión persigo hoy), esta responde cómo están repartidos los gestores.

## Fuera de alcance / Descartado (documentado para no re-proponer)

- **SLA / tiempos históricos del gestor** — ver arriba. Muerto por contaminación (admin/reasignación/pagador). No revivir sin resolver la atribución de tiempo, que hoy el dato no permite limpio.
- **Fee generado / cancelación imputable / cobertura de Inbox** — ver arriba.
- **Contar la decisión de presupuesto como "de su lado"** — excluida a propósito por contaminación del pagador; no es olvido.
- **Segmentar la barra por "de quién es la pelota"** (esmeralda "espera su decisión" vs gris "en curso") — probado en v1.0 y **descartado por Fausti**: confundía y estaba mal planteado (la etapa `presupuesto` es mixta técnico/gestor). No revivir sin resolver esos casos con datos que hoy la fila no trae.
- **Umbrales/días de antigüedad por gestor** — no van; eso es "estancadas", que ya existe y es cross-gestor.

## Criterios de aceptación

1. **Admin ve la card**: en Informes del administrador aparece "Reparto por gestor" con una barra por cada Gestor Comercial que tenga ≥1 gestión abierta, ordenadas de mayor a menor carga.
2. **Barra lisa**: cada barra es el total de gestiones activas del gestor (un solo color). Sin segmentación, sin leyenda.
3. **Solo Gestores Comerciales**: no aparecen dueños con otro rol (el admin u otros que puedan quedar como `gestor_id` NO figuran en la lista).
4. **Tooltip**: al pasar por una barra se ve el nombre del gestor + "N gestiones activas".
5. **Gestor Comercial y Financiero NO ven la card**: en sus Informes no aparece "Reparto por gestor".
6. **No se pisa con estancadas**: "Gestiones estancadas" sigue igual (lista plana por días), la card nueva es por gestor.
7. **Sin datos**: un gestor sin gestiones abiertas no aparece; si no hay ninguno, la card muestra el vacío estándar.
8. `tsc --noEmit` y `eslint` verdes; `next build` OK.

## Dev Agent Record

- **Commit v1.1:** `ae957c9` (2026-07-24). Feedback de Fausti en prueba: barra **lisa** (se quitó la segmentación esmeralda/gris) + se **excluyen dueños no-Gestor-Comercial** del reparto. Cambios: `features/metricas/service.ts` (SELECT del gestor `(nombre, rol)`, `FilaMetrica.gestorRol`); `panel-metricas.client.tsx` (`reparto` filtra `gestorRol === "gestor_mantenimiento"` y solo cuenta `total`, barra `<Bar dataKey="total">` sin apilar, sin leyenda, tooltip simple; se quitó la constante `NEUTRO_CARGA` y el ensanche de `TooltipCaja`). `tsc`/`eslint`/`build` verdes. E2E: admin ve **4 gestores** (Ramiro Zarate, GestorComercial Uno, Marcos Gutiérrez, Valentina Suárez) en barras lisas ordenadas por carga, sin "Admin" ni otros roles; la card sigue oculta para Gestor Comercial/Financiero.
- **Commit v1.0:** `9347411` (2026-07-24). Sin migración, sin cambios en el service. `tsc --noEmit`, `eslint` y `next build` verdes (Compiled successfully).
- **Verificación E2E** (navegador Playwright, dev local :3000, data real, 2026-07-24):
  - **Admin** → Informes: aparece "Reparto por gestor" con **9 gestores** (Ramiro Zarate, Giuliano Vigetti, GestorComercial Uno, Admin, etc.), barras horizontales apiladas ordenadas por carga total, esmeralda "espera su decisión" + gris "en curso", tooltip con desglose, badge "ahora". ✅
  - **Gestor Comercial** (`ausitesis+gestorcomercialuno`) → Informes: la card **NO aparece** (0 coincidencias de "Reparto"/"Espera su decisión"), pero sí ve el resto de sus Informes (estancadas presente). ✅ Gate `rol === "administrador"` demostrado.
  - "Gestiones estancadas" intacta (no se pisa). ✅
- **Archivos:**
  - `components/metricas/panel-metricas.client.tsx`: `useMemo` `reparto` (agrupa por gestor, `deSuLado` = ingresado ∨ conformidad-subida-sin-aprobar); nuevo `<Bloque>` "Reparto del trabajo" gateado a admin entre "Para resolver hoy" y "Orden por valor"; barra recharts apilada (BRAND + `NEUTRO_CARGA` #d4d4d8) con leyenda y tooltip; se amplió el tipo de `render` de `TooltipCaja` para exponer `payload`.
  - `specs/STORY-1050.md` (esta), `specs/README.md` (índice).
