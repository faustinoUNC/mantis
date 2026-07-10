# STORY-930 — Headers de seguridad HTTP en la app (anti-clickjacking + hardening) (v1.0)

**Estado:** 🚧 en desarrollo · **Origen:** Fausti pidió un pentest no destructivo del sistema. El barrido confirmó que el borde real (RLS en todas las tablas, storage cerrado, authz interna en funciones SECURITY DEFINER, guards de ruta, secreto del cron) está sólido. El único hallazgo app-level fue la **ausencia de headers de seguridad** en las respuestas. Regla #0: solución mínima que cierra el hallazgo sin cambiar comportamiento.

## Insight central

Las respuestas de `mantis-blue-three.vercel.app` sólo traen `HSTS` (que ya está, con `preload`). Faltan headers estándar de endurecimiento; el relevante es la **falta de protección contra clickjacking** (`X-Frame-Options` / CSP `frame-ancestors`): la app tiene sesiones autenticadas por cookie y hoy es enmarcable en un iframe. Se agregan headers **aditivos** vía `headers()` en `next.config.ts` — no cambian ninguna lógica ni ruta, sólo añaden cabeceras a todas las respuestas.

## Alcance y decisiones

**Se agrega** en `codigo/next.config.ts`:
- `poweredByHeader: false` → elimina `x-powered-by: Next.js` (deja de filtrar el framework).
- `async headers()` que aplica a **todas las rutas** (`source: "/:path*"`):
  - `X-Frame-Options: DENY` — cierra clickjacking (la app no se embebe en ningún iframe propio → seguro).
  - `X-Content-Type-Options: nosniff` — evita MIME sniffing.
  - `Referrer-Policy: strict-origin-when-cross-origin` — no filtra paths en el referer a terceros.

**Se decide NO incluir (para no romper nada):**
- **CSP (`Content-Security-Policy`)**: es el header con más riesgo de romper un Next.js (scripts inline de hidratación, estilos, etc.). Fuera de alcance; requeriría su propia STORY con prueba exhaustiva.
- **`Permissions-Policy`**: bajo valor y riesgo de bloquear features del navegador sin beneficio claro. Se omite.

**Se conserva** `HSTS` tal cual (ya lo pone Vercel con `preload`).

## Criterios de aceptación
1. Toda respuesta de la app trae `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` y `Referrer-Policy: strict-origin-when-cross-origin`.
2. La respuesta ya **no** trae `x-powered-by`.
3. **Cero cambio de comportamiento**: login, guards de ruta, subida de fotos, inbox, dashboard y vista técnico siguen funcionando igual (los headers son aditivos, sin CSP).
4. `next build` verde.

## Dev Agent Record
- **Estado:** ✅ implementado (2026-07-10). Sin commitear (Fausti revisa; deploy cuando decida).
- **Archivos:** `codigo/next.config.ts` (único). Agregado `poweredByHeader: false` + `headers()` con `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` sobre `source: "/:path*"`. Sin CSP ni Permissions-Policy (decisión de alcance).
- **Verificación:** `next build` verde (compila todas las rutas, sin errores). Los headers recién se ven en runtime tras deploy a Vercel; en local se pueden verificar con `next start` + `curl -I`.
