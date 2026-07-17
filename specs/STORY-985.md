# STORY-985 — Historial de la propiedad + Resumen de obras honesto

**Estado:** ✅ done · **Origen:** reporte de Fausti 2026-07-17 ("no se entiende nada y no es real la info que muestran, salen siempre 'En curso'") — diseño consolidado en party mode (décima sesión).

## El problema

1. **El legajo en la UI no muestra ninguna obra.** La página de la propiedad (`/cartera/propiedades/[id]`) lista inquilino, fechas y dos botones de PDF: las obras solo existen adentro del PDF. La pregunta real del negocio — "¿qué me hicieron en esta propiedad y cuánto salió?" — no tiene pantalla.
2. **El PDF "Resumen de obras" miente tres veces:**
   - `finalizada: etapa === "finalizado"` → toda obra que no llegó a la última columna del funnel sale "EN CURSO", incluyendo las que están en Cobro/Liquidación (trabajo terminado, falta la plata) y las **canceladas** (que salen "EN CURSO" para siempre).
   - La "descripción" es el problema reportado ("pérdida de agua"), no lo que se hizo — `descripcion_trabajo` del presupuesto aprobado nunca viaja al documento.
   - La fecha de cada obra es la de **creación** (cuándo se reportó), no la de terminación.
3. **50 de 175 gestiones no tienen `legajo_id`** (propiedad sin inquilino al crearlas): no aparecen en ningún resumen. No es bug — el recorte del PDF es el período del inquilino — pero confirma que la vista interna debe colgarse de la **propiedad**, no del legajo.

## La solución (Regla #0: cero tablas, cero estados nuevos — todo es lectura)

### Estado honesto, derivado en UN solo lugar

Helper puro compartido (`features/cartera/historial.ts`) entre la vista y el PDF:

- `estadoObra(etapa, cargo_cancelacion)`: **`cancelada`** si `etapa === "cancelada"` o `cargo_cancelacion != null` (la cancelación con cargo transita por Cobro — allowlist, lección de la STORY-984); **`terminada`** si la etapa es `facturacion_cobro | liquidacion_tecnico | finalizado` (conformidad aprobada en adelante: lo que sigue es circuito de plata, no obra); **`en_curso`** el resto.
- `costoObra(...)`: `cobrado_monto` → `costo_final + cargo_admin` → `cargo_cancelacion` (canceladas con cargo) → null. Mismo criterio STORY-942: el propietario ve lo cobrado, sin delatar la comisión.
- Fecha de terminación: última transición con `a_etapa = "conformidad"` en `eventos_gestion` (fin de obra real, criterio STORY-984). La de creación queda como "reportado el…".

### A. PDF honesto (documento externo)

`datosResumen` + `resumen-pdf.tsx`:

- Tres estados en el encabezado de cada obra: `TERMINADA` / `EN CURSO` / `CANCELADA`.
- **Canceladas sin cargo: afuera del PDF** (decisión de Fausti). Cancelada con cargo pagado aparece — es plata que salió y el papel es evidencia.
- Texto principal de cada obra: **qué se hizo** (`descripcion_trabajo` del presupuesto aprobado); el problema reportado abajo como "Problema reportado: …". Fallback a la descripción si no hay trabajo cargado.
- Fecha visible de la obra: terminación real; el meta agrega "Reportado el …".
- Cierre del documento: **totales del período** — total, pagó inquilino, pagó propietario.

### B. Sección "Historial" en la página de la propiedad (vista interna)

Nueva lectura `historialPropiedad(propiedadId)` (patrón `datosResumen`: rol staff + visibilidad RLS de la propiedad con el client de sesión, admin client para ver las gestiones de TODOS los gestores) + componente `historial.client.tsx`:

- **Línea de tiempo con los legajos como capítulos**, más capítulos "Propiedad sin ocupar" para las obras sin legajo (ubicadas en el hueco entre legajos según su fecha). Capítulos ordenados del más reciente al más viejo; solo el primero expandido.
- **Encabezado con los números del negocio**: N obras · M terminadas · $ invertidos, y el split "pagó inquilino / propietario".
- **Chip ámbar de reincidencia**: especialidad con ≥ 3 obras (no canceladas) en la propiedad — el argumento de "conviene cambiar en vez de arreglar por cuarta vez".
- Cada obra: estado (Badge: terminada=brand, en curso=neutro, cancelada=error y apagada), qué se hizo como línea principal, problema reportado en gris, especialidad · técnico · costo · pagador, fecha de terminación (o de reporte si sigue en curso). **Linkea al detalle de la gestión** (segunda puerta, misma cerradura).
- Los botones "Resumen de obras (PDF)" / "Enviar al propietario" se mudan al encabezado de cada capítulo con legajo. La sección "Legajos" queda solo para las acciones (abrir/cerrar legajo, editar inquilino) y pierde la tabla de históricos (ahora vive en el historial).
- En la vista interna las canceladas sin cargo SÍ se ven (apagadas): el gestor necesita saberlo; el propietario no.

## Criterios de aceptación

1. PDF: obra en Cobro o Liquidación sale `TERMINADA` con su fecha de terminación; cancelada sin cargo no aparece; cancelada con cargo pagado aparece como `CANCELADA` con su costo.
2. PDF: cada obra muestra el trabajo del presupuesto aprobado como texto principal y "Problema reportado"/"Reportado el" como secundarios; al pie, totales del período con split por pagador.
3. Propiedad con obras con y sin legajo: el historial muestra TODAS agrupadas en capítulos correctos (legajo por `legajo_id`; sin legajo → capítulo "sin ocupar" según fecha).
4. Encabezado del historial: conteos y montos consistentes con el criterio de costo del PDF.
5. Especialidad con ≥ 3 obras → chip ámbar de reincidencia.
6. La página de la propiedad conserva abrir/cerrar legajo y editar inquilino; los PDF se descargan/envían desde los capítulos.
7. `tsc` + `eslint` verdes.

## Dev Agent Record

- **Archivos:** `features/cartera/historial.ts` (nuevo — helpers puros `estadoObra`/`costoObra`/`armarCapitulos` + types), `features/cartera/service.ts` (`historialPropiedad` nuevo; `datosResumen` reescrito sobre los helpers + fechas de terminación por eventos), `features/cartera/resumen-pdf.tsx` (tres estados, trabajo vs problema, fecha de terminación, totales con split), `components/cartera/historial.client.tsx` (nuevo — timeline por capítulos; `ResumenObras` se muda acá), `components/cartera/legajos.client.tsx` (queda solo acciones), `app/cartera/propiedades/[id]/page.tsx` (sección Historial).
- **Verificación:** `tsc` + `eslint` verdes. E2E navegador 2026-07-17 sobre "Caseros 10" (14 gestiones, 1 legajo vigente, obras con y sin legajo, canceladas con y sin cargo): encabezado "13 obras · 7 terminadas · $ 5.983.052" con split consistente ($ 920.000 + $ 5.063.052), chip ámbar "Gas reincidente — 8 obras", 3 capítulos bien agrupados, cancelada sin cargo apagada y excluida de los números. PDF descargado y renderizado: CANCELADA (roja, solo la con cargo — 10 obras del capítulo → 9 en el PDF), TERMINADA con "Terminada el {fecha}", EN CURSO en ámbar, trabajo como texto principal + "Problema reportado"/"Reportado el" secundarios, totales del período $ 5.935.049,99 = inquilino $ 920.000 + propietario $ 5.015.049,99. Caso borde verificado: propiedad sin ningún legajo (Ituzaingó 1435) → un único capítulo "Propiedad sin ocupar" con las 9 obras.
- **v1.1 (mismo día):** Fausti: "no me convence cómo se ven los legajos… imaginate cuando tenga 7, no me parece mantenible". El acordeón vertical (línea de tiempo) se reemplazó por un **selector de período** con el segmentado idéntico al de Finanzas/Auditoría: un botón por capítulo (con conteo de obras; los "Sin ocupar" repetidos se desambiguan por año) + "Todas" (lista plana ordenada por fecha). Arranca en el período vigente (o Todas si no hay); el panel muestra la ficha del capítulo elegido (título, badge Vigente, período, botones del PDF) y SOLO sus obras — la página nunca es más larga que un período. Con un solo capítulo no hay segmentado. Solo presentación: `armarCapitulos` y el service intactos. E2E: Caseros 10 (4 botones, arranca en el vigente, "Todas" = 14 obras planas) e Ituzaingó (capítulo único sin segmentado).
- **v1.2 (mismo día):** Fausti: "veo que son tabs que se van poniendo uno al lado del otro — mejor hacé un desplegable". El segmentado se reemplazó por un **`ComboFiltrable`** (patrón STORY-981: los selects que crecen con datos reales — y los legajos crecen con los años), con opciones "{inquilino} — {período} · N obras" / "Sin ocupar — {período} · N obras" y `textoTodos` = "Todas las obras · N"; con 7+ legajos se encuentra al inquilino tipeando su nombre. Mismo comportamiento (default vigente, panel con ficha + PDF del período elegido, oculto con capítulo único). E2E: default vigente (10 obras + PDF), "Todas" = 14, cambio de período OK.
