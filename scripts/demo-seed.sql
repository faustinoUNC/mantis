-- ─────────────────────────────────────────────────────────────────────────
-- MANTIS 2 — CARGA DEMO (STORY-918): 80 gestiones realistas para métricas
--
-- Simula ~10 meses de uso real (sep-2025 → jul-2026; v2 STORY-919). Crea cartera,
-- gestiones en todas las etapas con sus eventos/presupuestos/avances/
-- conformidades/calificaciones/notificaciones/emails/inbox, todo con la
-- MISMA forma que deja el flujo natural del sistema y fechas backdateadas.
--
-- PRE-REQUISITO (ya ejecutado por Claude vía GoTrue Admin API): los 11
-- usuarios auth ausitesis+demo…@gmail.com (password = usuario123).
-- Los triggers de notificación se deshabilitan durante la siembra y las
-- notificaciones se insertan a mano replicando matriz_notificaciones
-- (si no, todo caería con fecha de hoy).
--
-- Marcadores: gestiones '[DEMO] %' · personas 'ausitesis+demo%'
--             · inbox gmail_message_id 'demo-%'
-- Reversión: scripts/demo-borrar.sql (no depende del estado de las gestiones)
-- ─────────────────────────────────────────────────────────────────────────

select setseed(0.42);

create function pg_temp.pick(arr text[]) returns text language sql volatile as
$$ select arr[1 + floor(random()*array_length(arr,1))::int] $$;
create function pg_temp.rint(a int, b int) returns int language sql volatile as
$$ select a + floor(random()*(b-a+1))::int $$;
create function pg_temp.d(a numeric, b numeric) returns numeric language sql volatile as
$$ select a + random()*(b-a) $$; -- días con decimales

alter table eventos_gestion disable trigger trg_notificar_evento;
alter table inbox_reportes  disable trigger trg_notificar_inbox;
alter table tecnicos        disable trigger trg_notificar_solicitud_tecnico;

do $seed$
declare
  -- actores
  v_admin uuid; v_uno uuid; v_val uuid; v_marcos uuid; v_laura uuid;
  -- especialidades (por nombre)
  e_plo uuid; e_gas uuid; e_ele uuid; e_alb uuid; e_pin uuid; e_car uuid;
  e_her uuid; e_cli uuid; e_tec uuid; e_vid uuid; e_pla uuid; e_otr uuid;
  -- técnicos
  t_uno uuid; t_dos uuid; t_raul uuid; t_sergio uuid; t_pablo uuid;
  t_andrea uuid; t_jose uuid; t_dario uuid; t_fede uuid; t_gaston uuid;
  -- cartera
  po uuid[6]; pr uuid[14]; lg uuid[14]; -- propietarios, propiedades, legajo x propiedad
  v_dir text[14]; v_inq_email text[14]; v_inq_nom text[14]; v_po_email text[14];
  inq uuid[10];
  -- por gestión
  i int; g uuid; v_p int; v_esp uuid; v_esp_nom text; v_gestor uuid; v_fin uuid;
  v_urg text; v_causa text; v_pag_sug text; v_pag text; v_desc text; v_tec uuid;
  v_tec2 uuid; v_tec_nom text; v_pool uuid[];
  mat numeric; mano numeric; ptotal numeric; cargo numeric; cfinal numeric;
  plazo int; liqm numeric; fref text; medio text; est int;
  t0 timestamptz; m1 timestamptz; m2 timestamptz; m3 timestamptz; m4 timestamptz;
  m5 timestamptz; m6 timestamptz; m7 timestamptz; m8 timestamptz; m9 timestamptz;
  tx timestamptz; ty timestamptz; tnota timestamptz;
  d1 numeric; d2 numeric; d3 numeric; d4 numeric; d5 numeric; d6 numeric;
  d7 numeric; d8 numeric; d9 numeric; margen numeric;
  conf_rech boolean; pres_rech boolean; asig_rech boolean; con_nota boolean;
  con_calif boolean; env_pagador boolean; n_av int; j int;
  etapa_obj text; inbox_n int := 0;
  -- v2 (STORY-919): arranque del negocio ~10 meses atrás para que las series
  -- temporales (ingresos, volumen) muestren tendencia. Las gestiones NO pueden
  -- preceder esta fecha (se clampea t0 abajo).
  ts_alta timestamptz := timestamptz '2025-09-01 10:00-03';
begin
  if exists (select 1 from gestiones where descripcion like '[DEMO] %') then
    raise exception 'La carga demo ya está aplicada — correr scripts/demo-borrar.sql primero.';
  end if;

  select id into v_admin from usuarios where email = 'ausitesis+admin@gmail.com';
  select id into v_uno   from usuarios where email = 'ausitesis+gestorcomercialuno@gmail.com';
  select id into t_uno   from tecnicos where email = 'ausitesis+tecnicouno@gmail.com';
  select id into t_dos   from tecnicos where email = 'ausitesis+tecnicodos@gmail.com';
  select id into v_val    from auth.users where email = 'ausitesis+demogestorvalentina@gmail.com';
  select id into v_marcos from auth.users where email = 'ausitesis+demogestormarcos@gmail.com';
  select id into v_laura  from auth.users where email = 'ausitesis+demoadministrativolaura@gmail.com';
  select id into t_raul   from auth.users where email = 'ausitesis+demotecnicoraul@gmail.com';
  select id into t_sergio from auth.users where email = 'ausitesis+demotecnicosergio@gmail.com';
  select id into t_pablo  from auth.users where email = 'ausitesis+demotecnicopablo@gmail.com';
  select id into t_andrea from auth.users where email = 'ausitesis+demotecnicaandrea@gmail.com';
  select id into t_jose   from auth.users where email = 'ausitesis+demotecnicojose@gmail.com';
  select id into t_dario  from auth.users where email = 'ausitesis+demotecnicodario@gmail.com';
  select id into t_fede   from auth.users where email = 'ausitesis+demotecnicofede@gmail.com';
  select id into t_gaston from auth.users where email = 'ausitesis+demotecnicogaston@gmail.com';

  select id into e_plo from especialidades where nombre = 'Plomería';
  select id into e_gas from especialidades where nombre = 'Gas';
  select id into e_ele from especialidades where nombre = 'Electricidad';
  select id into e_alb from especialidades where nombre = 'Albañilería';
  select id into e_pin from especialidades where nombre = 'Pintura e impermeabilización';
  select id into e_car from especialidades where nombre = 'Carpintería';
  select id into e_her from especialidades where nombre = 'Herrería y cerrajería';
  select id into e_cli from especialidades where nombre = 'Climatización';
  select id into e_tec from especialidades where nombre = 'Techos y zinguería';
  select id into e_vid from especialidades where nombre = 'Vidriería';
  select id into e_pla from especialidades where nombre = 'Control de plagas';
  select id into e_otr from especialidades where nombre = 'Otros';

  -- ── Staff demo ──
  insert into usuarios (id, nombre, email, rol, creado_en) values
    (v_val,    'Valentina Suárez', 'ausitesis+demogestorvalentina@gmail.com',    'gestor_mantenimiento', ts_alta),
    (v_marcos, 'Marcos Gutiérrez', 'ausitesis+demogestormarcos@gmail.com',       'gestor_mantenimiento', ts_alta + interval '25 minutes'),
    (v_laura,  'Laura Benítez',    'ausitesis+demoadministrativolaura@gmail.com', 'gestor_administrativo', ts_alta + interval '40 minutes');

  -- ── Técnicos demo (aprobados: fila en tecnicos + usuarios; como el alta real) ──
  insert into tecnicos (id, nombre, email, telefono, dni, estado, doc_dni_path, doc_matricula_path, creado_en) values
    (t_raul,   'Raúl Medina',    'ausitesis+demotecnicoraul@gmail.com',   '351-6602211', '22345678', 'aprobado', t_raul   || '/dni.png', t_raul  || '/matricula.png', ts_alta + interval '2 days'),
    (t_sergio, 'Sergio Álvarez', 'ausitesis+demotecnicosergio@gmail.com', '351-6602212', '25678901', 'aprobado', t_sergio || '/dni.png', t_sergio || '/matricula.png', ts_alta + interval '2 days 3 hours'),
    (t_pablo,  'Pablo Castro',   'ausitesis+demotecnicopablo@gmail.com',  '351-6602213', '30123456', 'aprobado', t_pablo  || '/dni.png', null, ts_alta + interval '3 days'),
    (t_andrea, 'Andrea Roldán',  'ausitesis+demotecnicaandrea@gmail.com', '351-6602214', '33456789', 'aprobado', t_andrea || '/dni.png', null, ts_alta + interval '3 days 5 hours'),
    (t_jose,   'José Luna',      'ausitesis+demotecnicojose@gmail.com',   '351-6602215', '27890123', 'aprobado', t_jose   || '/dni.png', null, ts_alta + interval '4 days'),
    (t_dario,  'Darío Peralta',  'ausitesis+demotecnicodario@gmail.com',  '351-6602216', '20987654', 'aprobado', t_dario  || '/dni.png', null, ts_alta + interval '4 days 2 hours'),
    (t_fede,   'Federico Ibáñez','ausitesis+demotecnicofede@gmail.com',   '351-6602217', '36789012', 'pendiente', t_fede  || '/dni.png', null, now() - interval '4 days'),
    (t_gaston, 'Gastón Vera',    'ausitesis+demotecnicogaston@gmail.com', '351-6602218', '31234567', 'rechazado', t_gaston || '/dni.png', null, now() - interval '20 days');
  update tecnicos set motivo_rechazo = 'La foto del DNI está ilegible; volvé a cargar la documentación.' where id = t_gaston;

  insert into usuarios (id, nombre, email, rol, creado_en)
  select id, nombre, email, 'tecnico', creado_en from tecnicos
  where id in (t_raul, t_sergio, t_pablo, t_andrea, t_jose, t_dario);

  insert into tecnico_especialidades (tecnico_id, especialidad_id) values
    (t_raul, e_plo), (t_raul, e_gas),
    (t_sergio, e_ele), (t_sergio, e_cli),
    (t_pablo, e_alb), (t_pablo, e_pin),
    (t_andrea, e_pin), (t_andrea, e_car),
    (t_jose, e_her), (t_jose, e_vid),
    (t_dario, e_tec), (t_dario, e_alb),
    (t_fede, e_plo), (t_gaston, e_otr);

  insert into franjas_disponibilidad (tecnico_id, dia_semana, hora_desde, hora_hasta)
  select t_raul, d, '08:00'::time, '17:00'::time from generate_series(1,5) d union all
  select t_sergio, d, '09:00'::time, '18:00'::time from unnest(array[1,3,5]) d union all
  select t_pablo, d, '08:00'::time, '13:00'::time from generate_series(1,6) d union all
  select t_andrea, d, '09:00'::time, '16:00'::time from unnest(array[2,3,4]) d union all
  select t_jose, d, '10:00'::time, '19:00'::time from generate_series(1,5) d union all
  select t_dario, d, '08:00'::time, '14:00'::time from unnest(array[1,2,4,5]) d;

  -- backdatear el alta en auth (coincide con usuarios/tecnicos.creado_en)
  update auth.users u set created_at = t.creado_en, updated_at = t.creado_en
  from tecnicos t where t.id = u.id and u.email like 'ausitesis+demo%';
  update auth.users u set created_at = s.creado_en, updated_at = s.creado_en
  from usuarios s where s.id = u.id and u.email like 'ausitesis+demo%' and s.rol <> 'tecnico';

  -- ── Cartera demo ──
  insert into propietarios (nombre, email, telefono, cuit, creado_en) values
    ('Alberto Sánchez',              'ausitesis+demopropietarioalberto@gmail.com', '351-5551201', '20-18345678-3', ts_alta),
    ('Mónica Ferreyra',              'ausitesis+demopropietariamonica@gmail.com',  '351-5551202', '27-22456789-4', ts_alta),
    ('Rodolfo Aguirre',              'ausitesis+demopropietariorodolfo@gmail.com', '351-5551203', '20-14567890-1', ts_alta),
    ('Silvia Barrionuevo',           'ausitesis+demopropietariasilvia@gmail.com',  '351-5551204', '27-25678901-2', ts_alta),
    ('Néstor Cabrera',               'ausitesis+demopropietarionestor@gmail.com',  '351-5551205', '20-20789012-5', ts_alta),
    ('Sucesión de Elena Marchetti',  'ausitesis+demopropietariaelena@gmail.com',   '351-5551206', '23-08890123-9', ts_alta);
  select array_agg(id order by creado_en, nombre) into po from propietarios where email like 'ausitesis+demo%';
  -- índice fijo por nombre (el array_agg de arriba no garantiza el orden de inserción)
  po[1] := (select id from propietarios where email like '%demopropietarioalberto%');
  po[2] := (select id from propietarios where email like '%demopropietariamonica%');
  po[3] := (select id from propietarios where email like '%demopropietariorodolfo%');
  po[4] := (select id from propietarios where email like '%demopropietariasilvia%');
  po[5] := (select id from propietarios where email like '%demopropietarionestor%');
  po[6] := (select id from propietarios where email like '%demopropietariaelena%');

  v_dir := array['Av. Colón 1834 3°B','Obispo Trejo 641 PB A','Bv. San Juan 320 5°C','9 de Julio 2450',
                 'Av. Vélez Sarsfield 1102 8°A','Caseros 977','Independencia 754 2°D','Av. Rafael Núñez 4520 Local 2',
                 'Fructuoso Rivera 158 1°A','Belgrano 1288 PH 3','Av. General Paz 356 6°B','Marcelo T. de Alvear 890 4°A',
                 'Ituzaingó 1435','27 de Abril 3010 2°C'];
  for j in 1..14 loop
    insert into propiedades (direccion, tipo, propietario_id, creado_en)
    values (v_dir[j],
            case j when 4 then 'Casa' when 6 then 'Casa' when 13 then 'Casa'
                   when 8 then 'Local' when 10 then 'PH' else 'Departamento' end,
            po[case j when 1 then 1 when 2 then 1 when 13 then 1
                      when 3 then 2 when 4 then 2 when 14 then 2
                      when 5 then 3 when 6 then 3
                      when 7 then 4 when 8 then 4
                      when 9 then 5 when 10 then 5
                      else 6 end],
            ts_alta + (j || ' hours')::interval)
    returning id into g;
    pr[j] := g;
    v_po_email[j] := (select p2.email from propietarios p2 join propiedades pp on pp.propietario_id = p2.id where pp.id = pr[j]);
  end loop;

  insert into inquilinos (nombre, email, telefono, dni, creado_en) values
    ('Lucía Herrera',   'ausitesis+demoinquilinalucia@gmail.com',    '351-7701301', '32456789', ts_alta),
    ('Javier Sosa',     'ausitesis+demoinquilinojavier@gmail.com',   '351-7701302', '28901234', ts_alta),
    ('Carolina Bustos', 'ausitesis+demoinquilinacarolina@gmail.com', '351-7701303', '35678901', ts_alta),
    ('Matías Quiroga',  'ausitesis+demoinquilinomatias@gmail.com',   '351-7701304', '30234567', ts_alta),
    ('Romina Díaz',     'ausitesis+demoinquilinaromina@gmail.com',   '351-7701305', '33890123', ts_alta),
    ('Federico Torres', 'ausitesis+demoinquilinofederico@gmail.com', '351-7701306', '29456789', ts_alta),
    ('Ana Villalba',    'ausitesis+demoinquilinaana@gmail.com',      '351-7701307', '36012345', ts_alta),
    ('Diego Moyano',    'ausitesis+demoinquilinodiego@gmail.com',    '351-7701308', '27678901', ts_alta),
    ('Paula Giordano',  'ausitesis+demoinquilinapaula@gmail.com',    '351-7701309', '34234567', ts_alta),
    ('María Ledesma',   'ausitesis+demoinquilinamaria@gmail.com',    '351-7701310', '26890123', ts_alta);
  inq[1] := (select id from inquilinos where email like '%demoinquilinalucia%');
  inq[2] := (select id from inquilinos where email like '%demoinquilinojavier%');
  inq[3] := (select id from inquilinos where email like '%demoinquilinacarolina%');
  inq[4] := (select id from inquilinos where email like '%demoinquilinomatias%');
  inq[5] := (select id from inquilinos where email like '%demoinquilinaromina%');
  inq[6] := (select id from inquilinos where email like '%demoinquilinofederico%');
  inq[7] := (select id from inquilinos where email like '%demoinquilinaana%');
  inq[8] := (select id from inquilinos where email like '%demoinquilinodiego%');
  inq[9] := (select id from inquilinos where email like '%demoinquilinapaula%');
  inq[10] := (select id from inquilinos where email like '%demoinquilinamaria%');

  -- legajos vigentes: propiedad → inquilino (6, 11, 13 y 14 quedan vacías)
  for j in 1..14 loop
    lg[j] := null; v_inq_email[j] := null; v_inq_nom[j] := null;
  end loop;
  declare
    mapa int[][] := array[[1,1],[2,2],[3,3],[4,4],[5,5],[7,7],[8,10],[9,8],[10,9],[12,6]];
    ini date[] := array['2024-08-01','2025-02-15','2025-07-01','2024-11-10','2026-01-20',
                        '2025-09-05','2024-05-15','2025-11-01','2026-03-01','2025-04-10']::date[];
  begin
    for j in 1..10 loop
      insert into legajos (propiedad_id, inquilino_id, fecha_inicio, creado_en)
      values (pr[mapa[j][1]], inq[mapa[j][2]], ini[j], greatest(ini[j]::timestamptz, ts_alta))
      returning id into g;
      lg[mapa[j][1]] := g;
      v_inq_nom[mapa[j][1]] := (select nombre from inquilinos where id = inq[mapa[j][2]]);
      v_inq_email[mapa[j][1]] := (select email from inquilinos where id = inq[mapa[j][2]]);
    end loop;
  end;

  -- ── 80 gestiones ──
  for i in 1..80 loop
    etapa_obj := case
      when i <= 30 then 'finalizado'       when i <= 36 then 'cancelada'
      when i <= 42 then 'ingresado'        when i <= 50 then 'asignacion'
      when i <= 58 then 'presupuesto'      when i <= 67 then 'en_ejecucion'
      when i <= 72 then 'conformidad'      when i <= 77 then 'facturacion_cobro'
      else 'liquidacion_tecnico' end;

    -- especialidad (cubiertas por el pool de técnicos; plagas/otros solo donde no hace falta técnico)
    declare r numeric := random(); begin
      v_esp := case
        when i in (43,44) then e_pla                -- gap de cobertura a propósito
        when i = 42 then e_otr
        when r < 0.20 then e_plo when r < 0.36 then e_ele when r < 0.45 then e_gas
        when r < 0.55 then e_alb when r < 0.65 then e_pin when r < 0.73 then e_car
        when r < 0.81 then e_cli when r < 0.88 then e_her when r < 0.94 then e_tec
        else e_vid end;
    end;
    select nombre into v_esp_nom from especialidades where id = v_esp;
    v_pool := case v_esp
      when e_plo then array[t_dos, t_raul]   when e_gas then array[t_uno, t_raul]
      when e_ele then array[t_uno, t_sergio] when e_cli then array[t_dos, t_sergio]
      when e_alb then array[t_pablo, t_dario] when e_pin then array[t_pablo, t_andrea]
      when e_car then array[t_dos, t_andrea] when e_her then array[t_jose]
      when e_vid then array[t_jose]          when e_tec then array[t_dario]
      else array[]::uuid[] end;

    -- propiedad (1 y 4 son "calientes" → reincidencia)
    declare r numeric := random(); begin
      v_p := case when r < 0.18 then 1 when r < 0.33 then 4 else pg_temp.rint(1,14) end;
    end;

    v_gestor := case when random() < 0.4 then v_uno when random() < 0.5 then v_val else v_marcos end;
    v_fin := case when random() < 0.8 then v_laura else v_admin end;
    v_urg := case when random() < 0.2 then 'urgente' else 'normal' end;
    v_causa := case
      when lg[v_p] is null then (case when random() < 0.7 then 'desgaste' else 'mejora' end)
      when random() < 0.55 then 'desgaste' when random() < 0.67 then 'dano' else 'mejora' end;
    v_pag_sug := case v_causa when 'dano' then 'inquilino' else 'propietario' end;
    v_pag := case when lg[v_p] is null then 'propietario'
                  when random() < 0.15 then (case v_pag_sug when 'inquilino' then 'propietario' else 'inquilino' end)
                  else v_pag_sug end;

    v_desc := '[DEMO] ' || pg_temp.pick(case v_esp_nom
      when 'Plomería' then array['Pérdida de agua bajo la mesada de la cocina','El inodoro pierde agua y la mochila carga sin parar','La canilla del lavadero gotea aunque esté cerrada','Se tapó la rejilla del patio y rebalsa cuando llueve','Poca presión de agua caliente en la ducha','Caño de la cocina con filtración, hay mancha de humedad en el mueble','La bomba presurizadora hace ruido y corta a cada rato']
      when 'Gas' then array['Olor a gas en la cocina cerca de la hornalla','El calefón no mantiene la llama piloto','La estufa del living no enciende','Revisión de la instalación para rehabilitar el gas tras el corte de Ecogas','El calefactor del dormitorio se apaga solo a los pocos minutos']
      when 'Electricidad' then array['Salta la térmica cuando prenden el aire y el horno juntos','El tomacorriente del dormitorio hizo chispa y quedó quemado','La mitad del departamento quedó sin luz','Cambio del tablero viejo de tapones por térmicas y disyuntor','El portero eléctrico no suena en el departamento','Las luces del pasillo titilan todo el tiempo']
      when 'Albañilería' then array['Humedad de cimientos en la pared del living','Se desprendió el revoque del techo del baño','Fisura en la pared del dormitorio que sigue creciendo','Rehacer las juntas de las cerámicas del patio','Se hundió parte del contrapiso de la cocina']
      when 'Pintura e impermeabilización' then array['Pintura completa del departamento antes del nuevo ingreso','Mancha de humedad en el techo del dormitorio, hay que impermeabilizar la terraza','Pintura descascarada en el balcón por las lluvias','La membrana de la terraza está levantada en las esquinas','Pintura del frente descascarada por humedad de la medianera']
      when 'Carpintería' then array['La puerta del placard se salió del riel','La ventana del living no cierra bien y entró agua con la tormenta','Ajustar la puerta de entrada que roza el piso','El piso flotante se levantó en la zona del ventanal','Mueble bajo mesada hinchado por una pérdida de agua']
      when 'Herrería y cerrajería' then array['La cerradura de la puerta de calle quedó trabada','El portón del garaje se salió de la guía','Soldar la baranda del balcón que quedó floja','Cambio de combinación de la cerradura por cambio de inquilino','La reja de la ventana de la cocina está oxidada y suelta']
      when 'Climatización' then array['El aire acondicionado del living no enfría','Pérdida de agua del split del dormitorio','Instalación de un split nuevo en el dormitorio principal','El aire hace un ruido fuerte al arrancar','Carga de gas y service del split del comedor']
      when 'Techos y zinguería' then array['Gotera sobre el pasillo cuando llueve fuerte','La canaleta del fondo está tapada y desborda','Se volaron chapas del techo del lavadero con el viento sur','Filtración en el techo del local cada vez que llueve']
      when 'Vidriería' then array['Se rajó el vidrio de la ventana del dormitorio','Cambio del vidrio del ventanal del living roto por el granizo','Reponer el vidrio de la puerta del balcón']
      when 'Control de plagas' then array['Aparecieron cucarachas en la cocina y el lavadero','Hay un nido de avispas en el balcón','Hormigas carpinteras en el marco de la ventana']
      else array['Limpieza y desinfección del tanque de agua','El ascensor vibra al frenar en planta baja','Colocar pasamanos en la escalera del PH'] end);

    -- técnico(s)
    v_tec := null; v_tec2 := null;
    if array_length(v_pool, 1) is not null then
      v_tec := v_pool[pg_temp.rint(1, array_length(v_pool, 1))];
      v_tec2 := v_pool[1]; if v_tec2 = v_tec and array_length(v_pool,1) > 1 then v_tec2 := v_pool[2]; end if;
    end if;
    select nombre into v_tec_nom from tecnicos where id = v_tec;

    -- montos
    mano := pg_temp.rint(40, 400) * 1000;
    mat := case when random() < 0.2 then 0 else pg_temp.rint(10, 500) * 1000 end;
    ptotal := mat + mano;
    -- v2 (STORY-919): fee de la inmobiliaria 15–22% del presupuesto (antes 6–12%,
    -- daba ~8,5% de la obra, ridículo). Ahora la franja de ganancia se ve.
    cargo := round(ptotal * pg_temp.d(0.15, 0.22) / 1000) * 1000;
    cfinal := round(ptotal * pg_temp.d(0.92, 1.30) / 1000) * 1000;
    plazo := pg_temp.rint(2, 15);
    liqm := cfinal;
    fref := case when random() < 0.7 then 'FC B 0003-' || lpad(pg_temp.rint(1200, 9800)::text, 8, '0') else null end;
    medio := case when random() < 0.7 then 'transferencia' when random() < 0.65 then 'efectivo' else 'otro' end;

    -- variantes
    conf_rech := (i <= 30 and random() < 0.10) or i = 72;
    pres_rech := (i <= 30 and not conf_rech and random() < 0.12) or i in (57, 58);
    asig_rech := (i <= 30 and random() < 0.08) or i in (49, 50);
    con_nota := case when i in (74, 75) then true when i in (73, 76, 77) then false else random() < 0.7 end;
    con_calif := random() < 0.75;
    env_pagador := i <= 30 and random() < 0.25;

    -- duraciones por etapa (días)
    d1 := case when v_urg = 'urgente' then pg_temp.d(0.05, 0.3) else pg_temp.d(0.2, 2.5) end;
    d2 := pg_temp.d(0.05, 1);   d3 := pg_temp.d(0.05, 1.5);
    d4 := pg_temp.d(0.3, 5);    d5 := pg_temp.d(0.2, 3);
    -- STORY-921: la ejecución se desvía del plazo comprometido con un SESGO
    -- PERSISTENTE por técnico (unos cumplen, otros se pasan), + jitter por obra,
    -- para que "Cumplimiento de plazo" muestre un espectro real (no todo negativo).
    d6 := greatest(0.5, plazo * (case v_tec
      when t_dos then 1.35 when t_pablo then 1.18 when t_jose then 1.08
      when t_dario then 1.00 when t_andrea then 0.98
      when t_sergio then 0.88 when t_uno then 0.82 when t_raul then 0.75
      else 1.00 end) * pg_temp.d(0.85, 1.15));
    d7 := pg_temp.d(0.2, 4);    d8 := pg_temp.d(1, 12);  d9 := pg_temp.d(1, 7);

    -- margen = tiempo en la etapa actual (estancadas a mano)
    margen := case
      when i = 37 then 18  when i = 43 then 35  when i = 51 then 28  when i = 73 then 30
      when etapa_obj = 'ingresado' then pg_temp.d(0.2, 4)
      when etapa_obj = 'asignacion' then pg_temp.d(0.3, 6)
      when etapa_obj = 'presupuesto' then pg_temp.d(0.5, 7)
      when etapa_obj = 'en_ejecucion' then pg_temp.d(1, 12)
      when etapa_obj = 'conformidad' then pg_temp.d(0.3, 5)
      when etapa_obj = 'facturacion_cobro' then pg_temp.d(1, 10)
      when etapa_obj = 'liquidacion_tecnico' then pg_temp.d(1, 8)
      when etapa_obj = 'cancelada' then pg_temp.d(5, 240)
      else pg_temp.d(1, 240) end; -- finalizado: días desde que terminó (v2: spread ~10 meses)

    -- t0 según cuántas etapas recorrió
    t0 := now() - margen * interval '1 day' - (case etapa_obj
      when 'ingresado' then 0
      when 'asignacion' then d1
      when 'presupuesto' then d1 + d2 + d3
      when 'en_ejecucion' then d1 + d2 + d3 + d4 + d5
      when 'conformidad' then d1 + d2 + d3 + d4 + d5 + d6
      when 'facturacion_cobro' then d1 + d2 + d3 + d4 + d5 + d6 + d7
      when 'liquidacion_tecnico' then d1 + d2 + d3 + d4 + d5 + d6 + d7 + d8
      when 'finalizado' then d1 + d2 + d3 + d4 + d5 + d6 + d7 + d8 + d9
      else case when i = 31 then pg_temp.d(0.1, 2) when i in (32, 33) then d1 + pg_temp.d(2, 15)
                when i in (34, 35) then d1 + d2 + d3 + pg_temp.d(2, 10)
                else d1 + d2 + d3 + d4 + d5 + pg_temp.d(1, 8) end
      end) * interval '1 day';
    -- Ninguna gestión puede existir antes de que el negocio (cartera/usuarios) exista.
    if t0 < ts_alta + interval '2 days' then t0 := ts_alta + (pg_temp.d(0.1, 6) || ' days')::interval; end if;
    m1 := t0 + d1 * interval '1 day';
    m2 := m1 + d2 * interval '1 day';
    m3 := m2 + d3 * interval '1 day';
    m4 := m3 + d4 * interval '1 day';
    m5 := m4 + d5 * interval '1 day';
    m6 := m5 + d6 * interval '1 day';
    m7 := m6 + d7 * interval '1 day';
    m8 := m7 + d8 * interval '1 day';
    m9 := m8 + d9 * interval '1 day';

    -- ── fila en gestiones (estado final coherente con la etapa) ──
    insert into gestiones (descripcion, etapa, especialidad_id, propiedad_id, legajo_id,
      urgencia, causa, pagador_sugerido, pagador, gestor_id, tecnico_id, asignacion_aceptada,
      costo_final, cargo_admin, nota_emitida_en, cobrado_en, medio_cobro, cobrado_monto, cobrado_fee,
      liq_monto, liq_factura_ref, liq_pagada_en, creado_en)
    values (v_desc, etapa_obj::etapa_gestion, v_esp, pr[v_p], lg[v_p],
      v_urg::urgencia_gestion, v_causa::causa_gestion, v_pag_sug::pagador_gestion,
      case when etapa_obj in ('en_ejecucion','conformidad','facturacion_cobro','liquidacion_tecnico','finalizado') or i = 36 then v_pag::pagador_gestion else null end,
      v_gestor,
      case when etapa_obj in ('ingresado') or i in (31, 33, 44, 45, 50) or (i = 43) then null
           when i in (34, 35) then v_tec else v_tec end,
      case when etapa_obj in ('presupuesto','en_ejecucion','conformidad','facturacion_cobro','liquidacion_tecnico','finalizado') or i in (34, 35, 36) then true
           else null end,
      case when etapa_obj in ('facturacion_cobro','liquidacion_tecnico','finalizado') then cfinal else null end,
      case when etapa_obj in ('en_ejecucion','conformidad','facturacion_cobro','liquidacion_tecnico','finalizado') or i = 36 then cargo else 0 end,
      case when con_nota and etapa_obj in ('facturacion_cobro','liquidacion_tecnico','finalizado') then m7 + d8 * 0.35 * interval '1 day' else null end,
      case when etapa_obj in ('liquidacion_tecnico','finalizado') then m8 else null end,
      case when etapa_obj in ('liquidacion_tecnico','finalizado') then medio else null end,
      case when etapa_obj in ('liquidacion_tecnico','finalizado') then cfinal + cargo else null end,
      case when etapa_obj in ('liquidacion_tecnico','finalizado') then cargo else null end,
      case when etapa_obj = 'finalizado' then liqm else null end,
      case when etapa_obj = 'finalizado' then fref else null end,
      case when etapa_obj = 'finalizado' then m9 else null end,
      t0)
    returning id into g;

    -- fix de técnico para gestiones que no llegaron a solicitud
    if i in (37,38,39,40,41,42) or i in (31) then update gestiones set tecnico_id = null where id = g; end if;

    -- ── eventos + hijos, replicando el flujo natural ──
    insert into eventos_gestion (gestion_id, tipo, actor_id, creado_en) values (g, 'creada', v_gestor, t0);

    -- inbox de origen (algunas, con legajo): reporte del inquilino gestionado
    if lg[v_p] is not null and inbox_n < 6 and random() < 0.25 and etapa_obj <> 'ingresado' then
      inbox_n := inbox_n + 1;
      ty := t0 - pg_temp.d(1, 12) * interval '1 hour';
      insert into inbox_reportes (gmail_message_id, canal, remitente, asunto, cuerpo, recibido_en, estado, gestion_id, procesado_por, creado_en)
      values ('demo-' || substr(md5(g::text), 1, 16), 'email', v_inq_email[v_p],
              'Problema en ' || v_dir[v_p],
              'Hola, les escribo porque ' || lower(left(substr(v_desc, 8), 1)) || substr(substr(v_desc, 8), 2) || '. ¿Pueden mandar a alguien? Gracias.',
              ty, 'gestionado', g, v_gestor, ty);
    end if;

    if etapa_obj = 'ingresado' then
      continue;
    end if;

    -- cancelada desde ingresado (duplicado)
    if i = 31 then
      insert into eventos_gestion (gestion_id, tipo, de_etapa, a_etapa, actor_id, detalle, creado_en)
      values (g, 'transicion', 'ingresado', 'cancelada', v_gestor, jsonb_build_object('motivo', 'Reporte duplicado: ya existe una gestión por la misma falla'), t0 + pg_temp.d(0.1, 2) * interval '1 day');
      continue;
    end if;

    -- ingresado → asignacion
    insert into eventos_gestion (gestion_id, tipo, de_etapa, a_etapa, actor_id, creado_en)
    values (g, 'transicion', 'ingresado', 'asignacion', v_gestor, m1);

    if etapa_obj = 'asignacion' or i in (32, 33) then
      tx := m1 + margen * pg_temp.d(0.1, 0.5) * interval '1 day';
      if i in (32, 33) then tx := m1 + pg_temp.d(0.3, 3) * interval '1 day'; end if;
      if i in (46, 47, 48, 32) then -- solicitada sin respuesta
        insert into eventos_gestion (gestion_id, tipo, actor_id, detalle, creado_en)
        values (g, 'asignacion_solicitada', v_gestor, jsonb_build_object('tecnico', v_tec_nom), tx);
      elsif i in (49, 50) then -- el técnico rechazó
        insert into eventos_gestion (gestion_id, tipo, actor_id, detalle, creado_en)
        values (g, 'asignacion_solicitada', v_gestor, jsonb_build_object('tecnico', v_tec_nom), tx);
        insert into eventos_gestion (gestion_id, tipo, actor_id, detalle, creado_en)
        values (g, 'asignacion_rechazada', v_tec, jsonb_build_object('motivo', pg_temp.pick(array['Estoy con la agenda completa esta semana','No llego a cubrir esa zona estos días','Estoy de viaje hasta fin de mes'])), tx + pg_temp.d(0.1, 1) * interval '1 day');
        if i = 49 and v_tec2 is not null then -- re-solicitada a otro
          update gestiones set tecnico_id = v_tec2 where id = g;
          insert into eventos_gestion (gestion_id, tipo, actor_id, detalle, creado_en)
          values (g, 'asignacion_solicitada', v_gestor, jsonb_build_object('tecnico', (select nombre from tecnicos where id = v_tec2)), tx + pg_temp.d(1.2, 2.5) * interval '1 day');
        end if;
      end if;
      if i = 32 then
        insert into eventos_gestion (gestion_id, tipo, de_etapa, a_etapa, actor_id, detalle, creado_en)
        values (g, 'transicion', 'asignacion', 'cancelada', v_gestor, jsonb_build_object('motivo', 'El inquilino avisó que lo resolvió por su cuenta'), tx + pg_temp.d(2, 8) * interval '1 day');
      elsif i = 33 then
        insert into eventos_gestion (gestion_id, tipo, de_etapa, a_etapa, actor_id, detalle, creado_en)
        values (g, 'transicion', 'asignacion', 'cancelada', v_gestor, jsonb_build_object('motivo', 'No se pudo coordinar el ingreso con el inquilino'), tx + pg_temp.d(2, 8) * interval '1 day');
      end if;
      continue;
    end if;

    -- solicitud (+ posible rechazo previo) y aceptación
    if asig_rech and v_tec2 is not null and v_tec2 <> v_tec then
      tx := m1 + d2 * 0.4 * interval '1 day';
      insert into eventos_gestion (gestion_id, tipo, actor_id, detalle, creado_en)
      values (g, 'asignacion_solicitada', v_gestor, jsonb_build_object('tecnico', (select nombre from tecnicos where id = v_tec2)), tx);
      insert into eventos_gestion (gestion_id, tipo, actor_id, detalle, creado_en)
      values (g, 'asignacion_rechazada', v_tec2, jsonb_build_object('motivo', pg_temp.pick(array['Estoy con la agenda completa esta semana','No llego a cubrir esa zona estos días'])), tx + (m2 - tx) * 0.6);
    end if;
    insert into eventos_gestion (gestion_id, tipo, actor_id, detalle, creado_en)
    values (g, 'asignacion_solicitada', v_gestor, jsonb_build_object('tecnico', v_tec_nom), m2);
    insert into eventos_gestion (gestion_id, tipo, actor_id, creado_en) values (g, 'asignacion_aceptada', v_tec, m3);
    insert into eventos_gestion (gestion_id, tipo, de_etapa, a_etapa, actor_id, creado_en)
    values (g, 'transicion', 'asignacion', 'presupuesto', v_tec, m3 + interval '2 seconds');

    -- inspección previa al presupuesto (a veces)
    if random() < 0.3 or i in (52, 53) then
      tx := m3 + (case when etapa_obj = 'presupuesto' then margen * pg_temp.d(0.1, 0.4) else d4 * pg_temp.d(0.2, 0.6) end) * interval '1 day';
      insert into avances (gestion_id, tecnico_id, tipo, nota, creado_en)
      values (g, v_tec, 'inspeccion', pg_temp.pick(array['Pasé a ver el trabajo, mañana mando el presupuesto','Revisé el problema con el inquilino presente, cotizo materiales y paso número','Hice la inspección: hay que conseguir repuestos antes de cotizar']), tx);
    end if;

    if etapa_obj = 'presupuesto' or i in (34, 35) then
      if i in (54, 55, 56, 57) then -- presupuesto enviado esperando evaluación
        tx := m3 + margen * pg_temp.d(0.3, 0.7) * interval '1 day';
        if i = 57 then -- antes hubo uno rechazado
          ty := m3 + margen * 0.2 * interval '1 day';
          insert into presupuestos (gestion_id, monto_materiales, monto_mano_obra, descripcion_trabajo, plazo_dias, estado, motivo_rechazo, creado_en)
          values (g, mat, round(mano * 1.35 / 1000) * 1000, 'Cotización inicial del trabajo completo', plazo, 'rechazado', 'El monto supera lo autorizado por el propietario, pedir alternativa', ty);
          insert into eventos_gestion (gestion_id, tipo, actor_id, detalle, creado_en)
          values (g, 'presupuesto_enviado', v_tec, jsonb_build_object('total', mat + round(mano * 1.35 / 1000) * 1000, 'plazo_dias', plazo), ty);
          insert into eventos_gestion (gestion_id, tipo, actor_id, detalle, creado_en)
          values (g, 'presupuesto_rechazado', v_gestor, jsonb_build_object('motivo', 'El monto supera lo autorizado por el propietario, pedir alternativa'), ty + pg_temp.d(0.2, 1) * interval '1 day');
        end if;
        insert into presupuestos (gestion_id, monto_materiales, monto_mano_obra, descripcion_trabajo, plazo_dias, notas, estado, creado_en)
        values (g, mat, mano, 'Reparación según lo relevado en la visita', plazo,
                case when random() < 0.4 then pg_temp.pick(array['Incluye materiales puestos en obra','No incluye pintura de terminación','Precio con IVA incluido']) else null end,
                'enviado', tx);
        insert into eventos_gestion (gestion_id, tipo, actor_id, detalle, creado_en)
        values (g, 'presupuesto_enviado', v_tec, jsonb_build_object('total', ptotal, 'plazo_dias', plazo), tx);
      elsif i = 58 then -- rechazado, esperando nueva cotización
        tx := m3 + margen * 0.3 * interval '1 day';
        insert into presupuestos (gestion_id, monto_materiales, monto_mano_obra, descripcion_trabajo, plazo_dias, estado, motivo_rechazo, creado_en)
        values (g, mat, mano, 'Reparación según lo relevado en la visita', plazo, 'rechazado', 'Muy caro respecto de trabajos similares, cotizar de nuevo solo la reparación', tx);
        insert into eventos_gestion (gestion_id, tipo, actor_id, detalle, creado_en)
        values (g, 'presupuesto_enviado', v_tec, jsonb_build_object('total', ptotal, 'plazo_dias', plazo), tx);
        insert into eventos_gestion (gestion_id, tipo, actor_id, detalle, creado_en)
        values (g, 'presupuesto_rechazado', v_gestor, jsonb_build_object('motivo', 'Muy caro respecto de trabajos similares, cotizar de nuevo solo la reparación'), tx + pg_temp.d(0.3, 2) * interval '1 day');
      elsif i in (34, 35) then -- canceladas en presupuesto
        tx := m3 + pg_temp.d(0.5, 3) * interval '1 day';
        insert into presupuestos (gestion_id, monto_materiales, monto_mano_obra, descripcion_trabajo, plazo_dias, estado, motivo_rechazo, creado_en)
        values (g, mat, mano, 'Reparación según lo relevado en la visita', plazo, 'rechazado', 'El propietario no autoriza el gasto', tx);
        insert into eventos_gestion (gestion_id, tipo, actor_id, detalle, creado_en)
        values (g, 'presupuesto_enviado', v_tec, jsonb_build_object('total', ptotal, 'plazo_dias', plazo), tx);
        insert into eventos_gestion (gestion_id, tipo, actor_id, detalle, creado_en)
        values (g, 'presupuesto_rechazado', v_gestor, jsonb_build_object('motivo', 'El propietario no autoriza el gasto'), tx + pg_temp.d(0.2, 1.5) * interval '1 day');
        insert into eventos_gestion (gestion_id, tipo, de_etapa, a_etapa, actor_id, detalle, creado_en)
        values (g, 'transicion', 'presupuesto', 'cancelada', v_gestor,
                jsonb_build_object('motivo', case i when 34 then 'El presupuesto supera lo que autoriza el propietario' else 'El propietario decidió no hacer el trabajo por el costo' end),
                tx + pg_temp.d(1, 4) * interval '1 day');
        update gestiones set asignacion_aceptada = true where id = g;
      end if;
      continue;
    end if;

    -- presupuesto (con posible rechazo previo) y aprobación
    if pres_rech then
      tx := m3 + d4 * pg_temp.d(0.25, 0.5) * interval '1 day';
      insert into presupuestos (gestion_id, monto_materiales, monto_mano_obra, descripcion_trabajo, plazo_dias, estado, motivo_rechazo, creado_en)
      values (g, mat, round(mano * 1.3 / 1000) * 1000, 'Cotización inicial del trabajo completo', plazo, 'rechazado', 'El monto supera lo autorizado por el propietario, pedir alternativa', tx);
      insert into eventos_gestion (gestion_id, tipo, actor_id, detalle, creado_en)
      values (g, 'presupuesto_enviado', v_tec, jsonb_build_object('total', mat + round(mano * 1.3 / 1000) * 1000, 'plazo_dias', plazo), tx);
      insert into eventos_gestion (gestion_id, tipo, actor_id, detalle, creado_en)
      values (g, 'presupuesto_rechazado', v_gestor, jsonb_build_object('motivo', 'El monto supera lo autorizado por el propietario, pedir alternativa'), tx + pg_temp.d(0.1, 0.8) * interval '1 day');
    end if;
    insert into presupuestos (gestion_id, monto_materiales, monto_mano_obra, descripcion_trabajo, plazo_dias, notas, estado, creado_en)
    values (g, mat, mano, 'Reparación según lo relevado en la visita', plazo,
            case when random() < 0.35 then pg_temp.pick(array['Incluye materiales puestos en obra','No incluye pintura de terminación','Precio con IVA incluido']) else null end,
            'aprobado', m4);
    insert into eventos_gestion (gestion_id, tipo, actor_id, detalle, creado_en)
    values (g, 'presupuesto_enviado', v_tec, jsonb_build_object('total', ptotal, 'plazo_dias', plazo), m4);
    if env_pagador then
      insert into eventos_gestion (gestion_id, tipo, actor_id, detalle, creado_en)
      values (g, 'presupuesto_enviado_pagador', v_gestor, jsonb_build_object('total', ptotal + cargo, 'para', v_pag), m4 + d5 * 0.4 * interval '1 day');
    end if;
    insert into eventos_gestion (gestion_id, tipo, actor_id, detalle, creado_en)
    values (g, 'presupuesto_aprobado', v_gestor, jsonb_build_object('pagador', v_pag, 'cargo_admin', cargo), m5);
    insert into eventos_gestion (gestion_id, tipo, de_etapa, a_etapa, actor_id, creado_en)
    values (g, 'transicion', 'presupuesto', 'en_ejecucion', v_gestor, m5 + interval '2 seconds');

    -- cancelada en ejecución
    if i = 36 then
      insert into avances (gestion_id, tecnico_id, tipo, nota, creado_en)
      values (g, v_tec, 'avance', 'Arranqué con el retiro de lo dañado, mañana sigo con los materiales nuevos', m5 + pg_temp.d(0.5, 2) * interval '1 day');
      insert into eventos_gestion (gestion_id, tipo, de_etapa, a_etapa, actor_id, detalle, creado_en)
      values (g, 'transicion', 'en_ejecucion', 'cancelada', v_gestor, jsonb_build_object('motivo', 'El propietario puso la propiedad en venta y frena las obras'), m5 + pg_temp.d(2, 7) * interval '1 day');
      continue;
    end if;

    -- avances durante la ejecución
    n_av := case when etapa_obj = 'en_ejecucion' then pg_temp.rint(0, 3) else pg_temp.rint(0, 2) end;
    for j in 1..n_av loop
      tx := m5 + (case when etapa_obj = 'en_ejecucion' then margen * (j * 0.9 / (n_av + 0.5)) else d6 * (j * 0.9 / (n_av + 0.5)) end) * interval '1 day';
      insert into avances (gestion_id, tecnico_id, tipo, nota, foto_path, creado_en)
      values (g, v_tec, 'avance',
              pg_temp.pick(array['Avancé con el desarme y la preparación de la zona de trabajo','Materiales comprados, mañana sigo con la instalación','Terminé la primera parte, falta la terminación y limpieza','Quedó secando, vuelvo el jueves a dar la segunda mano','Trabajo casi listo, falta el detalle final']),
              case when random() < 0.5 then g || '/avance-' || (extract(epoch from tx) * 1000)::bigint || '.png' else null end,
              tx);
    end loop;

    if etapa_obj = 'en_ejecucion' then continue; end if;

    -- conformidad subida (+ transición) y resolución
    insert into conformidades (gestion_id, foto_path, estado, creado_en)
    values (g, g || '/conformidad-' || (extract(epoch from m6) * 1000)::bigint || '.png',
            case when i = 72 then 'rechazada' when conf_rech then 'rechazada' when etapa_obj = 'conformidad' then 'subida' else 'aprobada' end,
            m6);
    insert into eventos_gestion (gestion_id, tipo, de_etapa, a_etapa, actor_id, creado_en)
    values (g, 'transicion', 'en_ejecucion', 'conformidad', v_tec, m6);

    if i = 72 then -- rechazada, esperando re-subida
      update conformidades set motivo_rechazo = 'En la foto se ve que falta terminar la junta, revisá y resubí' where gestion_id = g;
      insert into eventos_gestion (gestion_id, tipo, actor_id, detalle, creado_en)
      values (g, 'conformidad_rechazada', v_gestor, jsonb_build_object('motivo', 'En la foto se ve que falta terminar la junta, revisá y resubí'), m6 + margen * 0.5 * interval '1 day');
      continue;
    end if;
    if etapa_obj = 'conformidad' then continue; end if;

    if conf_rech then -- hubo una rechazada en el medio, después re-subió y aprobaron
      update conformidades set motivo_rechazo = pg_temp.pick(array['Quedó manchado el piso, falta la limpieza final','El inquilino dice que sigue igual, revisá antes de cerrar']) where gestion_id = g;
      insert into eventos_gestion (gestion_id, tipo, actor_id, detalle, creado_en)
      values (g, 'conformidad_rechazada', v_gestor, (select jsonb_build_object('motivo', motivo_rechazo) from conformidades where gestion_id = g), m6 + d7 * 0.35 * interval '1 day');
      tx := m6 + d7 * 0.65 * interval '1 day';
      insert into conformidades (gestion_id, foto_path, estado, creado_en)
      values (g, g || '/conformidad-' || (extract(epoch from tx) * 1000)::bigint || '.png', 'aprobada', tx);
    end if;
    insert into eventos_gestion (gestion_id, tipo, actor_id, detalle, creado_en)
    values (g, 'conformidad_aprobada', v_gestor, jsonb_build_object('costo_final', cfinal), m7);
    insert into eventos_gestion (gestion_id, tipo, de_etapa, a_etapa, actor_id, creado_en)
    values (g, 'transicion', 'conformidad', 'facturacion_cobro', v_gestor, m7 + interval '2 seconds');

    -- nota de cobro (si corresponde)
    tnota := m7 + d8 * 0.35 * interval '1 day';
    if con_nota and etapa_obj in ('facturacion_cobro', 'liquidacion_tecnico', 'finalizado') then
      if etapa_obj = 'facturacion_cobro' then tnota := m7 + margen * pg_temp.d(0.2, 0.6) * interval '1 day'; end if;
      insert into eventos_gestion (gestion_id, tipo, actor_id, detalle, creado_en)
      values (g, 'nota_cobro_enviada', v_fin, jsonb_build_object('total', cfinal + cargo, 'para', v_pag), tnota);
      if etapa_obj = 'facturacion_cobro' then update gestiones set nota_emitida_en = tnota where id = g; end if;
    end if;
    if etapa_obj = 'facturacion_cobro' then continue; end if;

    -- cobro registrado (+ transición a liquidación)
    insert into eventos_gestion (gestion_id, tipo, actor_id, detalle, creado_en)
    values (g, 'cobro_registrado', v_fin, jsonb_build_object('medio', medio), m8);
    insert into eventos_gestion (gestion_id, tipo, de_etapa, a_etapa, actor_id, creado_en)
    values (g, 'transicion', 'facturacion_cobro', 'liquidacion_tecnico', v_fin, m8 + interval '2 seconds');
    if etapa_obj = 'liquidacion_tecnico' then continue; end if;

    -- liquidación (+ transición a finalizado) y calificación
    insert into eventos_gestion (gestion_id, tipo, actor_id, detalle, creado_en)
    values (g, 'liquidacion_registrada', v_fin,
            jsonb_strip_nulls(jsonb_build_object('monto', liqm, 'factura_ref', fref)), m9);
    insert into eventos_gestion (gestion_id, tipo, de_etapa, a_etapa, actor_id, creado_en)
    values (g, 'transicion', 'liquidacion_tecnico', 'finalizado', v_fin, m9 + interval '2 seconds');

    if con_calif then
      est := case when random() < 0.4 then 5 when random() < 0.58 then 4 when random() < 0.6 then 3 when random() < 0.7 then 2 else 1 end;
      if v_tec in (t_raul, t_sergio) and est < 4 then est := est + 1; end if;
      if v_tec = t_dario and est > 2 then est := est - 1; end if;
      insert into calificaciones (gestion_id, tecnico_id, autor_id, estrellas, comentario, creado_en)
      values (g, v_tec, v_gestor, est,
              case when random() < 0.6 then pg_temp.pick(array['Impecable, rápido y prolijo','Buen trabajo, dejó todo limpio','Cumplió pero tardó más de lo pactado','Tuvo que volver dos veces, al final quedó bien','Excelente trato con el inquilino','Correcto, aunque costó coordinar los horarios']) else null end,
              least(m9 + pg_temp.d(0.05, 2) * interval '1 day', now() - interval '1 hour'));
    end if;
  end loop;

  -- ── Inbox suelto: 2 pendientes + 2 descartados ──
  insert into inbox_reportes (gmail_message_id, canal, remitente, asunto, cuerpo, recibido_en, estado, creado_en) values
    ('demo-' || substr(md5(random()::text), 1, 16), 'email', v_inq_email[3], 'Se rompió la persiana del comedor',
     'Hola, se cortó la cinta de la persiana del comedor y quedó baja. ¿Pueden mandar a alguien? Gracias.',
     now() - interval '26 hours', 'pendiente', now() - interval '26 hours'),
    ('demo-' || substr(md5(random()::text), 1, 16), 'email', v_inq_email[9], 'Consulta por humedad en el baño',
     'Buenas, hay una mancha de humedad al lado de la ducha que va creciendo. Adjunto foto. Saludos.',
     now() - interval '7 hours', 'pendiente', now() - interval '7 hours');
  insert into inbox_reportes (gmail_message_id, canal, remitente, asunto, cuerpo, recibido_en, estado, motivo_descarte, procesado_por, creado_en) values
    ('demo-' || substr(md5(random()::text), 1, 16), 'email', 'consultas@inmobiliariacba.com.ar', 'Consulta por alquiler en zona norte',
     'Hola, quería saber si tienen departamentos disponibles para alquilar en zona norte. Gracias.',
     now() - interval '12 days', 'descartado', 'Consulta comercial, no es un reporte de mantenimiento', v_uno, now() - interval '12 days'),
    ('demo-' || substr(md5(random()::text), 1, 16), 'email', 'promos@ofertashogar.com', 'Aprovechá 40% OFF en aires acondicionados',
     'Solo esta semana, cuotas sin interés en splits de todas las marcas.',
     now() - interval '6 days', 'descartado', 'Publicidad / spam', v_val, now() - interval '6 days');

  -- ── Notificaciones: réplica manual de matriz_notificaciones (triggers off) ──
  -- destino gestor / técnico (asignacion_solicitada usa el técnico del detalle:
  -- el destinatario correcto aunque después haya rechazado y cambiara el asignado)
  insert into notificaciones (usuario_id, gestion_id, titulo, cuerpo, creado_en, leida_en)
  select dest.uid, e.gestion_id, m.titulo, left(gg.descripcion, 120), e.creado_en,
         case when e.creado_en < now() - interval '4 days'
                then e.creado_en + (random() * 36 + 0.3) * interval '1 hour'
              when random() < 0.25
                then least(e.creado_en + (random() * 5 + 0.1) * interval '1 hour', now() - interval '5 minutes')
              else null end
  from eventos_gestion e
  join gestiones gg on gg.id = e.gestion_id and gg.descripcion like '[DEMO] %'
  join matriz_notificaciones m on m.tipo_evento = e.tipo and (m.a_etapa is null or m.a_etapa = e.a_etapa)
  cross join lateral (select case
      when m.destino = 'tecnico' and e.tipo = 'asignacion_solicitada'
        then (select t.id from tecnicos t where t.nombre = e.detalle->>'tecnico' limit 1)
      when m.destino = 'tecnico' then gg.tecnico_id
      when m.destino in ('gestor', 'nuevo_gestor') then gg.gestor_id end as uid) dest
  where m.destino <> 'administrativos' and dest.uid is not null and dest.uid <> e.actor_id;

  -- destino administrativos (una por administrativo activo, sin auto-notificarse)
  insert into notificaciones (usuario_id, gestion_id, titulo, cuerpo, creado_en, leida_en)
  select u.id, e.gestion_id, m.titulo, left(gg.descripcion, 120), e.creado_en,
         case when e.creado_en < now() - interval '4 days'
                then e.creado_en + (random() * 36 + 0.3) * interval '1 hour'
              when random() < 0.25
                then least(e.creado_en + (random() * 5 + 0.1) * interval '1 hour', now() - interval '5 minutes')
              else null end
  from eventos_gestion e
  join gestiones gg on gg.id = e.gestion_id and gg.descripcion like '[DEMO] %'
  join matriz_notificaciones m on m.tipo_evento = e.tipo and (m.a_etapa is null or m.a_etapa = e.a_etapa)
  join usuarios u on u.rol = 'gestor_administrativo' and u.esta_activo and u.id <> e.actor_id
  where m.destino = 'administrativos';

  -- inbox → gestores de mantenimiento + admin activos (réplica de notificar_inbox)
  insert into notificaciones (usuario_id, titulo, cuerpo, creado_en, leida_en)
  select u.id, 'Nuevo reporte en el inbox', coalesce(left(r.asunto, 120), 'Sin asunto'), r.creado_en,
         case when r.creado_en < now() - interval '4 days'
                then r.creado_en + (random() * 24 + 0.3) * interval '1 hour'
              else null end
  from inbox_reportes r
  join usuarios u on u.rol in ('gestor_mantenimiento', 'administrador') and u.esta_activo
  where r.gmail_message_id like 'demo-%';

  -- solicitudes de técnico (enrolamiento de Federico y Gastón)
  insert into notificaciones (usuario_id, titulo, cuerpo, creado_en, leida_en)
  select u.id, 'Nueva solicitud de técnico', t.nombre, t.creado_en,
         case when t.creado_en < now() - interval '4 days' then t.creado_en + (random() * 24 + 0.5) * interval '1 hour' else null end
  from tecnicos t
  join usuarios u on u.rol in ('gestor_mantenimiento', 'administrador') and u.esta_activo
  where t.email in ('ausitesis+demotecnicofede@gmail.com', 'ausitesis+demotecnicogaston@gmail.com');

  -- ── Emails (solo el log, igual que deja features/email — no se envía nada) ──
  -- reporte_recibido → inquilino, al crear (si hay legajo)
  insert into emails_enviados (para, asunto, tipo, gestion_id, estado, creado_en)
  select i2.email, 'Recibimos tu reporte de mantenimiento', 'reporte_recibido', gg.id, 'enviado', e.creado_en
  from eventos_gestion e
  join gestiones gg on gg.id = e.gestion_id and gg.descripcion like '[DEMO] %' and gg.legajo_id is not null
  join legajos l on l.id = gg.legajo_id join inquilinos i2 on i2.id = l.inquilino_id
  where e.tipo = 'creada';
  -- tecnico_asignado → inquilino, al aceptar el técnico
  insert into emails_enviados (para, asunto, tipo, gestion_id, estado, creado_en)
  select i2.email, 'Un técnico va a atender tu reporte', 'tecnico_asignado', gg.id, 'enviado', e.creado_en
  from eventos_gestion e
  join gestiones gg on gg.id = e.gestion_id and gg.descripcion like '[DEMO] %' and gg.legajo_id is not null
  join legajos l on l.id = gg.legajo_id join inquilinos i2 on i2.id = l.inquilino_id
  where e.tipo = 'asignacion_aceptada';
  -- resuelto → inquilino, al aprobar la conformidad
  insert into emails_enviados (para, asunto, tipo, gestion_id, estado, creado_en)
  select i2.email, 'El mantenimiento quedó resuelto', 'resuelto', gg.id, 'enviado', e.creado_en
  from eventos_gestion e
  join gestiones gg on gg.id = e.gestion_id and gg.descripcion like '[DEMO] %' and gg.legajo_id is not null
  join legajos l on l.id = gg.legajo_id join inquilinos i2 on i2.id = l.inquilino_id
  where e.tipo = 'conformidad_aprobada';
  -- presupuesto / nota_cobro → pagador (inquilino o propietario)
  insert into emails_enviados (para, asunto, tipo, gestion_id, estado, creado_en)
  select case when gg.pagador = 'propietario' then po2.email else i2.email end,
         case when e.tipo = 'nota_cobro_enviada' then 'Nota de cobro — ' || p2.direccion else 'Presupuesto de obra — ' || p2.direccion end,
         case when e.tipo = 'nota_cobro_enviada' then 'nota_cobro' else 'presupuesto' end,
         gg.id, 'enviado', e.creado_en
  from eventos_gestion e
  join gestiones gg on gg.id = e.gestion_id and gg.descripcion like '[DEMO] %'
  join propiedades p2 on p2.id = gg.propiedad_id
  join propietarios po2 on po2.id = p2.propietario_id
  left join legajos l on l.id = gg.legajo_id
  left join inquilinos i2 on i2.id = l.inquilino_id
  where e.tipo in ('nota_cobro_enviada', 'presupuesto_enviado_pagador')
    and (gg.pagador = 'propietario' or i2.email is not null);
  -- comprobante_liquidacion → técnico, al liquidar
  insert into emails_enviados (para, asunto, tipo, gestion_id, estado, creado_en)
  select t.email, 'Comprobante de liquidación — ' || p2.direccion, 'comprobante_liquidacion', gg.id, 'enviado', e.creado_en
  from eventos_gestion e
  join gestiones gg on gg.id = e.gestion_id and gg.descripcion like '[DEMO] %'
  join propiedades p2 on p2.id = gg.propiedad_id
  join tecnicos t on t.id = gg.tecnico_id
  where e.tipo = 'liquidacion_registrada';
end
$seed$;

alter table eventos_gestion enable trigger trg_notificar_evento;
alter table inbox_reportes  enable trigger trg_notificar_inbox;
alter table tecnicos        enable trigger trg_notificar_solicitud_tecnico;

-- Verificación
select etapa::text, count(*) from gestiones where descripcion like '[DEMO] %' group by etapa
union all select 'TOTAL gestiones', count(*) from gestiones where descripcion like '[DEMO] %'
union all select 'eventos', count(*) from eventos_gestion e join gestiones g on g.id = e.gestion_id and g.descripcion like '[DEMO] %'
union all select 'notificaciones', count(*) from notificaciones n where n.gestion_id in (select id from gestiones where descripcion like '[DEMO] %')
union all select 'emails', count(*) from emails_enviados where para like 'ausitesis+demo%'
union all select 'inbox', count(*) from inbox_reportes where gmail_message_id like 'demo-%'
union all select 'usuarios demo', count(*) from usuarios where email like 'ausitesis+demo%'
union all select 'tecnicos demo', count(*) from tecnicos where email like 'ausitesis+demo%'
union all select 'propiedades demo', count(*) from propiedades p join propietarios o on o.id = p.propietario_id and o.email like 'ausitesis+demo%';
