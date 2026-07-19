# STORY-1012 — Al agregar una especialidad nueva que exige matrícula, hay que cargar SU matrícula (v1.0)

**Estado:** 🟡 implementado, falta `tsc`/`eslint` + E2E (sin Node en este entorno) · **Origen:** Giuliano (2026-07-19): *"Cuando ya tengo un perfil de técnico creado en administración y a ese técnico le quiero añadir una categoría como gasista, en sistema no valida que si le agrego una categoría con matrícula obligatoria le cargue la nueva matrícula, si ya tiene una la deja pasar y debería obligar a cargar la nueva."*

STORY-948 (2026-07-18, ver `tasks/PENDIENTES.md` línea 41) había decidido a propósito que el campo de matrícula fuera "obligatorio solo si el técnico no tiene ninguna todavía, opcional si ya tiene y quiere sumar otra". Ese diseño es justo el que ahora se reporta como insuficiente: al agregar una especialidad nueva que exige matrícula, el chequeo miraba si el técnico tenía **cualquier** matrícula (de cualquier especialidad), no si tenía una para la especialidad recién agregada.

**Causa raíz:** el modelo de datos no asocia archivo de matrícula con especialidad — `doc_matricula_paths` es un array plano en `tecnicos`, sin `especialidad_id`. Por Regla #0 no se agrega esa relación (sería una tabla/columna nueva solo para poder decir "esta matrícula es de gasista"); en cambio, la validación pasa a exigir que se suba al menos un archivo nuevo en el mismo submit cuando se agrega una especialidad exigente que el técnico **no tenía antes** — sin importar cuántas matrículas viejas tenga de otras especialidades.

## Alcance

1. **Client** (`components/tecnicos/especialidades-tecnico.client.tsx`): `faltaMatricula` deja de depender de `tieneMatricula` (global, "¿tiene algún archivo?"). Pasa a ser `true` cuando alguna especialidad seleccionada exige matrícula **y no estaba** en las especialidades que el técnico ya tenía al abrir el formulario (prop `actuales`) — es decir, es una especialidad realmente nueva en este submit.
2. **Server** (`features/tecnicos/service.ts` → `actualizarEspecialidadesTecnico`): agrega una consulta a `tecnico_especialidades` para saber qué especialidades tenía el técnico antes de este submit. El bloqueo pasa de "hay exigentes Y el técnico no tiene ninguna matrícula" a "hay exigentes **nuevas** (no estaban antes) Y no se subió ningún archivo en este submit".
3. El mensaje de error menciona la especialidad nueva puntual, no todas las exigentes seleccionadas.

## Fuera de alcance

- No se crea relación matrícula↔especialidad en la DB (sería una migración de esquema no trivial, contra Regla #0). La validación sigue siendo "¿subiste algo en este submit?", no "¿subiste el archivo correcto para esta especialidad?" — mismo nivel de rigor que ya existía, solo corrige CUÁNDO se exige.
- Especialidades ya asignadas antes (viejas) que exigen matrícula y ya la tienen: sin cambios, no piden nada nuevo al resave.
- `eliminarMatriculaTecnico` (borrado de matrícula vieja): sin cambios, sigue bloqueando el borrado de la última matrícula si el técnico todavía tiene una especialidad que la exige.

## Criterios de aceptación

1. Técnico con "Electricista" (exige matrícula) + matrícula cargada. El gestor le agrega "Gasista" (exige matrícula) sin subir archivo nuevo → bloqueado, mensaje menciona "Gasista" específicamente.
2. Mismo caso, pero sube un archivo nuevo → la especialidad se guarda y el archivo se agrega a `doc_matricula_paths`.
3. Técnico nuevo sin especialidades: agregar una que exige matrícula sin archivo sigue bloqueado (regresión de STORY-948).
4. Resave sin cambios de especialidades (todas ya asignadas antes) no pide nada nuevo, aunque falte matrícula de alguna vieja (comportamiento pre-existente, sin cambios).
5. `tsc`/eslint verdes.

## Dev Agent Record

- **Archivos:** `codigo/features/tecnicos/service.ts` (`actualizarEspecialidadesTecnico`: consulta `tecnico_especialidades` previas, `exigentesNuevas` reemplaza `tendraMatricula`), `codigo/components/tecnicos/especialidades-tecnico.client.tsx` (`faltaMatricula` recalculado contra `actuales`).
- **Verificación:** no se pudo correr `tsc`/`eslint` ni probar en navegador en este entorno (sin Node/npm instalado). **Pendiente: correr `tsc`/`eslint` y probar E2E** — en particular confirmar en la app real que agregar una especialidad nueva exigente con matrícula previa de otra especialidad efectivamente bloquea sin archivo nuevo, y que el resave sin cambios (criterio 4) no rompe.
