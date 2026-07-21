# STORY-1015 — Walter conserva la conversación al navegar entre secciones (v1.1)

**Estado:** 🔨 en prueba · **Origen:** card Trello #135 (Rami, 2026-07-19, https://trello.com/c/Educo9xk): "el único error que le vi, es que borra el chat cuando te movés de un apartado a otro".

## Problema

`PanelShell` (que monta a `<Walter>`) vive en **un layout por cada sección de la app** (`app/tablero/layout.tsx`, `app/finanzas/layout.tsx`, `app/gestiones/layout.tsx`, `app/cartera/…`, etc. — 11 layouts hermanos). En el App Router de Next, al navegar de una sección a otra se cruza de un subárbol de layout a otro: `PanelShell` — y con él `<Walter>` — **se desmonta y se vuelve a montar**. Como los mensajes viven solo en el estado local de `useChat`, el chat se pierde en cada salto de sección.

La posición de la burbuja **sí** sobrevive porque ya se persiste en `sessionStorage` (`walter-burbuja`); la conversación no tiene ese tratamiento.

## Alcance

1. **Persistir los mensajes en `sessionStorage`** (`components/asistente/walter.client.tsx`), con el mismo patrón ya usado para la posición de la burbuja:
   - Al montar, en el `requestAnimationFrame` siguiente (evita el mismatch de hidratación: el server no conoce `sessionStorage`), restaurar los mensajes guardados con `setMessages` bajo la clave `walter-chat`.
   - Un `useEffect` sobre `messages` guarda el array serializado; si está vacío, borra la clave. Un ref `restaurado` evita que el primer render (aún con `messages = []`) pise lo guardado antes de restaurar.
2. **El botón "Nueva"** (que ya hace `setMessages([])`) limpia también la clave de `sessionStorage` — empezar de cero es explícito y persistente.

`sessionStorage` es por pestaña y se borra al cerrarla: es exactamente el alcance de una sesión de chat. No hace falta base de datos ni tabla (Regla #0).

## Fuera de alcance (decisiones conscientes)

- **Hoistear Walter a un layout raíz único** para que nunca se desmonte: implicaría un route group compartido (`(app)`) envolviendo las 11 secciones, con `PanelShell` (server component async que hace fetch de notificaciones) reestructurado. Cambio grande y frágil para un bug que la persistencia resuelve en pocas líneas.
- **Persistir el estado `abierto` del panel**: al navegar el panel se cierra (queda en la burbuja); reabrirlo muestra la conversación intacta. No se persiste que estaba abierto (abrir solo por navegar sería raro).
- **Persistencia entre sesiones/pestañas** (localStorage, DB): la conversación es efímera por diseño.

## Criterios de aceptación

1. Abrir Walter, mandar uno o más mensajes, navegar a otra sección (p. ej. Tablero → Finanzas) y reabrir Walter: la conversación sigue completa (mensajes del usuario y de Walter, botones de navegación incluidos).
2. Tocar "Nueva" vacía el chat y, tras navegar y reabrir, sigue vacío (no reaparece la conversación vieja).
3. Recargar la página (F5) dentro de la misma pestaña conserva la conversación; cerrar la pestaña la descarta.
4. Sin mismatch de hidratación en consola; la burbuja arrastrable sigue funcionando igual.
5. Regresión: enviar/streaming/reintento/estado "pensando" y los chips de sugerencia intactos; `tsc`/eslint verdes.

## Dev Agent Record

- **Commit:** `29b3933` (2026-07-19, junto con STORY-1016).
- **Archivos:** `codigo/components/asistente/walter.client.tsx` (restaurar + guardar `messages` en `sessionStorage` bajo `walter-chat` con ref `restaurado`; "Nueva" limpia la clave), `specs/README.md`, `tasks/PENDIENTES.md`.
- **Verificación:** `tsc`/eslint verdes. E2E navegador (admin): Walter → mensaje + respuesta → navegar Tablero→Finanzas → reabrir con la conversación intacta; "Nueva" + navegar → vuelve al saludo inicial (persistencia limpiada); sin mismatch de hidratación en consola.

## v1.1 — La conversación es del usuario, no de la pestaña (bug del tester, card #135)

**Problema (Rami, 2026-07-21):** cerrar sesión y entrar con OTRO usuario en la misma pestaña mostraba la conversación del anterior (probado entre técnicos). La clave `walter-chat` era única por pestaña — la card lo documentaba como corner case "tocar Nueva si aparece", pero es una fuga de privacidad real: un chat puede contener datos del alcance del usuario anterior.

**Fix:**

- La clave pasa a ser **por usuario**: `walter-chat:<usuarioId>`. `PanelShell` le pasa `usuarioId` a `<Walter>` (dato de sesión server-side, como ya hace con la campana). Cada usuario restaura SOLO su conversación; la del otro no se toca (si vuelve a entrar, la recupera).
- Limpieza de la clave vieja sin usuario (`walter-chat`) al montar, para que ninguna charla previa al fix quede legible por otro.
- La posición de la burbuja (`walter-burbuja`) sigue global: es preferencia de dispositivo, no dato.

**Criterios v1.1:** (1) usuario A chatea → logout → login usuario B en la misma pestaña → Walter arranca con el saludo inicial, sin rastro del chat de A; (2) B chatea, logout, login A → A recupera SU conversación; (3) regresión: navegar entre secciones con el mismo usuario sigue conservando el chat.
