# STORY-997 — Botones de acción icon-only con tooltip estético (v1.0)

**Estado:** ✅ done · **Origen:** Fausti (UX): dar un toque premium — que las acciones que hoy son botones con texto pasen a **solo ícono** (que invita a clickear, menos texto) **con un tooltip estético al hover** para no perder entendibilidad. Consistente en todo el sistema.

## Alcance

Se crea un componente reutilizable **`BotonIcono`** (botón cuadrado 44×44 con ícono + `ConTooltip` estético) y se promueve **`ConTooltip`** a `components/ui/` (misma cajita `bg-foreground` de STORY-996). Se convierten a icon-only + tooltip las **acciones de barra/fila** (no los submits de formulario, que conservan texto para no perder claridad):

| Pantalla | Botón hoy | Icono-only |
|---|---|---|
| Tablero | "Nueva gestión" / "Cerrar" | `mas` / `cerrar` + tooltip |
| Técnicos | "Alta manual" / "Cerrar" | `mas` / `cerrar` |
| Técnicos (fila) | "Inhabilitar" / "Habilitar" | `inhabilitar` / `check` |
| Empleados | "Nuevo empleado" / "Cerrar" | `mas` / `cerrar` |
| Empleados (fila) | "Inhabilitar" / "Habilitar" | `inhabilitar` / `check` |
| Especialidades | "Nueva especialidad" / "Cerrar" | `mas` / `cerrar` |
| Administración | "Nueva administración" (link) | `mas` (link) |
| Inbox | "Actualizar" | `refrescar` + tooltip |

Íconos nuevos en el set (`iconos.tsx`): `mas` (+), `cerrar` (×), `inhabilitar` (círculo tachado). Se reusan `check` (habilitar) y `refrescar` (actualizar).

## Fuera de alcance

- **Submits de formulario** (Crear gestión, Dar de alta, Enviar solicitud, Liquidar y finalizar, Guardar): conservan texto — son la confirmación de un formulario lleno, no una acción de barra.
- Botones destructivos con confirmación poco frecuentes (Cancelar gestión, Archivar/Desarchivar): quedan con texto por ahora.

## Criterios de aceptación

1. Las acciones de barra/fila listadas son botones cuadrados de solo ícono (target ≥44px) con tooltip estético al hover que dice qué hacen; `aria-label` para accesibilidad.
2. Mismo ícono para la misma acción en todo el sistema.
3. Los toggles (crear/cerrar) alternan ícono ＋↔✕ y tooltip.
4. Los submits de formulario conservan texto.
5. `tsc`/eslint verdes.

## Dev Agent Record

- **Commit:** `4bb7c1d` (pusheado a main 2026-07-18).
- **Íconos nuevos:** `mas`, `cerrar`, `inhabilitar`, `editar`, `llave` (además de reusar `ojo`, `check`, `refrescar`).
- **Archivos:** `components/ui/iconos.tsx`, `components/ui/con-tooltip.client.tsx` (nuevo), `components/ui/boton-icono.client.tsx` (nuevo); pantallas: `gestiones/tablero`, `tecnicos/tecnicos` (toggle + fila Ver detalle/Inhabilitar), `empleados/empleados` (toggle + fila Editar/Contraseña/Inhabilitar), `especialidades/especialidades` (toggle + fila Editar/Desactivar), `inbox/inbox` (Actualizar), `cartera/propiedades` (Nueva administración link).
- **Verificación:** `tsc`/eslint verdes. E2E en el navegador (Técnicos): header ＋ "Alta manual" y por fila 👁 "Ver detalle" + ⃠ "Inhabilitar"; los tooltips estéticos aparecen al hover sin recorte de la tabla.
