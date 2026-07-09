# STORY-922 — Alta unificada "Administración" (wizard de cartera) (v1.2)

**Estado:** 🚧 en desarrollo (aprobado por Fausti 2026-07-09: "dale para delante") · **Origen:** Fausti. Regla #0: la solución más simple que cumpla. Contract "Esmeralda técnica".

## Insight central

Hoy dar de alta una administración real exige tres pantallas en orden correcto (propietario → propiedad → detalle → abrir legajo). El dominio es uno solo: **una Administración = una propiedad + su propietario (obligatorios) + un inquilino (opcional**, porque la propiedad puede entrar desocupada o quedar desocupada**)**.

**Análisis de impacto (hecho antes de esta spec): el modelo de datos actual YA expresa exactamente eso.** `propiedades.propietario_id` es NOT NULL, el inquilino se vincula por `legajos` (unique vigente por propiedad) y `gestiones.legajo_id` ya es nullable (propiedad desocupada soportada en gestiones, emails y resumen de obras). Por lo tanto:

- **PROHIBIDO crear una entidad/tabla `administraciones`** — duplicaría la verdad y tocaría FKs, RLS, métricas, PDF y emails. La "Administración" es un **flujo de UI** (wizard) sobre las tablas existentes.
- **Sin migraciones.** Cero cambios en gestiones, métricas, RLS, resumen de obras, emails.
- **Todo estado intermedio es un estado válido del dominio** (propietario sin propiedades ✔, propiedad sin legajo = desocupada ✔) → no hace falta RPC transaccional; inserts secuenciales en una server action alcanzan. El legajo recién abierto no puede chocar con el unique (la propiedad es nueva).

## Alcance y decisiones

### A. Wizard "Nueva administración" en `/cartera/nueva`
Ruta bajo el layout de cartera existente (guard staff + tabs ya resueltos). 4 pasos chicos con stepper visible, un paso por card, `animate-aparecer`, tokens del contract:

1. **Propietario** — segmentado "Elegir existente / Cargar nuevo": select de propietarios activos **o** los 4 campos inline (nombre, email, teléfono, CUIT/CUIL). Evita duplicados de personas (riesgo real: no hay unique en email/documento).
2. **Propiedad** — dirección con **autocompletado de sugerencias** (v1.1, pedido de Fausti: práctica estándar — no buscar en el mapa con cada tecleo): al tipear aparecen debajo del input hasta 5 direcciones sugeridas (geocoder **Photon/OSM**, gratuito y sin API key — coherente con la decisión de STORY-205 de no usar key de Google; sesgo a Córdoba, filtro Argentina, debounce). Al **clickear una sugerencia** se completa el input y recién ahí el mapa se ubica en el punto exacto (lat/lon, más preciso que la búsqueda por texto). El usuario puede después completar piso/depto a mano sin que el pin se pierda. + tipo (opcional).
3. **Ocupación** — pregunta clara "¿Está alquilada hoy?" (toggle Sí/No). Si **sí**: inquilino (elegir existente / cargar nuevo) + fecha de inicio del legajo. Si **no**: texto guía "Queda registrada como desocupada; abrís el legajo desde la propiedad cuando entre un inquilino."
4. **Confirmar** — resumen legible (propietario · dirección · inquilino o "Desocupada") + botón "Crear administración".

Validación por paso antes de avanzar (no se descubre el error al final). Al crear: redirect al detalle de la propiedad (`/cartera/propiedades/[id]`), donde ya se ve el legajo vigente.

### B. Server action `crearAdministracion` (features/cartera/service.ts)
Payload: propietario (`{id}` existente **o** datos nuevos), propiedad (`direccion`, `tipo`), inquilino opcional (`{id}` o datos nuevos + `fecha_inicio`). Inserts secuenciales: propietario (si es nuevo) → propiedad → inquilino (si es nuevo) → legajo. Si un paso posterior falla, lo ya creado es un estado válido; el error dice qué quedó hecho y cómo seguir ("La propiedad quedó creada; abrí el legajo desde su detalle."). Devuelve `propiedadId`.

### C. El wizard es EL camino de alta
- En el listado de Propiedades, el botón "Nueva propiedad" (form inline) se **reemplaza** por un link "Nueva administración" → `/cartera/nueva`. Se elimina el `Formulario` inline de `propiedades.client.tsx` (un solo camino de alta, no dos).
- `guardarPropiedad` queda solo si lo usa otra cosa; si queda huérfano, se elimina (código sin uso = código que sobra).
- Los ABMs de Propietarios/Inquilinos **quedan como están** (edición, desactivar, alta suelta si hace falta). La rotación de inquilinos (cerrar/abrir legajo) sigue en el detalle de la propiedad.

### D. Naming
"Administración" en la UI (label del botón, título del wizard). La ruta es `/cartera/nueva` — NO `/administracion`, que ya es el home del gestor administrativo (colisión detectada en el análisis).

## Criterios de aceptación
1. Desde Cartera → Propiedades, "Nueva administración" lleva a `/cartera/nueva`.
2. El wizard permite crear en un solo flujo: propietario (existente o nuevo) + propiedad + opcionalmente inquilino (existente o nuevo) con legajo vigente desde la fecha indicada.
3. Con "¿Está alquilada hoy?" en No, la propiedad queda desocupada y el paso de inquilino se salta.
4. Cada paso valida antes de avanzar; el resumen final muestra lo que se va a crear.
5. Al confirmar, redirige al detalle de la propiedad con el legajo vigente visible (si lo hay).
6. Sin migraciones ni tabla nueva; gestiones/métricas/emails/PDF intactos.
7. Estética 100% contract (stepper, cards, un acento un significado); mobile OK.
8. `tsc` + eslint + `next build` verdes.

## Dev Agent Record
- **Estado:** ✅ implementado y verificado E2E en navegador (2026-07-09). Sin commitear (Fausti revisa).
- **Archivos:**
  - `codigo/components/cartera/alta-administracion.client.tsx` (nuevo) — wizard 4 pasos: stepper clickeable hacia atrás, segmentado existente/nuevo, cards de ocupación, resumen con "Cambiar" por fila.
  - `codigo/app/cartera/nueva/page.tsx` (nuevo) — carga propietarios/inquilinos activos.
  - `codigo/features/cartera/service.ts` — `crearAdministracion` + helper `resolverPersona`; se eliminó `guardarPropiedad` (quedaba huérfano al sacar el form inline).
  - `codigo/features/cartera/types.ts` — type `RefPersona` (`{id}` | `{nueva}`).
  - `codigo/components/cartera/propiedades.client.tsx` — form inline "Nueva propiedad" reemplazado por link "Nueva administración" → `/cartera/nueva`; `PropiedadesAbm` ya no recibe `propietariosActivos` (simplificado también `app/cartera/propiedades/page.tsx`).
- **Micro-decisiones:** (a) ~~mapa con debounce al tipear~~ → **v1.1: autocompletado de sugerencias** (pedido de Fausti): nuevo `components/ui/buscador-direccion.client.tsx` (Photon/OSM sin key, debounce 400ms, filtro AR + sesgo Córdoba, dropdown bajo el input); el mapa aparece SOLO al elegir una sugerencia (`MapaDireccion` ganó prop opcional `punto`); agregar piso/depto a mano después no re-abre sugerencias ni pierde el pin; si el geocoder no encuentra (o no hay red), el campo sigue siendo texto libre y se puede guardar igual; (b) el error de validación se limpia al elegir opción de ocupación o cambiar el segmentado (no quedaba "pegado"); (c) orden de pasos Propietario→Propiedad→Ocupación (narrativa "un propietario nos da una propiedad").
- **v1.2 — fix de alturas** (bug reportado por Fausti con "miguel potel junot 6148"): OSM no tiene muchas alturas de Córdoba → la sugerencia era la calle sola y al clickearla se PERDÍA el número tipeado. Ahora: (1) si la sugerencia es una calle y el usuario tipeó una altura (último número del texto), la etiqueta la conserva ("Miguel Potel Junot **6148**, Córdoba"); (2) esas sugerencias van marcadas `exacta: false` y el mapa busca el TEXTO completo en Google (que sí interpola alturas argentinas) en vez del centro de la calle de OSM; con altura exacta en OSM (`housenumber`) sigue el pin por lat/lon; (3) se filtran paradas de colectivo y andenes (`osm_value` bus_stop/platform) que ensuciaban la lista. Verificado en navegador: la sugerencia conserva 6148 y el pin cae en la cuadra correcta.
- **Verificación (Playwright sobre dev server, base viva):** camino feliz completo con propietario nuevo + CUIL con guiones + inquilino nuevo → redirect al detalle con legajo Vigente; camino desocupada con propietario existente → propiedad "Libre" en el listado; probes: paso 1 vacío, CUIL con verificador incorrecto, paso 3 sin elegir — los tres con mensaje claro y sin avanzar. CUIL guardado normalizado (verificado por SQL). Datos [PRUEBA] borrados al terminar. `tsc` + eslint + `next build` verdes.
