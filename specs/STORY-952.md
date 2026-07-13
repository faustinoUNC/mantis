# STORY-952 — Buscador de direcciones: las sugerencias que coinciden con lo tipeado van primero (v1.0)

**Estado:** ✅ done · **Origen:** card Trello #74: *"Revisar funcionamiento de
buscador google maps"*.

## Diagnóstico

El buscador (`components/ui/buscador-direccion.client.tsx`, STORY-205/922) usa
**Photon** (geocoder de OpenStreetMap, gratuito y sin API key) — no Google.
Funciona (probado en vivo: responde 200 en ~1s), pero el **ranking de Photon
prioriza cercanía sobre similitud de texto**: para "Av. Colón 1234" las dos
primeras sugerencias eran "Av. San Jose de Calasanz - Ruta E57 1234, Mendiolaza"
y "Av. Malvinas 1234, Mendiolaza" — la "Avenida Colón 1234, Córdoba" real recién
tercera. El usuario percibe que el buscador "anda mal".

## Fix (re-rank client-side, sin API nueva ni key)

1. Se piden 10 resultados a Photon (antes 5) y se muestran hasta 5.
2. Antes de mostrar, se reordenan: las sugerencias cuya **calle coincide con lo
   tipeado** (comparación normalizada: sin mayúsculas, tildes, números ni
   prefijos av/avenida/calle/bv/pasaje/ruta) van primero; el empate conserva el
   orden de Photon (cercanía a Córdoba). Orden estable → "San Martín 350,
   Córdoba capital" sigue ganándole a "San Martín 350, Toledo".
3. Todo lo demás queda igual: campo de texto libre, falla silenciosa por diseño
   (sin red → se tipea a mano), debounce 400ms, AbortController, filtro AR.

## Criterios de aceptación

1. Tipear "Av. Colón 1234" → la primera sugerencia es "Avenida Colón 1234,
   Córdoba, Córdoba" (no calles de otra localidad que no se llaman Colón).
2. Tipear "San Martín 350, Córdoba" → "San Martín 350, Córdoba, Córdoba" primera;
   las "Martín García"/"Martín Dobrizhoffer" quedan detrás de las San Martín.
3. Sin resultados coincidentes, el orden de Photon se conserva (no se rompe nada).
4. El buscador sigue sin requerir API key ni env vars.
5. `tsc`/eslint verdes.

## Dev Agent Record

- **Archivos:** `codigo/components/ui/buscador-direccion.client.tsx`.
- **Commit:** 63fde7e
- **Verificación:** `tsc` + eslint verdes. E2E con Playwright: "Av. Colón 1234"
  → primera sugerencia "Avenida Colón 1234, Córdoba, Córdoba" (antes tercera,
  detrás de dos calles de Mendiolaza que no eran Colón); "San Martín 350,
  Córdoba" → Córdoba capital primera y las "Martín García/Dobrizhoffer" fuera
  del top (solo San Martín reales).
