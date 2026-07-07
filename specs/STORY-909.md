# STORY-909 — Confirmación antes de inhabilitar un empleado (v1.0)

**Estado:** 🚧 en desarrollo · **Fecha:** 2026-07-07
**Origen:** Reproducción del "bug de login" (Trello Mantis, card #4). Se verificó con navegador que el alta+login de un gestor comercial **funciona bien**; lo que Fausti vio ("no me deja entrar") era una cuenta en estado **Inhabilitado** → el login muestra "Tu cuenta está inhabilitada". El hallazgo real: el botón **"Inhabilitar"** en `/admin/empleados` se ejecuta con **cero confirmación**, así que un click accidental deshabilita a un empleado en silencio (causa probable de la cuenta caída). Fausti pidió agregar una alerta previa.

## Objetivo

Evitar la inhabilitación accidental: pedir confirmación explícita antes de deshabilitar a un empleado. Habilitar (acción no destructiva) sigue siendo un solo click.

## Alcance

### `components/empleados/empleados.client.tsx` (componente `Fila`)
- Confirmación **inline de dos pasos** (sin modal nuevo — Regla #0, no hay componente Dialog reutilizable en `ui/`):
  - Estado normal: botón "Inhabilitar" (para activos) / "Habilitar" (para inhabilitados).
  - Al clickear **"Inhabilitar"** de un empleado activo, la celda de acciones pasa a modo confirmación: texto corto **"¿Inhabilitar a {nombre}?"** + botón **"Sí, inhabilitar"** (tono error) + **"Cancelar"** (fantasma). Recién "Sí, inhabilitar" llama a `cambiarEstadoEmpleado`.
  - **"Habilitar"** (acción reversible/no destructiva) NO pide confirmación — un click, como hoy.
- El estado de confirmación es local a la fila (`useState`), se resetea al cancelar o al completar.

### Sin cambios en
- `features/empleados/service.ts` (`cambiarEstadoEmpleado` ya valida admin y RLS): la lógica de negocio no cambia, solo el gatillo en la UI.

## Criterios de aceptación

1. Click en "Inhabilitar" no deshabilita de inmediato: muestra la confirmación inline en la misma fila.
2. "Cancelar" vuelve al estado normal sin cambios; "Sí, inhabilitar" deshabilita al empleado.
3. "Habilitar" sigue funcionando de un solo click.
4. La confirmación respeta el design contract (Button `variante`, sin sombras, acento error para la acción destructiva) y funciona en mobile (targets ≥44px).

## Fuera de alcance (Regla #0)
- Modal genérico de confirmación reutilizable: no se crea; la confirmación inline alcanza y es más simple de mantener.
- Confirmación en otras acciones (Editar, alta): no lo pidió el pedido; Editar no es destructivo.
- Diferenciar en el login "cuenta inhabilitada" vs "credenciales incorrectas": el login **ya** muestra el mensaje correcto ("Tu cuenta está inhabilitada"), no es necesario.

## Dev Agent Record
- **Commit:** 61d5492 (pusheado a main → auto-deploy)
- **Archivos:** `components/empleados/empleados.client.tsx` (componente `Fila`: estado `confirmando`, `toggleEstado` → `aplicarEstado(activo)`, celda de acciones con confirmación inline de dos pasos).
- **Verificación (navegador real contra dev server + Supabase prod, sesión admin):**
  - Click "Inhabilitar" → aparece "¿Inhabilitar a {nombre}? · Sí, inhabilitar · Cancelar" y el empleado **sigue Activo** (no se deshabilita). ✅
  - "Cancelar" → vuelve a Editar/Inhabilitar, sin cambios. ✅
  - "Sí, inhabilitar" → deshabilita (badge Inhabilitado, botón pasa a Habilitar). ✅
  - "Habilitar" → un solo click, sin confirmación (acción reversible). ✅
  - `npx tsc --noEmit` verde; `eslint` del archivo sin errores.
- **Nota:** durante la reproducción del "bug de login" (card #4) se confirmó que el alta+login de gestor comercial funciona bien; la cuenta caída estaba `esta_activo=false`. Se eliminó la cuenta `ausitesis+gestorcomercial@gmail.com` a pedido de Fausti (rehará el flujo manual).
