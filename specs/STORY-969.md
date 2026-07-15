# STORY-969 — Rendición: fotos que se acumulan de a una + comprobantes visibles en Actividad

**Estado:** ✅ done · **Origen:** card Trello #92, errores de la ronda de prueba 2026-07-15 sobre STORY-965.

## El problema

El tester reportó dos cosas de la rendición de comprobantes:

1. **"Solo permite subir una foto cuando pueden ser múltiples."** El input ya es `multiple`, pero cada apertura del picker **reemplaza** la selección anterior (comportamiento nativo del file input). El flujo real en el celular es sacar la foto de un ticket, volver, sacar la del siguiente — y la opción "Cámara" del picker devuelve UNA foto por vez: al elegir la segunda se pierde la primera. Elegir varias juntas de la galería funcionaba, pero nadie carga tickets así.
2. **"No se ve la foto del comprobante en Actividad."** La galería de comprobantes solo se renderiza dentro de la card de Acción mientras la conformidad espera revisión. Aprobada la conformidad, las fotos desaparecen de la vista para siempre. En Actividad, el evento `materiales_rendidos` muestra solo "Total: $X", sin fotos.

## La solución

1. **`InputArchivo` acumula cuando es `multiple`** (único uso: `fotos_comprobantes`; el modo foto única no cambia): estado `File[]` como fuente de verdad, cada apertura del picker **suma** a lo elegido (comprimiendo cada foto al agregarla, patrón STORY-945), lista visible de fotos con su × para quitar, y el `input.files` real se reconstruye con `DataTransfer` en cada cambio (el form sigue mandando todo junto, el service no cambia). El botón pasa a "Agregar más fotos" cuando ya hay elegidas.
2. **Galería en Actividad**: el evento `materiales_rendidos` más reciente muestra las miniaturas de `materiales_fotos_urls` (las fotos vigentes de la gestión — eventos de rendiciones viejas, p. ej. de un técnico desasignado, quedan solo con su total: sus fotos ya no son las de la gestión). Mismas miniaturas clickeables que la card de Conformidad.

## Criterios de aceptación

1. En "Terminar la obra": elegir una foto, volver a tocar el botón y elegir otra → quedan LAS DOS (contador y lista lo muestran); se puede quitar una con la ×; el submit sube todas.
2. La card de Conformidad del gestor sigue mostrando la galería como hasta ahora.
3. En Actividad, el evento "Comprobantes de materiales rendidos" muestra las miniaturas (click abre grande) en cualquier etapa posterior — la evidencia no desaparece al aprobar.
4. Si hubo dos rendiciones (desasignación de por medio), solo el evento más reciente lleva la galería.
5. `tsc` + `eslint` verdes.

## Dev Agent Record

- **Archivos:** `components/ui/input-archivo.client.tsx` (acumulación con estado `File[]` + `DataTransfer`, lista con quitar, solo en modo `multiple`), `components/gestiones/detalle.client.tsx` (ítem `rendicion` en Actividad con la galería en el evento más reciente).
- **Verificación:** `tsc`+`eslint` verdes. E2E local (2026-07-15): como técnico, dos aperturas del picker sumaron 1+1 fotos (lista con ambas y quitar funcionando), rendición subida con las 2; como gestor, Actividad muestra la galería en el evento de rendición estando la gestión más allá de Conformidad.
