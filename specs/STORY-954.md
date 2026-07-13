# STORY-954 — Presión por especialidad: demanda de gestiones vs. capacidad de técnicos (v1.2)

**Estado:** ✅ done · **Origen:** Fausti (card #73 de Trello, "Pendiente - Desarrollo"): *"Métrica de distribución de especialidades por técnico combinada de alguna forma con una métrica de gestiones por categoría. El objetivo de esto es prever qué tipo de gestiones son las más demandadas y ver si tenemos un buen número de técnicos de esa categoría para hacer frente a ellas."*

## Alcance

- **Card nueva en Informes**: "Presión por especialidad", en un bloque propio ("Cobertura de especialidades"), entre "Orden por valor" y la caja "En el período", con badge `alcance="ahora"` (v1.2 — antes vivía dentro de la caja del período).
- **La métrica combinada elegida es un ranking de presión** (opción elegida por Fausti entre tres propuestas): para cada especialidad, `presión = gestiones activas / técnicos disponibles con esa especialidad`. Arriba lo más desatendido.
- **Demanda = gestiones ACTIVAS a hoy** (ni finalizadas ni canceladas), NO el histórico del período (v1.2, decisión de Fausti: "me parece más valioso hacerlo a HOY"). La pregunta que responde la card es operativa — ¿tengo con qué cubrir lo que está abierto ahora? — y para eso la foto actual vale más que la demanda acumulada. No sigue el selector de período (como los demás bloques "ahora": estancadas, cobro, orden por valor).
- **Capacidad = técnicos con `estado = 'aprobado'` y `usuarios.esta_activo = true`, contados HOY** (v1.1 — mismo criterio exacto que usa la asignación; la capacidad es siempre actual y se aclara en el texto de ayuda de la card, mismo criterio de alcance mixto que ya usa el dashboard).
- **La card la ven solo administrador y gestor de mantenimiento** (v1.1, decisión de Fausti): la gestión de técnicos no es área del `gestor_administrativo` (no accede a `/tecnicos` ni puede aprobar/buscar técnicos), así que la métrica no le habilita ninguna acción — y su RLS tampoco le deja leer `usuarios` de técnicos, con lo cual el conteo de activos le daría vacío. Ocultarla es más simple y más honesto que mostrarle un número que no puede usar.
- **Sólo se listan especialidades con al menos una gestión activa.** Una especialidad con técnicos pero sin trabajo abierto no genera presión y no aporta a la decisión ("¿dónde falta gente?").
- **Caso "demanda sin técnicos"**: no se dibuja como barra infinita — va fijado arriba del ranking, en rojo y con la etiqueta "Sin técnicos" (estado, no magnitud; color + texto, nunca color solo).
- RLS manda como en todo el dashboard: el gestor de mantenimiento calcula la presión sobre SUS gestiones; admin y administrativo sobre todas.

## Implementación

- **`features/metricas/service.ts`**: tercera query en el `Promise.all` — `tecnico_especialidades` con join `especialidades(nombre)` y `tecnicos!inner(estado)` filtrado a `aprobado`. Se agrega `capacidad: { especialidad: string; tecnicos: number }[]` a la interfaz `Metricas` (agregado simple, se computa server-side; no hace falta granularidad).
- **`components/metricas/panel-metricas.client.tsx`**:
  - `useMemo` `presion`: agrupa `filasEsp` filtradas a etapas no terminales (v1.2 — antes usaba `filas` del período) por especialidad, cruza con `capacidad`, calcula el ratio, ordena: primero las "sin técnicos" (por demanda desc), después por presión desc.
  - Render con el patrón de barras-div del ranking de calificación (no Recharts: son filas con etiqueta directa siempre visible, sin hover). Ancho de barra ∝ presión relativa al máximo; color con `rampaMagnitud` (la escala verde→terracota que el contract reserva para "más intenso = peor"). Cada fila muestra la presión ("N,N gest./téc.") y los dos números crudos ("X gest. · Y téc.").
  - `MetricCard` con `unidad="especialidades"` y `humildad={false}` (el aviso de muestra chica está calibrado para gestiones, no para cantidad de especialidades).

## Criterios de aceptación

1. La card aparece en el Inicio de administrador y gestor de mantenimiento, fuera de la caja del período y con el badge "ahora" (v1.2). El gestor administrativo NO la ve (v1.1).
2. La demanda cuenta solo gestiones activas (ni finalizadas ni canceladas) y NO responde al selector de período (v1.2). Cerrar o cancelar una gestión la saca del conteo al refrescar.
3. Una especialidad con gestiones activas y 0 técnicos disponibles aparece primera, en rojo, con la etiqueta "Sin técnicos".
4. Las demás quedan ordenadas por presión descendente, con barra proporcional y ambos contadores visibles sin hover.
5. Especialidades sin gestiones activas no se listan.
6. Un técnico aprobado pero desactivado (`esta_activo = false`) no cuenta como capacidad — el contador coincide con los técnicos que la asignación ofrecería (v1.1).
7. Sin gestiones activas → empty state estándar de `MetricCard`.
8. `tsc`/eslint verdes y build de producción OK.

## Cambios v1.1 (2026-07-13)

Fausti, al revisar: contar aprobados sin mirar `esta_activo` sobreconta la capacidad. La v1.0 no filtraba por activo porque el RLS de `usuarios` no deja leer las filas de técnicos al `gestor_administrativo` (le habría mostrado "0 técnicos" en todo). La solución elegida por Fausti: **ocultarle la card al gestor administrativo** (la gestión de técnicos no es su área — no puede actuar sobre esta métrica) y, con eso, filtrar capacidad por `estado='aprobado'` **y** `esta_activo=true` con el RLS normal, igualando el criterio de la asignación.

## Cambios v1.2 (2026-07-13)

Fausti: *"me parece más valioso hacerlo a HOY, no histórico, es decir solo tener en cuenta las gestiones activas"*. La demanda pasa de "gestiones creadas en el período" a "gestiones activas ahora" — la card responde una pregunta operativa (cobertura de la carga abierta), no de tendencia. Se movió fuera de la caja "En el período" a un bloque propio entre "Orden por valor" y la caja, con badge `alcance="ahora"`; el memo pasa de `filas` (período) a `filasEsp` filtradas a etapas no terminales.

## Dev Agent Record

- **Archivos:** `codigo/features/metricas/service.ts` (query de capacidad + campo `capacidad` en `Metricas`), `codigo/components/metricas/panel-metricas.client.tsx` (memo `presion` + bloque "Cobertura de especialidades" con la card).
- **Verificación:** `tsc --noEmit`, `eslint` y `next build` limpios. Verificado visualmente en la app local como admin: 12 especialidades con datos reales, "Control de plagas" (2 gest. · 0 téc.) primera en rojo, resto ordenado por presión (Plomería 16,0 arriba).
- **Commit:** `11cb7e3`.
