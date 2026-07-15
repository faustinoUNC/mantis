# CLAUDE.md — MANTIS 2 (Gestión de Mantenimiento Inmobiliario)

Evolución del MANTIS original (`/Users/fausti/Downloads/projects/tesis/sist_gestion_incidentes`). Consultar ese repo como referencia de patrones probados (enrolamiento de técnicos, calendario/disponibilidad, conformidades) — pero NO copiar su lógica de sub-estados derivados.

## ⚠️ REGLA #0 — SIMPLICIDAD (FUNDAMENTAL Y CRÍTICO)

**Mantener las cosas SIMPLES. Siempre. No complejizar al pedo.**

- Ante dos soluciones que cumplen el requisito, elegir SIEMPRE la más simple de mantener — aunque la otra sea "más elegante" o "más escalable".
- No agregar abstracciones, configurabilidad, features ni capas "por las dudas" o "para el futuro". Si el PRD no lo pide, no va.
- Preferir: menos tablas, menos estados, menos componentes, menos dependencias, funnel de pocas columnas, flujos directos.
- El research lo confirma: la queja #1 contra los líderes del mercado es la complejidad. El diferencial de MANTIS 2 es ser simple.
- Ante la duda entre simple y completo → simple. Se agrega después SI hace falta de verdad.
- Esta regla le gana a cualquier otra consideración técnica de este archivo.

## Reglas críticas

### 1. Spec primero (BMAD — OBLIGATORIO)
- Fuente de verdad: `specs/`. Ningún código en `codigo/` sin STORY aprobada.
- BMAD instalado en `_bmad/` (skills `bmad-*` en `.claude/skills/`). Output en `_bmad-output/`.
- Docs base: `specs/PRD.md` y `specs/ARQUITECTURA.md`. Índice: `specs/README.md`.
- **Pendientes del proyecto: `tasks/PENDIENTES.md`** (única fuente de verdad — mantenerla al día: completados a "Hechos", descartados quedan documentados para no re-proponerlos).
- **Numeración de stories — Giuliano trabaja en paralelo y los números CHOCAN** (pasó TRES veces el 2026-07-12: 938/939/940 → 941/942/943, 944 → 945 y 948 → 949). Regla: `git fetch` + revisar `specs/` de `origin/main` **antes de crear una STORY** (tomar el siguiente número libre EN ORIGIN, no local) y **de nuevo antes de pushear** (pull --rebase primero; si mientras tanto tomaron el número, renumerar la nuestra: archivo, índice, PENDIENTES y comentarios en código, y recién ahí push). La regla vale para TODO push: fetch + pull --rebase siempre antes de pushear, aunque el cambio no cree stories.

### 2. Dominio — decisiones innegociables
- Se dice **"gestión de mantenimiento"**, nunca "incidente".
- **Inquilinos y propietarios NO acceden al sistema** — son entidades sin usuario en `auth.users`. Jamás crearles login.
- Roles con acceso: administrador, gestor de mantenimiento, gestor administrativo, técnico.
- La **etapa del funnel es un campo explícito en DB** + event log (`eventos_gestion`). PROHIBIDO derivar estados en runtime en componentes (fue el punto frágil del original).
- Transiciones de etapa SOLO vía función Postgres `avanzar_etapa()` (valida permiso por rol/columna + inserta evento, atómico).

### 3. Arquitectura (ver specs/ARQUITECTURA.md)
- Features: `codigo/features/{modulo}/` con `types.ts` + `service.ts` (`'use server'`). Todo dato pasa por server actions.
- Cliente browser de Supabase SOLO para `auth.*` y suscripciones Realtime.
- RLS en TODAS las tablas desde su primera migración.
- NO rutas `app/api/` salvo webhooks (Gmail) y cron.
- Email: **Resend** + React Email, siempre vía `features/email/service.ts`, con log en `emails_enviados`.
- Notificaciones: outbox transaccional (trigger sobre `eventos_gestion` → `notificaciones`) + Supabase Realtime + fetch de no-leídas al reconectar.

### 4. UX/UI — DESIGN CONTRACT OBLIGATORIO
- **Fuente de verdad de diseño**: `_bmad-output/planning-artifacts/ux-designs/ux-mantis-2026-07-05/DESIGN.md` (visual, dirección "Esmeralda técnica" minimalista) + `EXPERIENCE.md` (comportamiento). **TODA pantalla nueva se compone con esos tokens y criterios — desviarse está PROHIBIDO.** Si falta un token/componente, se agrega al contract primero.
- Los tokens del contract viven en `codigo/app/globals.css` (@theme). Un acento un significado: esmeralda = acción/marca; ámbar = urgente; rojo = error. El borde es la elevación (sin sombras en cards).
- Vista técnico **100% mobile-first** (dedos, gestos, targets ≥44px) — CRÍTICO.
- Nada genérico de IA: ni login card-centrada/banner-lateral, ni gradientes, ni sombras decorativas (ver Do's and Don'ts del contract).
- Cada gestor de mantenimiento ve SOLO sus gestiones (ownership `gestor_id`, PRD §2.1); tarjetas fuera de competencia opacadas/solo lectura.

### 5. MCP
- Perfil MCP del proyecto: `~/.claude/mcp-profiles/mantis.json` (Supabase HTTP oficial, proyecto `ejwokycbyjtlxwusbhtt`). Nunca editar `.mcp.json` a mano.

### 6. Reset de datos de prueba
- **`./scripts/reset-datos.sh`** — borra los datos operativos (gestiones + historial, inbox, notificaciones, emails, fotos del bucket) y conserva usuarios, técnicos, cartera, legajos y especialidades. Usarlo cuando Fausti pida "limpiar la base" para probar de cero. Lee la service key de `codigo/.env.local`; no requiere psql.
- Usuarios de prueba (patrón `ausitesis+nombre@gmail.com` / `nombre123`): admin, gestorcomercialuno (rol gestor de mantenimiento), tecnicouno. NO existe un usuario gestor administrativo de prueba (verificado en DB 2026-07-14) — el admin cubre ese rol. También hay usuarios `+demo*` sembrados por `demo-seed.sql`. Todos los emails entregan en ausitesis@gmail.com.
