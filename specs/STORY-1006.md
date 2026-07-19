# STORY-1006 — Bug: al rechazar la conformidad no se vuelve a pedir la rendición (v1.0)

**Estado:** 🟡 implementado, falta `tsc`/`eslint` + E2E (sin Node en este entorno) · **Origen:** reportado por Fausti (2026-07-19): la conformidad se puede rechazar tanto por la foto de conformidad como por la rendición (total de materiales / fotos de comprobantes) que se suben junto con ella. Hoy, al rechazar, el técnico vuelve a la pantalla de conformidad pero SOLO se le pide resubir la foto de conformidad — la rendición completa (total gastado en materiales + fotos de comprobantes) no se vuelve a pedir, aunque haya sido la causa del rechazo.

## Causa raíz

`subirConformidad` (`features/gestiones/service.ts`) y `AccionConformidadTecnico` (`components/gestiones/detalle.client.tsx`) deciden si piden la rendición con `terminando = gestion.etapa === "en_ejecucion"`. El rechazo de una conformidad (`resolverConformidad`, `aprobar=false`) NO mueve la etapa — la gestión queda en `"conformidad"` con la fila de `conformidades` en estado `"rechazada"`. Como la etapa ya no es `"en_ejecucion"`, la resubida solo pide la foto de conformidad; el comentario del código incluso lo daba por diseño ("la resubida de una conformidad rechazada no la vuelve a pedir"), pero no contempla que el motivo del rechazo puede ser la propia rendición.

## Alcance

1. **Server** (`subirConformidad`): `terminando` pasa a ser true también cuando la última conformidad de este técnico para la gestión está en estado `"rechazada"` (no solo cuando `etapa === "en_ejecucion"`) — así la validación de rendición (total > 0, foto de comprobantes ≥ 1) se vuelve a exigir en la resubida.
2. **Cliente** (`AccionConformidadTecnico`): mismo criterio — muestra de nuevo los campos "Total final gastado en materiales" y "Fotos de los comprobantes" cuando la última conformidad propia está rechazada, no solo cuando la etapa es `en_ejecucion`.
3. El total/fotos que se guardan en la resubida REEMPLAZAN los anteriores (mismo comportamiento que ya tenía el UPDATE de `materiales_total`/`materiales_fotos_paths` — no se acumulan).

## Fuera de alcance

- No se cambia la etapa del funnel ni se agrega un estado nuevo (Regla #0) — el rechazo sigue sin mover el funnel, solo cambia qué pide el formulario de resubida.
- No se diferencia "rechazada por la foto" vs "rechazada por la rendición" — pedir todo de nuevo es más simple y es lo que pidió Fausti.

## Criterios de aceptación

1. Gestor rechaza una conformidad (con motivo) → el técnico ve en su lista "A corregir" y al entrar, el formulario de resubida vuelve a mostrar "Rendición de la obra" (total + fotos de comprobantes) además de la foto de conformidad.
2. No se puede reenviar sin cargar total > 0 y al menos una foto de comprobante (igual que la primera vez).
3. La resubida actualiza `materiales_total`/`materiales_fotos_paths` con los nuevos valores (no los acumula con los previos).
4. La primera subida (desde `en_ejecucion`) sigue funcionando igual que antes.
5. `tsc`/eslint verdes.

## Dev Agent Record

- **Archivos:** `codigo/features/gestiones/service.ts` (`subirConformidad`), `codigo/components/gestiones/detalle.client.tsx` (`AccionConformidadTecnico`).
- **Detalle de la implementación:** se separaron dos condiciones que antes eran una sola (`terminando`): `terminando` (etapa === `en_ejecucion`) sigue siendo la única que dispara la transición de funnel (`avanzarEtapa(gestionId, "conformidad")`) — el rechazo NO mueve el funnel, así que la resubida no vuelve a llamar `avanzar_etapa` con la misma etapa (evitaría una `transicion_invalida`). `requiereRendicion` (`terminando || última conformidad de ESTE técnico === "rechazada"`, consultada server-side y ya disponible client-side en `gestion.conformidades`) es la que gatilla la validación/UI de "Total final gastado en materiales" + "Fotos de comprobantes". El UPDATE de `materiales_total`/`materiales_fotos_paths` sigue siendo un REEMPLAZO (no acumula). Botón de resubida tras rechazo: "Volver a enviar →".
- **Verificación:** no se pudo correr `tsc`/`eslint` en este entorno (sin Node/npm instalado) — revisión manual del diff y de balance de tipos. **Pendiente: correr `tsc`/`eslint` y probar E2E en navegador** (rechazar una conformidad y confirmar que la resubida vuelve a pedir monto + fotos, y que aprobar/objetar sigue funcionando igual que antes para la primera subida).
