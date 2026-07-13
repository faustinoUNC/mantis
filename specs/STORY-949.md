# STORY-949 — Alta de administración sin inquilino + legajos solo para inquilinos libres (v1.0)

**Estado:** ✅ done · **Origen:** dos cards de Trello en "Pendiente - Bugs":
- #77: *"Al crear una nueva administración se debería cambiar a pedir solo los datos del propietario y los de la vivienda y luego de darle el alta, pedir que se cargue el inquilino por separado."*
- #76: *"Al momento de abrir un legajo, el desplegable de inquilinos solo contendrá inquilinos sin legajo abierto."*

## Problema

El wizard de alta (STORY-922) creaba propietario + propiedad + inquilino + legajo con
inserts secuenciales sin transacción, y el inquilino se validaba en el server **después**
de insertar propietario y propiedad. Si el dato del inquilino estaba mal (p. ej. CUIL
duplicado — invisible para la validación client-side), la administración quedaba creada
SIN inquilino y el reintento chocaba con "ya hay un propietario con ese email/CUIL",
porque el propietario ya se había insertado en el intento anterior.

Además, el desplegable de "abrir legajo" mostraba TODOS los inquilinos activos, incluso
los que ya tienen un legajo vigente en otra propiedad.

## Solución (la simple: achicar el alta, no transaccionarla)

En vez de envolver los 4 inserts en un RPC, el alta deja de tocar al inquilino:

1. **Wizard de 3 pasos** — Propietario → Propiedad → Confirmar. Desaparece el paso
   "Ocupación" (y con él el estado `ocupada`, el selector de inquilino y la fecha de
   inicio). Toda propiedad entra desocupada. Al confirmar, se redirige (como ya se
   hacía) al detalle de la propiedad, donde la card "Propiedad libre" invita a abrir
   el legajo — ese ES el paso siguiente guiado.
2. **`crearAdministracion` sin parámetro `inquilino`** — queda: validar dirección →
   `resolverPersona("propietarios")` → insert de `propiedades`. El único fallo parcial
   posible (propietario guardado, propiedad falla) sigue siendo un estado válido y el
   mensaje lo dice. Sin RPC, sin migración.
3. **Desplegable de legajos filtrado** — nueva `listarInquilinosSinLegajo()`: inquilinos
   activos que NO figuran en ningún legajo con `fecha_fin IS NULL`. El detalle de la
   propiedad se la pasa a `<Legajos>` en lugar de `listarPersonas("inquilinos")`.
4. **Defensa server-side en `abrirLegajo`** — si el inquilino elegido es uno existente,
   se chequea que no tenga legajo vigente antes de insertar ("Ese inquilino ya tiene un
   legajo vigente en otra propiedad."). Cubre pestañas viejas/carreras sin migración
   (no se agrega unique parcial por inquilino: el chequeo de app alcanza para el riesgo
   real, Regla #0).

## Archivos

- `codigo/features/cartera/service.ts` — `crearAdministracion` (sin inquilino),
  `listarInquilinosSinLegajo()` nueva, `abrirLegajo` (chequeo de legajo vigente).
- `codigo/components/cartera/alta-administracion.client.tsx` — 3 pasos, sin
  `OpcionOcupacion` ni estados de inquilino; copy actualizado.
- `codigo/app/cartera/nueva/page.tsx` — ya no carga inquilinos.
- `codigo/app/cartera/propiedades/[id]/page.tsx` — usa `listarInquilinosSinLegajo()`.

## Criterios de aceptación

1. El wizard tiene 3 pasos y en ningún momento pide datos de inquilino.
2. Crear una administración con un dato de propietario duplicado NO deja nada creado
   (el propietario se valida/insertá primero y es el único insert previo a la propiedad).
3. Al crear la administración se aterriza en el detalle de la propiedad con la card
   "Propiedad libre — abrí un legajo cuando entre un inquilino" visible.
4. En "abrir legajo", el desplegable solo lista inquilinos activos sin legajo vigente
   (en ninguna propiedad). Si no queda ninguno, el selector arranca en "Cargar
   inquilino nuevo".
5. Elegir (vía pestaña vieja) un inquilino que ya tiene legajo vigente es rechazado por
   el server con mensaje claro.
6. `tsc`/eslint verdes.

## Dev Agent Record

- **Commit:** 4c7e3a8 (renumerada de 948 a 949 antes de pushear: Giuliano tomó el 948 en paralelo — tercera colisión).
- **Verificación:** `tsc --noEmit` + `eslint` limpios. E2E con Playwright sobre el
  dev server (datos de prueba borrados después):
  - Wizard de 3 pasos; alta con propietario nuevo → aterriza en el detalle con la
    card "Propiedad libre" y el form de abrir legajo.
  - Desplegable de legajos = exactamente los 4 inquilinos activos sin legajo
    vigente según SQL (de 13 activos); tras abrir un legajo, el inquilino
    desaparece del desplegable en otras propiedades.
  - Pestaña vieja que todavía ofrecía a un inquilino ya ocupado → el server
    rechaza con "Ese inquilino ya tiene un legajo vigente en otra propiedad."
  - Alta con email de propietario duplicado → "Ya hay un propietario registrado
    con ese email." y CERO filas creadas (el bug original quedaba con
    administración a medias).
