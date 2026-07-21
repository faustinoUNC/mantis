# STORY-1027 — El Gestor Financiero puede archivar y desarchivar gestiones finalizadas (v1.0)

**Estado:** ✅ implementada y verificada E2E (commit pendiente) · **Origen:** card Trello #148 "No se si esto es un bug pero lo dejo acá" (tester Ramiro, confirmado bug por Fausti, 2026-07-21). Pedido: tanto el Gestor Comercial como el Gestor Financiero deben poder archivar y desarchivar gestiones finalizadas; hoy solo puede el administrador (y el gestor owner). De paso (comentario de la card): el orden de las cards del Archivo debe ser consistente con Finanzas y los demás módulos.

## Problema

1. **Archivar/desarchivar falla para el Gestor Financiero.** El botón se le muestra (el detalle lo renderiza para `esGestorOwner || esAdministrativo`, `detalle.client.tsx:2451`) y la RLS lo permite (policy `administrativo_edita_gestiones`), pero el trigger `proteger_gestiones_update` limita al `gestor_administrativo` a una whitelist de columnas de finanzas (`v_finanzas`) que **no incluye `archivada_en`** → `raise exception 'sin_permiso'` → el update no afecta filas y el service devuelve el mensaje engañoso "No se pudo archivar (solo gestiones finalizadas)" sobre una gestión que sí está finalizada (screenshot de la card). Lo mismo al desarchivar desde la vista Archivo. El admin y el gestor owner no pasan por la whitelist, por eso a ellos les funciona.
2. **Orden del Archivo inconsistente.** `gestionesArchivadas()` ordena por `archivada_en desc`; Finanzas y el tablero (default "Más recientes primero") ordenan por `creado_en desc`. Si se archivan gestiones viejas después, el Archivo las muestra en otro orden que el resto del sistema.

## Alcance

1. **Migración**: recrear `proteger_gestiones_update()` agregando `'archivada_en'` a `v_finanzas` (la whitelist de columnas que el administrativo puede tocar). Nada más cambia en la función.
2. **Orden del Archivo** (`features/gestiones/service.ts`, `gestionesArchivadas`): `order("creado_en", desc)` en lugar de `archivada_en` — consistente con Finanzas y el tablero. La fecha "Archivada el …" de la card no cambia.

## Fuera de alcance

- Permitir archivar a un gestor comercial NO owner: la regla de ownership (PRD §2.1, cada gestor ve/opera solo sus gestiones) sigue vigente; el pedido de la card queda cubierto con owner + financiero + admin.
- Cambiar el mensaje de error del service o la UI del detalle: con el trigger corregido el flujo funciona; no se agrega complejidad.

## Criterios de aceptación

1. Gestor Financiero, gestión finalizada: "Archivar gestión" la saca del tablero y la deja en Archivo, con evento `archivada` en el historial.
2. Gestor Financiero, vista Archivo: "Desarchivar" la devuelve al tablero, con evento `desarchivada`.
3. Gestor Comercial owner y admin: archivar/desarchivar siguen funcionando (regresión).
4. El Gestor Financiero sigue SIN poder editar columnas fuera de la whitelist (p. ej. `descripcion`) — el trigger sigue protegiendo.
5. La vista Archivo lista las cards por fecha de ingreso descendente (misma lógica que Finanzas y el tablero por defecto).
6. `tsc` + eslint verdes.

## Dev Agent Record

- **Commit:** _pendiente_.
- **Archivos:** migración `story_1027_administrativo_archiva` (aplicada en Supabase: `archivada_en` en la whitelist `v_finanzas` de `proteger_gestiones_update()`); `codigo/features/gestiones/service.ts` (`gestionesArchivadas` ordena por `creado_en desc`).
- **Verificación:** `tsc --noEmit` + eslint verdes. **SQL con rol simulado** (Ramiro Zarate, gestor_administrativo, en transacción con rollback): archivar ✅, desarchivar ✅, editar `descripcion` sigue bloqueado con `sin_permiso` ✅. **E2E** como Laura Benítez (demo, Gestor Financiero): "Archivar gestión" en el detalle de una finalizada → badge Archivada + evento "Gestión archivada — Laura Benítez" en Actividad; "Desarchivar" desde la vista Archivo → vuelve al tablero + evento `desarchivada`. Estado de la base restaurado tras la prueba.
