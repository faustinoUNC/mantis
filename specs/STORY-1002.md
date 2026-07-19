# STORY-1002 — Adelanto de materiales: mostrar lo presupuestado y exigir comprobante (v1.0)

**Estado:** 🧪 implementada y verificada E2E, sin commitear · **Origen:** reunión de revisión con Andres Garcia (Fathom 2026-07-18, https://fathom.video/calls/752154451). Al cargar el adelanto de materiales en la demo, Fausti tuvo que acordarse de memoria cuánto había presupuestado el técnico en materiales ("me acuerdo que habíamos dicho 50 mil… debería estar acá", min 00:00) y Andres pidió dejar constancia del dinero entregado ("vamos a pedir un comprobante acá", min 00:52).

## Problema

En la etapa **En ejecución**, la caja "Adelanto de materiales" (`AdelantoMateriales`, STORY-977) pide un monto a ciegas:

1. No muestra **cuánto presupuestó el técnico en materiales** — que es justamente la referencia para decidir cuánto adelantarle. El dato ya está en la gestión (`presupuestos[].monto_materiales` del presupuesto aprobado) pero no se renderiza ahí.
2. La entrega de plata queda asentada solo como un número. No hay forma de adjuntar el **respaldo real** (recibo firmado por el técnico o constancia de transferencia), que es lo que protege a la inmobiliaria si después hay discusión.

## Alcance

1. **Mostrar lo presupuestado en materiales** (`components/gestiones/finanzas.client.tsx`, `AdelantoMateriales`): línea informativa con el `monto_materiales` del presupuesto **aprobado** más reciente — "El técnico presupuestó $X en materiales". Si además ya hay adelantos previos, se mantiene el "ya adelantado $Y" actual en la misma línea de contexto. Gestión sin presupuesto aprobado (caso borde de datos viejos): la línea no aparece y todo sigue como hoy.

2. **Comprobante obligatorio por cada adelanto** (mismo patrón que el comprobante de liquidación de STORY-986):
   - `InputArchivo` en el form (imagen o PDF — `MIME_COMPROBANTE` + tope `MAX_COMPROBANTE_BYTES` de 8 MB ya existentes en `features/finanzas/service.ts`; las imágenes pasan por la compresión client-side global de STORY-945). Un archivo por adelanto. **Obligatorio**: sin comprobante no se puede cargar el adelanto.
   - `registrarAdelantoMateriales` pasa a recibir `FormData` (monto + comprobante). Valida y sube el archivo **antes** de tocar la fila (si el archivo es inválido no se registra nada a medias), al bucket `gestiones` bajo `<gestionId>/adelanto-comprobante-<ts>.<ext>`.
   - El evento `adelanto_materiales_registrado` existente suma `comprobante_path` a su `detalle` — cada adelanto ya genera su evento con `{monto, total}`, así que el comprobante queda anclado a SU entrega sin columnas ni tablas nuevas (**sin migración**).

3. **Comprobante visible en la Actividad** (`features/gestiones/service.ts` + `components/gestiones/detalle.client.tsx`): al armar `GestionDetalle`, los eventos con `detalle.comprobante_path` ganan `comprobante_url` (URL firmada 1 h, mismo helper `fotoConUrl` de las fotos). En el timeline, el evento "Adelanto de materiales registrado — Monto: $X" muestra un link "Ver comprobante" que abre el archivo en otra pestaña. `detalleLegible` no imprime claves desconocidas, así que el path crudo nunca se muestra.

## Fuera de alcance

- Tope o validación del monto contra lo presupuestado (decisión explícita de STORY-977 v1.1: puede adelantarse de más; el excedente ya se muestra como "sobrante" al liquidar).
- Adjuntar comprobantes a adelantos ya cargados (histórico) o editar/borrar un comprobante subido.
- Enviar el comprobante por email al técnico (el email de liquidación ya adjunta lo suyo; esto es respaldo interno).

## Criterios de aceptación

1. En ejecución, la caja de adelanto muestra lo presupuestado en materiales por el técnico (presupuesto aprobado vigente). Sin presupuesto aprobado, no muestra la línea y no rompe.
2. No se puede confirmar un adelanto sin comprobante adjunto; con archivo de tipo inválido o >8 MB el server action rechaza con mensaje claro y no registra el monto.
3. Adelanto cargado con comprobante: el total adelantado suma como siempre, y en la Actividad el evento del adelanto muestra "Ver comprobante" que abre el archivo.
4. Varios adelantos → cada evento conserva SU comprobante.
5. Regresión: la liquidación sigue restando el adelanto igual que antes; `tsc`/eslint verdes.

## Dev Agent Record

- **Commit:** _pendiente (espera OK de Fausti)_
- **Archivos:** `codigo/features/finanzas/service.ts` (`registrarAdelantoMateriales` → FormData + validación y subida del comprobante antes de tocar la fila + `comprobante_path` en el evento), `codigo/features/gestiones/types.ts` (`Evento.comprobante_url`), `codigo/features/gestiones/service.ts` (URL firmada al armar los eventos del detalle), `codigo/components/gestiones/finanzas.client.tsx` (línea "El técnico presupuestó $X en materiales", `InputArchivo` obligatorio, File capturado en estado para el paso de confirmación). Sin migración.
- **Verificación:** `tsc`/eslint verdes. E2E navegador (Admin, gestión "Inodoro pierde agua" en ejecución): caja muestra "El técnico presupuestó $ 1.000 en materiales"; submit sin archivo bloquea con "Adjuntá el comprobante…"; con PNG adjunto la confirmación muestra monto + nombre del archivo; tras confirmar, "ya adelantado $ 800" y evento "Adelanto de materiales registrado — Total: $ 800 · Monto: $ 800" con link "Ver comprobante" (URL firmada verificada por curl: 200 image/png). Dato de prueba revertido (adelanto, evento y archivo del bucket borrados).
