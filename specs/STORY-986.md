# STORY-986 — Liquidación: el PDF automático es un "detalle", y se puede adjuntar un comprobante de pago real (opcional) (v1.0)

**Estado:** ✅ done (commit `e86d04b`) · **Origen:** Fausti, sobre la card #46 (reabierta por Rami). STORY-940 agregó la caja "Pago registrado" pero mantuvo el nombre "comprobante" para el PDF que genera MANTIS. Fausti aclara el requisito real: *"el archivo que se le manda al técnico dice comprobante… cuando realmente no es un comprobante, más bien es un detalle de lo que se le liquidó. Deberíamos exigir al momento de liquidar adjuntar un archivo que puede ser un comprobante de transferencia o una foto del recibo firmado. Opcional: si no sube nada solo va el detalle; si sube, se suma a los adjuntos."*

## Diagnóstico

El PDF que MANTIS genera al liquidar (`registrarLiquidacion` → `datosDocumento(gestionId, "comprobante")` + `generarPDF`) es una planilla que MANTIS arma con los datos de la gestión: pago registrado + trabajo + desglose de costos. Es un **detalle de la liquidación**, no una constancia externa de que el pago se hizo (transferencia bancaria, recibo firmado, etc.). Llamarlo "comprobante" (en el `filename`, en el título del PDF y en el asunto/cuerpo del email) es engañoso: el comprobante de verdad es un documento externo que hoy no se puede cargar.

## Alcance (Regla #0 — mínimo que cierra el requisito)

Dos cosas:

**A. Renombrar el documento auto-generado "comprobante" → "detalle de liquidación".**
- `pdf.tsx`: título del documento del técnico pasa de "Comprobante de liquidación" a "Detalle de liquidación". La caja "Pago registrado" (STORY-940) se mantiene — sigue siendo info útil dentro del detalle.
- `service.ts`: nombre de archivo `comprobante-{numero}.pdf` → `detalle-liquidacion-{numero}.pdf` (tanto en el email de liquidación como en `descargarDocumento`).
- Email al técnico: asunto "Comprobante de liquidación — {dir}" → "Detalle de tu liquidación — {dir}".
- `finanzas.client.tsx` (vista Finalizado): etiqueta "comprobante de liquidación" → "detalle de liquidación".
- Se renombra también la clave interna del union `tipo` (`"comprobante"` → `"detalle"`) dentro de la feature `finanzas` para no dejar el nombre viejo mintiendo en el código (cambio contenido a la feature: `pdf.tsx`, `finanzas/service.ts`, `finanzas.client.tsx`; la "nota" al pagador no se toca).

**B. Adjuntar un comprobante de pago real, opcional, al liquidar.**
- UI (`finanzas.client.tsx`, form de liquidar): input de archivo opcional "Comprobante de pago (opcional)" junto al método de pago. Ayuda: "Transferencia (PDF/imagen) o foto del recibo firmado". Se envía como `FormData`.
- `registrarLiquidacion(gestionId, formData)`: lee `medio` + archivo opcional `comprobante`. Si viene archivo: valida tipo (PDF, jpg, png, webp) y tamaño (≤ 8 MB), lo sube al bucket `gestiones` bajo `${gestionId}/comprobante-pago-*.{ext}` y guarda el path en la columna nueva `gestiones.liq_comprobante_path`.
- Email de liquidación: los adjuntos pasan a ser una lista. Siempre va el **detalle** (PDF). Si se subió comprobante, se **suma** como segundo adjunto. El cuerpo del email lo refleja: con comprobante → "Adjuntamos el detalle de la liquidación y el comprobante de pago."; sin comprobante → "Adjuntamos el detalle de la liquidación."
- `enviarEmail` / `enviarEmailDocumento`: `adjunto?` (uno) → `adjuntos?` (lista) para soportar N adjuntos.

## Fuera de alcance

- Dirección duplicada ("Cordoba, Córdoba") y N° crudo del documento (`0A43DEE5`): son otros temas, no de esta card.
- Vista Finalizado: el comprobante subido queda **persistido** (`liq_comprobante_path`) como respaldo/auditoría, pero esa vista solo permite ver/descargar el detalle (no reenvía por email), así que no se agrega UI nueva de descarga del comprobante. El comprobante viaja en el email de liquidación, que se dispara una sola vez.

## Migración

```sql
alter table gestiones add column if not exists liq_comprobante_path text;
```
(RLS de `gestiones` ya existente cubre la columna; no requiere policy nueva.)

## Criterios de aceptación

1. Al liquidar, el PDF que genera MANTIS se llama y se titula "detalle de liquidación", no "comprobante".
2. En el form de liquidación hay un campo opcional para adjuntar un comprobante de pago (PDF o imagen).
3. Si NO se adjunta nada: el email al técnico lleva solo el detalle (PDF) — igual que hoy.
4. Si SÍ se adjunta: el email lleva el detalle **y** el comprobante subido; el cuerpo lo menciona.
5. El comprobante subido queda guardado (`liq_comprobante_path`) como respaldo, y la validación/subida ocurre ANTES de registrar la liquidación (archivo inválido ⇒ no se liquida a medias).
6. Formatos inválidos o >8 MB: se rechaza con mensaje claro, sin romper la liquidación.
7. La nota de cobro al pagador no cambia. `tsc`/eslint verdes.

## Dev Agent Record

- **Commit:** `e86d04b` (pusheado a main 2026-07-18). Falta re-verificar E2E en la app (card #46 en "En prueba").
- **Archivos:**
  - `codigo/features/finanzas/pdf.tsx` — union `tipo` `"comprobante"`→`"detalle"`, título "Detalle de liquidación".
  - `codigo/features/finanzas/service.ts` — rename `tipo` en `datosDocumento`/`descargarDocumento` (filename `detalle-liquidacion-*`), constantes de storage + validación/subida del comprobante, `registrarLiquidacion(gestionId, FormData)` con adjuntos `[detalle, comprobante?]`, asunto/cuerpo/`tipo` de email actualizados, persiste `liq_comprobante_path`.
  - `codigo/features/email/service.ts` — `adjunto` (uno) → `adjuntos` (lista) en `enviarEmail`/`enviarEmailDocumento`.
  - `codigo/features/cartera/service.ts` — caller de `enviarEmailDocumento` migrado a `adjuntos: [...]`.
  - `codigo/components/gestiones/finanzas.client.tsx` — `InputArchivo` opcional "Comprobante de pago" en el form de liquidar (submit por `FormData`), etiqueta/tipo "detalle de liquidación" en Finalizado.
  - Migración `story_986_liq_comprobante_path` (columna `gestiones.liq_comprobante_path`) aplicada en Supabase.
- **Verificación:** `tsc --noEmit` y `eslint` verdes sobre los 5 archivos. PDF regenerado a mano confirma el título "Detalle de liquidación". Falta E2E en la app corriendo (liquidar con y sin comprobante, chequear el email del técnico).
