# STORY-945 — Registro de técnico: errores visibles en el celular (413 silencioso) y matrículas múltiples (v1.0)

**Estado:** 🚧 en desarrollo · **Origen:** Fausti (2026-07-12), bug reportado desde el celular en "Sumate como técnico" + pedido de matrículas múltiples.

## El bug (reproducido con Playwright)

En el celular, si el técnico no elige especialidad, **no aparece ningún mensaje** y el botón queda en "Enviando…" para siempre. En el navegador de escritorio (aun simulando mobile) sí aparece "Elegí al menos una especialidad."

**Causa raíz — no es la pantalla, es el tamaño de la foto.** Todas las validaciones del registro son del server action (`altaTecnico` en `features/tecnicos/service.ts`), y el form manda los archivos adentro del POST. Next.js corta los bodies de server actions en **1 MB por defecto** (`serverActions.bodySizeLimit` no está configurado en `next.config.ts`). Una foto de cámara de celular pesa 2–8 MB → el request muere con 413 **antes** de que corra ninguna validación; `onSubmit` (`form-tecnico.client.tsx`) no tiene try/catch, la promesa rechaza sin manejar y nunca se llega a `setError`. En la simulación de escritorio se adjuntan archivos chicos del disco → el POST pasa → el server valida y el mensaje sí sale.

Reproducido local (2026-07-12): DNI de 3 MB sin especialidad → `POST /registro-tecnico 500`, `Error: Body exceeded 1 MB limit` (statusCode 413), botón colgado en "Enviando…", cero mensajes.

**Alcance real del problema:** todos los flujos con foto pasan por server actions sin compresión (avances, rendición, gastos, conformidad del técnico — que se usan DESDE el celular). El mismo 413 silencioso aplica ahí. Además, en Vercel el body de un request tiene un techo de plataforma de ~4.5 MB que **no** se puede subir por config: la solución de fondo es que las imágenes viajen livianas.

## Objetivo

Que el técnico en el celular siempre vea qué le falta (especialidad, archivos) y pueda enviar la solicitud con fotos reales de cámara; y que pueda subir más de una matrícula.

## Alcance y decisiones

### A. El mensaje de especialidades sale siempre (bug reportado)

- `form-tecnico.client.tsx`: validación **en el cliente** antes de armar el FormData — si `seleccionadas.size === 0` → `setError("Elegí al menos una especialidad.")` y no se envía nada. Instantáneo, sin depender del roundtrip. (La validación del server queda como red de seguridad.)
- `onSubmit` con **try/catch/finally**: si el action explota (red, 413, lo que sea) → error visible "No pudimos enviar la solicitud. Revisá tu conexión y que los archivos no sean demasiado pesados." y el botón se recupera (`setEnviando(false)` en `finally`). Nunca más un cuelgue mudo.

### B. Causa raíz: las fotos viajan livianas

- **Compresión de imágenes en el cliente** — util nuevo `shared/utils/imagen.client.ts` con `comprimirImagen(file)`: solo imágenes > ~600 KB; canvas a máx. 1600 px de lado mayor, JPEG calidad 0.8 (una foto de cámara queda en ~200–500 KB). PDFs y archivos chicos pasan intactos. Si la compresión falla → se manda el original (fail-open).
- Se aplica **en el `onChange` de los dos inputs de archivo del sistema**: `CampoArchivo` (form de técnico) e `InputArchivo` (`components/ui/input-archivo.client.tsx`, todos los flujos del técnico en obra) — con eso avances/rendición/gastos/conformidad quedan cubiertos sin tocar cada componente. Reasignar `input.files` vía `DataTransfer`.
- Tope claro en el cliente (form de técnico): archivo > 4 MB tras comprimir → error visible "Cada archivo puede pesar hasta 4 MB." antes de enviar (los PDFs no se comprimen; 4 MB es el techo real de Vercel).
- `next.config.ts`: `serverActions: { bodySizeLimit: "8mb" }` — margen para varios archivos en dev/self-host (en Vercel manda el techo de plataforma, por eso lo anterior).

### C. Validación server de archivos con errores claros (fin del pisado silencioso)

- Hoy `subirDoc` devuelve `null` mudo si el MIME no está permitido o pesa > 8 MB → se crea el técnico **sin el documento**. En `altaTecnico`, validar MIME y tamaño de DNI y matrículas **antes** de crear el usuario, con mensajes concretos ("El DNI tiene un formato no permitido: subí JPG, PNG, WEBP o PDF.", "…pesa más de 8 MB…").

### D. Matrículas múltiples (hoy solo se puede subir una y se pisan)

- Hoy: un solo input, y en Storage el path fijo `{tecnicoId}/matricula.{ext}` con `upsert: true`. Un técnico con 2 matrículas (ej. gas + electricidad) no puede subir ambas.
- `CampoArchivo` acepta `multiple`; el campo Matrícula lo usa con label "Matrícula (podés subir más de una)".
- Server: `form.getAll("doc_matricula")`, cada archivo se sube como `{tecnicoId}/matricula-1.ext`, `matricula-2.ext`, …
- **Migración `story_944_matriculas_fase1` (2 fases, patrón STORY-943):**
  - Fase 1 (ahora): `alter table tecnicos add column doc_matricula_paths text[] not null default '{}'` + backfill `update tecnicos set doc_matricula_paths = array[doc_matricula_path] where doc_matricula_path is not null`. La columna vieja queda para el código viejo en prod.
  - Fase 2 (post-deploy): re-correr el backfill (por registros creados en la ventana de convivencia) y `drop column doc_matricula_path`.
- Código a la columna nueva:
  - `altaTecnico` — insert `doc_matricula_paths`.
  - `obtenerTecnico` — docs con label "Matrícula" o "Matrícula 1/2/…" si hay varias; `TecnicoDetalle["docs"].tipo` pasa de `"DNI" | "Matrícula"` a `string`.
  - `actualizarEspecialidadesTecnico` — exigencia de matrícula = array vacío.
  - `miPerfilTecnico` — `tiene_matricula` = array no vacío.

## Criterios de aceptación

1. Sin especialidad elegida, el mensaje "Elegí al menos una especialidad." aparece al instante, con cualquier tamaño de archivo (= también en el celular).
2. Con foto de cámara real (3+ MB) la solicitud se envía y entra bien (la imagen viaja comprimida); si algo falla, hay mensaje visible y el botón se recupera.
3. Archivo con formato no permitido o gigante → error claro antes de crear nada; no existen más técnicos con documentos perdidos en silencio.
4. Se pueden subir 2+ matrículas; en el detalle del técnico aparecen todas con su link; la exigencia de matrícula (registro y edición de especialidades) sigue funcionando.
5. `tsc` + eslint + `next build` verdes; E2E del registro completo con archivo grande y 2 matrículas OK.

## Dev Agent Record
- **Estado:** ✅ implementada y verificada E2E (2026-07-12) — SIN commitear, Fausti revisa. ⚠️ **Migración en 2 fases**: fase 1 aplicada (`story_944_matriculas_fase1` — quedó con ese nombre por la colisión de numeración con la 944 de Giuliano: columna `doc_matricula_paths text[]` + backfill — la vieja convive con el código en prod). **Fase 2 PENDIENTE post-deploy**: re-correr el backfill y `alter table tecnicos drop column doc_matricula_path;`
- **Archivos:**
  - `shared/utils/imagen.client.ts` (NUEVO) — `comprimirImagen` (canvas, máx 1600px, JPEG 0.8, solo imágenes >600KB, fail-open) + `comprimirArchivosDeInput` (reasigna `input.files` vía DataTransfer).
  - `components/ui/input-archivo.client.tsx` — compresión en el onChange (cubre avances/rendición/gastos/conformidad del técnico).
  - `components/tecnicos/form-tecnico.client.tsx` — validación client-side de especialidades (el mensaje sale siempre); tope de 4 MB por archivo con error claro; try/catch/finally en onSubmit (nunca más cuelgue mudo); compresión en CampoArchivo; campo matrícula `multiple`.
  - `next.config.ts` — `serverActions.bodySizeLimit: "8mb"`.
  - `features/tecnicos/service.ts` — `errorArchivo()` valida MIME/tamaño de DNI y matrículas ANTES de crear el usuario (fin del null mudo de `subirDoc`); `getAll("doc_matricula")` → paths `matricula-N.ext`; insert/selects a `doc_matricula_paths`; exigencia de matrícula por array vacío; `tiene_matricula` por array.
  - `features/tecnicos/types.ts` — `TecnicoDetalle["docs"].tipo: string` ("Matrícula N" cuando hay varias).
- **Verificación:** `tsc` + eslint + `next build` verdes. E2E con Playwright contra dev server con el límite VIEJO de 1 MB (prueba más exigente): (A) foto de 5,9 MB sin especialidad → "Elegí al menos una especialidad." instantáneo y botón recuperado (antes: 413 + colgado mudo — bug reproducido pre-fix); (B) registro completo con DNI de 5,9 MB + especialidad Gas + 2 matrículas (JPG+PDF) → éxito; DNI llegó comprimido a 292 KB (image/jpeg), `doc_matricula_paths` con `matricula-1.jpg` y `matricula-2.pdf` sin pisarse; detalle del staff lista "DNI ↗ / Matrícula 1 ↗ / Matrícula 2 ↗" con links firmados. Datos de prueba borrados (auth + tecnicos + storage).
