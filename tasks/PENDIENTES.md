# Pendientes — MANTIS 2

> Única fuente de verdad de los pendientes del proyecto. Al completar uno,
> moverlo a "Hechos" con la fecha. Última actualización: 2026-07-06.

## Ahora (esta semana)

- [ ] **Activar leaked password protection** — Dashboard de Supabase → Authentication → Sign In / Providers → toggle "Leaked password protection". 2 minutos.
- [ ] **Prueba manual del flujo de presupuesto** — En la app deployada, como gestor: elegir pagador → vista previa → enviar presupuesto → aprobar. Confirmar que el email va al pagador elegido y que el total de la nota coincide con lo aprobado (fixes de STORY-906). 5 minutos.

## Salida a producción

- [ ] **Verificar dominio en Resend** — Dashboard de Resend → Domains → agregar dominio → cargar registros DNS (SPF/DKIM) → al quedar "Verified", cambiar el remitente `onboarding@resend.dev` por uno del dominio en el código de email. Hasta entonces los emails solo llegan a la casilla de prueba.
- [ ] **Relajar el filtro del inbox** — Cuando haya casilla de mail exclusiva de mantenimiento, cambiar la query `subject:mantenimiento` en `codigo/features/inbox/sync.ts` para ingerir todo lo que llegue (hoy es necesario porque la casilla es compartida).

## Descartados (no hacer)

- ~~CRON_SECRET del job pg_cron a Vault~~ — Decisión de Fausti (2026-07-06): riesgo bajo, no se hará.

## Hechos

- [x] Correcciones completas de la auditoría 2026-07-06 (STORY-906, commit 950dbf8) — seguridad DB, finanzas, funnel, inbox, realtime, UI, métricas.
