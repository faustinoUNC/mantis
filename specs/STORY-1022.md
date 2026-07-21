# STORY-1022 — Tooltips tapados en listas con animación escalonada (v1.0)

**Estado:** ✅ hecha · **Origen:** pedido directo de Fausti (2026-07-21, con screenshot): el tooltip "Horarios de trabajo" del picker de técnicos (hover sobre la tira de días) sale ilegible — las filas de abajo se dibujan encima y "se ve todo mezclado".

## Problema

No es transparencia: el fondo del tooltip es sólido (`--color-foreground`). Las filas siguientes del picker **pintan por encima** del tooltip. Causa raíz: la lista usa `.stagger` (`globals.css:127-137`), cuya animación `aparecer` corre con `animation-fill-mode: both`. Por spec de CSS, un elemento con una animación activa de `opacity`/`transform` establece un stacking context — y con `both` el fill dura para siempre, así que **cada fila queda encerrada en su propio stacking context permanente**. El `z-20` del tooltip de `TiraDias` (`detalle.client.tsx:394`) y el `z-50` de `ConTooltip` (`:429`) solo valen dentro de su fila; la fila siguiente, pintada después, les pasa por arriba.

Es el hermano del bug ya documentado en `globals.css:93-94` (transform residual que rompía overlays fixed): aquel se arregló con `transform: none` en el keyframe final, pero el stacking context del fill quedó. **Afecta a toda lista `.stagger` con tooltips/overlays adentro**, no solo al picker.

## Alcance

1. **Fix de raíz** (`codigo/app/globals.css:128`): `animation-fill-mode` de `both` → `backwards`. El fill solo hace falta durante el delay inicial (filas invisibles antes de aparecer); al terminar la animación el elemento vuelve a sus estilos naturales y el stacking context desaparece. Mismo efecto visual, cero contexto residual.
2. **Cinturón en el picker** (`detalle.client.tsx`, `FilaTecnico`): `relative hover:z-10` en la fila, para que aun con stacking contexts por cualquier otra causa la fila hovereada gane a sus hermanas.

## Fuera de alcance

- Rediseñar el contenido del tooltip (día + rango sobre fondo oscuro se lee bien una vez destapado; se revisa después si hace falta).
- Migrar los tooltips CSS a portales/librería: complejidad innecesaria.

## Criterios de aceptación

1. En el picker de asignación, hover sobre la tira de días de un técnico con más técnicos debajo → el tooltip "Horarios de trabajo" se lee completo, opaco, por encima de las filas siguientes.
2. Ídem los `ConTooltip` de "★" y "en curso" del picker.
3. La animación de aparición escalonada de las listas se ve igual que antes (filas invisibles hasta su turno, sin flash).
4. Regresión: tablero, informes y cualquier otra lista `.stagger` sin cambios visuales.

## Dev Agent Record

- **Commit:** _pendiente de OK_.
- **Archivos:** `codigo/app/globals.css` (`.stagger > *`: `both` → `backwards`, con comentario del porqué); `codigo/components/gestiones/detalle.client.tsx` (`relative hover:z-10` en el `<button>` de `FilaTecnico`).
- **Verificación:** `tsc --noEmit`, eslint y `next build` verdes. E2E navegador (admin, gestión #84 en Asignación con 2 candidatos): hover sobre la tira de días de Faustino → tooltip "Horarios de trabajo · Mar 09:00–21:00" **opaco y por encima** de la fila de Giuliano (antes: la fila de abajo se dibujaba encima — screenshot de Fausti). Stagger visualmente intacto (aparición escalonada igual).
