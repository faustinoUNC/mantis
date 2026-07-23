# STORY-1039 — Ampliación: elegir su pagador SIEMPRE + guard "se autoriza lo que se envió" (v1.0)

**Estado:** 🔨 en prueba · **Origen:** pedido de Fausti (2026-07-23) — dos cosas sobre la ampliación de presupuesto (STORY-1017/1038): (1) el guard de STORY-1037 (bloquear "aprobar" si cambiaste el pagador/fee después de enviar) debe existir también para la ampliación, hoy no; (2) el selector "¿quién paga la ampliación?" debe aparecer SIEMPRE, no solo cuando la obra base es compartida.

## Problema

1. **Sin guard en la ampliación:** el gestor puede enviar el aviso de ampliación a una parte, cambiar el selector de pagador y "Registrar autorización" igual — autoriza algo distinto a lo que recibió el pagador (mismo agujero que la STORY-1037 tapó en el presupuesto).
2. **Selector limitado (STORY-1038):** el pagador de la ampliación solo se podía re-elegir en obras compartidas. En una obra de pagador único no se podía decir "esta ampliación la paga la otra parte / se comparte".

## Decisión de diseño

**El reparto del cobro se generaliza: ya no asume que la obra es compartida.** La obra base va a su pagador (inquilino / propietario / compartido por %) y cada ampliación con pagador propio al suyo. Consecuencia clave: **una obra de pagador único con una ampliación atribuida a la otra parte se cobra DIVIDIDA** (dos notas, dos cobros — reusa toda la maquinaria de STORY-1036). El disparador del flujo dividido deja de ser `pagador === "compartido"` y pasa a ser **`esRepartido` = ambas partes deben plata** (un solo helper).

- **Helper único `repartoGestion(total, obraPagador, obraPct, ampliaciones)`** (reemplaza a `repartoCompartido`): base = total − Σ ampliaciones de pagador propio; base al pagador de la obra (por % si compartido) + cada ampliación a su pagador. `esRepartido(...)` = ambos montos > 0. Usado por nota/PDF, card de facturación, cobro por partes, lista de Cobros e historial de cartera.
- **`datosDocumento` (nota):** los destinatarios se resuelven por quién DEBE plata (no por el pagador de la obra) — una parte, o las dos. Se resuelven ambos contactos siempre.
- **Selector SIEMPRE (`AmpliacionGestor` + `enviarAmpliacionEmail`):** en cualquier obra el gestor elige quién paga la ampliación al enviarla; default heredado del pagador de la obra. Se ancla `pagador`/`pct` en la fila al enviar (siempre, no solo compartida).
- **Guard (espejo STORY-1037):** `terminosCambiados` = ya enviada Y el pagador/pct en pantalla difiere del anclado → "Registrar autorización" deshabilitado con aviso "reenviá antes de autorizar". El server ya autoriza contra lo anclado (resolverAmpliacion no reescribe el pagador desde el cliente).

## Fuera de alcance

- Cambiar cómo el técnico solicita la ampliación (monto + motivo).
- Mostrar % en las superficies de pago (se sacaron en STORY-1038 v1.1 — se muestran montos).
- Tocar el guard/aprobación del presupuesto (STORY-1037, intacto).

## Criterios de aceptación

1. En CUALQUIER obra (compartida o de pagador único), al enviar una ampliación aparece "¿Quién paga esta ampliación?" con el pagador de la obra por defecto; se puede cambiar a inquilino, propietario o compartido con %.
2. Obra de pagador único (ej. propietario) + ampliación atribuida al inquilino → la gestión se cobra DIVIDIDA: dos notas (cada parte con su monto), dos cobros independientes, la etapa espera a los dos; Finanzas → Cobros muestra "Falta el X" y una fila por parte. La obra base la sigue pagando el pagador original; solo la ampliación va a la otra parte.
3. Guard: enviada la ampliación, si el gestor cambia quién la paga, "Registrar autorización" se deshabilita con el aviso de reenviar; al reenviar se re-habilita.
4. El email de la ampliación va a la(s) parte(s) correcta(s) según su pagador, con el monto de cada una.
5. Regresión: obra compartida → igual que STORY-1036/1038 (ampliación heredada o con pagador propio); obra de pagador único SIN ampliación de otra parte → un cobro, como siempre; historial de la propiedad reparte bien. `tsc`/eslint verdes.

## Dev Agent Record

- **Commit:** `a937398` (2026-07-23).
- **Implementación (2026-07-23):** 8 archivos, cero migraciones (reusa las columnas de STORY-1038).
  - `features/finanzas/consultas-types.ts`: `repartoCompartido` → **`repartoGestion(total, obraPagador, obraPct, ampliaciones)`** (la obra base a su pagador + cada ampliación al suyo) + **`esRepartido(...)`** (ambas partes deben plata) + tipo `PagadorObra`.
  - `features/finanzas/service.ts`: `datosDocumento` reescrito — resuelve ambos contactos y elige destinatario(s) por quién DEBE plata (nota), no por el pagador de la obra; `registrarCobro` usa `esRepartido` (antes `pagador === "compartido"`); `enviarAmpliacionEmail` acepta y ancla el pagador de la ampliación SIEMPRE (removido el gate de obra compartida).
  - `components/gestiones/finanzas.client.tsx`: helper `cobroDividido()` + `repartoGestion` en las 3 ramas del cobro y la vista del reparto.
  - `components/gestiones/detalle.client.tsx` (`AmpliacionGestor`): selector SIEMPRE visible; default heredado / anclado; **guard `terminosCambiados`** deshabilita "Registrar autorización" con aviso si cambiás el pagador tras enviar.
  - `app/gestiones/[id]/page.tsx`: pide `cobrosParciales` en facturación para cualquier gestión (devuelve [] si no es dividido).
  - `features/finanzas/consultas.ts`: la lista de Cobros arma filas por parte / "Falta el X" según los eventos con `parte` (no según `pagador === "compartido"`).
  - `features/cartera/historial.ts` (`parteObra`) + `service.ts` + `resumen-pdf.tsx`: reparto vía `repartoGestion` para cualquier obra; se traen las ampliaciones de pagador propio de todas las obras.
- **Verificación (2026-07-23, `tsc`+eslint verdes, E2E navegador como admin):**
  - Caso nuevo (#208, obra **propietario** $290.000 + ampliación **inquilino** $90.000): cobro DIVIDIDO — inquilino $90.000, propietario $200.000 (suma $290.000); dos notas, dos cobros, "Total a cobrar al inquilino y propietario" ✓.
  - Guard (#119): estado inicial con autorización habilitada; cambiar el pagador de la ampliación → "Registrar autorización" deshabilitado + aviso "Cambiaste quién paga…"; reenviar → re-habilitado, aviso desaparece ✓; selector visible.
  - Regresión: obra de pagador único SIN ampliación divergente (#164) → una nota, un cobro; obra compartida (#93) → sigue dividida ($153.600 / $230.400). Datos de prueba sembrados y borrados.
