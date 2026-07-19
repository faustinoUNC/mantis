# STORY-1008 — Bug: el campo Nombre aceptaba números (v1.0)

**Estado:** 🟡 implementado, falta `tsc`/`eslint` + E2E (sin Node en este entorno) · **Origen:** reportado por Fausti (2026-07-19): en propietarios, inquilinos y empleados el campo "Nombre" aceptaba cualquier número — no había ninguna validación de formato, solo de "no vacío".

## Causa raíz

Ningún flujo de alta/edición de nombre de persona (propietario, inquilino, empleado, técnico) validaba el formato del campo `nombre`: ni cliente ni server. La única validación existente era presencia (`required` / `!x.nombre.trim()`), heredada de cuando el campo se trataba como texto libre sin reglas. El teléfono y el CUIL sí tenían validadores dedicados (`shared/utils/telefono.ts`, `shared/utils/cuil.ts`) con el mismo patrón: `errorX(valor)` llamado en cliente y server — al nombre nunca se le hizo el mismo tratamiento.

## Alcance

1. **Util nuevo** `codigo/shared/utils/nombre.ts` — `errorNombre(valor, etiqueta = "nombre")`: rechaza vacío, rechaza cualquier dígito (mensaje específico "no puede tener números"), y rechaza otros símbolos fuera de letras/espacios/guiones/apóstrofes. Mismo molde que `errorTelefono`/`errorCuil`.
2. **Server** (rechazo real — es la defensa que importa): se agrega `errorNombre()` antes de insertar/actualizar en los 6 puntos de escritura:
   - `features/cartera/service.ts`: `guardarPersona()` (propietario/inquilino, alta y edición desde el detalle de propiedad) y `resolverPersona()` (propietario/inquilino nuevo desde el wizard de administración / abrir legajo / cambiar propietario).
   - `features/empleados/service.ts`: `crearEmpleado()` y `editarEmpleado()`.
   - `features/tecnicos/service.ts`: `altaTecnico()` (compartida por alta manual del staff y enrolamiento público) y `editarDatosTecnico()`.
   - De paso: el nombre ahora se persiste con `.trim()` en todos estos puntos (antes se guardaba tal cual, con espacios sueltos si el usuario los dejaba).
3. **Cliente** (feedback inmediato): mismo `errorNombre()` en la validación de cada formulario antes de enviar, más filtro `onChange` que descarta dígitos mientras se tipea (mismo patrón que el filtro de Teléfono) en:
   - `components/cartera/persona-campos.client.tsx` (`CamposPersona`, `validarPersona`, `FormEditarPersona`) — cubre TODOS los flujos de propietario/inquilino (wizard, cambiar propietario, abrir legajo, edición inline).
   - `components/empleados/empleados.client.tsx` (alta y edición inline).
   - `components/tecnicos/form-tecnico.client.tsx` (alta manual + enrolamiento público) y `components/tecnicos/datos-tecnico.client.tsx` (edición nombre/CUIL).

## Fuera de alcance

- No se agrega constraint en DB (Regla #0 + patrón ya establecido con teléfono/CUIL: la validación vive en la app).
- No se re-valida ni corrige el dato histórico ya guardado con números (nadie reportó un caso real corrompido; si aparece, se corrige puntual).
- Nombres de especialidades u otros campos de texto libre no relacionados a personas: fuera de alcance, no fue lo pedido.

## Criterios de aceptación

1. Alta de propietario/inquilino (cualquiera de los 3 flujos: wizard, cambiar propietario, abrir legajo) con un número en el nombre → error claro, no se guarda.
2. Alta y edición de empleado con un número en el nombre → error claro, no se guarda.
3. Alta de técnico (manual y enrolamiento público) y edición de nombre/CUIL de técnico con un número en el nombre → error claro, no se guarda.
4. Nombres válidos con tildes, ñ, apóstrofes y guiones (ej. "José María O'Connor-Núñez") siguen funcionando sin falsos positivos.
5. El filtro del input descarta dígitos mientras se tipea (no hace falta esperar al submit para darse cuenta).
6. `tsc`/eslint verdes.

## Dev Agent Record

- **Archivos:** `codigo/shared/utils/nombre.ts` (nuevo), `codigo/features/cartera/service.ts`, `codigo/features/empleados/service.ts`, `codigo/features/tecnicos/service.ts`, `codigo/components/cartera/persona-campos.client.tsx`, `codigo/components/empleados/empleados.client.tsx`, `codigo/components/tecnicos/form-tecnico.client.tsx`, `codigo/components/tecnicos/datos-tecnico.client.tsx`.
- **Verificación:** no se pudo correr `tsc`/`eslint` en este entorno (sin Node/npm instalado) — revisión manual del diff. **Pendiente: correr `tsc`/`eslint` y probar E2E en navegador** (los 6 flujos de alta/edición listados arriba).
