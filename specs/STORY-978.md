# STORY-978 — El admin recibe el conglomerado de notificaciones de los dos tipos de gestores

> **v1.1 (2026-07-16):** copy sin "facturar" — la regla de la matriz pasa de "Obra lista para facturar" a **"Obra lista para cobrar"** (la columna del funnel se llama Cobro; decisión de Fausti: fuera las referencias a facturación del sistema). Migración `story_978_v11_obra_lista_para_cobrar` + update de las 86 notificaciones ya emitidas con el texto viejo. Nota de la ronda de prueba: el reporte "al admin no le llega" fue la guarda anti-auto-notificación funcionando — Fausti movió las gestiones logueado como admin (actor) y por diseño el actor no recibe copia de su propia acción; los otros 3 admins la recibieron correctamente (verificado en DB).

**Estado:** ✅ done · **Origen:** reporte de Fausti 2026-07-15 ("cuando entra una gestión en cobro solo se notifica al gestor administrativo, no al admin") + party mode 2026-07-15 (diseño de la copia de supervisión).

## El problema

El trigger outbox `notificar_evento()` resuelve los destinos de `matriz_notificaciones` sin incluir nunca al administrador: el destino `administrativos` notifica solo a `rol = 'gestor_administrativo'` (así lo definió STORY-501 — gap de diseño, no regresión) y los destinos `gestor`/`nuevo_gestor` van únicamente al `gestor_id` dueño. Resultado: el admin, que según el PRD "ve todo y puede accionar en cualquier columna", solo se entera del inbox, de las solicitudes de técnico y de las gestiones donde él mismo es el gestor. La entrada a cobro ("Obra lista para facturar") y a liquidación le pasan de largo — el caso reportado.

## Decisión de diseño (party mode 2026-07-15, Regla #0)

**Copia física de supervisión** para cada admin activo, insertada por el mismo trigger, para todo destino `gestor`, `nuevo_gestor` y `administrativos`. Regla uniforme: cualquier fila futura de la matriz con esos destinos queda cubierta sola.

- **Lo del técnico queda afuera** (destino `tecnico` no genera copia) — confirmado por Fausti: "las notificaciones del técnico son del técnico"... las del gestor son del gestor, y el admin conglomera solo las de los dos tipos de gestores.
- **El gestor administrativo queda como está** (sus 2 reglas `administrativos`) — confirmado por Fausti.
- **Fila propia, no lectura ampliada**: `leida_en` vive en la fila; compartir filas entre admin y gestor mezclaría el estado de leído, y el realtime de la campanita solo entrega INSERT con `usuario_id` propio (descubrimiento STORY-968). Filas baratas > estado compartido.
- **El contexto viaja congelado en la copia** (no se deriva en el cliente): cuerpo `"Gestor: {nombre} — {descripción}"` y título en voz de supervisor cuando el original está en segunda persona ("Te reasignaron una gestión" → "Gestión reasignada"). La campanita no cambia ni un componente.
- **Dos guardas anti-ruido**: si el admin es el actor del evento no recibe copia (nadie necesita el aviso de lo que acaba de hacer), y si ya es el destinatario directo (es el gestor dueño) recibe una sola fila, la de gestor.

**En acta de la sala** (aceptado por Regla #0, sin trabajo ahora): el badge del admin mezcla propias y supervisión en un solo número; si el volumen real desborda el popover de 320px, la conversación siguiente es una página `/notificaciones`, no más filtros en el popover.

## La solución

1. **Migración `story_978_copia_admin_notificaciones`:**
   - `matriz_notificaciones.titulo_admin text null` — título alternativo para la copia de supervisión; `null` = usar `titulo`. Única fila que lo setea hoy: `gestor_reasignado` → "Gestión reasignada".
   - `create or replace function notificar_evento()`: se reestructura el loop para que cada regla resuelva su destinatario directo como hoy (la rama `administrativos` deja de hacer `continue`) y, al final de cada iteración con destino ≠ `tecnico`, inserte la copia para todos los `administrador` activos con las dos guardas (`<> actor_id`, `is distinct from` destinatario directo). Cuerpo: `left('Gestor: ' || nombre || ' — ' || descripción, 120)`, ruta `/gestiones/{id}`.
2. **Sin cambios de frontend**: la campanita ya muestra título + cuerpo + realtime por `usuario_id`.

## Criterios de aceptación

1. Transición a `facturacion_cobro` → el gestor administrativo recibe "Obra lista para facturar" (como hoy) **y** el admin recibe su copia con "Gestor: {nombre} — {descripción}". Ídem `liquidacion_tecnico`.
2. Evento con destino `gestor` (p. ej. `presupuesto_enviado`) → el gestor dueño recibe la suya (sin cambios) y el admin la copia con contexto.
3. `gestor_reasignado` → el nuevo gestor ve "Te reasignaron una gestión"; el admin ve "Gestión reasignada".
4. Eventos con destino `tecnico` NO generan copia al admin.
5. Si el admin es el actor del evento o el gestor dueño de la gestión, no recibe copia duplicada.
6. La campanita del gestor no cambia; la del admin muestra las copias vía realtime sin tocar código cliente.

## Dev Agent Record

- **Migración:** `story_978_copia_admin_notificaciones` (aplicada 2026-07-15): `matriz_notificaciones.titulo_admin` + seed de `gestor_reasignado` → "Gestión reasignada" + `create or replace` de `notificar_evento()` con la copia de supervisión al final del loop (la rama `administrativos` ya no hace `continue`; `v_destinatario` se resetea por iteración).
- **Código de app:** sin cambios — la campanita y el realtime existentes cubren todo (por diseño).
- **Verificación E2E (SQL, 2026-07-15):** 6 eventos sintéticos sobre gestiones reales cubriendo los 6 criterios — copia al admin en `administrativos` (con las de gestor_administrativo intactas y sin prefijo), copia con "Gestor: {nombre} — {desc}" en destino `gestor`, "Gestión reasignada" vs "Te reasignaron una gestión" en `gestor_reasignado`, cero copia en destino `tecnico`, exclusión del admin actor y del admin que ya es gestor dueño (una sola fila, la de gestor). 13+1 notificaciones esperadas = 13+1 obtenidas. Datos sintéticos limpiados.
- **Incidente de verificación (documentado):** la limpieza por ventana de tiempo (15 min sobre las 2 gestiones de prueba) se llevó también 13 notificaciones reales del E2E que Giuliano estaba corriendo EN ESE MOMENTO para STORY-977 sobre la gestión "adelanto test". Se reconstruyeron las 13 desde `eventos_gestion` (fuente de verdad) con sus `creado_en` originales; solo se perdió el posible estado de leídas. Lección: limpiar datos sintéticos por marcador propio, nunca por ventana de tiempo, con más gente trabajando en la misma base.
