# STORY-1034 — Modo vacaciones del técnico (v1.0)

**Estado:** 🔨 en prueba · **Origen:** pedido de Fausti (2026-07-21) — que el técnico pueda "marcarse de vacaciones" para que no le manden solicitudes de asignación mientras no está.

## Problema

La asignación es por solicitud (el gestor envía, el técnico acepta/rechaza). Si el técnico está de vacaciones, la solicitud queda colgada sin respuesta y la gestión frenada en Asignación hasta que el gestor se dé cuenta y la cancele. Hoy no hay forma de avisarlo dentro del sistema:

- `usuarios.esta_activo` es una **baja administrativa** del staff: desloguea al técnico y está bloqueada si tiene gestiones en curso. No sirve para una ausencia temporal.
- Las franjas de disponibilidad (STORY-1025) son una agenda **semanal recurrente** — no cubren ausencias puntuales, y además son solo informativas en el picker.

## Solución (la más simple)

Un **toggle auto-servicio** en el perfil del técnico. Sin rangos de fechas, sin cron de retorno, sin aprobación del staff: el técnico lo prende al irse y lo apaga al volver.

- Columna nueva `tecnicos.en_vacaciones boolean not null default false` (migración remota vía Supabase MCP).
- Server action `actualizarMisVacaciones(enVacaciones)` en `features/tecnicos/service.ts` (solo rol técnico, mismo patrón que `actualizarMiContacto`).
- **Perfil del técnico** (`/tecnico/perfil`): fila "Vacaciones" con el estado y botón Activar/Desactivar. Aclara que los trabajos ya aceptados siguen a su cargo.
- **Picker de asignación** (`tecnicosDisponibles` + `FilaTecnico`): el técnico de vacaciones **se muestra pero no se puede elegir** — va al final de la lista, opacado, con badge ámbar "De vacaciones" (mejor que ocultarlo: el gestor sabe que existe y que vuelve).
- **Guard server-side** en `asignarTecnico`: si el elegido está de vacaciones, la acción falla con mensaje claro (defensa contra UI desactualizada).
- **Lista staff** (`/tecnicos`): badge ámbar "De vacaciones" junto al estado del técnico aprobado.

## Fuera de alcance

- Rangos de fechas / vuelta automática — se agrega solo si el toggle manual queda corto en la práctica.
- Auto-cancelar solicitudes pendientes al activar el modo: el técnico ya puede rechazarlas y el gestor ya tiene "Cancelar y elegir otro técnico".
- Los trabajos **aceptados** no se tocan: vacaciones solo frena solicitudes nuevas.
- Notificar al staff cuando un técnico activa el modo.

## Criterios de aceptación

1. El técnico ve en su perfil la fila "Vacaciones" y puede activar/desactivar el modo; el cambio persiste tras recargar.
2. Con el modo activo, en el picker de asignación el técnico aparece al final, opacado, con badge "De vacaciones" y no se puede seleccionar ni enviarle solicitud (tampoco forzando la action: devuelve error).
3. Al desactivar el modo vuelve a ser elegible como siempre.
4. La lista `/tecnicos` del staff muestra el badge "De vacaciones".
5. Los flujos existentes no cambian: asignación a técnico disponible, aceptar/rechazar, y trabajos en curso del técnico de vacaciones siguen intactos.
6. `tsc`/eslint verdes.

## Dev Agent Record

- _Pendiente._
