# STORY-1029 — El adelanto del saliente es asunto interno: el técnico entrante no lo ve, y los carteles se entienden (v1.0)

**Estado:** ✅ done · **Origen:** card Trello #149 (2026-07-21, https://trello.com/c/8VQ4EtdT) + comentario de Fausti en la card sobre la UI del cartel ("no se entiende absolutamente nada, no es estético, no va con el sistema, debe ser más simple, más visual, no tanto texto").

## Problema

STORY-1014 creó la constancia del adelanto entregado a un técnico que salió de la gestión, y STORY-1019 el saldado manual. Dos problemas detectados en prueba:

1. **El técnico entrante ve la plata del saliente.** La vista del técnico ("Mis trabajos") linkea al mismo detalle `/gestiones/[id]` que usan los gestores, y ahí la contabilidad del adelanto se muestra sin filtro de rol:
   - La caja de constancia en la card de datos (`DatosGestion`) se renderiza para TODOS los roles — `esAdministrativo` solo gatea el botón "Marcar saldada", no la caja.
   - La línea de tiempo **Actividad** imprime "Adelanto al saliente: $X · Devuelto/ajustado en el acto: $Y" (`detalleLegible`, `eventos.ts`) y los eventos `adelanto_saldado` con su nota, también sin filtro.

   La plata entre la inmobiliaria y el saliente es un arreglo interno (principio de STORY-1014: "la recuperación es un asunto humano inmobiliaria↔técnico") — al entrante no le incumbe y verlo genera ruido y desconfianza.

2. **Los carteles ámbar son párrafos ilegibles.** Tanto la caja del modal de desasignación como la constancia son prosa corrida que mezcla nombre, montos, fechas y estado en una sola oración con incisos — el dato accionable (cuánto queda pendiente) está enterrado, sin jerarquía, y fuera del lenguaje visual del sistema (que comunica con badges y pares label/valor).

## Alcance

1. **Filtro por rol técnico** (`detalle.client.tsx`): con `usuario.rol === "tecnico"`:
   - La caja de constancia de `DatosGestion` no se renderiza (entera: desasignaciones, cancelada con adelanto y sobrantes — todo es contabilidad interna).
   - En `Actividad`, los eventos `adelanto_saldado` se omiten, el evento de desasignación se muestra sin `adelanto_saliente` ni `devolucion_adelanto` (el motivo y el nombre del saliente se siguen viendo — eso sí le da contexto de la obra), y los eventos `adelanto_materiales_registrado` anteriores a la última desasignación se omiten enteros (montos + comprobante son plata del saliente; los adelantos PROPIOS del técnico solo pueden existir después de esa fecha y se siguen viendo — STORY-977).
   - Es presentación (los eventos siguen viajando al cliente): no es un secreto de seguridad sino prolijidad de roles — Regla #0, sin tocar queries ni RLS.
2. **Rediseño de los dos carteles** con tokens del contract (`urgente-soft`/`urgente-fuerte`, `Badge`, montos en mono):
   - **Modal de desasignación**: fila "Adelanto en su mano" + monto en mono a la derecha; una línea corta de contexto; el campo de devolución debajo. Muere el párrafo de tres renglones.
   - **Constancia en datos**: un bloque por constancia con encabezado (nombre del técnico + contexto corto + badge de estado: "A resolver" urgente / "Saldado" neutro) y montos como pares label/valor (Adelanto / Devolvió en el acto / Pendiente — Pendiente solo si sigue abierto). La nota del saldado queda como línea secundaria. "Marcar saldada" sigue igual (solo administrativo).

## Fuera de alcance

- Sin cambios de datos, DB, RLS ni queries — todo presentacional.
- El campo de devolución del modal es de STORY-1030 (misma pantalla, otro bug).
- La pestaña Adelantos de Finanzas y el perfil del técnico staff (STORY-1019) no cambian — ya son vistas solo-staff.

## Criterios de aceptación

1. Técnico asignado a una gestión con desasignación previa con adelanto: no ve la caja de constancia, y en Actividad ve "Técnico desasignado" con motivo/saliente pero SIN montos de adelanto, SIN eventos de saldado y SIN los "Adelanto de materiales registrado" del saliente; sus adelantos propios (posteriores) sí aparecen.
2. Admin/gestores ven la constancia rediseñada: badge de estado, montos label/valor, nota del saldado como línea secundaria; "Marcar saldada" solo para administrativo, como hoy.
3. El modal de desasignar con adelanto muestra el cartel nuevo (monto destacado, texto mínimo); sin adelanto, el modal queda como hoy.
4. Regresión: cancelada con adelanto y sobrante de liquidación siguen apareciendo en la constancia (rediseñadas); Auditoría (que también usa `detalleLegible`) no cambia; `tsc`/eslint verdes.

## Dev Agent Record

- **Commit:** `9dc4e02` (2026-07-21, conjunto con STORY-1030).
- **Archivos:** `codigo/components/gestiones/detalle.client.tsx` — helper `MontoConstancia`, prop `esTecnico` en `DatosGestion` (gate de la caja entera) y en `Actividad` (omite `adelanto_saldado`, quita `adelanto_saliente`/`devolucion_adelanto` del evento de desasignación y omite los `adelanto_materiales_registrado` anteriores a la última desasignación); rediseño de la constancia (encabezado nombre+contexto+`Badge` A resolver/Saldado, montos label/valor, nota del saldado como línea secundaria) y del cartel del modal ("Adelanto en su mano" + monto, contexto en una línea).
- **Verificación:** `tsc`/eslint verdes. E2E navegador (gestión #108 `[DEMO]`, adelanto $700.000 de Ramiro Zarate): desasignado como Admin con devolución $150.000 → constancia nueva "Ramiro Zarate · desasignado · [A resolver]" con Adelanto/Devolvió/Pendiente ($550.000 en ámbar) y "Marcar saldada"; Actividad staff completa ("Adelanto al saliente: $700.000 · Devuelto/ajustado: $150.000"). Como Tecnico Uno (solicitud de asignación pendiente): cero apariciones de constancia, montos del saliente, saldados o adelantos registrados previos — sí ve "Técnico desasignado" con el motivo y el CTA de aceptar. "Marcar saldada" con nota → badge "Saldado", fila Pendiente desaparece, línea "Saldado el 21/7, 20:03 — …" y evento en Actividad staff.
