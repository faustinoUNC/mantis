# STORY-944 — CUIL, email y teléfono no pueden repetirse dentro de cada tipo de persona (v1.0)

**Estado:** ✅ done · **Origen:** Giuliano: *"En este momento los datos de todos los usuarios se pueden repetir, CUIL MAIL Y NUMERO DE TELEFONO, no se debe poder repetir nunca, en todas las instancias donde se da de alta algo (en el inicio a un técnico, dentro de la cuenta de administración a clientes y en todas las demás) debe validarse que estos datos no existan ya en la base de datos antes de ser creada"*.

## Alcance (decisiones confirmadas con Giuliano)

- **Por tipo, no global**: unicidad de CUIL/email/teléfono es dentro de cada tabla (técnicos entre sí, propietarios entre sí, inquilinos entre sí). Un técnico y un propietario **pueden** compartir teléfono (ej. familiares) — cruzar las 3 tablas hubiera sido una regla más compleja de la que el negocio pidió (Regla #0).
- **Server + UNIQUE en DB** (no solo validación de app): el chequeo previo da un mensaje en español antes del insert; el índice UNIQUE en Postgres es la garantía real ante altas concurrentes (dos altas en simultáneo con el mismo dato). Esto revierte la aceptación explícita de riesgo documentada en STORY-922 y STORY-924 ("no hay unique en email/documento", "sin constraint DB") — a pedido directo de Giuliano.
- `usuarios` (staff: admin/gestores/empleados) **no se tocó**: `crearEmpleado()` y `altaTecnico()` ya usan `admin.auth.admin.createUser()`, que rechaza emails duplicados a nivel de `auth.users` con mensaje amigable propio. No hay columnas cuil/telefono en `usuarios`.

## Diagnóstico

- **Técnicos** (`features/tecnicos/service.ts`, `altaTecnico()` — cubre tanto `crearTecnicoManual` como `enrolarTecnico`): el email ya estaba protegido por Supabase Auth; **cuil y teléfono no tenían ningún chequeo**, ni de app ni de DB.
- **Propietarios/inquilinos** (`features/cartera/service.ts`, `guardarPersona()` y `resolverPersona()`): ninguna de las 3 columnas (email, cuil, telefono) tenía chequeo — estas tablas no tienen usuario en `auth.users`, así que no hay ninguna protección heredada. `resolverPersona()` es compartida por el wizard de alta (`crearAdministracion`), el cambio de propietario (`cambiarPropietario`, STORY-941) y el alta de inquilino al abrir legajo (`abrirLegajo`, STORY-941) — cubrir ahí cubre las 3 rutas de una sola vez.
- Efecto secundario encontrado: `guardarPersona`/`resolverPersona` no normalizaban el email a minúsculas (a diferencia de `tecnicos/service.ts`, que sí lo hacía) — "Juan@x.com" y "juan@x.com" se guardaban como registros distintos. Se corrigió para que la nueva unicidad no tenga ese agujero.

## Fix

- **`shared/utils/duplicados.ts`** (nuevo): helper único `duplicadoPersona(supabase, tabla, datos, excluirId?)` — recorre email/cuil/telefono, si el valor no está vacío consulta `SELECT id FROM <tabla> WHERE <campo> = valor` (excluyendo el propio id en updates) y devuelve un mensaje en español si ya existe. Constante `ERROR_DUPLICADO_DB` como mensaje de fallback si un alta concurrente cuela un duplicado entre el chequeo previo y el insert (lo atrapa el índice UNIQUE, código Postgres `23505`).
- **`features/tecnicos/service.ts`** (`altaTecnico`): chequeo `duplicadoPersona` antes de crear el usuario en Auth y antes del insert en `tecnicos`; fallback `23505` en el insert.
- **`features/cartera/service.ts`** (`guardarPersona`, `resolverPersona`): mismo chequeo antes de insert/update; email normalizado a minúsculas en ambas funciones; fallback `23505` en ambos inserts.
- **Migración SQL** (corrida manualmente por Giuliano en el SQL Editor de Supabase — no hay MCP activo en esta sesión): índices `UNIQUE` sobre `tecnicos`, `propietarios`, `inquilinos` en `email`, `cuil`, `telefono`. Los 3 campos ya se guardan como `NULL` cuando están vacíos (no `""`), así que un índice `UNIQUE` común alcanza — Postgres no considera duplicados dos `NULL`. El chequeo previo (Paso 1) encontró un duplicado real de datos de prueba: los técnicos Ramiro Zarate y Gastón Heredia tenían el mismo CUIL de relleno (`20399355681`) — se vació el de Gastón (`update tecnicos set cuil = null where id = 'e8f6c409-f305-47a4-a6cf-ad984aff1328'`) y se recorrió el Paso 1 limpio antes de crear los índices.

```sql
-- Paso 1: chequear que no haya duplicados existentes ANTES de crear los índices
-- (si alguna de estas 9 consultas devuelve filas, hay que resolver esos datos
-- a mano — fusionar o vaciar el campo repetido — antes de seguir al paso 2).
select 'tecnicos' tabla, 'email' campo, email valor, count(*) from tecnicos where email is not null group by email having count(*) > 1
union all select 'tecnicos', 'cuil', cuil, count(*) from tecnicos where cuil is not null group by cuil having count(*) > 1
union all select 'tecnicos', 'telefono', telefono, count(*) from tecnicos where telefono is not null group by telefono having count(*) > 1
union all select 'propietarios', 'email', email, count(*) from propietarios where email is not null group by email having count(*) > 1
union all select 'propietarios', 'cuil', cuil, count(*) from propietarios where cuil is not null group by cuil having count(*) > 1
union all select 'propietarios', 'telefono', telefono, count(*) from propietarios where telefono is not null group by telefono having count(*) > 1
union all select 'inquilinos', 'email', email, count(*) from inquilinos where email is not null group by email having count(*) > 1
union all select 'inquilinos', 'cuil', cuil, count(*) from inquilinos where cuil is not null group by cuil having count(*) > 1
union all select 'inquilinos', 'telefono', telefono, count(*) from inquilinos where telefono is not null group by telefono having count(*) > 1;

-- Paso 2: si el paso 1 no devolvió filas, crear los índices.
create unique index if not exists tecnicos_email_key on tecnicos (email);
create unique index if not exists tecnicos_cuil_key on tecnicos (cuil);
create unique index if not exists tecnicos_telefono_key on tecnicos (telefono);
create unique index if not exists propietarios_email_key on propietarios (email);
create unique index if not exists propietarios_cuil_key on propietarios (cuil);
create unique index if not exists propietarios_telefono_key on propietarios (telefono);
create unique index if not exists inquilinos_email_key on inquilinos (email);
create unique index if not exists inquilinos_cuil_key on inquilinos (cuil);
create unique index if not exists inquilinos_telefono_key on inquilinos (telefono);
```

## Criterios de aceptación

1. Al dar de alta un técnico (enrolamiento propio o alta manual del gestor) con un CUIL, email o teléfono que ya tiene otro técnico, se rechaza con mensaje claro ANTES de crear la cuenta.
2. Al dar de alta o editar un propietario/inquilino (wizard de administración, cambio de propietario, alta de inquilino al abrir legajo, ABM directo) con un dato repetido dentro de su misma tabla, se rechaza con mensaje claro.
3. Un técnico y un propietario/inquilino SÍ pueden compartir teléfono, email o CUIL entre sí (la unicidad es por tabla, no global).
4. Editar una persona existente sin cambiar sus datos (o cambiando solo un campo) no se autorrechaza por "duplicado con uno mismo".
5. Con la migración SQL aplicada, dos altas concurrentes con el mismo dato no pueden colar ambas — la segunda recibe el mensaje de `ERROR_DUPLICADO_DB`.
6. `tsc`/eslint verdes.

## Dev Agent Record

- **Archivos:** `codigo/shared/utils/duplicados.ts` (nuevo), `codigo/features/tecnicos/service.ts` (`altaTecnico`), `codigo/features/cartera/service.ts` (`guardarPersona`, `resolverPersona` + normalización de email a minúsculas).
- **Migración:** ver bloque SQL arriba — ejecutada por Giuliano en el SQL Editor de Supabase (no hay MCP vivo en esta sesión). Los 9 índices `UNIQUE` están creados; la garantía de concurrencia ya está activa.
- **Verificación:** `tsc --noEmit` y `eslint` limpios sobre los 3 archivos.
- **Nota de reconciliación:** este trabajo se hizo en paralelo a STORY-941/942/943 (Faustino) que tocó el mismo archivo `cartera/service.ts` (unificación de alta/edición de personas desde la propiedad). Se reconcilió por `git stash` + `git pull --ff-only` + resolución manual del conflicto en `guardarPersona`; `resolverPersona` fusionó sin conflicto y el chequeo de duplicados quedó cubriendo también los nuevos callers de STORY-941 (`cambiarPropietario`, `abrirLegajo`).
