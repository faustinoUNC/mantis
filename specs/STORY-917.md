# STORY-917 — Métricas accionables: estancadas, antigüedad de cobranza y reincidencia (v1.0)

**Estado:** 🚧 en desarrollo · **Fecha:** 2026-07-08
**Origen:** Fausti, en la revisión pre-commit de STORY-914/915 — pidió sumar las 3 métricas propuestas por su valor de negocio real (no "métricas por agregar"): las tres convierten el dashboard en herramienta de decisión diaria y salen 100% de datos existentes (cero tablas ni migraciones).

## Objetivo

Sumar al dashboard (STORY-914) tres tarjetas **accionables** — dicen *qué atender hoy*, no solo cómo viene el histórico:

| # | Métrica (pregunta de negocio) | Forma | Viva/Cerrada | Fuente |
|---|---|---|---|---|
| 10 | **Gestiones estancadas** — ¿qué tengo que patear hoy? | Lista top 5: gestión + etapa + días en esa etapa, linkeada al detalle | Viva | `eventos_gestion` (última transición) |
| 11 | **Cobranza por antigüedad** — ¿hace cuánto espero la plata? | Lista: gestión + monto + días esperando; ámbar pasado el umbral | Viva | etapa `facturacion_cobro` + fecha de entrada a la etapa |
| 12 | **Reincidencia (90 días)** — ¿el trabajo queda bien hecho? | Contador + lista: misma propiedad + especialidad reabierta a <90 días de finalizada | Viva | `propiedad_id` + fechas de finalización |

## Decisiones de diseño

- **Listas, no gráficos**: las tres son accionables — el valor está en *cuáles* son, no en la forma de la curva. Cada ítem linkea a `/gestiones/[id]` (patrón del ranking #3: filas simples, sin chartjunk).
- **#10 mide "días en la etapa actual"** (desde la última transición), no "sin actividad": es exacto con los datos que ya viajan (solo transiciones) y no miente — una gestión con avances recientes pero clavada en su etapa sigue siendo un problema del funnel. Solo activas; la peor arriba; días en ámbar a partir de 3.
- **#11**: monto = `costo_final + cargo_admin` (lo mismo que factura el tile "por cobrar"); días desde que entró a `facturacion_cobro`. Ámbar a partir de 15 días.
- **#12**: una gestión es reincidente si existe otra **de la misma propiedad y especialidad, finalizada hace ≤90 días** al momento de crearse. La referencia histórica es el set completo (sin filtros); el filtro de período/especialidad recorta solo las candidatas. Complementa las estrellas (subjetivas) con calidad dura.
- **Umbrales fijos en el código** (3 / 15 / 90 días) — configurarlos sería complejidad sin pedido (Regla #0 y "fuera de alcance" de STORY-914).
- Las tres respetan el contrato de STORY-914: denominador visible, humildad con muestra chica, refresco vivo vía la suscripción existente a `gestiones` (toda transición actualiza la tabla).

## Alcance (código — sin migraciones)

- `features/metricas/service.ts` — `FilaMetrica` suma `descripcion`, `propiedadId`, `direccion`, `cargoAdmin` (campos ya existentes en `gestiones`/`propiedades`, solo se agregan al select).
- `components/metricas/panel-metricas.client.tsx` — tarjetas #10, #11 y #12 (cómputo client-side desde `filas` + `eventos`, patrón STORY-910).

## Criterios de aceptación

1. **Estancadas**: lista las 5 gestiones activas con más días en su etapa actual, con etapa y días visibles, cada una linkeando a su detalle. Días ≥3 en ámbar.
2. **Cobranza**: lista las gestiones en `facturacion_cobro` con monto a cobrar y días de espera; ≥15 días en ámbar.
3. **Reincidencia**: cuenta y lista las gestiones del período creadas a ≤90 días de otra finalizada en la misma propiedad + especialidad, mostrando dirección y días entre cierre y reingreso.
4. Las tres tarjetas respetan filtros (especialidad; período donde aplica), denominador (N) y refresco en vivo al mover una gestión.
5. `tsc` verde, eslint verde. Sin migraciones nuevas.

## Fuera de alcance

- Umbrales configurables o alertas/notificaciones sobre estas métricas.
- "Sin actividad" incluyendo avances/presupuestos en #10 (requeriría traer más tablas; la señal por etapa alcanza).

## Dev Agent Record
- **Commit:** _(pendiente — Fausti revisa en local antes de commitear)_
- **Archivos:**
  - `features/metricas/service.ts` — `FilaMetrica` suma `descripcion`, `propiedadId`, `direccion`, `cargoAdmin` (solo select ampliado; RLS de `propiedades` ya incluía al administrativo — verificado).
  - `components/metricas/panel-metricas.client.tsx` — tarjetas #10/#11/#12 con `FilaAccionable` (fila linkeada a `/gestiones/[id]`); mapa `ultimaTransicion` compartido para "días en etapa"; `MetricCard` suma prop `humildad` (las listas son inventario, no estadística — sin aviso de muestra chica); umbrales `DIAS_ESTANCADA_AMBAR=3`, `DIAS_COBRO_AMBAR=15`, `VENTANA_REINCIDENCIA_MS=90d`.
- **Verificación:** `npx tsc --noEmit` verde · eslint verde · `npx next build` OK. Sin migraciones. Pendiente: vista en navegador de Fausti (con la carga actual, reincidencia probablemente vacía — esperado).
