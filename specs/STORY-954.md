# STORY-954 — Presión por especialidad: demanda de gestiones vs. capacidad de técnicos (v1.0)

**Estado:** ✅ done · **Origen:** Fausti (card #73 de Trello, "Pendiente - Desarrollo"): *"Métrica de distribución de especialidades por técnico combinada de alguna forma con una métrica de gestiones por categoría. El objetivo de esto es prever qué tipo de gestiones son las más demandadas y ver si tenemos un buen número de técnicos de esa categoría para hacer frente a ellas."*

## Alcance

- **Card nueva en Informes**: "Presión por especialidad", en un bloque propio ("Cobertura de especialidades") dentro de la caja "En el período".
- **La métrica combinada elegida es un ranking de presión** (opción elegida por Fausti entre tres propuestas): para cada especialidad, `presión = gestiones del período / técnicos aprobados con esa especialidad`. Arriba lo más desatendido.
- **Demanda = gestiones creadas en el período seleccionado** (el selector Mes/Trimestre/Año/Todo existente), NO solo las activas. Razón de negocio: el objetivo de la card es *prever* qué se demanda — y una gestión ya finalizada es demanda demostrada igual que una activa. Mirar solo activas mediría la foto de un instante (pocos casos, ruidosa) y la carga activa ya la cubren "Gestiones estancadas" y los tiles del Inicio. Además reusa el filtro existente sin agregar controles nuevos (Regla #0).
- **Capacidad = técnicos con `estado = 'aprobado'`, contados HOY** (la capacidad es siempre actual; se aclara en el texto de ayuda de la card, mismo criterio de alcance mixto que ya usa el dashboard). **No se filtra por `usuarios.esta_activo`** a propósito: la política RLS `staff_mant_lee_usuarios_tecnicos` no deja al `gestor_administrativo` leer las filas de técnicos en `usuarios`, así que filtrar por activo haría que a ese rol la card le mienta "0 técnicos" en todas las especialidades. Desactivar un técnico aprobado es un caso raro y esta métrica es para planificar cobertura, no para asignar (la asignación sí filtra por activo).
- **Sólo se listan especialidades con demanda > 0 en el período.** Una especialidad con técnicos pero sin gestiones no genera presión y no aporta a la decisión ("¿dónde falta gente?").
- **Caso "demanda sin técnicos"**: no se dibuja como barra infinita — va fijado arriba del ranking, en rojo y con la etiqueta "Sin técnicos" (estado, no magnitud; color + texto, nunca color solo).
- RLS manda como en todo el dashboard: el gestor de mantenimiento calcula la presión sobre SUS gestiones; admin y administrativo sobre todas.

## Implementación

- **`features/metricas/service.ts`**: tercera query en el `Promise.all` — `tecnico_especialidades` con join `especialidades(nombre)` y `tecnicos!inner(estado)` filtrado a `aprobado`. Se agrega `capacidad: { especialidad: string; tecnicos: number }[]` a la interfaz `Metricas` (agregado simple, se computa server-side; no hace falta granularidad).
- **`components/metricas/panel-metricas.client.tsx`**:
  - `useMemo` `presion`: agrupa `filas` (ya filtradas por período) por especialidad, cruza con `capacidad`, calcula el ratio, ordena: primero las "sin técnicos" (por demanda desc), después por presión desc.
  - Render con el patrón de barras-div del ranking de calificación (no Recharts: son filas con etiqueta directa siempre visible, sin hover). Ancho de barra ∝ presión relativa al máximo; color con `rampaMagnitud` (la escala verde→terracota que el contract reserva para "más intenso = peor"). Cada fila muestra la presión ("N,N gest./téc.") y los dos números crudos ("X gest. · Y téc.").
  - `MetricCard` con `unidad="especialidades"` y `humildad={false}` (el aviso de muestra chica está calibrado para gestiones, no para cantidad de especialidades).

## Criterios de aceptación

1. La card aparece en el Inicio de administrador, gestor de mantenimiento y gestor administrativo, dentro de la caja "En el período", y responde al selector de período.
2. Cambiar el período recalcula la demanda; la capacidad (técnicos) no cambia con el período y el texto de ayuda lo aclara.
3. Una especialidad con gestiones en el período y 0 técnicos aprobados aparece primera, en rojo, con la etiqueta "Sin técnicos".
4. Las demás quedan ordenadas por presión descendente, con barra proporcional y ambos contadores visibles sin hover.
5. Especialidades sin gestiones en el período no se listan.
6. Para el `gestor_administrativo` los contadores de técnicos son los mismos que ve el admin (no dependen de leer `usuarios`).
7. Sin datos en el período → empty state estándar de `MetricCard`.
8. `tsc`/eslint verdes y build de producción OK.

## Dev Agent Record

- **Archivos:** `codigo/features/metricas/service.ts` (query de capacidad + campo `capacidad` en `Metricas`), `codigo/components/metricas/panel-metricas.client.tsx` (memo `presion` + bloque "Cobertura de especialidades" con la card).
- **Verificación:** `tsc --noEmit`, `eslint` y `next build` limpios. Verificado visualmente en la app local como admin: 12 especialidades con datos reales, "Control de plagas" (2 gest. · 0 téc.) primera en rojo, resto ordenado por presión (Plomería 16,0 arriba).
- **Commit:** `11cb7e3`.
