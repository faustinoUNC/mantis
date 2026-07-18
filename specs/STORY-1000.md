# STORY-1000 — Cobro como gestor financiero: la whitelist del trigger quedó vieja (tarjeta/combinado/adelanto daban "sin_permiso") (v1.0)

**Estado:** ✅ done · **Origen:** Card Trello #111 (Giuliano): "error al querer liquidar al técnico, no se puede pagar con tarjeta de crédito, al apretar el botón la instancia no avanza; solo ocurre cuando la tarjeta es el medio de pago 1".

## Diagnóstico

La pantalla del reporte es la de **Cobro** (su botón dice "Registrar cobro → Liquidación", por eso el reporte habla de liquidar). El bug **no depende del orden de los medios sino del rol del usuario**:

- El trigger `proteger_gestiones_update` (migración `proteger_etapa_y_funnel`) limita al rol `gestor_administrativo` a una whitelist de columnas de finanzas (`v_finanzas`). Esa lista quedó atrás de las stories que fueron sumando columnas a `gestiones`: hoy mismo (2026-07-18, sesión paralela) se le agregaron `liq_medio`/`liq_comprobante_path` para destrabar la liquidación de ese rol, pero seguían faltando las del **cobro**: `medio_cobro_2`, `cobrado_monto_2` (pago combinado, STORY-950), `recargo_tarjeta_pct`, `recargo_tarjeta_monto` (recargo tarjeta, STORY-975) y `adelanto_materiales` (adelanto al técnico, STORY-977). Tercera vez que pasa el mismo patrón (antes: columnas de cobro en STORY-914, `liq_*` hoy).
- Como **gestor financiero**, cualquier cobro que toque esas columnas muere con `sin_permiso` → la UI muestra "No se pudo registrar el cobro." y la gestión no avanza. Eso cubre: tarjeta de crédito con recargo (medio 1 **o** 2), todo pago combinado, y también cargar un adelanto de materiales.
- Como **administrador** el trigger no restringe columnas — por eso a Giuliano "le funcionó con tarjeta en medio 2": esa prueba la hizo logueado de admin (evento de las 03:39 en el log), y las fallidas como gestor financiero (~15:00, antes de crear la card).

Reproducido empíricamente contra la DB simulando el JWT del rol: `UPDATE gestiones SET recargo_tarjeta_pct=…` → `sin_permiso` (línea 26 del trigger); `SET medio_cobro=…` (whitelisted) → pasa; como admin todo el flujo E2E pasa.

## Alcance

Migración `story_1000_whitelist_finanzas_gestor_administrativo`: se recrea `proteger_gestiones_update()` agregando a `v_finanzas` las cinco columnas de finanzas que las STORY-950/975/977 sumaron a `gestiones`:

`medio_cobro_2`, `cobrado_monto_2`, `recargo_tarjeta_pct`, `recargo_tarjeta_monto`, `adelanto_materiales`.

Nada más cambia (misma lógica, mismos guards de etapa/gestor_id). `cargo_cancelacion` NO se agrega: lo escribe el flujo de cancelación (admin/gestor owner), nunca el gestor financiero.

## Fuera de alcance

- Sin cambios de código en `codigo/` (el fix es 100% DB; las server actions ya mandaban bien los datos).
- No se generaliza la whitelist "para el futuro" (Regla #0): queda la lista explícita + comentario en la función recordando mantenerla cuando se agreguen columnas de finanzas.

## Criterios de aceptación

1. Como gestor financiero: cobro con tarjeta de crédito como medio 1 (con o sin recargo) registra y la gestión pasa a Liquidación técnico.
2. Como gestor financiero: pago combinado (cualquier par de medios) y adelanto de materiales funcionan.
3. Como gestor financiero sigue PROHIBIDO tocar etapa, gestor_id o columnas no financieras (guards intactos).
4. Regresión: como admin, cobro simple y combinado siguen funcionando.

## Dev Agent Record

- **Commit:** `ead1a55` (pusheado a main 2026-07-18).
- **Migración:** `story_1000_whitelist_finanzas_gestor_administrativo` (aplicada al proyecto `ejwokycbyjtlxwusbhtt`).
- **Verificación:** simulación SQL del rol gestor_administrativo post-fix: `recargo_tarjeta_*`, `medio_cobro_2`/`cobrado_monto_2` y `adelanto_materiales` pasan; `etapa` sigue bloqueada (`etapa_solo_por_funcion`) y una columna no financiera (`descripcion`) sigue dando `sin_permiso`. E2E en la app como admin: cobro tarjeta simple y combinado avanzan a Liquidación técnico.
