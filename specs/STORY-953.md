# STORY-953 — La campanita de notificaciones lleva a donde corresponde (v1.0)

**Estado:** 🚧 en desarrollo (falta correr la migración SQL) · **Origen:** Giuliano (siguiendo un Trello): *"Al hacer click en alguno de los items de la campanita de notificaciones, estaría bueno que te lleve a donde corresponda."*

## Alcance

- Las notificaciones de gestión ya llevaban a `/gestiones/{gestion_id}` (con `Link`, ver `components/paneles/campana.client.tsx`). Las otras dos, que ya existían pero nunca navegaban a ningún lado porque la tabla `notificaciones` no tenía de dónde sacar el destino:
  - **"Nuevo reporte en el inbox"** (trigger `notificar_inbox` sobre `inbox_reportes`) → ahora lleva a `/inbox`.
  - **"Nueva solicitud de técnico"** (trigger `notificar_solicitud_tecnico` sobre `tecnicos`) → ahora lleva a `/tecnicos/{id}` del técnico que se registró.
- No se agregó una columna de referencia por origen (`inbox_id`, `tecnico_id`, etc.) — eso hubiese obligado al frontend a conocer todos los orígenes posibles y armar la URL de cada uno (Regla #0: no complejizar). En cambio, se agregó una sola columna genérica `ruta` a `notificaciones`, que arma el trigger que ya sabe de qué se trata en el momento de insertar. El frontend solo hace `<Link href={n.ruta}>` si existe.
- El inbox no tiene vista de detalle por ítem (es una lista plana con acciones inline en `/inbox`) — no hace falta deep-link a un reporte puntual, con abrir la lista alcanza.

## Implementación

- **Migración SQL**: agrega `notificaciones.ruta text` y actualiza las 3 funciones de trigger para poblarla (ver bloque abajo). `notificar_evento` (gestiones) sigue guardando `gestion_id` como antes — el `ruta` ahí es solo `'/gestiones/' || gestion_id`, calculado igual en los dos `insert` que ya tenía.
- **`features/notificaciones/service.ts`**: `Notificacion` gana `ruta: string | null`; `misNotificaciones()` la selecciona.
- **`components/paneles/campana.client.tsx`**: el link condicional pasa de `n.gestion_id ? /gestiones/${n.gestion_id} : sin link` a `n.ruta ? n.ruta : sin link` — misma estructura, ahora genérica.

## Migración SQL (pendiente de correr en Supabase)

```sql
alter table notificaciones add column if not exists ruta text;

create or replace function public.notificar_inbox()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  insert into public.notificaciones (usuario_id, titulo, cuerpo, ruta)
  select u.id, 'Nuevo reporte en el inbox',
         coalesce(left(new.asunto, 120), 'Sin asunto'),
         '/inbox'
  from public.usuarios u
  where u.rol in ('gestor_mantenimiento','administrador') and u.esta_activo;
  return new;
end;
$function$;

create or replace function public.notificar_solicitud_tecnico()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  insert into public.notificaciones (usuario_id, titulo, cuerpo, ruta)
  select u.id, 'Nueva solicitud de técnico', new.nombre,
         '/tecnicos/' || new.id
  from public.usuarios u
  where u.rol in ('gestor_mantenimiento','administrador') and u.esta_activo;
  return new;
end;
$function$;

create or replace function public.notificar_evento()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_gestion record;
  v_regla record;
  v_destinatario uuid;
begin
  select gestor_id, tecnico_id, descripcion into v_gestion
  from public.gestiones where id = new.gestion_id;

  for v_regla in
    select destino, titulo from public.matriz_notificaciones
    where tipo_evento = new.tipo
      and (a_etapa is null or a_etapa = new.a_etapa)
  loop
    if v_regla.destino in ('gestor','nuevo_gestor') then
      v_destinatario := v_gestion.gestor_id;
    elsif v_regla.destino = 'tecnico' then
      v_destinatario := v_gestion.tecnico_id;
    else
      -- administrativos: una notificación por cada gestor administrativo activo
      insert into public.notificaciones (usuario_id, gestion_id, titulo, cuerpo, ruta)
      select u.id, new.gestion_id, v_regla.titulo, left(v_gestion.descripcion, 120),
             '/gestiones/' || new.gestion_id
      from public.usuarios u
      where u.rol = 'gestor_administrativo' and u.esta_activo and u.id <> new.actor_id;
      continue;
    end if;

    if v_destinatario is not null and v_destinatario <> new.actor_id then
      insert into public.notificaciones (usuario_id, gestion_id, titulo, cuerpo, ruta)
      values (v_destinatario, new.gestion_id, v_regla.titulo, left(v_gestion.descripcion, 120),
              '/gestiones/' || new.gestion_id);
    end if;
  end loop;

  return new;
end;
$function$;
```

Sin backfill: las notificaciones ya existentes quedan con `ruta` en `null` (siguen sin link, comportamiento sin cambios — no vale la pena reconstruir su origen retroactivamente).

## Criterios de aceptación

1. Al hacer clic en una notificación de gestión (asignación, presupuesto, conformidad, cobro, etc.) sigue llevando a `/gestiones/{id}`, igual que antes.
2. Al hacer clic en "Nuevo reporte en el inbox" lleva a `/inbox`.
3. Al hacer clic en "Nueva solicitud de técnico" lleva a `/tecnicos/{id}` del técnico correspondiente.
4. Notificaciones sin `ruta` (viejas, de antes de esta migración) se siguen mostrando pero sin comportamiento de link, igual que hoy.
5. `tsc`/eslint verdes.

## Dev Agent Record

- **Archivos:** `codigo/features/notificaciones/service.ts` (`ruta` en `Notificacion` y en el `select`), `codigo/components/paneles/campana.client.tsx` (link genérico por `ruta`).
- **Migración:** ver bloque SQL arriba — pendiente de que Giuliano la corra en el SQL Editor de Supabase (no hay MCP vivo en esta sesión). Incluye `alter table` + 3 `create or replace function` (mismo cuerpo que las funciones actuales, solo se les agrega `ruta` al insert).
- **Verificación:** `tsc --noEmit` y `eslint` limpios. Falta probar el flujo end-to-end en la app corriendo (no se hizo en esta sesión) — en particular, hasta que no se corra la migración, `ruta` no existe como columna y el `select` de `misNotificaciones()` va a fallar (error de Supabase por columna inexistente). **No pushear/deployar el código sin correr antes la migración**, o las notificaciones dejan de cargar para todos.
