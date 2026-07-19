# STORY-1013 — Walter no expone el fee de la inmobiliaria al técnico (v1.0)

**Estado:** 🔨 en prueba · **Origen:** auditoría de robustez del 2026-07-19 (hallazgo confirmado, verificado contra código y UI). El asistente Walter (STORY-1007), con el rol **técnico**, devolvía en la tool `detalle_gestion` el `cargo_admin` — el **fee de la inmobiliaria** —, un dato que la interfaz le oculta al técnico. Es un eco directo de la sobre-exposición de Walter v1 (repo tesis, hallazgo C-6), y la seguridad de Walter era requisito innegociable de la STORY-1007.

## Contexto

- En la app, el fee (`cargo_admin`) se define y se ve **solo** dentro de `FinanzasAcciones`, que `detalle.client.tsx` renderiza únicamente para `esAdministrativo` (rol administrador / gestor administrativo). El técnico **nunca** ve el fee en su vista de detalle.
- El técnico **sí** ve —y debe ver— el resto de lo financiero de su trabajo: `pagador`, `costo_final`, `adelanto_materiales`, la rendición de materiales y su presupuesto (mano de obra / materiales). Eso queda intacto.
- La tool `detalle_gestion` es del catálogo **compartido** (todos los roles) y devolvía `cargo_admin: plata(g.cargo_admin)` sin condicionar por rol → Walter, preguntándole como técnico "contame de la gestión X", le soltaba el fee que la UI le esconde. `compactar()` no expone el fee; el único punto de fuga era esa línea.

## Alcance

1. **`features/asistente/tools.ts`** — en el objeto de retorno de `detalle_gestion`, condicionar `cargo_admin` al rol: se incluye para todos los roles **menos** `tecnico` (spread condicional, mismo patrón que el ensamblado del catálogo). El `rol` ya está en el scope del closure (`const rol = usuario.rol`, construido con el rol de la sesión — nunca viaja del cliente).

## Fuera de alcance (documentado para no re-proponer)

- El resto de los hallazgos de la auditoría de robustez (email invisible, inserts de `eventos_gestion` sin chequeo, event log forjable, guards de etapa, índices FK, etc.): decisión de Fausti de **no** tocarlos por ser robustez ante fallos que no aplica al contexto tesis. Quedan en memoria (engram) por si esto pasa a producto.
- Ocultar `pagador` / `costo_final` / `adelanto_materiales` al técnico: la UI **sí** se los muestra, así que Walter se alinea a esa doctrina y los mantiene.

## Criterios de aceptación

1. Walter, con rol **técnico**, en `detalle_gestion` ya **no** devuelve `cargo_admin` (ni ningún alias del fee de la inmobiliaria).
2. Walter, con rol administrador / gestor de mantenimiento / gestor administrativo, **sigue** devolviendo `cargo_admin` como antes.
3. El técnico sigue viendo `pagador`, `costo_final`, `adelanto_materiales` y su presupuesto en Walter (paridad con la UI).
4. `tsc` / eslint verdes. Sin cambios de DB, RLS, triggers ni otras tools.

## Dev Agent Record

- **Commit:** _(pendiente de OK de Fausti)_
- **Archivos:** `codigo/features/asistente/tools.ts`
- **Verificación:** _(pendiente)_
