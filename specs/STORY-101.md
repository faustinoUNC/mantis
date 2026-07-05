# Story 1.1: Setup del proyecto y design system base

Status: done
Versión: 1.0.0

## Story

Como administrador,
quiero que el sistema exista como aplicación desplegable con identidad visual propia,
para que todas las features se construyan sobre una base sólida y consistente.

## Acceptance Criteria

1. **Given** el repo con convención `codigo/` + `specs/`, **When** se inicializa el proyecto (Next.js 15 + TypeScript + Tailwind 4 + Supabase local), **Then** `npm run dev` levanta la app con página de login shell (UI sin lógica de auth — la auth real es Story 1.2).
2. **And** existen los tokens del design system propio (colores, tipografía, espaciado) generados con las skills `frontend-design`/`ui-ux-pro-max` — nada de estética genérica de IA (NFR3).
3. **And** el proyecto compila sin errores (`npm run build`) y tiene la estructura `app/ components/ features/ hooks/ shared/`.

## Tasks / Subtasks

- [ ] Task 1: Scaffold del proyecto (AC: 1, 3)
  - [ ] `npx create-next-app@latest` en `codigo/` con TypeScript + App Router + Tailwind (migrar a Tailwind 4 CSS-first con `@theme` si el default es v3)
  - [ ] Crear carpetas `components/ features/ hooks/ shared/` con `shared/lib/supabase/` (client.ts, server.ts, admin.ts) siguiendo el patrón del MANTIS original
  - [ ] `supabase init` en la raíz del proyecto (carpeta `supabase/` junto a `codigo/`) + `.env.example` con las vars (URL, anon key, service role)
  - [ ] Instalar `@supabase/supabase-js` + `@supabase/ssr` (NO auth-helpers — deprecado)
- [ ] Task 2: Design system base (AC: 2)
  - [ ] Invocar skill `frontend-design` / `ui-ux-pro-max` para definir: paleta (con dark como consideración, no requisito v1), tipografía, espaciado, radios, sombras
  - [ ] Tokens en CSS-first de Tailwind 4 (`@theme` en `globals.css`) — un solo archivo fuente de verdad
  - [ ] Componentes UI base mínimos en `components/ui/`: Button, Input, Card, Badge — SOLO estos cuatro (Regla #0: el resto se crea cuando una story lo necesite)
- [ ] Task 3: Login shell + verificación (AC: 1, 3)
  - [ ] Página `/` = login shell (email + password + branding MANTIS) usando los componentes base, mobile-responsive
  - [ ] `npm run build` sin errores; `npm run dev` funcional

## Dev Notes

- **Regla #0 — SIMPLICIDAD**: nada de librerías extra (ni shadcn, ni UI kits, ni state managers). Tailwind 4 + componentes propios chicos. Solo lo que las tasks piden.
- **Stack fijado por ARQUITECTURA.md §1**: Next.js 15 App Router + TS + Tailwind 4 + Supabase + Vercel. Charts/PDF/email NO se instalan acá (llegan en sus épicas).
- **Patrón de datos (ARQUITECTURA.md §2)**: dejar `shared/lib/supabase/` listo con los 3 clients (browser solo para auth+realtime; server para services; admin solo ops administrativas). Sin services todavía — solo la infraestructura de conexión.
- **Tailwind 4**: configuración CSS-first con `@theme` (sin `tailwind.config.js` salvo necesidad real). Producción ~70% más liviana que v3.
- **`@supabase/ssr`** es el paquete vigente para cookie-based auth en App Router; `@supabase/auth-helpers` está deprecado. [Fuente: supabase.com/docs/guides/getting-started/quickstarts/nextjs]
- **Design system**: la vista técnico será 100% mobile (NFR2) — los tokens deben nacer con targets táctiles (≥44px) y escala tipográfica legible en pantalla chica.
- **Testing**: para esta story alcanza con build limpio + verificación visual del login shell (no hay lógica que testear). El estándar de tests se define cuando haya services (Story 1.2+).

### Project Structure Notes

```
mantis/
├── codigo/                  ← app Next.js (todo el código va acá — hook spec-first)
│   ├── app/                 (login shell en /, layout raíz, globals.css con @theme)
│   ├── components/ui/       (Button, Input, Card, Badge)
│   ├── features/            (vacío — se puebla por story)
│   ├── hooks/               (vacío)
│   └── shared/lib/supabase/ (client.ts, server.ts, admin.ts)
├── supabase/                ← migrations (vacío en esta story — JIT por story)
└── specs/                   ← esta story
```

- NO crear tablas ni migraciones en esta story (principio JIT: cada story crea solo lo que necesita).
- NO crear rutas `app/api/` (NFR10).

### References

- [Source: specs/ARQUITECTURA.md#1-stack, #2, #7-estructura-del-código]
- [Source: specs/PRD.md#12-uxui] (NFR2 mobile-first técnico, NFR3 diseño personalizado)
- [Source: _bmad-output/planning-artifacts/epics.md#story-11]
- [Source: https://supabase.com/docs/guides/getting-started/quickstarts/nextjs] (@supabase/ssr vigente)

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code, 2026-07-05)

### Debug Log References

- `npm run build` limpio (Next 16.2.10, TS ok, ruta `/` estática)
- Verificación visual con Playwright en localhost:3002 — desktop 1200px y mobile 390px OK (screenshots enviados a Fausti)

### Completion Notes List

- Scaffold con `create-next-app` → quedó **Next 16.2.10** (última estable, sucesora de la 15 de ARQUITECTURA.md — sin breaking changes para nuestro uso) + React 19 + Tailwind 4.
- Design system "utilitario de obra" definido con skill frontend-design: Archivo (grotesca argentina, wdth variable para display expandido) + Fragment Mono para etiquetas/datos; paleta tinta verde `#15211b` / papel `#f6f4ee` / mantis `#1d5c43` / ámbar señal `#f2a422`; radios chicos, sombra papel, target táctil 44px (`min-h-tap`). Tokens en `@theme` de `globals.css` (única fuente de verdad).
- Utilidades de identidad: `.etiqueta` (rótulo mono uppercase), `.franja-obra` (diagonal ámbar/tinta), `.regla-plano` (hairline técnica).
- 4 componentes base sin dependencias externas (cn propio, sin clsx/shadcn — Regla #0).
- 3 clients Supabase listos (`@supabase/ssr`, no auth-helpers). `supabase init` hecho en raíz; sin migraciones (JIT).
- Login shell sin lógica de auth (llega en Story 1.2). Dev server usa puerto alternativo si 3000 está ocupado por el MANTIS viejo.

### File List

- codigo/ (scaffold create-next-app: package.json, tsconfig, eslint, next.config.ts, postcss)
- codigo/app/globals.css (tokens @theme + utilidades de identidad)
- codigo/app/layout.tsx (fuentes Archivo + Fragment Mono, lang es, metadata)
- codigo/app/page.tsx (login shell)
- codigo/components/ui/button.tsx | input.tsx | card.tsx | badge.tsx
- codigo/shared/lib/supabase/client.ts | server.ts | admin.ts
- codigo/shared/utils/cn.ts
- codigo/.env.example
- supabase/config.toml (supabase init)
