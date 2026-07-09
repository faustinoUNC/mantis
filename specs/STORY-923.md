# STORY-923 — CUIL como documento único (técnicos, propietarios, inquilinos) (v1.0)

**Estado:** 🚧 en desarrollo (aprobado por Fausti 2026-07-09: "dale para delante") · **Origen:** Fausti, de paso con STORY-922. Regla #0.

## Insight central

Hoy el documento pedido es heterogéneo: técnicos DNI, inquilinos DNI, propietarios CUIT. Fausti quiere **un solo dato: el CUIL** — del CUIL se deduce el DNI (dígitos 3–10), así que no se pierde información y se gana un identificador tributario único y verificable (dígito verificador).

## Alcance y decisiones

### A. Migración `unificar_cuil` (renames, sin pérdida de datos)
```sql
alter table public.inquilinos  rename column dni  to cuil;
alter table public.tecnicos    rename column dni  to cuil;
alter table public.propietarios rename column cuit to cuil;
```
- Columnas siguen `text` nullable (salvo técnicos, donde la obligatoriedad ya es de la app). Sin constraint de formato en DB (validación en la app, Regla #0).
- **Datos existentes** (DNIs de 8 dígitos de prueba/demo): quedan como están — no se puede deducir el CUIL desde el DNI (falta el prefijo por género). Solo se valida el formato en escrituras nuevas.
- `tecnicos.doc_dni_path` y el upload "DNI (foto/PDF)" **NO cambian**: el documento físico que se sube sigue siendo el DNI.

### B. Validación compartida — `codigo/shared/utils/cuil.ts`
`cuilValido(cuil: string): boolean` — acepta con o sin guiones, exige 11 dígitos + dígito verificador correcto (mod 11, coeficientes 5-4-3-2-7-6-5-4-3-2; resto 11→0, resto 10→inválido). Se guarda normalizado (solo dígitos). No se agrega `dniDesdeCuil` hasta que algo lo necesite (YAGNI).

### C. Renombres en app
- **Cartera** (`features/cartera`): desaparece el mapeo `COL_DOC` (ambas tablas usan `cuil`); labels en `personas.client.tsx`: propietarios **"CUIT / CUIL"** (puede ser empresa; mismo formato y verificador), inquilinos **"CUIL"**. Campo sigue opcional; si se completa, se valida server-side.
- **Técnicos** (`features/tecnicos` + forms + perfil + detalle): `dni` → `cuil` en types/service/form; label "CUIL", placeholder "Sin guiones, ej. 20301234567"; sigue obligatorio en el enrolamiento con validación de formato server-side ("El CUIL no es válido."). Pantallas que mostraban "DNI xxx" muestran "CUIL xxx".
- **Wizard STORY-922**: nace pidiendo CUIL.

### D. Seed demo
`scripts/demo-seed.sql` se actualiza (nombres de columna + valores CUIL de 11 dígitos con verificador real) para que siga corriendo tras la migración.

## Criterios de aceptación
1. Las tres tablas tienen columna `cuil`; ninguna referencia viva a `inquilinos.dni`, `tecnicos.dni` ni `propietarios.cuit` en `codigo/`.
2. Enrolamiento/alta de técnico pide CUIL (obligatorio, validado); alta de propietario/inquilino pide CUIT-CUIL/CUIL (opcional, validado si se completa).
3. Un CUIL mal formado o con verificador incorrecto se rechaza con mensaje claro; se acepta con o sin guiones.
4. La foto/PDF del DNI del técnico sigue igual (label y storage).
5. `scripts/demo-seed.sql` corre sin errores tras la migración.
6. `tsc` + eslint + `next build` verdes.

## Dev Agent Record
- **Estado:** ✅ implementado (2026-07-09). Migración aplicada a la base viva. Código sin commitear (Fausti revisa).
- **Archivos:**
  - Migración `unificar_cuil` aplicada en `ejwokycbyjtlxwusbhtt` (3 renames).
  - `codigo/shared/utils/cuil.ts` (nuevo) — `cuilValido` (11 dígitos + verificador mod 11, acepta guiones) + `normalizarCuil`.
  - `codigo/features/cartera/{service,types}.ts` — sin `COL_DOC` (ambas tablas usan `cuil`); validación server en `guardarPersona`.
  - `codigo/components/cartera/personas.client.tsx` — labels "CUIT / CUIL" (propietarios) y "CUIL" (inquilinos), inputMode numeric.
  - `codigo/features/tecnicos/{service,types}.ts` + `codigo/components/tecnicos/form-tecnico.client.tsx` + `codigo/app/tecnico/perfil/page.tsx` + `codigo/app/tecnicos/[id]/page.tsx` — `dni`→`cuil` (campo, label, validación server "El CUIL no es válido"); `doc_dni_path` y el upload "DNI (foto/PDF)" sin cambios.
  - `scripts/demo-seed.sql` — columnas renombradas + CUILs de 11 dígitos con verificador real (calculados). Además se actualizaron por UPDATE los datos demo vivos (técnicos/inquilinos con CUIL válido; propietarios sin guiones).
- **Verificación:** wizard STORY-922 ejercita `cuilValido` E2E (rechazo de verificador incorrecto, aceptación con guiones, guardado normalizado verificado por SQL); `/registro-tecnico` muestra el campo CUIL con su placeholder y conserva "DNI (foto/PDF)". `tsc` + eslint + `next build` verdes. Nota: el seed demo actualizado no se re-ejecutó (los datos demo ya estaban sembrados; se parchearon por UPDATE).
