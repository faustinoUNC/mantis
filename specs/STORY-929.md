# STORY-929 — Limpieza del dashboard de Informes: sacar "Gestiones cobradas", quitar tortas de "Composición del trabajo" y renombrar "Prioridad por valor" (v1.0)

**Estado:** 🚧 en desarrollo · **Origen:** Fausti, tras usar el dashboard. Regla #0: la solución más simple que cumpla, sin residuos. Contract "Esmeralda técnica".

## Insight central

Tres podas de contenido en el panel de Informes, todas en `panel-metricas.client.tsx` (el service no se toca). El objetivo es **quitar peso** al dashboard: dos métricas que no aportan lo suficiente y un nombre que sugiere una priorización que no queremos comunicar. Se elimina lo que sobra **sin dejar residuo** (constantes, memos, imports y series que quedan sin consumidor) y **sin tocar nada de más** (todo lo que comparte cómputo con métricas que quedan, se conserva).

## Alcance y decisiones

### A. Eliminar la métrica "Gestiones cobradas"
Es la segunda card del bloque **Dinero** (línea gráfica de cantidad de gestiones cobradas por período). Se elimina la card completa.
- **Residuo a limpiar en el memo `dinero`** (lo consumía SOLO esa card): el acumulado `cant`, la tendencia `tendCant`, y las salidas `trendCant` y `diagCant` (incluida la del early-return de "pocos datos").
- **Se conserva** todo lo que usa "Ingresos cobrados" (la card que queda en Dinero): `tecnico`, `fee`, `n`, `pocos`, `diagTec`, `diagFee`. El memo `dinero` sigue existiendo.

### B. Quitar las tortas de "Composición del trabajo"
Se elimina el bloque completo **"Perfil del trabajo"** (su única card son las dos tortas causa/pagador).
- **Residuo a limpiar** (todos exclusivos de esa card): el memo `composicion`, las constantes `CAUSA_LABEL`, `PAGADOR_LABEL` y `donutColores`, y los imports `Pie` y `PieChart` de recharts.
- **Se conserva** `filas` (lo usan el embudo, cuellos, rechazos, etc.) y el resto de imports de recharts.

### C. Renombrar "Prioridad por valor" (sin sugerir priorización, sin repetir el título)
Hoy el nombre aparece dos veces apilado: header del bloque **y** título de la card, idénticos. Fausti pide que (a) no diga "Prioridad" (no queremos comunicar una priorización por comisión) y (b) no esté repetido.
- **Header del bloque:** "Prioridad por valor" → **"Orden por valor"**.
- **Título de la card:** "Prioridad por valor" → **"Gestiones ordenadas por fee"** (distinto del header → sin repetición).
- El subtítulo (ayuda) y la lógica (`porFee`, orden fee desc) no cambian. Comentarios del código actualizados a "Orden por valor".

## Criterios de aceptación
1. El bloque **Dinero** muestra solo "Ingresos cobrados"; "Gestiones cobradas" ya no existe.
2. No hay tortas de "Composición del trabajo"; el bloque "Perfil del trabajo" desaparece.
3. La sección de fee dice **"Orden por valor"** (header) y **"Gestiones ordenadas por fee"** (card); en ningún lado dice "Prioridad", ni el título está repetido.
4. Sin residuos: no quedan `composicion`, `CAUSA_LABEL`, `PAGADOR_LABEL`, `donutColores`, `Pie`, `PieChart`, `cant`, `tendCant`, `trendCant` ni `diagCant` en el archivo.
5. `tsc --noEmit` + eslint + `next build` verdes; sin regresiones en el resto del panel (embudo, rechazos, ciclo, cuellos, ingresos, histórico de técnicos, orden por valor, para resolver hoy).

## Dev Agent Record
- **Estado:** ✅ implementado (2026-07-09). Sin commitear (Fausti revisa).
- **Archivos:** `codigo/components/metricas/panel-metricas.client.tsx` (único; el service no se toca).
  - **A.** Card "Gestiones cobradas" eliminada del bloque Dinero. Memo `dinero` podado: fuera `cant`, `tendCant`, `trendCant`, `diagCant` (incl. early-return); acumulador ahora `{ tecnico, fee }`. Bloque Dinero → `cols={1}` (queda una sola card → full-width, consistente con los demás bloques de una card).
  - **B.** Bloque "Perfil del trabajo" (tortas "Composición del trabajo") eliminado. Residuo limpiado: memo `composicion`, constantes `CAUSA_LABEL`, `PAGADOR_LABEL`, `donutColores`, imports `Pie`/`PieChart` de recharts.
  - **C.** Header del bloque de fee "Prioridad por valor" → **"Orden por valor"**; título de la card → **"Gestiones ordenadas por fee"** (distinto del header, sin repetición ni "Prioridad"). Comentarios actualizados. Lógica (`porFee`, orden fee desc) intacta.
- **Verificación:** `tsc --noEmit` + `eslint` + `next build` verdes. Sin residuos (grep de todos los símbolos eliminados: limpio). Falta pasada visual en navegador por Fausti.
