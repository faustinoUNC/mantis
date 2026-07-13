# STORY-948 — La inmobiliaria puede editar todos los datos de un técnico (v1.0)

**Estado:** ✅ done · **Origen:** Giuliano: *"Falta permitir que la inmobiliaria pueda editar todos los datos personales y especialidades de los técnicos (confirmando la matrícula en caso de ser necesario), ya que si el técnico comete algún error como escribir mal el mail se pondrán en contacto con la administración para que lo corrijan así que deben poder editar todo de los técnicos."*

## Alcance

- Staff de mantenimiento (`administrador` o `gestor_mantenimiento` — mismo gate `exigirStaffMantenimiento` que ya usan el resto de las mutaciones de técnicos) puede editar, desde `/tecnicos/[id]`:
  1. **Datos personales**: nombre, email, teléfono, CUIL.
  2. **Especialidades**: ya era editable (STORY previa); se extiende para resolver el caso donde se agrega una especialidad que exige matrícula.
  3. **Matrícula**: si al agregar una especialidad que exige matrícula el técnico no tiene ninguna cargada, el mismo formulario de especialidades permite subir el archivo ahí — antes esto bloqueaba sin ninguna salida en la UI.
- **Fuera de alcance**: reemplazo del DNI. El pedido del usuario da como ejemplo concreto un email mal tipeado, y la matrícula es el único documento que hoy se puede necesitar recién después del alta (por agregar una especialidad nueva); el DNI no tiene ese caso de uso y no se mencionó. Si hace falta corregirlo se agrega después (Regla #0).
- `gestor_administrativo` sigue sin poder tocar nada de técnicos (no cambia el gate existente).

## Implementación

- **`features/tecnicos/service.ts`**:
  - `editarDatosTecnico(tecnicoId, {nombre, email, telefono, cuil})` (nueva): valida nombre/email no vacíos, CUIL válido (`errorCuil`), chequea duplicados con `duplicadoPersona(admin, "tecnicos", {...}, tecnicoId)` (excluyendo al propio técnico). Si el email cambia, actualiza primero `auth.users` vía `admin.auth.admin.updateUserById` (con `email_confirm: true`) y recién después escribe `tecnicos`; si el update de `tecnicos` falla, hace rollback del email en auth — mismo patrón de compensación que `altaTecnico` (que borra el usuario de auth si falla el insert en `tecnicos`). Si el técnico está `aprobado` (tiene fila en `usuarios`), sincroniza `usuarios.nombre`/`usuarios.email` también.
  - `actualizarEspecialidadesTecnico`: cambia de firma `(tecnicoId, especialidadIds: string[])` a `(tecnicoId, form: FormData)`. Lee `especialidades` (multi) y `doc_matricula` (multi, opcional) del form. Si alguna especialidad elegida exige matrícula y el técnico no tiene ninguna cargada NI se subió una nueva en este submit, sigue bloqueando con el mismo mensaje de antes (ahora sugiere subir el archivo). Si se subieron archivos nuevos, se agregan a `doc_matricula_paths` (numeración continua a partir de las existentes, mismo helper `subirDoc` que usa el alta) antes de reemplazar el set de especialidades.
  - `obtenerTecnico`: agrega `tieneMatricula: paths.length > 0` al `TecnicoDetalle` devuelto, para que la UI sepa si hace falta mostrar el campo de carga sin tener que parsear `docs[].tipo`.
- **`features/tecnicos/types.ts`**: `TecnicoDetalle` gana el campo `tieneMatricula: boolean`.
- **`components/tecnicos/form-tecnico.client.tsx`**: `CampoArchivo` pasa de componente local no exportado a `export function CampoArchivo` — se reutiliza tal cual en la edición de especialidades, sin duplicar código ni tocar el `InputArchivo` compartido (que es de un solo archivo, no sirve para matrícula múltiple).
- **`components/tecnicos/especialidades-tecnico.client.tsx`**: pasa a construir un `FormData` real (checkboxes con `name="especialidades"` dentro de un `<form>`) en vez de armar un array a mano; agrega el `CampoArchivo` de matrícula, visible solo cuando `exigeMatricula && !tieneMatricula`.
- **`components/tecnicos/datos-tecnico.client.tsx`** (nuevo): edición inline de nombre/email/teléfono/CUIL, mismo patrón toggle-editar que `EspecialidadesTecnico` (vista de solo lectura + botón "Editar datos" → `Card` con formulario → Guardar/Cancelar → `router.refresh()`).
- **`app/tecnicos/[id]/page.tsx`**: reemplaza el bloque estático de nombre/email/teléfono/CUIL por `<DatosTecnico>`; pasa `tieneMatricula` a `<EspecialidadesTecnico>`.

## Criterios de aceptación

1. Un `administrador` o `gestor_mantenimiento` puede editar nombre, email, teléfono y CUIL de un técnico ya existente desde `/tecnicos/[id]`, sin recrear la cuenta.
2. Si cambia el email, el técnico puede loguearse con el nuevo email inmediatamente (se actualiza en `auth.users`, no solo en la tabla `tecnicos`).
3. Si el nuevo email/CUIL/teléfono ya lo usa otro técnico, se rechaza con el mismo mensaje de `duplicadoPersona` que usan alta y cartera — no rompe la unicidad de STORY-944.
4. Si falla el guardado en `tecnicos` después de haber cambiado el email en auth, el email en auth se revierte (no queda desincronizado).
5. Un técnico `aprobado` (con fila en `usuarios`) ve su nombre/email actualizados también ahí — no solo en `tecnicos`.
6. Al editar especialidades y agregar una que exige matrícula en un técnico sin matrícula cargada, aparece un campo para subir el archivo en el mismo formulario; si se sube, la especialidad se guarda; si no, sigue bloqueado con mensaje explicativo (ya no es un callejón sin salida).
7. `gestor_administrativo` no ve ni puede ejecutar ninguna de estas acciones (gate sin cambios).
8. `tsc`/eslint verdes.

## Dev Agent Record

- **Archivos:** `codigo/features/tecnicos/service.ts` (`editarDatosTecnico` nueva, `actualizarEspecialidadesTecnico` cambia de firma, `obtenerTecnico` agrega `tieneMatricula`), `codigo/features/tecnicos/types.ts` (`TecnicoDetalle.tieneMatricula`), `codigo/components/tecnicos/form-tecnico.client.tsx` (`CampoArchivo` exportado), `codigo/components/tecnicos/especialidades-tecnico.client.tsx` (FormData + upload de matrícula), `codigo/components/tecnicos/datos-tecnico.client.tsx` (nuevo), `codigo/app/tecnicos/[id]/page.tsx` (wiring).
- **Verificación:** `tsc --noEmit` y `eslint` limpios. Falta probar el flujo end-to-end en la app corriendo (no se hizo en esta sesión).
