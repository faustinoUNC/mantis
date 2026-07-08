-- ─────────────────────────────────────────────────────────────────
-- MANTIS 2 — BORRAR DATOS DE CARGA (prueba de rendimiento del tablero)
--
-- Elimina TODO lo sembrado para probar el sistema con mucha data.
-- Marcadores usados por el seed:
--   • gestiones      → descripcion LIKE '[CARGA]%'
--   • especialidades → nombre      LIKE '[CARGA]%'
--   • tecnicos       → nombre      LIKE '[CARGA]%'  (id = auth.users)
--   • auth.users     → email       LIKE '%@carga.seed'
--
-- NO toca ningún dato real: los usuarios reales, la cartera, el técnico
-- real y las 12 especialidades originales quedan intactos.
--
-- Cómo correrlo: pegar este SQL en el SQL Editor de Supabase
-- (o pedirle a Claude "corré scripts/borrar-carga.sql").
-- ─────────────────────────────────────────────────────────────────

-- 1) Gestiones sembradas (no generaron hijos: eventos/notif no se tocaron).
delete from gestiones where descripcion like '[CARGA]%';

-- 2) Técnicos sembrados: borrar los auth.users cascadea a
--    public.tecnicos y public.tecnico_especialidades (ON DELETE CASCADE).
delete from auth.users where email like '%@carga.seed';

-- 3) Especialidades sembradas (quedan sin referencias porque las gestiones
--    de carga usaron las especialidades reales).
delete from especialidades where nombre like '[CARGA]%';

-- Verificación (debe dar 0, 0, 0, 0):
select
  (select count(*) from gestiones      where descripcion like '[CARGA]%') as gestiones,
  (select count(*) from especialidades where nombre like '[CARGA]%')      as especialidades,
  (select count(*) from tecnicos       where nombre like '[CARGA]%')      as tecnicos,
  (select count(*) from auth.users     where email like '%@carga.seed')   as auth_users;
