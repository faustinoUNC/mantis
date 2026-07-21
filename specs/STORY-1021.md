# STORY-1021 — Fotos del cliente en el inbox: los adjuntos del mail entran al sistema (v1.0)

**Estado:** 🔨 en desarrollo · **Origen:** pedido directo de Fausti (2026-07-21): hoy, si un inquilino/propietario manda el reporte por mail con una foto, la foto se pierde silenciosamente — la ingesta solo extrae el texto y no queda ni rastro de que el mail traía adjuntos. La única forma de verla es abrir Gmail a mano.

## Problema

La sincronización Gmail → `inbox_reportes` (`codigo/features/inbox/sync.ts`) extrae únicamente la parte `text/plain` del mail. Los adjuntos no se descargan, no se guardan y no se registra su existencia. Consecuencias:

- El gestor ve la card del inbox sin saber que el cliente mandó fotos del problema.
- Un mail que es "solo la foto" llega como reporte casi vacío.
- Al convertir el reporte en gestión, la foto tampoco viaja: el técnico va a la visita sin ver el problema.

## Alcance

1. **Ingesta de adjuntos** (`sync.ts`): al ingerir un mail nuevo, recorrer las partes MIME y bajar los adjuntos de imagen (`image/*`) vía la API de attachments de Gmail. Subirlos al bucket `gestiones` bajo `inbox/<gmail_message_id>/…` y guardar los paths en la columna nueva `inbox_reportes.adjuntos_paths text[]`. Límites simples: máximo 5 imágenes por mail, se saltean adjuntos de más de 10 MB. Si un adjunto falla, el reporte entra igual con los que se pudieron bajar (la foto es complemento, no gate).
2. **Card del inbox** (`features/inbox/service.ts` + `components/inbox/inbox.client.tsx`): `listarInbox` firma URLs (patrón `fotoConUrl` existente) y la card muestra la galería de miniaturas debajo del cuerpo — mismo patrón visual que los comprobantes de rendición del detalle (thumbnail clickeable que abre la imagen).
3. **Las fotos viajan a la gestión** (`crearDesdeReporte` + `gestiones`): al crear la gestión desde el reporte, los paths se copian a la columna nueva `gestiones.fotos_reporte_paths text[]` (mismos objetos del bucket, sin duplicar archivos). El detalle de gestión muestra la galería "Fotos del reporte" debajo de la descripción, visible para todos los roles — el técnico ve el problema antes de ir.

## Fuera de alcance (decisiones conscientes)

- **Adjuntos no-imagen (PDF, video)**: no — el caso real es la foto del problema; lo demás sigue viviendo en Gmail.
- **Re-procesar mails ya ingestados**: no — aplica solo a mails nuevos; la idempotencia por `gmail_message_id` no se toca.
- **Elegir qué fotos viajan al convertir**: no — viajan todas; simple.
- **Tabla de adjuntos aparte**: no — un `text[]` en cada tabla alcanza (mismo patrón que `materiales_fotos_paths`).

## Criterios de aceptación

1. Mail con asunto "mantenimiento" + 1 foto adjunta → aparece en el inbox con la miniatura visible; click abre la imagen completa.
2. Mail con varias fotos → se ven hasta 5 miniaturas.
3. Crear gestión desde ese reporte → el detalle muestra "Fotos del reporte" debajo de la descripción; el técnico asignado también las ve en su vista.
4. Mail sin adjuntos → todo sigue igual que hoy (regresión: card sin galería, conversión sin fotos).
5. Descartar un reporte con fotos → sin errores (los objetos quedan en el bucket; los limpia `reset-datos.sh`, que ya barre todas las carpetas del bucket).
6. Regresión: `tsc`/eslint verdes; la sincronización sigue idempotente (re-sync no duplica reportes ni fotos).

## Dev Agent Record

- **Commit:** _pendiente (espera OK de Fausti)_.
- **Migración:** `story_1021_adjuntos_inbox` (aplicada): `inbox_reportes.adjuntos_paths text[] not null default '{}'` + `gestiones.fotos_reporte_paths text[] not null default '{}'`.
- **Archivos:** `codigo/features/inbox/sync.ts` (`extraerImagenes` recorre las partes MIME; baja cada adjunto por la API de attachments de Gmail, lo sube a `gestiones/inbox/<gmail_message_id>/<i>-<nombre>` con `upsert: true` y guarda los paths en el insert del reporte; falla de un adjunto → el reporte entra igual, con log); `codigo/features/inbox/service.ts` (`Reporte.adjuntos_urls`, `listarInbox` firma URLs 1 h con el admin client; `crearDesdeReporte` toma `adjuntos_paths` del reclamo y los copia a `gestiones.fotos_reporte_paths` tras crear — mismos objetos, sin duplicar archivos); `codigo/features/gestiones/types.ts` + `service.ts` (`fotos_reporte_urls` en `GestionDetalle`/`obtenerGestion`, patrón `fotoConUrl`); `codigo/components/inbox/inbox.client.tsx` (galería de miniaturas bajo el cuerpo); `codigo/components/gestiones/detalle.client.tsx` (galería bajo la descripción, todos los roles).
- **Verificación:** `tsc --noEmit` y eslint verdes. **E2E navegador** con mails reales a la casilla del inbox (enviados por la API de Gmail con las credenciales del sync): (1) mail con 1 foto → card del inbox con miniatura, click abre la imagen firmada; (2) convertir en gestión (#201, plomería) → "Fotos del reporte" bajo la descripción del detalle; (3) asignado a tecnicodos y logueado como él → ve la foto en su vista mobile antes de aceptar el trabajo; (4) mail con 3 fotos → 3 miniaturas en la card; (5) regresión: reporte sin adjuntos renderiza sin galería (caso visto en vivo: el cron de producción, con el código viejo, ingiere con `adjuntos_paths` vacío); (6) idempotencia intacta (auto-sync + cron sobre los mismos mails, sin duplicados; storage con `upsert`). Ojo para probar en local: el cron de Vercel (código viejo) gana la carrera del minuto — hasta el deploy, los mails nuevos entran sin fotos.
