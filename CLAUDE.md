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

### 4. UX/UI
- Vista técnico **100% mobile-first** (dedos, gestos, animaciones) — CRÍTICO.
- Diseño 100% personalizado: usar skills `frontend-design` / `ui-ux-pro-max`; nada de cards genéricas de IA ni plantillas típicas.
- Cada rol ve SOLO su área (dashboard, métricas, acciones); tarjetas fuera de competencia se ven opacadas/solo lectura.

### 5. MCP
- Perfil MCP propio del proyecto pendiente de crear (`~/.claude/mcp-profiles/mantis.json`) cuando exista el proyecto Supabase. Nunca editar `.mcp.json` a mano.
