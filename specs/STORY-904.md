# Story 9.4: Feedback de avance, stepper del funnel, restyle del tablero y bloqueo por presencia

Status: done
Versión: 1.0.0

> Pedidos de Fausti (2026-07-06): que el avance de etapa se NOTE, etapa visible en el detalle, tablero más lindo, y bloqueo de tarjeta cuando otro usuario la trabaja (con su nombre, "solo si no es complejo ni riesgoso").

## Alcance implementado

1. **Stepper del funnel** en el detalle: los 8 pasos bajo el título — pasados con ✓ esmeralda, actual en pill brand, futuros apagados. La etapa se ve de un vistazo.
2. **Feedback de avance**: cuando la etapa cambia (acción propia o realtime), el paso nuevo hace un **flash esmeralda** y un **toast** ("La gestión avanzó a X") confirma abajo al centro. Verificado E2E: update por atrás con la página abierta → stepper avanzó + toast.
3. **Restyle del tablero**: columnas como contenedores con dot de accionabilidad + contador pill, empty state con borde punteado "Sin gestiones", cards con separador interno, hover con elevación y acento esmeralda.
4. **Bloqueo por presencia (soft-lock seguro)**: Supabase Realtime Presence por gestión — el que llega SEGUNDO ve banner ámbar con candado "{nombre} está trabajando en esta gestión — las acciones se desbloquean cuando salga" y la card de acción atenuada/inoperable. Toast oscuro cuando alguien entra. **No riesgoso por diseño**: presence se auto-libera al cerrar pestaña/perder conexión (verificado: al expirar el simulador, se desbloqueó solo) y la atomicidad real la siguen garantizando avanzar_etapa()/responder_asignacion() en Postgres.

## Dev Notes

- Keyframes nuevos en @theme: toast-entrar, flash-brand.
- Presencia: canal `presencia-gestion-{id}` con presence key = user id; "dueño" = menor online_at. Payload solo {usuario_id, nombre, online_at}.
- Toasts por createPortal (regla del proyecto para overlays).

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code, 2026-07-06)

### File List

- components/gestiones/{etapa-stepper.client.tsx, presencia.client.tsx} (nuevos)
- components/gestiones/{detalle.client.tsx (stepper+presencia), tablero.client.tsx (restyle)}
- app/globals.css (keyframes toast-entrar, flash-brand)
