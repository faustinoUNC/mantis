---
name: MANTIS 2
description: Contrato de experiencia — arquitectura de información, comportamiento, estados e interacciones. La identidad visual vive en DESIGN.md (gana ante conflicto junto con este archivo).
status: final
updated: 2026-07-05
sources:
  - specs/PRD.md (v1.2.0)
  - _bmad-output/planning-artifacts/epics.md
---

## Foundation

Web responsive (Next.js + Tailwind 4, tokens de `DESIGN.md`). Dos modos de uso con prioridades distintas:

- **Paneles de gestión** (admin, gestor de mantenimiento, gestor administrativo): desktop-first, denso pero legible; funcionan en mobile.
- **Vista técnico**: **mobile-first estricto** — se diseña primero a 390px, con targets `{spacing.tap}`, gestos y mínimos taps. Desktop es la adaptación, no al revés.

Modo claro únicamente en v1 (dark mode: fuera de alcance, se evaluará después — Regla #0).

## Information Architecture

- `/` login → `/panel` (router por rol) → panel del rol:
  - **/admin**: todo + mantenedores (especialidades, empleados) + auditoría + métricas globales.
  - **/gestion** (gestor mantenimiento): tablero Kanban con **SOLO sus gestiones** (ownership `gestor_id`, PRD §2.1), inbox de reportes, técnicos.
  - **/administracion** (gestor administrativo): sus columnas (Facturación y cobro, Liquidación) + vista lectura del resto.
  - **/tecnico**: mis trabajos (hoy primero), agenda de disponibilidad, historial.
- Navegación por panel: barra superior simple (≤5 ítems por rol). Sin sidebars colapsables ni breadcrumbs en v1.

## Voice and Tone

- Español rioplatense con voseo ("Accedé", "Enrolate", "Registrá el avance"). Directo, sin jerga técnica ni tono corporativo.
- Microcopy de error: qué pasó + qué hacer ("Correo o contraseña incorrectos."). Nunca códigos crudos.
- "Gestión de mantenimiento", jamás "incidente" (PRD §1).

## Component Patterns

- **Tablero Kanban**: 8 columnas fijas; en mobile, columnas como carrusel horizontal con snap. Tarjeta: dirección de propiedad + especialidad + badge urgencia + tiempo en etapa. Fuera de competencia → opacada, tap abre detalle solo lectura.
- **Acciones de etapa**: cada tarjeta muestra UNA acción principal según etapa+rol (el patrón probado del MANTIS original). Nada de menús con 8 opciones.
- **Formularios**: una columna, labels arriba, validación inline al blur, submit deshabilitado mientras envía ("Enviando…").
- **Confirmaciones destructivas**: modal con la consecuencia explícita ("El gestor anterior dejará de ver esta gestión").

## State Patterns

- **Cargando**: skeletons del layout final (no spinners a pantalla completa).
- **Vacío**: mensaje útil + acción ("Todavía no tenés gestiones asignadas").
- **Error**: inline cerca de la causa; toast solo para acciones asíncronas de fondo.
- **Realtime**: cambios remotos entran con la animación `aparecer`; badge de notificaciones se actualiza sin recarga.

## Interaction Primitives

- Foco SIEMPRE visible (ring esmeralda de DESIGN.md) — navegable 100% por teclado en paneles.
- Animación única del sistema: `aparecer` (fade + 10px up, 150–250ms, ease-out). Sin parallax, sin bounce, sin animaciones largas.
- Optimistic UI solo donde el rollback es trivial (marcar leída una notificación); las transiciones de etapa esperan al servidor (son atómicas y con permisos).
- Mobile técnico: acciones frecuentes alcanzables con el pulgar (mitad inferior), swipe permitido solo con alternativa visible por botón.

## Accessibility Floor

- Contraste AA mínimo en todo texto (verificado contra los tokens de DESIGN.md).
- Targets ≥44px, inputs con label real (`for`/`id`), errores con `role="alert"`.
- El color nunca es el único portador de significado: urgente = badge con texto, no solo ámbar.

## Key Flows

**Marcos, técnico gasista, 11:40, en la calle con guantes puestos.** Le suena el teléfono: nueva solicitud de asignación. 1) Abre MANTIS desde el celular — ya logueado, cae en *Mis trabajos*. 2) Arriba de todo, la solicitud nueva con dirección, especialidad y urgencia. 3) Un tap: *Aceptar*. 4) **Clímax:** en la visita, saca una foto del avance, escribe "cambié el flexible, mañana pruebo presión" y toca *Registrar* — **3 taps, 20 segundos, sin soltar la herramienta.** 5) El gestor ve el avance al instante en su tablero; el inquilino recibe el email de estado. Nadie llamó a nadie.

**Carla, gestora de mantenimiento, lunes 9:05.** 1) Entra a */gestion*: su tablero tiene SOLO sus gestiones — las 4 urgentes arriba con el badge ámbar. 2) En el inbox hay 3 mails nuevos; toca el botón IA en el primero: la card aparece en *Ingresado* clasificada como Plomería, editable. 3) Asigna técnico viendo la disponibilidad de la semana. 4) Si necesita derivar una gestión a otro gestor, no puede — le pide la reasignación al admin (ownership).
