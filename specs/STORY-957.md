# STORY-957 — La página de Técnicos se actualiza en tiempo real

**Estado:** ✅ done · **Origen:** Fausti (2026-07-13): *"no están entrando in real time las solicitudes de los técnicos a la página de Técnicos del sistema, sí lo hacen ok en la campanita [...] es fundamental que no tengamos estos errores"*.

## Diagnóstico

No es una regresión de STORY-955: `/tecnicos` **nunca tuvo refresco en vivo**. La campanita anda porque `notificaciones` tiene su propio canal Realtime (STORY-908), pero la lista de técnicos es un server component que solo se refetchea al navegar. Faltaban las dos piezas del patrón estándar del proyecto (`RefrescoVivo`, el mismo de tablero/inbox/inicio):

1. La tabla `tecnicos` no estaba en la publicación `supabase_realtime` (estaban gestiones, inbox_reportes, notificaciones, usuarios, etc. — técnicos no).
2. `tecnicos.client.tsx` no montaba `<RefrescoVivo>`.

## Fix

- **Migración `story_957_tecnicos_realtime`**: `alter publication supabase_realtime add table tecnicos;` — la autorización la sigue dando la RLS (el staff recibe eventos de todas las filas; un técnico logueado, solo de la suya).
- **`components/tecnicos/tecnicos.client.tsx`**: monta `<RefrescoVivo tabla="tecnicos" />`. Cualquier INSERT/UPDATE/DELETE sobre `tecnicos` refresca la vista (debounce de 400 ms del componente): cubre la solicitud nueva que se verifica (UPDATE de `email_verificado`, que es cuando aparece para el staff), aprobaciones/rechazos hechos por otro gestor en paralelo y ediciones de datos.

## Criterios de aceptación

1. Con `/tecnicos` abierta como staff, cuando un técnico verifica su email la solicitud aparece en la lista sin recargar (y a la vez suena la campanita, como ya pasaba).
2. Cambios de estado hechos desde otra sesión (aprobar/rechazar) también se reflejan sin recargar.
3. `tsc`/eslint verdes.

## Dev Agent Record

- **Migración:** `story_957_tecnicos_realtime` aplicada.
- **Archivos:** `codigo/components/tecnicos/tecnicos.client.tsx` (monta `RefrescoVivo`).
- **Verificación:** `tsc` + `eslint` verdes. E2E en local: con `/tecnicos` abierta, un INSERT de solicitud sin verificar no la muestra (correcto) y el UPDATE de `email_verificado` la hace aparecer sola (~1 s), sin tocar el navegador.
