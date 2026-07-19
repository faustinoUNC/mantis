-- avanzar_etapa() — LA función de transición de etapas (fuente de verdad).
-- STORY-1014: primera vez versionada en el repo (antes vivía solo en Supabase).
-- Toda modificación se hace ACÁ y se aplica con una migración — nunca a mano
-- en el editor SQL sin actualizar este archivo.
--
-- Historia: STORY-966 (desasignar = retroceso total), STORY-967 (cancelación
-- con cargo), STORY-970 (envío de presupuesto no sobrevive), STORY-976 (el
-- aviso "no puedo continuar" no sobrevive), STORY-914 (cancelar),
-- STORY-1014 (el adelanto del saliente se congela en el evento y se resetea).

CREATE OR REPLACE FUNCTION public.avanzar_etapa(p_gestion uuid, p_nueva etapa_gestion, p_detalle jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actual public.etapa_gestion;
  v_gestor uuid;
  v_tecnico uuid;
  v_materiales numeric;
  v_adelanto numeric;
  v_cargo_cancel numeric;
  v_rol public.rol_usuario;
  v_uid uuid;
  v_detalle jsonb := p_detalle;
begin
  select etapa, gestor_id, tecnico_id, materiales_total, adelanto_materiales, cargo_cancelacion
    into v_actual, v_gestor, v_tecnico, v_materiales, v_adelanto, v_cargo_cancel
  from public.gestiones where id = p_gestion for update;
  if not found then
    raise exception 'gestion_inexistente';
  end if;

  v_rol := public.rol_actual();
  v_uid := (select auth.uid());

  if not (
    (v_actual = 'ingresado'           and p_nueva = 'asignacion') or
    (v_actual = 'asignacion'          and p_nueva = 'presupuesto') or
    (v_actual = 'presupuesto'         and p_nueva = 'en_ejecucion') or
    -- STORY-966: desasignar técnico — retroceso total a Asignación (el nuevo
    -- técnico rehace evaluación, presupuesto, ejecución y rendición).
    (v_actual in ('presupuesto','en_ejecucion','conformidad') and p_nueva = 'asignacion') or
    (v_actual = 'en_ejecucion'        and p_nueva = 'conformidad') or
    (v_actual = 'conformidad'         and p_nueva = 'facturacion_cobro') or
    -- STORY-967: cancelación con cargo — entra a Cobro marcada como cancelación.
    (v_actual in ('presupuesto','en_ejecucion') and p_nueva = 'facturacion_cobro'
       and coalesce(p_detalle->>'cancelacion','') = 'true') or
    (v_actual = 'facturacion_cobro'   and p_nueva = 'liquidacion_tecnico') or
    -- STORY-967: el cobro de una cancelación cierra en cancelada (solo si la
    -- gestión tiene cargo de cancelación — una gestión normal no puede).
    (v_actual = 'facturacion_cobro'   and p_nueva = 'cancelada' and v_cargo_cancel is not null) or
    (v_actual = 'liquidacion_tecnico' and p_nueva = 'finalizado') or
    -- STORY-914: cancelar (sin cargo) desde cualquier etapa operativa.
    (v_actual in ('ingresado','asignacion','presupuesto','en_ejecucion','conformidad') and p_nueva = 'cancelada')
  ) then
    raise exception 'transicion_invalida';
  end if;

  -- Cancelar exige motivo no vacío en el detalle.
  if p_nueva = 'cancelada' and v_actual <> 'facturacion_cobro'
     and coalesce(trim(p_detalle->>'motivo'), '') = '' then
    raise exception 'motivo_requerido';
  end if;
  -- STORY-966: desasignar también — el motivo queda congelado en el evento.
  if p_nueva = 'asignacion' and v_actual <> 'ingresado'
     and coalesce(trim(p_detalle->>'motivo'), '') = '' then
    raise exception 'motivo_requerido';
  end if;
  -- STORY-967: cancelación con cargo también exige motivo.
  if p_nueva = 'facturacion_cobro' and coalesce(p_detalle->>'cancelacion','') = 'true'
     and coalesce(trim(p_detalle->>'motivo'), '') = '' then
    raise exception 'motivo_requerido';
  end if;

  if v_actual = 'en_ejecucion' and p_nueva = 'conformidad' and v_tecnico = v_uid then
    null; -- técnico asignado sube conformidad
  elsif v_actual in ('ingresado','asignacion','presupuesto','en_ejecucion','conformidad') then
    if not (v_rol = 'administrador' or (v_rol = 'gestor_mantenimiento' and v_gestor = v_uid)) then
      raise exception 'sin_permiso';
    end if;
  else
    if not (v_rol in ('administrador','gestor_administrativo')) then
      raise exception 'sin_permiso';
    end if;
  end if;

  -- STORY-966: retroceso total al desasignar — sin restos del técnico
  -- saliente, pero con sus hechos congelados en el detalle del evento
  -- (historial, avances y fotos del bucket se conservan).
  -- STORY-1014: el adelanto es plata en la mano del TÉCNICO, no de la
  -- gestión — se congela como adelanto_saliente y la columna vuelve a NULL
  -- (el entrante arranca en cero: su adelanto no se apila y su liquidación
  -- no descuenta plata ajena). La eventual devolucion_adelanto ya viene en
  -- p_detalle desde el modal.
  if p_nueva = 'asignacion' and v_actual in ('presupuesto','en_ejecucion','conformidad') then
    v_detalle := coalesce(v_detalle, '{}'::jsonb)
      || jsonb_build_object('tecnico_saliente', v_tecnico)
      || case when v_materiales is not null
           then jsonb_build_object('materiales_total_saliente', v_materiales)
           else '{}'::jsonb end
      || case when v_adelanto is not null
           then jsonb_build_object('adelanto_saliente', v_adelanto)
           else '{}'::jsonb end;
    update public.gestiones
      set tecnico_id = null,
          asignacion_aceptada = null,
          desasignada_en = now(),
          materiales_total = null,
          materiales_fotos_paths = null,
          costo_final = null,
          adelanto_materiales = null,
          -- STORY-970: el envío del presupuesto era del técnico saliente — el
          -- nuevo presupuesto exige su propio envío al pagador.
          presupuesto_enviado_en = null
      where id = p_gestion;
    update public.presupuestos
      set estado = 'rechazado',
          motivo_rechazo = coalesce(motivo_rechazo, 'Técnico desasignado')
      where gestion_id = p_gestion and estado in ('enviado','aprobado');
    update public.conformidades
      set estado = 'rechazada',
          motivo_rechazo = coalesce(motivo_rechazo, 'Técnico desasignado')
      where gestion_id = p_gestion and estado = 'subida';
  end if;

  -- STORY-976: toda transición es una decisión del gestor que resuelve el
  -- aviso "no puedo continuar" — el campo no sobrevive a un cambio de etapa.
  update public.gestiones
    set etapa = p_nueva,
        aviso_no_continua_en = null,
        aviso_no_continua_motivo = null
    where id = p_gestion;
  insert into public.eventos_gestion (gestion_id, tipo, de_etapa, a_etapa, actor_id, detalle)
  values (p_gestion, 'transicion', v_actual, p_nueva, v_uid, v_detalle);
end;
$function$;