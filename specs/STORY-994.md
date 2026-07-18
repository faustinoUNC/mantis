# STORY-994 — Reconciliar la escala tipográfica (v0.1 · BORRADOR)

**Estado:** 📝 borrador (espera **decisión** de Fausti — ver abajo) · **Origen:** auditoría UX STORY-991 — la escala real del código no coincide con la del contract y conviven tres "chicos" sin criterio.

## Problema (con números reales del código)
1. **Body: 14 vs 15.** El contract dice `body = 15px`, pero el código estandarizó de hecho `text-sm` (14px): **~213 usos de `text-sm`** contra ~20 de `text-[15px]`. Hay dos "textos legibles" compitiendo.
2. **Piso de tamaño.** El contract define mínimo 13px (label/data), pero hay **~70 usos de 11/12px** (`text-[11px]`, `text-[12px]`) en timestamps, contadores y metadatos — fuera de escala (salvo el 10px de `nav-tecnico`, que tiene licencia explícita).

## Decisión que necesito de Fausti (esto define el bump)
**A) Body:** ¿el contract adopta **14px** (`text-sm`) como body oficial —alinear contract al código, migración casi nula— **o** migramos el código a **15px**? → *Recomiendo adoptar 14px:* es lo que ya se ve en producción y en pantallas densas de gestión lee mejor; menos churn (Regla #0).
**B) Micro:** ¿agregamos un token **`caption: 12px`** para timestamps/contadores/metadatos (y subimos lo demás a 13px), **o** ponemos **piso duro 13px** y migramos todo? → *Recomiendo `caption: 12px`:* el metadato existe y necesita ser más chico que el body; formalizarlo es más honesto que perseguir 70 ocurrencias.

## Cambio de contract (bump DESIGN.md, según decisión)
- Actualizar §Typography: `body: 14px` (si A=14) y agregar `caption: 12px` (si B=caption).
- Actualizar `globals.css` sólo si hace falta (los tamaños son utilities Tailwind, no tokens @theme).

## Alcance
- Fijar la escala final en `DESIGN.md`.
- Migración mecánica de los usos fuera de la escala elegida (empezando por `detalle` y `finanzas`, que concentran el volumen). Sin lógica.

## Fuera de alcance
- Pesos y familias (ya OK). El 10px de `nav-tecnico` (licencia del contract, no se toca).

## Verificación
- `tsc` + `eslint` verdes. Grep de control: 0 usos fuera de la escala aprobada (salvo la excepción de nav-tecnico).

## Dev Agent Record
- _(pendiente)_
