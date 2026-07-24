# STORY-1051 — Patrones de fondo: detectar problemas crónicos por propiedad y facilitar la obra que los ataca (v1.0)

**Estado:** 🔨 en prueba — diseñada en party mode (Mary·John·Winston·Amelia·Sally·Paige·Boundary·Grumbal) el 2026-07-24 con Fausti podando en vivo; **Fase 1 en `main`** el mismo día (commit `d31e065`). **Fase 2 (Walter) implementada y verificada E2E** el 2026-07-24 (sin commitear aún). · **Origen:** Fausti, al abrir el legajo de una propiedad (Belgrano 1288 PH 3) y ver el badge "⚠ Electricidad reincidente — 4 obras": *"el sistema detecta el patrón crónico pero no lo convierte en una decisión — 4 reportes sueltos no dejan darse cuenta de que había que cambiar todo el tendido"*.

## Problema

Hoy el sistema **cuenta** la reincidencia pero no la **explota** para decidir:

- **El badge del legajo (STORY-985, `components/cartera/historial.client.tsx:198-207`)**: misma especialidad **≥3 veces en toda la vida** de la propiedad → una etiqueta ámbar `⚠ {esp} reincidente — {n} obras`. Es puramente decorativa: sin acción, sin "¿y ahora qué?". Es lo que Fausti vio.
- **La métrica de dashboard (STORY-917 #12, "Reincidencia 90 días")**: **fue cortada** — no está en `panel-metricas.client.tsx` y quedó solo el campo fósil `propiedadId` en `metricas/service.ts:24`. Medía **calidad del técnico** (misma propiedad+especialidad reabierta a <90 días) — otro lente, casi siempre vacío con la carga real.

Ninguna de las dos hace lo que el negocio necesita: cuando una propiedad acumula obras del mismo rubro (electricidad, plomería, humedad…), **nadie junta esas obras para preguntarse si son el mismo problema de fondo** y, si lo son, atacar la causa (renovar el tendido) en vez de pagar el 5º parche. El dato para hacerlo **ya existe y no se usa**: cada obra tiene su fecha, su categoría, y —clave— la **nota de inspección** del técnico (`Avance.nota`, `features/gestiones/types.ts:147-156`), que es el **diagnóstico** ("tablero sulfatado"), no el síntoma del reporte ("se cortó la luz").

## Decisión de diseño

Tres piezas que se sostienen por separado (la #1 vale sin las otras dos):

### 1. Bandeja "Para revisar de fondo" (detección — tonta, barata, proactiva)

- **Una sección nueva en Informes**, hermana de "Gestiones estancadas" / "Gestiones pendientes de cobro" (bloque "Para resolver hoy", `panel-metricas.client.tsx`). NO es un gráfico: es una **bandeja que se vacía** (como Cobro), no un tablero eterno — cada fila es una pregunta que se responde una vez.
- **Candidata** = propiedad + categoría (especialidad) con **≥2 obras no canceladas** (`≥2` = "repite" = la definición, no un número mágico). Cross-cartera, respetando el **mismo alcance de ownership** que el resto de Informes (admin ve todo; el gestor, sus propiedades — PRD §2.1).
- **Ordenada peor-arriba por severidad** = frecuencia + qué tan **apretadas en el tiempo** están (ambas salen de las fechas que ya tenemos — **sin fórmula con constantes ocultas**: un clúster reciente y denso pesa más que 3 obras espaciadas en 10 años, que se hunden solas).
- **Dos filtros de vista EN VIVO, del lado del cliente, EFÍMEROS** (mismo patrón que el `ComboFiltrable` del historial; **NO** una config persistida por inmobiliaria — eso es complejidad de producto y queda **fuera de alcance**):
  - **Sensibilidad** — `≥ N` reiteraciones. **Default `3`** (piso de "patrón", heredado de STORY-985; slideable hasta 2).
  - **Ventana** — `últimos X años`. **Default: todo el histórico** (no recorta por tiempo al abrir → no excluye nada; paso de 1 año). La ventana era el único número que *excluía* en duro, por eso es un filtro vivo y no una constante: si querés más perspectiva, la ensanchás.
  - Los dos son **solo dónde arrancan parados**: la bandeja funciona sin tocar nada, y el `3`/años se mueven en vivo. Cada default va **comentado con su porqué** en el código (un número explicado y ajustable en una línea no es deuda).
- **Al desplegar una fila** (énfasis de Fausti — **leer por sí mismo es el camino primario, Walter es opcional**): se listan las obras de esa propiedad+categoría **dentro del plazo**, cada una con **título + fecha como link directo a `/gestiones/[id]`** → un toque y ves el timeline completo vos mismo (mismo patrón que el historial, que ya linkea cada obra). La bandeja **vale aunque nunca uses Walter**: te junta las crónicas y te da un click a cada timeline.

### 2. Walter analiza (juicio — opcional, caro, a demanda, SOLO LECTURA)

- Botón **opcional** "Analizar con Walter" en la fila desplegada. Su valor es lo único que un contador **no puede** hacer: **leer las notas de inspección** de las obras y decir si son el **mismo problema de fondo** o coincidencia. A escala de cartera, lee lo que ningún gestor va a leer a mano.
- Walter lee **hondo pero acotado**: las obras de **UNA propiedad + UNA categoría, dentro del plazo del filtro, a demanda**. **Nunca** barre la cartera entera en profundidad (sería una bomba de tokens). *La lista dice **dónde** mirar; Walter dice **qué** estás mirando.*
- **Lo que ve en pantalla es lo que juzga**: Walter analiza exactamente las obras **del plazo definido** (consistencia de UX — nada de obras fantasma fuera de la ventana). ¿Querés que mire más atrás? Ensanchás la ventana y re-analizás: **la ventana es también el control de "hasta dónde para atrás investiga Walter"**.
- **Pre-tratamiento = la tool eligiendo campos, NO un mini-modelo que resuma** (eso sería IA-antes-de-IA, Regla #0). Se le manda **solo lo que diagnostica**: `nota` de inspección + descripción del trabajo (presupuesto) + rendición. Se tira el ruido (fotos, UUIDs, plata-plumbing, event-log). **Se cura la estructura, NO se resume la prosa**: "sulfatado" tiene que llegarle **textual** o se pierde la señal.
- **Walter propone, el humano evalúa** (pedido explícito de Fausti: "el gestor/admin evalúa"). Su default es **la duda, no la confirmación**: dice "no, son artefactos distintos" cuando corresponde. Presenta una **hipótesis con su razonamiento** ("las 4 notas mencionan el mismo tablero — parece de fondo; confirmá vos"), **nunca una sentencia** — "están relacionadas" es una inferencia, no un dato, y confirmar de más ES inventar (contra su regla `nunca inventás datos`).
- **Walter NO ve fotos** (es texto): la mejor evidencia (foto del tablero) la tiene el humano, no él → refuerza "propone con lo que lee, vos evaluás con lo que ves".
- **Walter sigue de SOLO LECTURA** (pilar de seguridad, `prompt.ts:79`). No crea la gestión: **propone y pasa el botón**. El "solo lectura" no es limitación, es lo que mantiene su superficie de ataque a cero (prompt injection desde inbox/tools no puede escribir).

**Calidad del diagnóstico (convenciones de grounding — Anthropic + el campo, investigadas 2026-07-24).** El riesgo de Walter no es *factualidad* (contradecir el mundo) sino **fidelidad** (afirmar algo que su fuente no dice). El lever #1 contra eso es **citar la evidencia y descartar lo que no se puede citar**. Decisiones:
- **Salida estructurada con cita textual OBLIGATORIA** — el análisis NO devuelve prosa libre; devuelve un **objeto validado** (`generateObject` + schema Zod, en vez del `streamText` del chat). Por cada obra que Walter incluye en el patrón, una **cita textual de la nota de inspección** que la conecta con las demás. **Sin cita verbatim → esa obra no cuenta como evidencia.** Auditable: el gestor ve las frases exactas del técnico. Schema aprox.: `{ veredicto: "fondo"|"coincidencia"|"insuficiente", confianza: 0–1, obras: [{ id, citaTextual }] }`.
- **Abstención de primera clase** — `insuficiente` es un veredicto válido, no un caso raro: cuando las notas no sostienen la relación (técnico que no escribió el hallazgo, causa que vive en una foto), el default es *"no me alcanza, mirá vos"*. Mata el falso positivo por diseño.
- **Modelo del análisis: Claude Sonnet 5** (`claude-sonnet-5`), NO el Haiku 4.5 del chat. El juicio "¿misma causa raíz?" es razonamiento duro y Haiku no soporta adaptive thinking; el análisis es **a demanda y de baja frecuencia**, así que el costo extra es marginal. Es un **override por-llamada** (el chat de Walter sigue en Haiku): se agrega `MODELO_ANALISIS = "claude-sonnet-5"` al lado de `MODELO_ASISTENTE` en `features/asistente/config.ts`, cero refactor. Documentar POR QUÉ el análisis usa otro modelo, para que nadie lo "unifique" por descuido.

### 3. Iniciar la gestión de fondo (acción — facilitada)

- Desde la fila (con o sin Walter), botón **"Iniciar gestión de fondo"** → abre **Nueva Gestión pre-cargada**: propiedad + categoría ya puestas, y **descripción redactada citando las obras antecedentes** ("Revisión de fondo del tendido. Antecedentes: #12, #34, #56, #78"). Ese pre-cargado es el **"facilitar"** que pidió Fausti: cero re-tipeo, el gestor confirma y ajusta.
- **Trazabilidad por texto, no estructural.** Se **citan** los números de obra en la descripción (gratis, cero tabla). NO se reusa `gestion_origen_id` (STORY-1001): ese vínculo **rechaza orígenes cerrados** (`service.ts:282`) —y las obras crónicas están terminadas— y es **un solo padre**, mientras acá hay N antecedentes. Un vínculo "muchos antecedentes retrospectivos" sería una tabla nueva para un botón → fuera de alcance.

### 4. Ciclo de vida de la fila (cómo se vacía y cuándo vuelve)

- **Sale de la bandeja** por una de dos vías (las dos son un **juicio**, no un "snooze" pasivo): **descartada** ("no relacionadas / coincidencia") o **gestión de fondo iniciada**.
- **Reaparece** con **una sola regla — el patrón "no leído"**: *entra una obra nueva (no cancelada) de esa categoría, posterior a la última vez que la atendiste*. `newest_obra > atendida_en` → vuelve. Sin umbrales raros.
- **Bordes (Boundary):**
  - Obra **cancelada** NO dispara reaparición (no pasó; consistente con la bandeja, que ignora canceladas).
  - Mientras la **gestión de fondo está en curso**, la propiedad NO va en la bandeja (la estás atacando).
  - Si la **gestión de fondo se cancela**, la fila **reaparece ya** (no atacaste nada) — la marca de "atendida vía gestión" vale solo mientras la fondo sigue viva o terminó OK.
- **El regalo del ciclo (Winston/Mary):** si reaparece **después de una gestión de fondo terminada**, eso significa *"el arreglo de fondo NO aguantó"* — el **feedback loop** que audita si la inversión valió la pena. La fila reaparecida **dice por qué volvió** (Sally: "volvió: obra nueva desde que renovaste el tablero"), no vuelve muda.

## Alcance

Fasable por fases (la #1 entrega valor sola — "la torta sin la frutilla"):

**Fase 1 — Bandeja + acción (vale sin Walter):**
- **Capa de datos (server):** agregación cross-cartera de obras por propiedad+especialidad (id, fecha, título/descripción, estado), respetando ownership. Reusa la lógica de `features/cartera/historial.ts` (`ObraHistorial`, exclusión de canceladas) a nivel cartera. El **conteo y el filtrado por ventana se hacen en el cliente** (los filtros son en vivo), así que el server devuelve las obras crudas agrupadas; el cliente cuenta/ordena/filtra.
- **UI:** sección "Para revisar de fondo" en Informes (`panel-metricas.client.tsx`, bloque "Para resolver hoy") con los **dos filtros en vivo** (`useState`, patrón `ComboFiltrable`) y filas desplegables con las obras como links a `/gestiones/[id]`.
- **Nueva Gestión pre-cargada:** el form de "Nueva gestión" (hoy nace vacío) acepta **pre-fill por query params** (propiedad, especialidad, descripción). Botón "Iniciar gestión de fondo" que arma la URL citando antecedentes.
- **Estado nuevo (mínimo):** tabla `revisiones_fondo` (`propiedad_id`, `especialidad_id`, `atendida_en`, `resultado` enum `descartada|gestion_iniciada`, `gestion_fondo_id` FK nullable, `actor_id`) + **RLS desde la primera migración**. Es el ÚNICO estado nuevo (el "un timestamp" que concedió Winston). El ciclo de vida (ocultar/reaparecer) se **deriva** comparando `newest_obra` vs la última `revisiones_fondo` válida.

**Fase 2 — Walter (la frutilla):**
- Tool nueva de lectura para Walter, acotada: `timeline_rubro(propiedad_id, especialidad_id, desde?)` → devuelve, de esas obras dentro del plazo, **solo** `nota` de inspección + descripción del trabajo + rendición (curación de campos, prosa **textual**, sin fotos) — es el corpus contra el que Walter cita.
- **Análisis estructurado** con `generateObject` (AI SDK) + schema Zod `{ veredicto, confianza, obras: [{ id, citaTextual }] }`, con **`MODELO_ANALISIS = "claude-sonnet-5"`** (override por-llamada; el chat sigue en Haiku). Cita textual obligatoria por obra; `insuficiente` como veredicto de primera clase.
- El botón "Analizar con Walter" dispara ese análisis y **siembra el resultado** en el chat de Walter existente (`components/asistente/walter.client.tsx`) — reusa su infra, no crea superficie nueva.
- Ajuste de `prompt.ts`/prompt del análisis: instrucción explícita — **default a la duda**, hipótesis con evidencia citada, nunca sentencia, "vos tenés las fotos que yo no veo".

## Fuera de alcance

- **NO** "sensibilidad" configurable persistida por inmobiliaria (tabla/settings/default eterno). Los filtros son **de vista, efímeros, cliente**. Esa distinción es la que rescató la idea; cruzarla la mata.
- **NO** se le da a Walter ninguna tool que **escriba/cree/accione**. Sigue de solo lectura — cruzar esa línea es un terremoto de seguridad, no un ajuste.
- **NO** Walter **proactivo** (que abra la boca solo). Queda como opción A (consultás/tocás el botón). El push proactivo es un "quizás después" si el A prueba que sirve.
- **NO** vínculo estructural de antecedentes (tabla de "muchos orígenes retrospectivos"). Se citan por texto.
- **NO** un mini-modelo que resuma el timeline antes de Walter (IA-antes-de-IA).
- **NO** chain-of-verification en Fase 2 (segundo pase que auto-verifica el diagnóstico): la cita textual obligatoria ya expone la evidencia a la vista del gestor; un segundo pase es costo/latencia sin pedido (Regla #0). Se reserva por si la cita no alcanza en la práctica.
- **NO** una **tercera** perilla en la bandeja (por técnico, por barrio…). Dos ejes —cuántas + en cuánto tiempo— son "crónico"; una tercera es adorno.
- **NO** selección por checkbox de qué obras analiza Walter (idea planteada y **retirada** por Fausti: el juicio del humano se corre al paso "vos evaluás la propuesta", una sola superficie de decisión, no dos).
- **Badge de STORY-985:** se mantiene como está (nota liviana en el legajo). Alinear su umbral a la definición de la bandeja es una consistencia deseable pero **no bloqueante** de esta story.

## Criterios de aceptación

1. **La bandeja aparece y se ordena:** una propiedad con ≥3 obras de una categoría figura en "Para revisar de fondo", con las más crónicas (recientes + densas en el tiempo) arriba. Una con 3 obras espaciadas en 10 años queda al fondo.
2. **Filtros en vivo con default:** la bandeja abre con `≥3` y `todo el histórico`. Mover la sensibilidad a `≥4` recorta filas al instante; bajarla a `2` muestra los pares; apretar la ventana a "2 años" re-filtra sin recargar. Nada se persiste (refrescar vuelve a los defaults).
3. **Leer por sí mismo (primario):** al desplegar una fila, cada obra del plazo es un link directo a `/gestiones/[id]` con su timeline. La feature es usable **sin tocar Walter**.
4. **Walter propone, no sentencia (Fase 2):** "Analizar con Walter" sobre un patrón real devuelve una **hipótesis con razonamiento** sobre las notas de inspección, y sobre un falso patrón (p. ej. 3 pintura por mudanza + 2 por filtración, si las notas lo dicen) es capaz de decir **"no parecen el mismo problema"**. Nunca afirma relación como hecho.
5. **Walter respeta el plazo:** analiza solo las obras dentro de la ventana visible; ensanchar la ventana y re-analizar hace que considere obras más viejas.
6. **Iniciar gestión de fondo:** el botón abre Nueva Gestión con propiedad + categoría pre-cargadas y la descripción citando los números de obra antecedentes. Confirmarla crea una gestión normal (sin vínculo estructural).
7. **La fila se vacía:** descartar o iniciar la gestión de fondo saca la propiedad+categoría de la bandeja.
8. **Reaparición (patrón "no leído"):** entra una obra nueva no cancelada de esa categoría después de atenderla → la fila vuelve, indicando el motivo. Una obra **cancelada** no la trae de vuelta.
9. **Feedback loop:** una fila atendida vía gestión de fondo **terminada** que vuelve por una obra nueva se muestra como "el arreglo de fondo no aguantó". Si la gestión de fondo se **cancela**, la fila reaparece de inmediato.
10. **Solo lectura intacto:** Walter no expone ninguna acción de escritura; su aporte termina en el botón que navega. RLS en `revisiones_fondo` desde la primera migración.
11. **Sin regresión técnica:** `tsc --noEmit` y `eslint` verdes. La bandeja no rompe los otros informes ni el badge de STORY-985.

## Dev Agent Record

- **Estado:** 🔨 **Fase 1 en `main`** (2026-07-24, commit `d31e065`, rebaseado sobre origin/main sin perder nada — el fix de desvíos `cfc60ec` intacto). `tsc` + eslint + `next build` verdes, **E2E navegador OK** (ver abajo). Fase 2 (Walter) sin empezar.
- **Migración (aplicada en prod, no en la rama):** `story_1051_revisiones_fondo` — tabla `revisiones_fondo` (`propiedad_id`, `especialidad_id`, `resultado` CHECK descartada|gestion_iniciada, `gestion_fondo_id` FK, `actor_id`, `atendida_en`) + RLS (SELECT/INSERT para los tres roles de gestión vía `rol_actual()`; INSERT exige `actor_id = auth.uid()`; append-only, sin UPDATE/DELETE) + índice `(propiedad_id, especialidad_id, atendida_en desc)`. **Ojo: descartar la rama NO borra la tabla** — revertir = `drop table revisiones_fondo`.
- **Archivos (Fase 1):**
  - `codigo/features/patrones-fondo/patrones.ts` **(nuevo)** — módulo puro: `armarPatrones(obras, revisiones, {minReiteraciones, ventanaAnios}, ahora)`. Detección (≥N por rubro), orden peor-arriba (cantidad → span → recencia, sin fórmula con constantes ocultas), y el ciclo de vida "no leído" (oculta atendidas; reaparece con obra nueva; skip de fondo cancelada; motivo de reaparición incl. "no aguantó"). Reusa `estadoObra` del historial.
  - `codigo/features/patrones-fondo/service.ts` **(nuevo, 'use server')** — `listarRevisionesFondo()` (RLS) + `descartarPatron(propiedad, especialidad)`.
  - `codigo/features/metricas/service.ts` — `FilaMetrica` suma `numero` + `especialidadId`; `Metricas` suma `revisionesFondo`; el SELECT agrega `numero, especialidad_id`; `obtenerMetricas` trae las revisiones en el `Promise.all`.
  - `codigo/features/gestiones/service.ts` — `crearGestion` acepta `es_patron_fondo?`; si viene, inserta `revisiones_fondo(gestion_iniciada, gestion_fondo_id)` tras crear la gestión.
  - `codigo/components/metricas/bandeja-fondo.client.tsx` **(nuevo)** — la bandeja: dos filtros en vivo (sensibilidad `≥N` def. 3, ventana años def. todo), filas desplegables con las obras como links a `/gestiones/[id]`, botones "Iniciar gestión de fondo" (→ Nueva Gestión pre-cargada, gate por rol) y "No están relacionadas" (descartar). Se auto-oculta si no hay ningún rubro repetido (≥2).
  - `codigo/components/metricas/panel-metricas.client.tsx` — mapea `filas`→`ObraParaPatron` y renderiza `<BandejaFondo>` como sección "Para revisar de fondo" bajo "Para resolver hoy".
  - `codigo/app/tablero/page.tsx` + `codigo/components/gestiones/tablero.client.tsx` — pre-carga de Nueva Gestión por query params (`propiedad`, `especialidad`, `descripcion`, `fondo=1`): el form abre solo, con propiedad/especialidad/descripción puestas, y pasa `es_patron_fondo`.
- **Verificación:** `tsc --noEmit` + eslint + `next build` verdes. **E2E navegador OK** (2026-07-24, admin, dev :3000, data real, Playwright):
  - **Detección + orden:** la bandeja "Para revisar de fondo" aparece con 22 propiedades, ordenadas peor-arriba (Caseros/Gas 35 → … → los de 4 → los de 3). Belgrano 1288 PH 3 · Electricidad · 4 obras presente (el caso que originó todo — y 3 de sus 4 obras dicen "cambio de tablero": el patrón de componente que Walter cazará en Fase 2).
  - **Filtro sensibilidad en vivo:** subir a `≥5` recorta a 4 propiedades al instante (Belgrano de 4 cae); default `3` / ventana "todo".
  - **Desplegar:** Belgrano abre con los 4 links `#120, #99, #75, #28` (más nuevo arriba) a `/gestiones/[id]` + botones "Iniciar gestión de fondo" y "No están relacionadas".
  - **Iniciar gestión de fondo:** el botón navega a Nueva Gestión pre-cargada (propiedad Belgrano, especialidad Electricidad, descripción "Revisión de fondo del rubro Electricidad. Antecedentes (4 obras…): #120, #99, #75, #28."); al crear → gestión #259 en `ingresado` + `revisiones_fondo(gestion_iniciada, gestion_fondo_id=#259)`; Belgrano **sale** de la bandeja (22→21).
  - **Descartar:** "No están relacionadas" en Av. General Paz 356 6°B · Plomería → `revisiones_fondo(descartada)` + sale de la bandeja.
  - **Reaparecer (feedback loop):** insertada una obra nueva de plomería en General Paz posterior al descarte → reaparece con badge **"Volvió"** + motivo "Descartada antes, pero entró una obra nueva de este rubro", cuenta 4→5.
  - **Cleanup:** las 2 gestiones de prueba (#259/#260) y todas las revisiones borradas → prod restaurado (max #258, revisiones=0, bandeja de vuelta en 22 con Belgrano).
  - **Fase 2 (Walter) — implementada y verificada E2E (2026-07-24, sin commitear).** Archivos: `features/asistente/config.ts` (`MODELO_ANALISIS = "claude-sonnet-5"`), `features/patrones-fondo/service.ts` (`analizarPatronFondo` — junta notas de inspección + trabajo + rendición, corre `generateObject` Sonnet 5 con schema `{veredicto, confianza, razonamiento, obras:[{numero, cita_textual}], sugerencia}`, **thinking apagado** por-llamada porque `generateObject` fuerza tool-choice y choca con el thinking de Sonnet 5), `features/asistente/tools.ts` (tool `analizar_patron_fondo`, gateada a `esStaff`), `features/asistente/prompt.ts` (guía de relato fiel), `components/metricas/bandeja-fondo.client.tsx` (botón "Analizar con Walter" → `CustomEvent("walter:preguntar")`), `components/asistente/walter.client.tsx` (escucha el evento → abre + envía). **Verificación:** (1) 4 casos aislados contra Sonnet 5 = oráculo exacto (CASO A picaporte→fondo, B1 tablero→fondo, B2 artefactos distintos→coincidencia, C notas vagas→insuficiente); (2) E2E navegador completo: botón→evento→Walter abre→Haiku llama la tool→Sonnet 5→veredicto con citas textuales→relato fiel (CASO A "de fondo" + sugerencia "iniciá la gestión de fondo"; B2 "coincidencia"); (3) **repreguntar** funciona (follow-up con el análisis en contexto). Test de oro B1 vs B2 (misma Electricidad, veredicto opuesto) OK: juzga por la causa de las notas, no por el rubro. Datos de prueba: `TEST-WALTER-casos-sembrados.md` (propietario marcador `ausitesis+testwalter@gmail.com`).
