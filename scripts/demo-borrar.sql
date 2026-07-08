-- ─────────────────────────────────────────────────────────────────────────
-- MANTIS 2 — REVERTIR CARGA DEMO (STORY-918)
--
-- Deja la base EXACTAMENTE como estaba antes de scripts/demo-seed.sql, aunque
-- las gestiones demo hayan sido movidas de etapa / editadas / calificadas
-- después de sembrarlas. NO se apoya en el marcador '[DEMO]' ni en la etapa:
-- ancla la identificación en las RELACIONES con las personas/cartera demo
-- (ausitesis+demo…), que ninguna feature del sistema permite reasignar.
--
-- Qué NO toca: los 4 usuarios reales, los 2 técnicos reales, la cartera real
-- (propietario Giuliano, sus propiedades/inquilinos/legajos) y las 7 gestiones
-- reales previas. Verificado con el bloque final.
--
-- Cómo correrlo: pedirle a Claude «corré scripts/demo-borrar.sql» o pegarlo en
-- el SQL Editor de Supabase. Las FOTOS del storage se borran aparte (abajo del
-- todo hay una nota con el comando; el SQL no accede al bucket).
-- ─────────────────────────────────────────────────────────────────────────

do $undo$
declare
  demo_gestiones uuid[];
  demo_users uuid[];       -- auth.users demo (staff + técnicos, incluye pendientes/rechazados)
  demo_props uuid[];       -- propiedades demo (por propietario demo)
  demo_props_owner uuid[]; -- propietarios demo
  demo_inq uuid[];         -- inquilinos demo
  n int;
begin
  -- Personas demo (ancla principal)
  select array_agg(id) into demo_users     from auth.users     where email like 'ausitesis+demo%';
  select array_agg(id) into demo_props_owner from propietarios where email like 'ausitesis+demo%';
  select array_agg(id) into demo_inq        from inquilinos    where email like 'ausitesis+demo%';
  select array_agg(p.id) into demo_props    from propiedades p where p.propietario_id = any(coalesce(demo_props_owner,'{}'));

  -- Gestión demo = vive en propiedad demo, O la creó/atiende una persona demo,
  -- O conserva el marcador. La unión cubre cualquier mutación posterior.
  select array_agg(distinct g.id) into demo_gestiones
  from gestiones g
  where g.descripcion like '[DEMO] %'
     or g.propiedad_id = any(coalesce(demo_props,'{}'))
     or g.gestor_id    = any(coalesce(demo_users,'{}'))
     or g.tecnico_id   = any(coalesce(demo_users,'{}'));

  demo_gestiones := coalesce(demo_gestiones, '{}');

  -- 1) Emails: el FK gestion_id es SET NULL → hay que borrarlos explícitamente.
  --    Por gestión demo o por destinatario demo (los al pagador/técnico demo).
  delete from emails_enviados e
  where e.gestion_id = any(demo_gestiones)
     or e.para like 'ausitesis+demo%';

  -- 2) Inbox: marcador propio + desvincular procesado_por demo en reportes reales
  --    (el FK procesado_por es NO ACTION → hay que limpiarlo antes de borrar users).
  delete from inbox_reportes where gmail_message_id like 'demo-%';
  update inbox_reportes set procesado_por = null
   where procesado_por = any(coalesce(demo_users,'{}'));
  update inbox_reportes set gestion_id = null
   where gestion_id = any(demo_gestiones);

  -- 3) Notificaciones sin gestión (inbox suelto / solicitudes de técnico): FK a
  --    usuarios es CASCADE al borrar el user, pero las dirigidas a usuarios
  --    REALES por eventos demo hay que borrarlas a mano (no cascadean por gestión).
  delete from notificaciones where gestion_id = any(demo_gestiones);

  -- 4) Calificaciones: el FK tecnico_id/autor_id es NO ACTION → si el técnico o
  --    autor es demo pero la gestión no entró en el set (imposible por diseño,
  --    pero defensivo), limpiarlas. Las de gestión demo cascadean en el paso 5.
  delete from calificaciones c
  where c.tecnico_id = any(coalesce(demo_users,'{}'))
     or c.autor_id   = any(coalesce(demo_users,'{}'));

  -- 5) Gestiones demo → CASCADE limpia eventos_gestion, presupuestos, avances,
  --    conformidades, calificaciones y notificaciones asociadas.
  delete from gestiones where id = any(demo_gestiones);

  -- 6) Personas demo. Borrar auth.users cascadea a usuarios, tecnicos,
  --    tecnico_especialidades, franjas_disponibilidad y sus notificaciones.
  --    (eventos_gestion.actor_id es NO ACTION pero ya no quedan eventos demo,
  --     y ningún evento real tiene actor demo.)
  delete from auth.users where id = any(coalesce(demo_users,'{}'));

  -- 7) Cartera demo (legajos → inquilinos/propiedades → propietarios).
  delete from legajos      where propiedad_id = any(coalesce(demo_props,'{}'))
                              or inquilino_id  = any(coalesce(demo_inq,'{}'));
  delete from propiedades  where id = any(coalesce(demo_props,'{}'));
  delete from inquilinos   where id = any(coalesce(demo_inq,'{}'));
  delete from propietarios where id = any(coalesce(demo_props_owner,'{}'));

  raise notice 'Demo revertida: % gestiones, % personas, % propiedades borradas.',
    array_length(demo_gestiones,1), array_length(demo_users,1), array_length(demo_props,1);
end
$undo$;

-- ── Verificación: todo demo en 0; los datos reales intactos ──
select 'gestiones DEMO restantes'  k, count(*)::text v from gestiones where descripcion like '[DEMO] %'
union all select 'usuarios demo',    count(*)::text from usuarios     where email like 'ausitesis+demo%'
union all select 'auth demo',        count(*)::text from auth.users   where email like 'ausitesis+demo%'
union all select 'tecnicos demo',    count(*)::text from tecnicos     where email like 'ausitesis+demo%'
union all select 'propietarios demo',count(*)::text from propietarios where email like 'ausitesis+demo%'
union all select 'inquilinos demo',  count(*)::text from inquilinos   where email like 'ausitesis+demo%'
union all select 'inbox demo',       count(*)::text from inbox_reportes where gmail_message_id like 'demo-%'
union all select 'emails demo',      count(*)::text from emails_enviados where para like 'ausitesis+demo%'
union all select '── REALES (no deben cambiar) ──', ''
union all select 'gestiones reales',  count(*)::text from gestiones where descripcion not like '[DEMO] %'
union all select 'usuarios reales',   count(*)::text from usuarios where email not like 'ausitesis+demo%'
union all select 'tecnicos reales',   count(*)::text from tecnicos where email not like 'ausitesis+demo%'
union all select 'propietarios reales',count(*)::text from propietarios where email not like 'ausitesis+demo%';

-- ─────────────────────────────────────────────────────────────────────────
-- FOTOS DEL STORAGE (correr aparte — este SQL no toca el bucket):
--   Las fotos demo viven bajo <gestionId>/… (bucket 'gestiones') y
--   <tecnicoId>/… (bucket 'documentacion-tecnicos'). Como las carpetas usan
--   los UUIDs ya borrados, quedan huérfanas pero inertes. Para limpiarlas,
--   pedile a Claude «borrá las fotos demo del storage» — corre un script que
--   lista y elimina las carpetas de los UUIDs demo en ambos buckets.
--   (Alternativa manual: Storage → gestiones / documentacion-tecnicos.)
-- ─────────────────────────────────────────────────────────────────────────
