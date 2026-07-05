# Arquitectura — MANTIS 2

| | |
|---|---|
| **Versión** | 1.0.0 |
| **Fecha** | 2026-07-05 |
| **Estado** | Borrador — pendiente aprobación de Fausti |

---

## 1. Stack

| Capa | Elección | Motivo |
|---|---|---|
| Framework | **Next.js 15 (App Router) + React + TypeScript** | Mismo stack probado en MANTIS original |
| UI | **Tailwind CSS 4** + design system propio (tokens custom) | Diseño 100% personalizado, mobile-first para técnico |
| Backend/DB | **Supabase** (PostgreSQL + Auth + Realtime + Storage) | Igual al original |
| Hosting | **Vercel** | Igual al original |
| Charts | **Recharts** (o Tremor si encaja con el design system) | Gráficos de calidad para reportes |
| PDF | `@react-pdf/renderer` para "Resumen de obras", facturas y comprobantes | Server-side, sin dependencia de browser |

## 2. Server Actions vs. cliente Supabase directo (decisión)

**Decisión: híbrido con regla clara — igual al patrón del MANTIS original, que ya demostró ser simple de mantener:**

- **TODA lectura y escritura de datos → Server Actions** (`features/{modulo}/service.ts` con `'use server'`). Ventajas: un solo lugar por módulo, tipado end-to-end, lógica de negocio (transiciones del funnel, notificaciones, emails) corre en servidor, testeable, y las keys nunca viajan al browser.
- **Cliente Supabase de browser SOLO para dos cosas**: `supabase.auth.*` (login/logout) y **suscripciones Realtime** (notificaciones, tablero en vivo).
- **RLS activo en TODAS las tablas igual** — defensa en profundidad: aunque todo pase por server actions, ninguna tabla queda sin políticas. El server action usa el client con sesión del usuario (respeta RLS); `createAdminClient()` (service role) solo para operaciones administrativas puntuales (crear usuarios, revocar sesiones).
- **NO crear rutas API** (`app/api/`) salvo los webhooks entrantes que lo exigen (Gmail push §5, cron jobs).

> Por qué no "cliente directo + RLS": obligaría a duplicar lógica de negocio en el browser, complica las transacciones multi-tabla (transición de etapa + evento + notificación) y hace imposible centralizar side-effects (emails). RLS solo autoriza, no orquesta.

## 3. Servicio de email (proveedor gratuito)

**Decisión: Resend** (plan free: 3.000 emails/mes, 100/día) con **React Email** para plantillas.

- Suficiente para el volumen de una inmobiliaria (facturas, comprobantes, notificaciones).
- DX excelente con Next.js, plantillas en React (facturas con detalle, comprobantes, resumen de obras).
- Alternativa de respaldo si se supera el free tier: Brevo (300/día gratis).
- Envío SIEMPRE desde server actions vía `features/email/service.ts` (un solo punto de salida, con log en tabla `emails_enviados` para trazabilidad/auditoría).

## 4. Notificaciones in-app 100% realtime (diseño desde el día 1)

**Arquitectura basada en outbox transaccional + Supabase Realtime:**

1. **Tabla `eventos_gestion`** (event log del funnel): cada transición inserta un evento en la MISMA transacción que el cambio de etapa (función Postgres `avanzar_etapa()` — atómico, imposible que avance sin evento).
2. **Trigger Postgres** sobre `eventos_gestion` → inserta filas en `notificaciones` (una por usuario destinatario según matriz evento→rol). Todo dentro de la transacción: **cero eventos perdidos**.
3. **Entrega realtime**: Supabase Realtime (Postgres Changes) sobre `notificaciones` filtrado por `usuario_id` (RLS limita cada suscripción a las propias). Cliente: badge + toast + centro de notificaciones.
4. **Resiliencia**: al reconectar (o al montar), el cliente hace fetch de no-leídas → nada se pierde si el websocket estuvo caído. `leida_at` timestamp para read-state.
5. **Bloqueo de usuarios en tiempo real**: canal realtime sobre `usuarios.esta_activo` + chequeo en middleware en cada navegación + revocación de refresh tokens. El bloqueado queda fuera en segundos.

La matriz evento→rol destinatario vive en un mantenedor/tabla (`matriz_notificaciones`), no hardcodeada.

## 5. Ingesta Gmail → Inbox

- **Gmail API con Push Notifications (`users.watch` + Google Cloud Pub/Sub)** → webhook `app/api/webhooks/gmail` → inserta en tabla `inbox_reportes` → Realtime lo muestra al gestor al instante.
- Fallback/plan B simple para MVP: **polling cada 1-2 min** vía Vercel Cron sobre la Gmail API (misma tabla, mismo flujo aguas abajo). Se puede arrancar con polling y migrar a push sin tocar nada más.
- **Botón IA**: server action que llama a la API de Claude (`claude-sonnet-5`) con tool use — tool `crear_gestion` (síntesis + clasificación contra las especialidades de los mantenedores + propiedad inferida si se puede). El resultado cae en la primera columna del Kanban, siempre editable.

## 6. Esquema de datos (núcleo)

```
usuarios (empleados + técnicos; rol; esta_activo)
propietarios / inquilinos (SIN usuario — solo datos de contacto)
propiedades
legajos (propiedad_id, inquilino_id, fecha_inicio, fecha_fin)  ← historial de ocupación
gestiones (la tarjeta: etapa, especialidad_id, legajo_id, paga:'inquilino'|'propietario', ...)
eventos_gestion (event log — fuente de la trazabilidad y las notificaciones)
asignaciones / presupuestos / avances / conformidades (heredadas del original, simplificadas)
facturas / cobros / liquidaciones (+ comprobantes)
inbox_reportes (mails entrantes)
notificaciones
especialidades / roles / matriz_notificaciones (mantenedores)
franjas_disponibilidad (agenda técnico — heredada del original)
emails_enviados (log de salida)
auditoria (vista/tabla derivada de eventos_gestion + acciones ABM)
```

**Lección clave del original aplicada**: la etapa es un **campo explícito** en `gestiones` + event log. Nada de sub-estados derivados en runtime en múltiples componentes.

## 7. Estructura del código

Convención BMAD del workspace: código en `codigo/`, specs en `specs/`.

```
codigo/
├── app/            # (admin) (gestor-mantenimiento) (gestor-administrativo) (tecnico) (auth) (imprimir)
├── components/     # visual — por rol + ui/ (design system propio)
├── features/       # {modulo}/types.ts + service.ts ('use server')  ← patrón del original
├── hooks/
└── shared/         # tipos, utils, lib/supabase (server/client/admin)
supabase/
└── migrations/
specs/              # STORY-XXX.md — fuente de verdad
```

## 8. Seguridad

- RLS en todas las tablas desde la primera migración (no como afterthought).
- Políticas por rol vía función `public.rol_actual()` (SECURITY DEFINER acotada: devuelve solo el rol del propio `auth.uid()` si está activo; EXECUTE revocado para anon). Sin claim JWT custom — evita configurar el Custom Access Token Hook y el problema de claims desactualizados hasta el refresh. *(Ajustado por STORY-102; antes decía "claim vía trigger", patrón que ya no existe.)*
- Permisos por columna del funnel: chequeados en la función `avanzar_etapa()` en Postgres (server-side, no solo UI).
- Inquilinos/propietarios NO tienen registros en `auth.users` — imposible que accedan.
