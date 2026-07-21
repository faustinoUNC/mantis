# STORY-1025 — Horarios del técnico: vista arreglada y carga obligatoria al enrolarse (v1.0)

**Estado:** ✅ hecha (commit `158a74a`) · **Origen:** pedido directo de Fausti (2026-07-21): "arreglar vista de horarios del técnico y hacer que sea obligatorio que el técnico los ponga cuando se inscribe, así está desde el vamos en el sistema".

## Problema

1. **La vista** (`/tecnico/agenda`, `agenda.client.tsx`) es funcional pero floja: el "Borrar" es fire-and-forget (`:96` — sin `await`, sin estado, sin mensaje si falla), y se pueden cargar franjas que se pisan (9–18 y 10–12 el mismo día) porque el único freno es el `unique` de hora de inicio exacta.
2. **El registro no pide horarios**: `TecnicoForm` (`form-tecnico.client.tsx`) no tiene campo de franjas y `altaTecnico` (`tecnicos/service.ts:96-402`) nunca toca `franjas_disponibilidad`. El técnico nace sin horarios y el staff asigna viendo "sin horarios" (`detalle.client.tsx:377`) — salvo que al técnico se le ocurra entrar solo a la pestaña Horarios.

## Alcance

1. **Arreglo de la vista** (`agenda.client.tsx` + `tecnicos/service.ts`):
   - Borrar con `await`, estado "borrando" y error visible (mismo patrón que Agregar).
   - Validación de solapamiento al agregar (cliente y server): una franja nueva no puede pisar una existente del mismo día — error claro "Se pisa con la franja HH:MM–HH:MM".
   - `misFranjas()` filtra por `tecnico_id` explícito (defensa en profundidad, hoy descansa solo en RLS).
2. **Franjas obligatorias en el enrolamiento** (`form-tecnico.client.tsx` + `tecnicos/service.ts`):
   - Bloque "Horarios de trabajo" en el form: mismo widget día+desde+hasta de la agenda, franjas acumuladas en estado local con quitar; misma validación de solapamiento.
   - Obligatorio ≥1 franja para enviar (validación cliente y server, análoga a especialidades).
   - Las franjas viajan en el `FormData` como JSON y `altaTecnico` las inserta en `franjas_disponibilidad` tras el insert de `tecnicos` — también en el path de reapertura/reintento (reemplazando las que hubiera).
   - Aplica a ambos modos del form (enrolamiento público y alta manual del staff): el alta manual también deja al técnico con horarios desde el día uno.
3. **Técnicos existentes sin horarios**: no se fuerza nada (decisión de simplicidad, recomendación aceptada por Fausti al aprobar el plan) — siguen pudiendo cargarlos en su pestaña; el "sin horarios" del picker ya los delata.

## Fuera de alcance

- Edición de franjas (borrar y recrear alcanza para el volumen real).
- Excepciones por fecha / feriados / fases: el modelo semanal simple de STORY-304 no cambia.
- Validar que la asignación caiga dentro de una franja: los horarios siguen siendo informativos para el staff.

## Criterios de aceptación

1. En `/tecnico/agenda`, borrar una franja muestra estado y, si el server falla, un error visible; la lista queda consistente.
2. Agregar una franja que se pisa con otra del mismo día → error claro, no se inserta (ni en agenda ni en enrolamiento).
3. El form de registro público exige ≥1 franja: sin franjas no envía y lo dice; con franjas, el técnico aprobado ya aparece con su tira de días en el picker de asignación sin ningún paso extra.
4. El alta manual del staff también pide y guarda franjas.
5. Reintento de enrolamiento (correo ya usado en estado reabierble) conserva/reemplaza las franjas del intento nuevo.
6. Técnicos viejos sin franjas: todo sigue como hoy ("sin horarios" en el picker, agenda vacía editable).
7. `tsc` + eslint verdes; regresión del enrolamiento completo (fotos, matrículas, especialidades) intacta.

## Dev Agent Record

- **Commit:** `158a74a`.
- **Archivos:** `codigo/features/tecnicos/types.ts` (`FranjaNueva` + `errorFranja()` compartida cliente/server: fin > inicio + solapamiento); `codigo/features/tecnicos/service.ts` (`leerFranjas()` — parsea/valida el JSON del form: forma, día 0–6, `HH:MM`, solapamientos; `altaTecnico` exige ≥1 franja y las inserta en el alta nueva y en la reapertura (delete + insert); `misFranjas` con `.eq(tecnico_id)` explícito; `agregarFranja` valida solapamiento contra las existentes del día); `codigo/components/tecnicos/agenda.client.tsx` (borrar con `await` + estado "…" + error visible bajo el form); `codigo/components/tecnicos/form-tecnico.client.tsx` (bloque "Horarios de trabajo *" con día/desde/hasta + Agregar, lista con Quitar, validación local, `franjas` como JSON en el FormData, submit bloqueado sin ≥1 franja — aplica a enrolamiento Y alta manual).
- **Verificación:** `tsc --noEmit`, eslint y `next build` verdes. E2E navegador: **agenda** (tecnicouno) — agregar Lun 10–12 sobre Lun 09–18 → "Se pisa con tu franja de 09:00–18:00 del lunes." sin insertar; agregar Jue 10–12 ✅ y borrarla ✅ (botón con estado, lista consistente). **Registro público, viewport mobile 390×844** — enviar sin franjas → "Cargá al menos un horario de trabajo."; franja solapada en el widget → mismo error de pisado; con Lun 09–18 + Mié 10–12 el alta salió y las DOS franjas quedaron en `franjas_disponibilidad` del técnico pendiente (verificado por SQL); técnico de prueba borrado después (auth + storage + cascade, verificado en 0). Regresión del form (especialidades, DNI, CUIL duplicado) intacta.
