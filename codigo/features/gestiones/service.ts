"use server";

import { revalidatePath } from "next/cache";
import { obtenerUsuarioActual } from "@/features/auth/service";
import type { Rol } from "@/features/auth/types";
import { emailEstadoGestion } from "@/features/email/service";
import type { ActionResult } from "@/features/empleados/types";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { createClient } from "@/shared/lib/supabase/server";
import type {
  Etapa,
  GestionDetalle,
  GestionResumen,
  Pagador,
  StatsTecnico,
  TecnicoDisponible,
  Urgencia,
} from "./types";
import { ETAPAS_TERMINALES } from "./types";
import { ejecucionParaPlazoDias, type TransicionEjecucion } from "./ejecucion";
import { nombrarSalientes } from "./salientes";

const BUCKET = "gestiones";
const MIME_FOTOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_FOTO_BYTES = 8 * 1024 * 1024;

const RUTAS_TABLERO = ["/gestion", "/admin", "/administracion", "/tecnico"];
function refrescarTablero(id?: string) {
  RUTAS_TABLERO.forEach((r) => revalidatePath(r));
  if (id) revalidatePath(`/gestiones/${id}`);
}

function normalizarFila(g: Record<string, unknown>): GestionResumen {
  const propiedad = g.propiedades as {
    direccion: string;
    propietarios?: { nombre: string } | null;
  } | null;
  // STORY-962: el inquilino solo cuenta si su legajo sigue vigente (fecha_fin
  // null). Un legajo cerrado se trata como "sin inquilino, solo propietario",
  // igual que la cartera — la gestión no puede resucitar al inquilino que se fue.
  const legajo = g.legajos as
    | { fecha_fin: string | null; inquilinos: { nombre: string } | null }
    | null;
  const inquilinoVigente = legajo?.fecha_fin == null ? legajo?.inquilinos : null;
  const especialidad = g.especialidades as { nombre: string } | null;
  // STORY-979: el rol viene null cuando la RLS de usuarios no deja ver la
  // fila del gestor (roles no-admin) — el filtro por rol es solo del admin.
  const gestor = g.gestor as { nombre: string; rol: Rol } | null;
  const tecnico = g.tecnico as { nombre: string } | null;
  const presupuestos = (g.presupuestos as { estado: string }[] | null) ?? [];
  const conformidades =
    (g.conformidades as { estado: string; creado_en: string }[] | null) ?? [];
  const ultimaConformidad = [...conformidades].sort((a, b) =>
    b.creado_en.localeCompare(a.creado_en)
  )[0];
  return {
    id: g.id as string,
    descripcion: g.descripcion as string,
    etapa: g.etapa as Etapa,
    urgencia: g.urgencia as Urgencia,
    especialidad: especialidad?.nombre ?? "—",
    direccion: propiedad?.direccion ?? "—",
    propietario_nombre: propiedad?.propietarios?.nombre ?? null,
    inquilino_nombre: inquilinoVigente?.nombre ?? null,
    gestor_id: g.gestor_id as string,
    gestor_rol: gestor?.rol ?? null,
    gestor_nombre: gestor?.nombre ?? "—",
    tecnico_nombre: tecnico?.nombre ?? null,
    asignacion_aceptada: (g.asignacion_aceptada as boolean | null) ?? null,
    presupuesto_pendiente: presupuestos.some((p) => p.estado === "enviado"),
    conformidad_rechazada: ultimaConformidad?.estado === "rechazada",
    desasignada_en: (g.desasignada_en as string | null) ?? null,
    aviso_no_continua_en: (g.aviso_no_continua_en as string | null) ?? null,
    creado_en: g.creado_en as string,
  };
}

const SELECT_RESUMEN =
  "id, descripcion, etapa, urgencia, asignacion_aceptada, desasignada_en, aviso_no_continua_en, creado_en, gestor_id, propiedades(direccion, propietarios(nombre)), legajos(fecha_fin, inquilinos(nombre)), especialidades(nombre), gestor:usuarios!gestiones_gestor_id_fkey(nombre, rol), tecnico:tecnicos!gestiones_tecnico_id_fkey(nombre), presupuestos(estado), conformidades(estado, creado_en)";

// STORY-938: igual que SELECT_RESUMEN pero con el contacto de propietario/
// inquilino — solo para el detalle (obtenerGestion), el tablero no lo necesita.
// (gestor_id no va acá: obtenerGestion ya lo suma junto a tecnico_id y demás.)
const SELECT_DETALLE =
  "id, descripcion, etapa, urgencia, asignacion_aceptada, desasignada_en, aviso_no_continua_en, creado_en, propiedades(direccion, propietarios(nombre, email, telefono)), legajos(fecha_fin, inquilinos(nombre, email, telefono)), especialidades(nombre), gestor:usuarios!gestiones_gestor_id_fkey(nombre, rol), tecnico:tecnicos!gestiones_tecnico_id_fkey(nombre), presupuestos(estado), conformidades(estado, creado_en)";

// Inquilino si la gestión tiene legajo vigente; si no, el propietario.
function resolverContacto(g: Record<string, unknown>): GestionDetalle["contacto_cliente"] {
  const propiedad = g.propiedades as {
    propietarios?: { nombre: string; email: string | null; telefono: string | null } | null;
  } | null;
  const legajo = g.legajos as {
    fecha_fin: string | null;
    inquilinos: { nombre: string; email: string | null; telefono: string | null } | null;
  } | null;
  // STORY-962: legajo cerrado (fecha_fin ≠ null) → el inquilino ya no habita;
  // el contacto vigente pasa a ser el propietario.
  const inquilino = legajo?.fecha_fin == null ? legajo?.inquilinos : null;
  const propietario = propiedad?.propietarios;
  if (inquilino) {
    return { tipo: "inquilino", nombre: inquilino.nombre, telefono: inquilino.telefono, email: inquilino.email };
  }
  if (propietario) {
    return { tipo: "propietario", nombre: propietario.nombre, telefono: propietario.telefono, email: propietario.email };
  }
  return null;
}

// El tablero: RLS decide qué ve cada rol (ownership del gestor incluida).
// Las archivadas (STORY-935) salen del tablero — viven en /gestiones/archivadas.
export async function tableroGestiones(): Promise<GestionResumen[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("gestiones")
    .select(SELECT_RESUMEN)
    .is("archivada_en", null)
    .order("urgencia", { ascending: false })
    .order("creado_en", { ascending: true });
  return (data ?? []).map((g) => normalizarFila(g as Record<string, unknown>));
}

// STORY-935: la vista "Archivo" — misma query y misma RLS que el tablero
// (cada rol ve exactamente lo que le corresponde), solo que al revés.
export async function gestionesArchivadas(): Promise<
  (GestionResumen & { archivada_en: string })[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("gestiones")
    .select(`${SELECT_RESUMEN}, archivada_en`)
    .not("archivada_en", "is", null)
    .order("archivada_en", { ascending: false });
  return (data ?? []).map((g) => ({
    ...normalizarFila(g as Record<string, unknown>),
    archivada_en: (g as Record<string, unknown>).archivada_en as string,
  }));
}

// STORY-935: archivar una finalizada la saca del tablero (no es una etapa —
// es ordenar). El update va por cliente de sesión: la RLS decide quién puede
// (admin, gestor owner, administrativo) y el guard de etapa hace el resto.
export async function archivarGestion(
  gestionId: string,
  archivar: boolean
): Promise<ActionResult> {
  const actual = await obtenerUsuarioActual();
  if (!actual) return { ok: false, error: "Sin sesión." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gestiones")
    .update({ archivada_en: archivar ? new Date().toISOString() : null })
    .eq("id", gestionId)
    .eq("etapa", "finalizado")
    .select("id");
  if (error || !data?.length) {
    return {
      ok: false,
      error: archivar
        ? "No se pudo archivar (solo gestiones finalizadas)."
        : "No se pudo desarchivar.",
    };
  }

  await supabase.from("eventos_gestion").insert({
    gestion_id: gestionId,
    tipo: archivar ? "archivada" : "desarchivada",
    actor_id: actual.id,
  });

  refrescarTablero(gestionId);
  revalidatePath("/gestiones/archivadas");
  return { ok: true };
}

export async function crearGestion(datos: {
  descripcion: string;
  propiedad_id: string;
  especialidad_id: string;
  urgencia: Urgencia;
}): Promise<ActionResult<{ gestionId: string }>> {
  const actual = await obtenerUsuarioActual();
  if (!actual) return { ok: false, error: "Sin sesión." };

  // STORY-935: sin técnico para la especialidad, la gestión nace muerta —
  // mismo criterio exacto que la pantalla de asignación.
  const disponibles = await tecnicosDisponibles(datos.especialidad_id);
  if (disponibles.length === 0) {
    return {
      ok: false,
      error:
        "No hay técnicos activos con esa especialidad — cargá uno antes de crear la gestión.",
    };
  }

  const supabase = await createClient();
  const { data: legajo } = await supabase
    .from("legajos")
    .select("id")
    .eq("propiedad_id", datos.propiedad_id)
    .is("fecha_fin", null)
    .maybeSingle();

  const { data: gestion, error } = await supabase
    .from("gestiones")
    .insert({
      ...datos,
      legajo_id: legajo?.id ?? null,
      gestor_id: actual.id,
    })
    .select("id")
    .single();
  if (error || !gestion) {
    return { ok: false, error: "No se pudo crear la gestión." };
  }

  await supabase.from("eventos_gestion").insert({
    gestion_id: gestion.id,
    tipo: "creada",
    actor_id: actual.id,
  });

  await emailEstadoGestion(gestion.id, "reporte_recibido");

  refrescarTablero();
  return { ok: true, data: { gestionId: gestion.id } };
}

async function fotoConUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const admin = createAdminClient();
  const { data } = await admin.storage.from(BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export async function obtenerGestion(
  id: string
): Promise<GestionDetalle | null> {
  const supabase = await createClient();
  const { data: g } = await supabase
    .from("gestiones")
    .select(
      `${SELECT_DETALLE}, pagador, costo_final, cargo_admin, cargo_cancelacion, materiales_total, materiales_fotos_paths, adelanto_materiales, nota_emitida_en, presupuesto_enviado_en, archivada_en, aviso_no_continua_motivo, gestor_id, tecnico_id, propiedad_id, especialidad_id, calificaciones(estrellas, comentario)`
    )
    .eq("id", id)
    .single();
  if (!g) return null;

  const [
    { data: eventos },
    { data: presupuestos },
    { data: avances },
    { data: conformidades },
  ] =
    await Promise.all([
      supabase
        .from("eventos_gestion")
        .select("id, tipo, de_etapa, a_etapa, actor_id, detalle, creado_en, actor:usuarios(nombre)")
        .eq("gestion_id", id)
        .order("creado_en", { ascending: false }),
      supabase
        .from("presupuestos")
        .select("id, tecnico_id, monto_materiales, monto_mano_obra, descripcion_trabajo, plazo_dias, notas, estado, motivo_rechazo, creado_en")
        .eq("gestion_id", id)
        .order("creado_en", { ascending: false }),
      supabase
        .from("avances")
        .select("id, tecnico_id, tipo, nota, foto_path, creado_en")
        .eq("gestion_id", id)
        .order("creado_en", { ascending: false }),
      supabase
        .from("conformidades")
        .select("id, tecnico_id, foto_path, estado, motivo_rechazo, creado_en")
        .eq("gestion_id", id)
        .order("creado_en", { ascending: false }),
    ]);

  const base = normalizarFila(g as unknown as Record<string, unknown>);
  const fila = g as unknown as {
    pagador: Pagador | null;
    costo_final: number | null;
    cargo_admin: number | null;
    cargo_cancelacion: number | null;
    materiales_total: number | null;
    materiales_fotos_paths: string[] | null;
    adelanto_materiales: number | null;
    nota_emitida_en: string | null;
    presupuesto_enviado_en: string | null;
    archivada_en: string | null;
    aviso_no_continua_motivo: string | null;
    gestor_id: string;
    tecnico_id: string | null;
    propiedad_id: string;
    especialidad_id: string;
    // to-ONE (gestion_id UNIQUE): PostgREST devuelve objeto, no array.
    calificaciones:
      | { estrellas: number; comentario: string | null }
      | { estrellas: number; comentario: string | null }[]
      | null;
  };

  const calif = Array.isArray(fila.calificaciones)
    ? fila.calificaciones[0]
    : fila.calificaciones;
  return {
    ...base,
    calificacion: calif ?? null,
    contacto_cliente: resolverContacto(g as unknown as Record<string, unknown>),
    pagador: fila.pagador,
    costo_final: fila.costo_final,
    cargo_admin: fila.cargo_admin,
    cargo_cancelacion:
      fila.cargo_cancelacion == null ? null : Number(fila.cargo_cancelacion),
    materiales_total: fila.materiales_total == null ? null : Number(fila.materiales_total),
    adelanto_materiales:
      fila.adelanto_materiales == null ? null : Number(fila.adelanto_materiales),
    materiales_fotos_urls: (
      await Promise.all((fila.materiales_fotos_paths ?? []).map(fotoConUrl))
    ).filter((u): u is string => u != null),
    nota_emitida_en: fila.nota_emitida_en,
    presupuesto_enviado_en: fila.presupuesto_enviado_en,
    archivada_en: fila.archivada_en,
    aviso_no_continua_motivo: fila.aviso_no_continua_motivo,
    gestor_id: fila.gestor_id,
    tecnico_id: fila.tecnico_id,
    propiedad_id: fila.propiedad_id,
    especialidad_id: fila.especialidad_id,
    // STORY-974: el tecnico_saliente congelado es un UUID — se nombra acá.
    eventos: (await nombrarSalientes(eventos ?? [], supabase)).map((e) => ({
      ...e,
      actor: Array.isArray(e.actor) ? (e.actor[0] ?? null) : e.actor,
    })) as GestionDetalle["eventos"],
    presupuestos: (presupuestos ?? []) as GestionDetalle["presupuestos"],
    avances: await Promise.all(
      (avances ?? []).map(async (a) => ({
        id: a.id,
        tecnico_id: a.tecnico_id,
        tipo: a.tipo,
        nota: a.nota,
        foto_url: await fotoConUrl(a.foto_path),
        creado_en: a.creado_en,
      }))
    ),
    conformidades: await Promise.all(
      (conformidades ?? []).map(async (c) => ({
        id: c.id,
        tecnico_id: c.tecnico_id,
        estado: c.estado,
        motivo_rechazo: c.motivo_rechazo,
        foto_url: await fotoConUrl(c.foto_path),
        creado_en: c.creado_en,
      }))
    ),
  };
}

export async function avanzarEtapa(
  id: string,
  nueva: Etapa,
  detalle?: Record<string, unknown>
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("avanzar_etapa", {
    p_gestion: id,
    p_nueva: nueva,
    p_detalle: detalle ?? null,
  });
  if (error) {
    const mensajes: Record<string, string> = {
      transicion_invalida: "Esa transición no está permitida.",
      sin_permiso: "No tenés permiso para mover esta gestión.",
    };
    const clave = Object.keys(mensajes).find((k) => error.message.includes(k));
    return { ok: false, error: clave ? mensajes[clave] : "No se pudo avanzar." };
  }
  refrescarTablero(id);
  return { ok: true };
}

// STORY-914: cancelar una gestión (estado terminal con motivo obligatorio).
// STORY-967: post-aceptación del técnico admite un cargo opcional y libre —
// con cargo la gestión pasa por Cobro marcada como cancelación y recién ahí
// cierra en `cancelada` (el cobro la termina). Sin cargo, directo a cancelada.
// La validación de etapa/permiso/motivo vive en avanzar_etapa (Postgres).
export async function cancelarGestion(
  gestionId: string,
  motivo: string,
  cargo?: number
): Promise<ActionResult> {
  if (!motivo?.trim()) return { ok: false, error: "Indicá el motivo de la cancelación." };
  const supabase = await createClient();

  const conCargo = Number(cargo) > 0;
  if (conCargo) {
    if (!Number.isFinite(Number(cargo))) {
      return { ok: false, error: "El cargo por cancelación no es un monto válido." };
    }
    // RLS (admin o gestor owner) decide quién puede; el guard de etapa evita
    // marcar cargo donde no corresponde (el técnico aceptó = presupuesto+).
    const { data, error } = await supabase
      .from("gestiones")
      .update({ cargo_cancelacion: Number(cargo) })
      .eq("id", gestionId)
      .in("etapa", ["presupuesto", "en_ejecucion", "conformidad"])
      .select("id");
    if (error || !data?.length) {
      return { ok: false, error: "No se pudo registrar el cargo de cancelación en esta etapa." };
    }
  }

  const { error } = await supabase.rpc("avanzar_etapa", {
    p_gestion: gestionId,
    p_nueva: conCargo ? "facturacion_cobro" : "cancelada",
    p_detalle: conCargo
      ? { motivo: motivo.trim(), cancelacion: "true", cargo: Number(cargo) }
      : { motivo: motivo.trim() },
  });
  if (error) {
    // Si el avance falló, el cargo marcado no debe quedar colgado.
    if (conCargo) {
      await supabase
        .from("gestiones")
        .update({ cargo_cancelacion: null })
        .eq("id", gestionId);
    }
    const mensajes: Record<string, string> = {
      motivo_requerido: "Indicá el motivo de la cancelación.",
      transicion_invalida: "Esta gestión ya no se puede cancelar.",
      sin_permiso: "No tenés permiso para cancelar esta gestión.",
    };
    const clave = Object.keys(mensajes).find((k) => error.message.includes(k));
    return { ok: false, error: clave ? mensajes[clave] : "No se pudo cancelar." };
  }
  refrescarTablero(gestionId);
  return { ok: true };
}

// STORY-966: desasignar al técnico — la gestión vuelve a Asignación con
// retroceso TOTAL (presupuesto rechazado, rendición limpia; el nuevo técnico
// rehace su evaluación). El historial y los avances del saliente se conservan.
// Postgres congela {motivo, imputado, tecnico_saliente} en el evento; si fue
// abandono, el contador del picker lo lee de ahí (el tecnico_id se pisa).
export async function desasignarTecnico(
  gestionId: string,
  motivo: string,
  abandonoTecnico: boolean
): Promise<ActionResult> {
  if (!motivo?.trim()) {
    return { ok: false, error: "Indicá el motivo de la desasignación." };
  }
  const supabase = await createClient();
  const { data: g } = await supabase
    .from("gestiones")
    .select("tecnico_id, descripcion")
    .eq("id", gestionId)
    .single();
  if (!g?.tecnico_id) {
    return { ok: false, error: "La gestión no tiene técnico asignado." };
  }

  const { error } = await supabase.rpc("avanzar_etapa", {
    p_gestion: gestionId,
    p_nueva: "asignacion",
    p_detalle: {
      motivo: motivo.trim(),
      imputado: abandonoTecnico ? "tecnico" : "gestor",
    },
  });
  if (error) {
    const mensajes: Record<string, string> = {
      motivo_requerido: "Indicá el motivo de la desasignación.",
      transicion_invalida: "En esta etapa no se puede desasignar al técnico.",
      sin_permiso: "No tenés permiso para desasignar en esta gestión.",
    };
    const clave = Object.keys(mensajes).find((k) => error.message.includes(k));
    return { ok: false, error: clave ? mensajes[clave] : "No se pudo desasignar." };
  }

  // La RLS deja de mostrarle la gestión al saliente: sus notificaciones
  // quedarían linkeando a un 404 desde la campanita (patrón STORY-951).
  const admin = createAdminClient();
  await admin
    .from("notificaciones")
    .delete()
    .eq("usuario_id", g.tecnico_id)
    .eq("gestion_id", gestionId);

  // STORY-968: el aviso al saliente no puede salir del trigger outbox
  // (cuando corre, tecnico_id ya está en NULL) — se crea acá con el id
  // capturado antes. Sin gestion_id ni ruta: no hay link que pueda dar
  // 404 y la limpieza de arriba nunca la alcanza. Este INSERT es además
  // la señal realtime que refresca las vistas del técnico (el UPDATE de
  // gestiones no le llega: la fila salió de su alcance RLS).
  await admin.from("notificaciones").insert({
    usuario_id: g.tecnico_id,
    titulo: "Ya no estás asignado a esta gestión",
    cuerpo: (g.descripcion as string | null)?.slice(0, 120) ?? null,
  });

  refrescarTablero(gestionId);
  return { ok: true };
}

// STORY-914: calificación del técnico (estrellas 1–5) que carga el gestor
// dueño al finalizar. Un hecho por gestión (unique), inmutable. RLS valida
// que sea admin o gestor owner.
export async function calificarTecnico(
  gestionId: string,
  estrellas: number,
  comentario?: string
): Promise<ActionResult> {
  const actual = await obtenerUsuarioActual();
  if (!actual) return { ok: false, error: "Sin sesión." };
  if (!Number.isInteger(estrellas) || estrellas < 1 || estrellas > 5) {
    return { ok: false, error: "Elegí entre 1 y 5 estrellas." };
  }

  const supabase = await createClient();
  const { data: g } = await supabase
    .from("gestiones")
    .select("tecnico_id, etapa")
    .eq("id", gestionId)
    .single();
  if (!g?.tecnico_id) return { ok: false, error: "La gestión no tiene técnico asignado." };
  if (g.etapa !== "finalizado") {
    return { ok: false, error: "La calificación se registra al finalizar la gestión." };
  }

  const { error } = await supabase.from("calificaciones").insert({
    gestion_id: gestionId,
    tecnico_id: g.tecnico_id,
    autor_id: actual.id,
    estrellas,
    comentario: comentario?.trim() || null,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Esta gestión ya fue calificada." };
    return { ok: false, error: "No se pudo guardar la calificación." };
  }
  refrescarTablero(gestionId);
  return { ok: true };
}

// ── Asignación (STORY-404) ──

export async function tecnicosDisponibles(
  especialidadId: string
): Promise<TecnicoDisponible[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tecnicos")
    .select(
      "id, nombre, estado, tecnico_especialidades!inner(especialidad_id), todas:tecnico_especialidades(especialidades(nombre)), franjas_disponibilidad(dia_semana, hora_desde, hora_hasta)"
    )
    .eq("estado", "aprobado")
    .eq("tecnico_especialidades.especialidad_id", especialidadId);

  const { data: activos } = await supabase
    .from("usuarios")
    .select("id")
    .eq("rol", "tecnico")
    .eq("esta_activo", true);
  const idsActivos = new Set((activos ?? []).map((u) => u.id));

  type Fila = {
    id: string;
    nombre: string;
    todas: { especialidades: { nombre: string } | null }[];
    franjas_disponibilidad: TecnicoDisponible["franjas"];
  };
  const candidatos = ((data ?? []) as unknown as Fila[]).filter((t) =>
    idsActivos.has(t.id)
  );

  const stats = await estadisticasTecnicos(candidatos.map((t) => t.id));
  const lista = candidatos.map((t) => ({
    id: t.id,
    nombre: t.nombre,
    especialidades: (t.todas ?? [])
      .map((te) => te.especialidades?.nombre)
      .filter((n): n is string => Boolean(n)),
    franjas: t.franjas_disponibilidad ?? [],
    stats: stats.get(t.id) ?? null,
  }));
  // STORY-987 v1.2: mejor calificados primero (los sin calificación quedan al
  // final); se desempata por nombre para un orden estable.
  return lista.sort((a, b) => {
    const ea = a.stats?.estrellas ?? -1;
    const eb = b.stats?.estrellas ?? -1;
    if (eb !== ea) return eb - ea;
    return a.nombre.localeCompare(b.nombre);
  });
}

// STORY-915: desempeño agregado por técnico para el scorecard de asignación.
// Usa admin client a propósito: las stats deben mirar TODAS las gestiones del
// técnico (no solo las del gestor actual, que es lo que ve por RLS). Devuelve
// solo números agregados — nunca gestiones de otros gestores.
async function estadisticasTecnicos(
  ids: string[]
): Promise<Map<string, StatsTecnico>> {
  const salida = new Map<string, StatsTecnico>();
  if (ids.length === 0) return salida;

  const admin = createAdminClient();
  const [{ data: califs }, { data: gestiones }, { data: desasignaciones }, { data: respuestas }] = await Promise.all([
    admin.from("calificaciones").select("tecnico_id, estrellas").in("tecnico_id", ids),
    admin
      .from("gestiones")
      .select(
        "id, tecnico_id, etapa, asignacion_aceptada, costo_final, materiales_total, presupuestos(estado, monto_materiales, monto_mano_obra, plazo_dias)"
      )
      .in("tecnico_id", ids),
    // STORY-966: abandonos desde los eventos congelados — el tecnico_id de la
    // gestión se pisa al reasignar; el evento guarda al saliente para siempre.
    admin
      .from("eventos_gestion")
      .select("detalle")
      .eq("tipo", "transicion")
      .eq("a_etapa", "asignacion")
      .eq("detalle->>imputado", "tecnico")
      .in("detalle->>tecnico_saliente", ids),
    // STORY-970: las respuestas a asignaciones también van por eventos — el
    // rechazo pone tecnico_id = null en el acto, así que el estado vivo de
    // gestiones no puede contarlas. El actor del evento ES el técnico
    // (responder_asignacion valida tecnico_id = auth.uid()).
    admin
      .from("eventos_gestion")
      .select("tipo, actor_id")
      .in("tipo", ["asignacion_aceptada", "asignacion_rechazada"])
      .in("actor_id", ids),
  ]);
  const abandonosPorTecnico = new Map<string, number>();
  for (const e of (desasignaciones ?? []) as { detalle: { tecnico_saliente?: string } | null }[]) {
    const t = e.detalle?.tecnico_saliente;
    if (t) abandonosPorTecnico.set(t, (abandonosPorTecnico.get(t) ?? 0) + 1);
  }
  const respuestasPorTecnico = new Map<string, { total: number; rechazos: number }>();
  for (const e of (respuestas ?? []) as { tipo: string; actor_id: string }[]) {
    const r = respuestasPorTecnico.get(e.actor_id) ?? { total: 0, rechazos: 0 };
    r.total += 1;
    if (e.tipo === "asignacion_rechazada") r.rechazos += 1;
    respuestasPorTecnico.set(e.actor_id, r);
  }

  type GFila = {
    id: string;
    tecnico_id: string;
    etapa: string;
    asignacion_aceptada: boolean | null;
    costo_final: number | null;
    materiales_total: number | null;
    presupuestos: {
      estado: string;
      monto_materiales: number;
      monto_mano_obra: number;
      plazo_dias: number | null;
    }[] | null;
  };

  // STORY-966: cumplimiento de plazo del picker — días reales de la ÚLTIMA
  // ejecución completa (mismo criterio que Informes) vs plazo comprometido.
  const idsGestiones = ((gestiones ?? []) as unknown as GFila[]).map((g) => g.id);
  const ejecucionDias = new Map<string, number>();
  if (idsGestiones.length > 0) {
    const { data: transiciones } = await admin
      .from("eventos_gestion")
      .select("gestion_id, de_etapa, a_etapa, creado_en")
      .eq("tipo", "transicion")
      .in("gestion_id", idsGestiones);
    const porGestion = new Map<string, TransicionEjecucion[]>();
    for (const e of transiciones ?? []) {
      const lista = porGestion.get(e.gestion_id) ?? [];
      lista.push({ aEtapa: e.a_etapa, deEtapa: e.de_etapa, t: new Date(e.creado_en).getTime() });
      porGestion.set(e.gestion_id, lista);
    }
    // STORY-984: para el % de plazo solo cuentan obras terminadas (salida a
    // conformidad) y con piso de 1 día — canceladas/desasignadas no computan.
    for (const [gid, evs] of porGestion) {
      const dias = ejecucionParaPlazoDias(evs);
      if (dias != null) ejecucionDias.set(gid, dias);
    }
  }
  for (const id of ids) {
    const gs = ((gestiones ?? []) as unknown as GFila[]).filter((g) => g.tecnico_id === id);
    const estrellasArr = (califs ?? [])
      .filter((c) => c.tecnico_id === id)
      .map((c) => Number(c.estrellas));

    const respuestas = respuestasPorTecnico.get(id) ?? { total: 0, rechazos: 0 };

    // STORY-937: desvío SOLO de materiales (la mano de obra es fija por
    // diseño), ponderado por plata: Σ reales / Σ presupuestados − 1.
    // Reales = rendición; fallback para viejas: costo_final − mano de obra.
    let matReales = 0;
    let matPresupuestados = 0;
    let nDesvio = 0;
    // STORY-966: cumplimiento de plazo (promedio de % de desvío por obra,
    // mismo cálculo que la card homónima de Informes).
    let plazoTotalPct = 0;
    let nPlazo = 0;
    for (const g of gs) {
      const aprob = (g.presupuestos ?? []).find((p) => p.estado === "aprobado");
      if (!aprob) continue;
      const real =
        Number(aprob.monto_materiales) <= 0
          ? null
          : g.materiales_total != null
            ? Number(g.materiales_total)
            : g.costo_final != null
              ? Number(g.costo_final) - Number(aprob.monto_mano_obra)
              : null;
      if (real != null && real >= 0) {
        matReales += real;
        matPresupuestados += Number(aprob.monto_materiales);
        nDesvio += 1;
      }
      const diasReales = ejecucionDias.get(g.id);
      if (aprob.plazo_dias && aprob.plazo_dias > 0 && diasReales != null) {
        plazoTotalPct += ((diasReales - aprob.plazo_dias) / aprob.plazo_dias) * 100;
        nPlazo += 1;
      }
    }

    const prom = (arr: number[]) =>
      arr.length ? arr.reduce((s, n) => s + n, 0) / arr.length : null;

    salida.set(id, {
      estrellas: prom(estrellasArr),
      nCalif: estrellasArr.length,
      desvioPct: nDesvio
        ? Math.round((matReales / matPresupuestados - 1) * 1000) / 10
        : null,
      nDesvio,
      desvioPlazoPct: nPlazo ? Math.round((plazoTotalPct / nPlazo) * 10) / 10 : null,
      nPlazo,
      obrasActivas: gs.filter((g) => !ETAPAS_TERMINALES.has(g.etapa)).length,
      // Realizadas = solo finalizadas (una cancelada no es un trabajo hecho).
      obrasRealizadas: gs.filter((g) => g.etapa === "finalizado").length,
      pctRechazoAsig: respuestas.total
        ? Math.round((respuestas.rechazos / respuestas.total) * 100)
        : null,
      nAsig: respuestas.total,
      abandonos: abandonosPorTecnico.get(id) ?? 0,
    });
  }
  return salida;
}

export async function asignarTecnico(
  gestionId: string,
  tecnicoId: string
): Promise<ActionResult> {
  const actual = await obtenerUsuarioActual();
  if (!actual) return { ok: false, error: "Sin sesión." };

  const supabase = await createClient();
  // RLS: solo admin o gestor owner pueden actualizar la gestión.
  const { error } = await supabase
    .from("gestiones")
    .update({ tecnico_id: tecnicoId, asignacion_aceptada: null })
    .eq("id", gestionId);
  if (error) return { ok: false, error: "No se pudo asignar." };

  const { data: tecnicoAsignado } = await supabase
    .from("tecnicos")
    .select("nombre")
    .eq("id", tecnicoId)
    .single();
  await supabase.from("eventos_gestion").insert({
    gestion_id: gestionId,
    tipo: "asignacion_solicitada",
    actor_id: actual.id,
    detalle: { tecnico: tecnicoAsignado?.nombre ?? null },
  });

  refrescarTablero(gestionId);
  return { ok: true };
}

// FUN-1: el gestor puede retirar una solicitud que el técnico no respondió
// (técnico desactivado o que no contesta) y volver a elegir. El guard
// .is("asignacion_aceptada", null) evita pisar una aceptación concurrente.
export async function cancelarSolicitudAsignacion(
  gestionId: string
): Promise<ActionResult> {
  const actual = await obtenerUsuarioActual();
  if (!actual) return { ok: false, error: "Sin sesión." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gestiones")
    .update({ tecnico_id: null, asignacion_aceptada: null })
    .eq("id", gestionId)
    .eq("etapa", "asignacion")
    .is("asignacion_aceptada", null)
    .not("tecnico_id", "is", null)
    .select("id");
  if (error || !data?.length) {
    return { ok: false, error: "No se pudo cancelar (¿el técnico ya respondió?)." };
  }

  await supabase.from("eventos_gestion").insert({
    gestion_id: gestionId,
    tipo: "asignacion_cancelada",
    actor_id: actual.id,
  });

  refrescarTablero(gestionId);
  return { ok: true };
}

export async function responderAsignacion(
  gestionId: string,
  acepta: boolean,
  motivo?: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("responder_asignacion", {
    p_gestion: gestionId,
    p_acepta: acepta,
    p_motivo: motivo ?? null,
  });
  if (error) return { ok: false, error: "No se pudo responder la asignación." };
  if (acepta) {
    await emailEstadoGestion(gestionId, "tecnico_asignado");
  } else {
    // Sus notificaciones sobre esta gestión ("Nueva solicitud de trabajo")
    // quedarían linkeando a una gestión que la RLS ya no le muestra — 404
    // desde la campanita (STORY-951). Admin client: notificaciones no tiene
    // policy de DELETE; el filtro por usuario_id acota el borrado a lo suyo.
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { createAdminClient } = await import("@/shared/lib/supabase/admin");
      await createAdminClient()
        .from("notificaciones")
        .delete()
        .eq("usuario_id", user.id)
        .eq("gestion_id", gestionId);
    }
  }
  // Al rechazar, el RPC pone tecnico_id = null y la RLS deja de mostrarle la
  // gestión al técnico: revalidar el detalle re-renderizaría un 404 debajo
  // suyo. Solo tableros; el cliente lo lleva a /tecnico.
  refrescarTablero(acepta ? gestionId : undefined);
  return { ok: true };
}

// ── Presupuesto (STORY-405) ──

export async function enviarPresupuesto(
  gestionId: string,
  datos: {
    monto_materiales: number;
    monto_mano_obra: number;
    descripcion_trabajo: string;
    plazo_dias: number;
    notas: string;
  }
): Promise<ActionResult> {
  // STORY-976: presupuesta solo el técnico asignado, y no con la obra en pausa.
  const ctx = await exigirTecnicoAsignado(gestionId);
  if (!ctx) return { ok: false, error: "No tenés permiso." };
  if (ctx.gestion.aviso_no_continua_en) return { ok: false, error: ERROR_EN_PAUSA };
  const actual = ctx.actual;
  if (!datos.descripcion_trabajo.trim()) {
    return { ok: false, error: "Describí el trabajo a realizar." };
  }
  if (!datos.plazo_dias || datos.plazo_dias < 1) {
    return { ok: false, error: "Indicá el plazo estimado en días." };
  }
  if (
    !Number.isFinite(datos.monto_materiales) || datos.monto_materiales < 0 ||
    !Number.isFinite(datos.monto_mano_obra) || datos.monto_mano_obra < 0
  ) {
    return { ok: false, error: "Los montos no pueden ser negativos." };
  }

  const supabase = await createClient();

  // STORY-943: sin inspección registrada no hay presupuesto — el gestor
  // decide quién paga en base a lo que el técnico encontró (la UI ya lo
  // bloquea; esto cubre refresh y carreras). STORY-983: la inspección tiene
  // que ser DE ESTE técnico — la de un saliente desasignado no cuenta.
  const { count: inspecciones } = await supabase
    .from("avances")
    .select("id", { count: "exact", head: true })
    .eq("gestion_id", gestionId)
    .eq("tecnico_id", actual.id)
    .eq("tipo", "inspeccion");
  if (!inspecciones) {
    return {
      ok: false,
      error: "Registrá primero la inspección — el presupuesto sale de lo que encontraste.",
    };
  }

  const { error } = await supabase.from("presupuestos").insert({
    gestion_id: gestionId,
    tecnico_id: actual.id,
    monto_materiales: datos.monto_materiales,
    monto_mano_obra: datos.monto_mano_obra,
    descripcion_trabajo: datos.descripcion_trabajo.trim(),
    plazo_dias: datos.plazo_dias,
    notas: datos.notas || null,
  });
  if (error) {
    return {
      ok: false,
      error: error.code === "23505"
        ? "Ya hay un presupuesto enviado esperando evaluación."
        : "No se pudo enviar el presupuesto.",
    };
  }

  await supabase.from("eventos_gestion").insert({
    gestion_id: gestionId,
    tipo: "presupuesto_enviado",
    actor_id: actual.id,
    detalle: {
      total: datos.monto_materiales + datos.monto_mano_obra,
      plazo_dias: datos.plazo_dias,
    },
  });

  refrescarTablero(gestionId);
  return { ok: true };
}

export async function resolverPresupuesto(
  presupuestoId: string,
  gestionId: string,
  aprobar: boolean,
  opciones: { pagador?: Pagador; motivo?: string; cargo_admin?: number }
): Promise<ActionResult> {
  const actual = await obtenerUsuarioActual();
  if (!actual) return { ok: false, error: "Sin sesión." };

  // Validar TODO antes de escribir (evita estados a medias)
  if (aprobar && !opciones.pagador) {
    return { ok: false, error: "Confirmá quién paga la obra." };
  }
  const cargoAdmin = opciones.cargo_admin ?? 0;
  if (aprobar && (!Number.isFinite(cargoAdmin) || cargoAdmin < 0)) {
    return { ok: false, error: "El cargo administrativo no puede ser negativo." };
  }

  const supabase = await createClient();

  // STORY-935: el pagador aprueba lo que recibió — sin email enviado no hay
  // aprobación (la UI deshabilita el botón; esto cubre refresh y carreras).
  // STORY-943: y el pagador elegido tiene que existir — "inquilino" solo si
  // la gestión tiene legajo.
  if (aprobar) {
    const { data: g } = await supabase
      .from("gestiones")
      .select("presupuesto_enviado_en, legajo_id, legajos(fecha_fin)")
      .eq("id", gestionId)
      .single();
    if (!g?.presupuesto_enviado_en) {
      return {
        ok: false,
        error: "Enviá el presupuesto al pagador por email antes de aprobar.",
      };
    }
    // STORY-962: "inquilino" solo vale si el legajo está vigente (fecha_fin
    // null). Un legajo cerrado = el inquilino se fue → paga el propietario.
    const legajoVigente =
      g.legajo_id != null &&
      (g.legajos as unknown as { fecha_fin: string | null } | null)?.fecha_fin == null;
    if (opciones.pagador === "inquilino" && !legajoVigente) {
      return {
        ok: false,
        error: "La propiedad no tiene inquilino vigente — el pago solo puede ser del propietario.",
      };
    }
  }

  // El .eq(gestion_id) cruza id↔gestión y el .eq(estado) evita resolver dos veces
  const { data: filas, error } = await supabase
    .from("presupuestos")
    .update(
      aprobar
        ? { estado: "aprobado" }
        : { estado: "rechazado", motivo_rechazo: opciones.motivo ?? null }
    )
    .eq("id", presupuestoId)
    .eq("gestion_id", gestionId)
    .eq("estado", "enviado")
    .select("id");
  if (error || !filas?.length) {
    return { ok: false, error: "No se pudo resolver el presupuesto (¿ya fue resuelto?)." };
  }

  if (aprobar) {
    // El fee queda ANCLADO en la aprobación: lo que se aprueba es lo que
    // después factura el administrativo (FIN-1)
    await supabase
      .from("gestiones")
      .update({ pagador: opciones.pagador, cargo_admin: cargoAdmin })
      .eq("id", gestionId);
  }

  await supabase.from("eventos_gestion").insert({
    gestion_id: gestionId,
    tipo: aprobar ? "presupuesto_aprobado" : "presupuesto_rechazado",
    actor_id: actual.id,
    detalle: aprobar
      ? { pagador: opciones.pagador, cargo_admin: cargoAdmin }
      : { motivo: opciones.motivo },
  });

  if (aprobar) return avanzarEtapa(gestionId, "en_ejecucion");

  refrescarTablero(gestionId);
  return { ok: true };
}

// ── Avances y conformidad (STORY-406/407) ──

async function subirFoto(
  gestionId: string,
  prefijo: string,
  archivo: File | null
): Promise<string | null> {
  if (!archivo || archivo.size === 0) return null;
  if (archivo.size > MAX_FOTO_BYTES) return null;
  const ext = MIME_FOTOS[archivo.type];
  if (!ext) return null;
  const path = `${gestionId}/${prefijo}-${Date.now()}.${ext}`;
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, archivo, { contentType: archivo.type });
  return error ? null : path;
}

// Verifica que el caller sea el técnico asignado (los uploads usan admin client).
async function exigirTecnicoAsignado(gestionId: string) {
  const actual = await obtenerUsuarioActual();
  if (!actual || actual.rol !== "tecnico") return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("gestiones")
    .select("id, etapa, tecnico_id, aviso_no_continua_en")
    .eq("id", gestionId)
    .eq("tecnico_id", actual.id)
    .single();
  return data ? { actual, gestion: data } : null;
}

// STORY-976: con el aviso "no puedo continuar" activo, la obra está en pausa
// para el técnico — la UI ya lo bloquea; esto cubre refresh y carreras.
const ERROR_EN_PAUSA =
  "Avisaste que no podés continuar — el trabajo está en pausa hasta que el gestor decida.";

// STORY-971: el técnico no cancela ni se desasigna solo (el funnel y las
// imputaciones son del gestor) — pero puede AVISAR que no puede continuar.
// STORY-976: el aviso queda como campo explícito en la gestión (pausa la
// obra para el técnico, banner/badge del gestor); el gestor decide con las
// herramientas de siempre (desasignar/cancelar) o lo resuelve sin mover el
// funnel (resolverAvisoTecnico).
export async function avisarNoPuedoContinuar(
  gestionId: string,
  motivo: string
): Promise<ActionResult> {
  if (!motivo?.trim()) {
    return { ok: false, error: "Contá por qué no podés continuar." };
  }
  const ctx = await exigirTecnicoAsignado(gestionId);
  if (!ctx) return { ok: false, error: "No tenés permiso." };
  if (!["presupuesto", "en_ejecucion", "conformidad"].includes(ctx.gestion.etapa)) {
    return { ok: false, error: "En esta etapa no hace falta avisar — contactá a la administración." };
  }
  if (ctx.gestion.aviso_no_continua_en) {
    return { ok: false, error: "Ya avisaste — el gestor está decidiendo cómo sigue." };
  }

  // Admin client: la RLS de gestiones no da UPDATE al técnico, pero
  // exigirTecnicoAsignado ya validó que es SU gestión (patrón rendición).
  const admin = createAdminClient();
  const { error: errorMarca } = await admin
    .from("gestiones")
    .update({
      aviso_no_continua_en: new Date().toISOString(),
      aviso_no_continua_motivo: motivo.trim(),
    })
    .eq("id", gestionId)
    .is("aviso_no_continua_en", null);
  if (errorMarca) return { ok: false, error: "No se pudo enviar el aviso." };

  const supabase = await createClient();
  const { error } = await supabase.from("eventos_gestion").insert({
    gestion_id: gestionId,
    tipo: "tecnico_no_continua",
    actor_id: ctx.actual.id,
    detalle: { motivo: motivo.trim() },
  });
  if (error) {
    // Sin evento no hay notificación al gestor — el aviso no debe quedar a medias.
    await admin
      .from("gestiones")
      .update({ aviso_no_continua_en: null, aviso_no_continua_motivo: null })
      .eq("id", gestionId);
    return { ok: false, error: "No se pudo enviar el aviso." };
  }

  refrescarTablero(gestionId);
  return { ok: true };
}

// STORY-976: el gestor resuelve el aviso SIN mover el funnel ("al final el
// técnico continúa"). Limpia la marca (cliente de sesión — la RLS decide
// quién puede) + evento aviso_resuelto → la matriz le avisa al técnico.
export async function resolverAvisoTecnico(gestionId: string): Promise<ActionResult> {
  const actual = await obtenerUsuarioActual();
  if (!actual) return { ok: false, error: "Sin sesión." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gestiones")
    .update({ aviso_no_continua_en: null, aviso_no_continua_motivo: null })
    .eq("id", gestionId)
    .not("aviso_no_continua_en", "is", null)
    .select("id");
  if (error || !data?.length) {
    return { ok: false, error: "No se pudo resolver el aviso." };
  }

  await supabase.from("eventos_gestion").insert({
    gestion_id: gestionId,
    tipo: "aviso_resuelto",
    actor_id: actual.id,
  });

  refrescarTablero(gestionId);
  return { ok: true };
}

export async function registrarAvance(
  gestionId: string,
  form: FormData
): Promise<ActionResult> {
  const ctx = await exigirTecnicoAsignado(gestionId);
  if (!ctx) return { ok: false, error: "No tenés permiso." };
  if (ctx.gestion.aviso_no_continua_en) return { ok: false, error: ERROR_EN_PAUSA };

  const nota = String(form.get("nota") ?? "").trim();
  if (!nota) return { ok: false, error: "Escribí una nota." };
  const foto = await subirFoto(gestionId, "avance", form.get("foto") as File | null);

  const supabase = await createClient();
  const { error } = await supabase.from("avances").insert({
    gestion_id: gestionId,
    tecnico_id: ctx.actual.id,
    tipo: ctx.gestion.etapa === "presupuesto" ? "inspeccion" : "avance",
    nota,
    foto_path: foto,
  });
  if (error) return { ok: false, error: "No se pudo registrar el avance." };

  refrescarTablero(gestionId);
  return { ok: true };
}

export async function subirConformidad(
  gestionId: string,
  form: FormData
): Promise<ActionResult> {
  const ctx = await exigirTecnicoAsignado(gestionId);
  if (!ctx) return { ok: false, error: "No tenés permiso." };
  if (ctx.gestion.aviso_no_continua_en) return { ok: false, error: ERROR_EN_PAUSA };
  const terminando = ctx.gestion.etapa === "en_ejecucion";

  // STORY-934/964/965: para TERMINAR la obra el técnico rinde UN solo número —
  // el total real gastado en la obra — más las fotos de los comprobantes (una
  // por ticket, al menos una). La resubida de una conformidad rechazada no la
  // vuelve a pedir.
  let rendicion: { total: number; fotos: string[] } | null = null;
  if (terminando) {
    const total = Number(form.get("materiales_total"));
    if (!Number.isFinite(total) || total <= 0) {
      return { ok: false, error: "Indicá el total gastado en la obra." };
    }

    // STORY-936: sin al menos una nota de avance el gestor estuvo ciego
    // toda la obra — no se termina sin contar qué se hizo. STORY-983: el
    // avance tiene que ser DE ESTE técnico, no de un saliente desasignado.
    const supabaseCheck = await createClient();
    const { data: avances } = await supabaseCheck
      .from("avances")
      .select("id")
      .eq("gestion_id", gestionId)
      .eq("tecnico_id", ctx.actual.id)
      .eq("tipo", "avance")
      .limit(1);
    if (!avances?.length) {
      return {
        ok: false,
        error: "Registrá al menos una nota de avance antes de terminar la obra.",
      };
    }

    // STORY-965: las fotos de los comprobantes (una por ticket) + el desvío
    // visible al gestor son el control anti-inflado.
    const archivos = form
      .getAll("fotos_comprobantes")
      .filter((f): f is File => f instanceof File && f.size > 0);
    const fotos: string[] = [];
    for (const archivo of archivos) {
      const path = await subirFoto(gestionId, "comprobantes", archivo);
      if (!path) {
        return { ok: false, error: `No se pudo subir "${archivo.name}" (JPG/PNG/WebP, máx 8MB por foto).` };
      }
      fotos.push(path);
    }
    if (fotos.length === 0) {
      return { ok: false, error: "Subí las fotos de los comprobantes de la obra (al menos una)." };
    }
    rendicion = { total, fotos };
  }

  const foto = await subirFoto(gestionId, "conformidad", form.get("foto") as File | null);
  if (!foto) return { ok: false, error: "Subí la foto de la conformidad (JPG/PNG/WebP, máx 8MB)." };

  const supabase = await createClient();
  if (rendicion) {
    // Admin client: la RLS de gestiones no da UPDATE al técnico, pero
    // exigirTecnicoAsignado ya validó que es SU gestión (patrón de subirFoto).
    const admin = createAdminClient();
    const { error } = await admin
      .from("gestiones")
      .update({ materiales_total: rendicion.total, materiales_fotos_paths: rendicion.fotos })
      .eq("id", gestionId);
    if (error) return { ok: false, error: "No se pudo guardar la rendición de materiales." };
    await supabase.from("eventos_gestion").insert({
      gestion_id: gestionId,
      tipo: "materiales_rendidos",
      actor_id: ctx.actual.id,
      detalle: { total: rendicion.total },
    });
  }

  const { error } = await supabase.from("conformidades").insert({
    gestion_id: gestionId,
    tecnico_id: ctx.actual.id,
    foto_path: foto,
  });
  if (error) return { ok: false, error: "No se pudo subir la conformidad." };

  if (terminando) {
    return avanzarEtapa(gestionId, "conformidad");
  }
  refrescarTablero(gestionId);
  return { ok: true };
}

export async function resolverConformidad(
  conformidadId: string,
  gestionId: string,
  aprobar: boolean,
  opciones: { motivo?: string }
): Promise<ActionResult> {
  const actual = await obtenerUsuarioActual();
  if (!actual) return { ok: false, error: "Sin sesión." };

  // El .eq(gestion_id) cruza id↔gestión y el .eq(estado) evita resolver dos veces
  const supabase = await createClient();
  const { data: filas, error } = await supabase
    .from("conformidades")
    .update(
      aprobar
        ? { estado: "aprobada" }
        : { estado: "rechazada", motivo_rechazo: opciones.motivo ?? null }
    )
    .eq("id", conformidadId)
    .eq("gestion_id", gestionId)
    .eq("estado", "subida")
    .select("id");
  if (error || !filas?.length) {
    return { ok: false, error: "No se pudo resolver la conformidad (¿ya fue resuelta?)." };
  }

  if (!aprobar) {
    await supabase.from("eventos_gestion").insert({
      gestion_id: gestionId,
      tipo: "conformidad_rechazada",
      actor_id: actual.id,
      detalle: { motivo: opciones.motivo },
    });
    refrescarTablero(gestionId);
    return { ok: true };
  }

  // STORY-961/964: el costo final NO lo tipea el gestor — se calcula server-side
  // (no manipulable): total real rendido por el técnico + mano de obra
  // presupuestada. Fallback a materiales presupuestados para gestiones viejas.
  const { data: g } = await supabase
    .from("gestiones")
    .select("materiales_total, presupuestos(monto_materiales, monto_mano_obra, estado)")
    .eq("id", gestionId)
    .single();
  type Fila = {
    materiales_total: number | null;
    presupuestos: { monto_materiales: number; monto_mano_obra: number; estado: string }[];
  };
  const fila = g as unknown as Fila | null;
  const aprobado = fila?.presupuestos.find((p) => p.estado === "aprobado");
  const manoObra = aprobado ? Number(aprobado.monto_mano_obra) : 0;
  const matPresupuestados = aprobado ? Number(aprobado.monto_materiales) : 0;
  const rendido = fila?.materiales_total;
  const costoFinal = (rendido != null ? Number(rendido) : matPresupuestados) + manoObra;

  await supabase.from("eventos_gestion").insert({
    gestion_id: gestionId,
    tipo: "conformidad_aprobada",
    actor_id: actual.id,
    detalle: { costo_final: costoFinal },
  });
  await supabase.from("gestiones").update({ costo_final: costoFinal }).eq("id", gestionId);
  await emailEstadoGestion(gestionId, "resuelto");
  return avanzarEtapa(gestionId, "facturacion_cobro");
}

// ── Reasignación de gestor (STORY-408, solo admin) ──

export async function reasignarGestor(
  gestionId: string,
  nuevoGestorId: string
): Promise<ActionResult> {
  const actual = await obtenerUsuarioActual();
  if (actual?.rol !== "administrador") {
    return { ok: false, error: "Solo el administrador puede reasignar." };
  }

  const supabase = await createClient();
  const { data: gestion } = await supabase
    .from("gestiones")
    .select("gestor_id")
    .eq("id", gestionId)
    .single();
  if (!gestion) return { ok: false, error: "Gestión no encontrada." };

  const { error } = await supabase
    .from("gestiones")
    .update({ gestor_id: nuevoGestorId })
    .eq("id", gestionId);
  if (error) return { ok: false, error: "No se pudo reasignar." };

  const { data: nuevoGestor } = await supabase
    .from("usuarios")
    .select("nombre")
    .eq("id", nuevoGestorId)
    .single();
  await supabase.from("eventos_gestion").insert({
    gestion_id: gestionId,
    tipo: "gestor_reasignado",
    actor_id: actual.id,
    detalle: { nuevo_gestor: nuevoGestor?.nombre ?? null },
  });

  refrescarTablero(gestionId);
  return { ok: true };
}
