# STORY-1026 — Walter grafica: gráficos dinámicos en las respuestas de métricas (v1.0)

**Estado:** ✅ done · **Origen:** pedido de Fausti (2026-07-21): que Walter muestre gráficos al responder métricas, como el Walter del MANTIS original pero "que ande mejor" — y que pueda armar cruces que no tienen reporte desarrollado (ej.: eficiencia por gestor).

> Revierte un descarte documentado en STORY-1007 ("charts dentro del chat — Informes ya los tiene"): el tester y Fausti confirmaron que la respuesta visual dentro del chat vale la pena.

## Problema

Walter responde métricas solo con texto. Para comparaciones (ranking de técnicos, ingresos por mes, carga por etapa) el número pelado es difícil de leer, y cualquier cruce sin card en Informes (ej. "¿cómo rinden mis gestores?") directamente no tiene respuesta visual en ningún lado.

El Walter v1 de la tesis resolvía esto haciendo que el **modelo re-escribiera los números** en un JSON embebido en el texto (`WALTER_CHART:{...}`) que el server parseaba: el gráfico podía mentir (transcripción a mano), fallaba en silencio si el JSON venía cortado, y era un estado global que se borraba con cada mensaje.

## Solución: tool `graficar` con serie calculada 100 % server-side

El modelo **nunca escribe números**: elige QUÉ cruzar y el servidor pivotea los datos reales.

### 1. Datos — `features/metricas/service.ts`

- `FilaMetrica` suma `gestorId` / `gestorNombre` (join `gestor:usuarios!gestiones_gestor_id_fkey(nombre)`, mismo alias que el tablero). Es la única dimensión que faltaba; el resto (técnico, especialidad, etapa, fechas, montos congelados, estrellas) ya viaja.

### 2. Tool nueva `graficar` — `features/asistente/tools.ts` (solo staff)

Input (todo enums Zod — el modelo compone, no inventa):

- `agrupar_por`: `tecnico | gestor | especialidad | etapa | mes`
- `metrica`: `cantidad | monto_cobrado | fee_inmobiliaria | tiempo_ciclo_dias | calificacion_promedio | dias_en_etapa`
- `estado` (opcional): `activas | terminadas | todas` (default `todas`)
- `periodo` (opcional): `este_mes | ultimos_3_meses | ultimos_6_meses | ultimo_anio | historico` (default `historico`; filtra por `cobradoEn` en las métricas de plata/ciclo, por `creadoEn` en el resto)
- `titulo`: string corto (cosmético — los números jamás salen del modelo)

Reglas del pivoteo (una función pura sobre `obtenerMetricas()` — mismos números que Informes, RLS de sesión, guard staff idéntico a `metricas_negocio`):

- `dias_en_etapa` solo con `agrupar_por: etapa` (permanencia promedio, misma derivación que cuellos de botella); otra combinación devuelve `{error}` legible para que el modelo se corrija.
- `mes` ordena cronológico ascendente y etiqueta "jul 2026"; el resto ordena por valor descendente, tope 12 grupos (el resto se agrega como "Otros" solo en `cantidad`; en promedios se recorta y se informa `mostrando_top`).
- Grupos sin dato para un promedio (sin calificaciones, sin cobros) se omiten — un promedio sobre nada no se grafica.
- Output: `{ titulo, tipo, unidad, serie: [{label, valor}], total?, mostrando_top? }` con valores **numéricos crudos** — el mismo JSON alimenta el render del cliente y el comentario del modelo: consistencia texto↔gráfico por construcción.
- `tipo` lo decide el server: `mes` → línea; el resto → barras. Sin torta (dos formas alcanzan y comunican mejor; Regla #0).

### 3. Render — parte de tool en el mensaje (patrón `sugerir_navegacion`)

- `components/asistente/grafico.client.tsx` (nuevo): recibe el output validado y dibuja con **recharts** (ya es dependencia) — `BarChart` horizontal para categorías (nombres largos legibles en el panel de 400 px) o `LineChart` para meses. Colores y tooltip del design contract (esmeralda `#059669`, grid `#e4e4e7`, caja de tooltip como `TooltipCaja` de Informes). Una sola serie → sin leyenda; título arriba; alto ~180 px.
- `walter.client.tsx` renderiza `parte.type === "tool-graficar"` con `state === "output-available"` dentro de la burbuja del mensaje — el gráfico queda **atado a su mensaje** y persiste con el chat (sessionStorage), a diferencia del chart global del v1.
- El componente entra por `next/dynamic` (lazy): recharts no se suma al bundle de cada pantalla; el técnico (que no tiene la tool) no lo descarga nunca.
- `CONSULTANDO` suma `graficar: "Armando el gráfico"`.

### 4. Prompt — `features/asistente/prompt.ts` (solo roles staff)

Regla nueva: cuando la respuesta compare valores entre categorías o muestre una evolución (rankings, distribuciones, series por mes), llamar a `graficar` además del resumen corto en texto; el texto comenta el gráfico (máximo 2-3 datos salientes), no lo repite ítem por ítem.

## Fuera de alcance (decisiones conscientes)

- **SQL libre generado por el modelo**: máxima flexibilidad, pero rompe el requisito de seguridad impecable de Walter v2 (superficie de exfiltración/carga) y la Regla #0. Las dimensiones × métricas del enum cubren decenas de cruces; si falta una dimensión, se agrega al enum (es un campo más en la query).
- **Torta/donut** y múltiples series por gráfico: barras + línea de una serie comunican todo lo pedido con menos bugs.
- **Gráficos para el técnico**: no tiene tools de métricas (matriz de guards intacta).
- **Export/descarga del gráfico**: no lo pide nadie.

## Criterios de aceptación

1. Admin: "mostrame los ingresos por mes" → gráfico de **línea** en el chat con los mismos totales que la card Dinero de Informes, y texto que lo comenta sin inventar números.
2. Admin: "¿cómo rinden los gestores?" (cruce SIN card en Informes) → gráfico de barras por gestor con datos reales (p. ej. cantidad o tiempo de ciclo).
3. Gestor de mantenimiento: pide un gráfico → sale calculado SOLO sobre sus gestiones (RLS, mismo alcance que su pantalla de Informes).
4. Técnico: no existe la tool — pedir un gráfico no la dispara ni revela datos de negocio.
5. El gráfico queda pegado a su mensaje: seguir chateando, navegar de sección y reabrir → los gráficos anteriores siguen en su lugar en el hilo.
6. Combinación inválida (`dias_en_etapa` + `tecnico`) → Walter se disculpa/reintenta con una válida; jamás un gráfico roto ni un crash.
7. Los valores del gráfico salen del server: no existe camino por el que el modelo escriba un número en la serie.
8. `tsc`/eslint verdes; regresión de Walter (chips, navegación, streaming, error+reintentar) intacta.

## Dev Agent Record

- **Commit:** _pendiente de OK de Fausti_
- **Archivos:** `codigo/features/metricas/service.ts` (`gestorId`/`gestorNombre` en `FilaMetrica` + join), `codigo/features/asistente/tools.ts` (`armarGrafico` + tool `graficar` staff + descripción de `ranking_tecnicos` apuntando a Informes), `codigo/features/asistente/prompt.ts` (regla de gráficos, solo staff), `codigo/app/api/asistente/route.ts` (saneo de tool calls incompletos — patch STORY-1007 v1.2), `codigo/components/asistente/grafico.client.tsx` (nuevo, recharts lazy), `codigo/components/asistente/walter.client.tsx` (render de `tool-graficar` a ancho completo, clave de chat por usuario — patch STORY-1015 v1.1 —, limpieza de partes colgadas al restaurar, label "Armando el gráfico"), `codigo/components/paneles/panel-shell.tsx` (`usuarioId` a Walter).
- **Verificación (E2E navegador, 2026-07-21):** `tsc`/eslint verdes, consola sin errores. **Admin**: "ingresos por mes" → línea con 8 meses y texto comentando pico/promedio/acumulado desde el mismo tool result; "¿cómo rinden los gestores?" → barras "Tiempo de ciclo por gestor" (cruce sin card en Informes) con caveat propio sobre datos de prueba; ambos gráficos persisten en el hilo. **Gestor comercial**: "activas por etapa" → barras que suman 19 = su tile de Informes (RLS, admin ve 80). **Técnico**: pide gráfico de ingresos → declina sin datos ni gráfico (no tiene la tool) y su chat NO se cruzó con el del admin en la misma pestaña (claves separadas, criterio v1.1 de STORY-1015 en ambos sentidos). **Bug #146**: historial envenenado (tool call `input-available` sin output inyectado en sessionStorage) → sin spinner eterno y el mensaje siguiente respondió normal. **Bug #147**: "top de técnicos" → botón "Ver desempeño en Informes" → `/metricas`.
