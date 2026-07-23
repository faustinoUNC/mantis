# STORY-1044 — En el cobro por partes (pagador mixto) el botón "Registrando…" se animaba en las dos partes a la vez (v1.0)

**Estado:** 🔨 en prueba · **Origen:** pedido de Fausti (2026-07-23). Bug visual en el cobro de pago compartido/mixto.

## Problema

En la etapa de **Cobro** de una gestión con **pagador mixto** (inquilino + propietario, cobro por partes de STORY-1036/1039), se renderiza un `FormCobro` por cada parte. Al tocar "Registrar cobro" de **una** parte (p. ej. el inquilino), el estado de carga "Registrando…" se animaba en **los dos botones** a la vez, como si se estuvieran registrando ambos cobros.

Causa en `codigo/components/gestiones/finanzas.client.tsx`:

- `CobroPorPartes` renderiza los dos `FormCobro` compartiendo el **mismo** estado `cargando` (string | null) del contenedor.
- Ambos `onSubmit` llamaban a `correr("cobro", …)` con la **misma clave** `"cobro"`, y el botón se anima con `cargando === "cobro"`. Al tocar uno, `cargando` pasa a `"cobro"` → la condición da `true` en los dos `FormCobro` → doble animación.

Es solo visual (cada cobro se registra por separado y correcto, con su `parte`), pero da la sensación de que se dispararon los dos.

## Decisión de diseño

- **Clave de carga por parte (Regla #0).** `FormCobro` recibe una prop `claveCarga` (default `"cobro"`) y se anima solo si `cargando === claveCarga`. En `CobroPorPartes` cada parte usa `` `cobro:${parte}` `` tanto en el `correr(...)` como en la prop → cada botón reacciona únicamente a su propio submit. Cambio chico, sin tocar el estado compartido ni `correr`.
- **Se mantiene el bloqueo de submit concurrente.** El `disabled={cargando !== null || …}` se deja igual a propósito: mientras una parte está en vuelo, el botón de la otra queda deshabilitado (evita disparar los dos cobros pisados). Lo que se corrige es solo la animación engañosa, no el bloqueo.
- **Los cobros de pagador único no cambian.** Los otros dos `FormCobro` (cancelación / cobro simple) no pasan `claveCarga` → default `"cobro"`, que coincide con su `correr("cobro", …)`. Cero regresión.

## Alcance

`codigo/components/gestiones/finanzas.client.tsx`:

1. `FormCobro`: nueva prop opcional `claveCarga?: string` (default `"cobro"`); el texto del botón usa `cargando === claveCarga` en vez del literal `"cobro"`.
2. `CobroPorPartes`: pasar `claveCarga={`cobro:${parte}`}` y cambiar el `onSubmit` a `correr(`cobro:${parte}`, …)`.

## Fuera de alcance

- No se toca `registrarCobro` ni el server (el registro por parte ya era correcto).
- No se cambia el `disabled` (bloqueo de submit concurrente intencional).
- El prop `error` sigue compartido entre las dos partes (un error de una se ve en ambas) — es un caso raro y no lo reportado; se deja como está para no ampliar el alcance.

## Criterios de aceptación

1. **Solo una parte se anima:** en un cobro por partes, tocar "Registrar cobro" del inquilino muestra "Registrando…" **solo** en ese botón; el del propietario no se anima.
2. **Registro correcto:** el cobro se imputa a la parte tocada (evento + constancia "Cobrado el …"); al registrar la segunda parte la gestión avanza de etapa (STORY-1036).
3. **Sin submit doble:** mientras una parte está en vuelo, el botón de la otra queda deshabilitado.
4. **Pagador único intacto:** el cobro simple y el de cancelación siguen mostrando "Registrando…" normal en su único botón.
5. `tsc`/eslint verdes.

## Dev Agent Record

- **Commit:** `f064925` (2026-07-23). Sin migración (fix 100% cliente, solo visual).
- **Archivos:**
  - `codigo/components/gestiones/finanzas.client.tsx`: prop `claveCarga` en `FormCobro` (default `"cobro"`, usada en el texto del botón); `CobroPorPartes` pasa `` `cobro:${parte}` `` en `claveCarga` y en `correr(...)`.
- **Verificación:**
  - `tsc --noEmit` y `eslint` verdes.
  - Click-through en navegador pendiente (pasos en los criterios de aceptación).
