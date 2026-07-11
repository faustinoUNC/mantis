"use server";

import { revalidatePath } from "next/cache";
import { obtenerUsuarioActual } from "@/features/auth/service";
import { emailEstadoGestion } from "@/features/email/service";
import type { ActionResult } from "@/features/empleados/types";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { createClient } from "@/shared/lib/supabase/server";
import type {
  Causa,
  Etapa,
  GestionDetalle,
  GestionResumen,
  Pagador,
  StatsTecnico,
  TecnicoDisponible,
  Urgencia,
} from "./types";
import { PAGADOR_POR_CAUSA } from "./types";

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
  const legajo = g.legajos as { inquilinos: { nombre: string } | null } | null;
  const especialidad = g.especialidades as { nombre: string } | null;
  const gestor = g.gestor as { nombre: string } | null;
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
    inquilino_nombre: legajo?.inquilinos?.nombre ?? null,
    gestor_nombre: gestor?.nombre ?? "—",
    tecnico_nombre: tecnico?.nombre ?? null,
    asignacion_aceptada: (g.asignacion_aceptada as boolean | null) ?? null,
    presupuesto_pendiente: presupuestos.some((p) => p.estado === "enviado"),
    conformidad_rechazada: ultimaConformidad?.estado === "rechazada",
    creado_en: g.creado_en as string,
  };
}

const SELECT_RESUMEN =
  "id, descripcion, etapa, urgencia, asignacion_aceptada, creado_en, propiedades(direccion, propietarios(nombre)), legajos(inquilinos(nombre)), especialidades(nombre), gestor:usuarios!gestiones_gestor_id_fkey(nombre), tecnico:tecnicos!gestiones_tecnico_id_fkey(nombre), presupuestos(estado), conformidades(estado, creado_en)";

// El tablero: RLS decide qué ve cada rol (ownership del gestor incluida).
export async function tableroGestiones(): Promise<GestionResumen[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("gestiones")
    .select(SELECT_RESUMEN)
    .order("urgencia", { ascending: false })
    .order("creado_en", { ascending: true });
  return (data ?? []).map((g) => normalizarFila(g as Record<string, unknown>));
}

export async function crearGestion(datos: {
  descripcion: string;
  propiedad_id: string;
  especialidad_id: string;
  urgencia: Urgencia;
  causa: Causa;
}): Promise<ActionResult<{ gestionId: string }>> {
  const actual = await obtenerUsuarioActual();
  if (!actual) return { ok: false, error: "Sin sesión." };

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
      pagador_sugerido: PAGADOR_POR_CAUSA[datos.causa],
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
      `${SELECT_RESUMEN}, causa, pagador_sugerido, pagador, costo_final, cargo_admin, materiales_total, materiales_foto_path, nota_emitida_en, gestor_id, tecnico_id, propiedad_id, especialidad_id, calificaciones(estrellas, comentario)`
    )
    .eq("id", id)
    .single();
  if (!g) return null;

  const [
    { data: eventos },
    { data: presupuestos },
    { data: avances },
    { data: conformidades },
    { data: gastos },
  ] =
    await Promise.all([
      supabase
        .from("eventos_gestion")
        .select("id, tipo, de_etapa, a_etapa, actor_id, detalle, creado_en, actor:usuarios(nombre)")
        .eq("gestion_id", id)
        .order("creado_en", { ascending: false }),
      supabase
        .from("presupuestos")
        .select("id, monto_materiales, monto_mano_obra, descripcion_trabajo, plazo_dias, notas, estado, motivo_rechazo, creado_en")
        .eq("gestion_id", id)
        .order("creado_en", { ascending: false }),
      supabase
        .from("avances")
        .select("id, tipo, nota, foto_path, creado_en")
        .eq("gestion_id", id)
        .order("creado_en", { ascending: false }),
      supabase
        .from("conformidades")
        .select("id, foto_path, estado, motivo_rechazo, creado_en")
        .eq("gestion_id", id)
        .order("creado_en", { ascending: false }),
      supabase
        .from("gastos_imprevistos")
        .select("id, monto, descripcion, foto_path, creado_en")
        .eq("gestion_id", id)
        .order("creado_en", { ascending: false }),
    ]);

  const base = normalizarFila(g as unknown as Record<string, unknown>);
  const fila = g as unknown as {
    causa: Causa;
    pagador_sugerido: Pagador;
    pagador: Pagador | null;
    costo_final: number | null;
    cargo_admin: number | null;
    materiales_total: number | null;
    materiales_foto_path: string | null;
    nota_emitida_en: string | null;
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
    causa: fila.causa,
    pagador_sugerido: fila.pagador_sugerido,
    pagador: fila.pagador,
    costo_final: fila.costo_final,
    cargo_admin: fila.cargo_admin,
    materiales_total: fila.materiales_total == null ? null : Number(fila.materiales_total),
    materiales_foto_url: await fotoConUrl(fila.materiales_foto_path),
    nota_emitida_en: fila.nota_emitida_en,
    gestor_id: fila.gestor_id,
    tecnico_id: fila.tecnico_id,
    propiedad_id: fila.propiedad_id,
    especialidad_id: fila.especialidad_id,
    eventos: (eventos ?? []).map((e) => ({
      ...e,
      actor: Array.isArray(e.actor) ? (e.actor[0] ?? null) : e.actor,
    })) as GestionDetalle["eventos"],
    presupuestos: (presupuestos ?? []) as GestionDetalle["presupuestos"],
    avances: await Promise.all(
      (avances ?? []).map(async (a) => ({
        id: a.id,
        tipo: a.tipo,
        nota: a.nota,
        foto_url: await fotoConUrl(a.foto_path),
        creado_en: a.creado_en,
      }))
    ),
    conformidades: await Promise.all(
      (conformidades ?? []).map(async (c) => ({
        id: c.id,
        estado: c.estado,
        motivo_rechazo: c.motivo_rechazo,
        foto_url: await fotoConUrl(c.foto_path),
        creado_en: c.creado_en,
      }))
    ),
    gastos: await Promise.all(
      (gastos ?? []).map(async (ga) => ({
        id: ga.id,
        monto: Number(ga.monto),
        descripcion: ga.descripcion,
        foto_url: await fotoConUrl(ga.foto_path),
        creado_en: ga.creado_en,
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
// La validación de etapa/permiso/motivo vive en avanzar_etapa (Postgres).
export async function cancelarGestion(
  gestionId: string,
  motivo: string
): Promise<ActionResult> {
  if (!motivo?.trim()) return { ok: false, error: "Indicá el motivo de la cancelación." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("avanzar_etapa", {
    p_gestion: gestionId,
    p_nueva: "cancelada",
    p_detalle: { motivo: motivo.trim() },
  });
  if (error) {
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
  return candidatos.map((t) => ({
    id: t.id,
    nombre: t.nombre,
    especialidades: (t.todas ?? [])
      .map((te) => te.especialidades?.nombre)
      .filter((n): n is string => Boolean(n)),
    franjas: t.franjas_disponibilidad ?? [],
    stats: stats.get(t.id) ?? null,
  }));
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
  const [{ data: califs }, { data: gestiones }] = await Promise.all([
    admin.from("calificaciones").select("tecnico_id, estrellas").in("tecnico_id", ids),
    admin
      .from("gestiones")
      .select(
        "tecnico_id, etapa, asignacion_aceptada, costo_final, presupuestos(estado, monto_materiales, monto_mano_obra)"
      )
      .in("tecnico_id", ids),
  ]);

  type GFila = {
    tecnico_id: string;
    etapa: string;
    asignacion_aceptada: boolean | null;
    costo_final: number | null;
    presupuestos: { estado: string; monto_materiales: number; monto_mano_obra: number }[] | null;
  };
  const terminales = new Set(["finalizado", "cancelada"]);

  for (const id of ids) {
    const gs = ((gestiones ?? []) as unknown as GFila[]).filter((g) => g.tecnico_id === id);
    const estrellasArr = (califs ?? [])
      .filter((c) => c.tecnico_id === id)
      .map((c) => Number(c.estrellas));

    const respondidas = gs.filter((g) => g.asignacion_aceptada !== null);
    const rechazadas = gs.filter((g) => g.asignacion_aceptada === false);
    const terminadas = gs.filter((g) => terminales.has(g.etapa));

    const desvios: number[] = [];
    for (const g of gs) {
      if (g.costo_final == null) continue;
      const aprob = (g.presupuestos ?? []).find((p) => p.estado === "aprobado");
      if (!aprob) continue;
      const base = Number(aprob.monto_materiales) + Number(aprob.monto_mano_obra);
      if (base <= 0) continue;
      desvios.push((Number(g.costo_final) - base) / base);
    }

    const prom = (arr: number[]) =>
      arr.length ? arr.reduce((s, n) => s + n, 0) / arr.length : null;

    salida.set(id, {
      estrellas: prom(estrellasArr),
      nCalif: estrellasArr.length,
      desvioPct: desvios.length ? Math.round((prom(desvios) ?? 0) * 1000) / 10 : null,
      nDesvio: desvios.length,
      obrasActivas: gs.filter((g) => !terminales.has(g.etapa)).length,
      // Realizadas = solo finalizadas (una cancelada no es un trabajo hecho).
      obrasRealizadas: gs.filter((g) => g.etapa === "finalizado").length,
      pctRechazoAsig: respondidas.length
        ? Math.round((rechazadas.length / respondidas.length) * 100)
        : null,
      nAsig: respondidas.length,
      // Sobre terminadas (finalizadas + canceladas): las activas no diluyen la señal.
      pctCancelacion: terminadas.length
        ? Math.round(
            (terminadas.filter((g) => g.etapa === "cancelada").length / terminadas.length) * 100
          )
        : null,
      nTerminadas: terminadas.length,
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
  if (acepta) await emailEstadoGestion(gestionId, "tecnico_asignado");
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
  const actual = await obtenerUsuarioActual();
  if (!actual) return { ok: false, error: "Sin sesión." };
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
  const { error } = await supabase.from("presupuestos").insert({
    gestion_id: gestionId,
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

  // El .eq(gestion_id) cruza id↔gestión y el .eq(estado) evita resolver dos veces
  const supabase = await createClient();
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
    .select("id, etapa, tecnico_id")
    .eq("id", gestionId)
    .eq("tecnico_id", actual.id)
    .single();
  return data ? { actual, gestion: data } : null;
}

export async function registrarAvance(
  gestionId: string,
  form: FormData
): Promise<ActionResult> {
  const ctx = await exigirTecnicoAsignado(gestionId);
  if (!ctx) return { ok: false, error: "No tenés permiso." };

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

// ── Gastos imprevistos (STORY-932/934) ──
// El técnico registra el gasto con foto de la factura obligatoria. Es un
// hecho informativo, sin aprobación: el control vive en el costo final que
// fija el gestor al aprobar la conformidad, viendo los gastos.

export async function registrarGastoImprevisto(
  gestionId: string,
  form: FormData
): Promise<ActionResult> {
  const ctx = await exigirTecnicoAsignado(gestionId);
  if (!ctx) return { ok: false, error: "No tenés permiso." };
  if (ctx.gestion.etapa !== "en_ejecucion") {
    return { ok: false, error: "Los gastos se registran durante la ejecución." };
  }

  const monto = Number(form.get("monto"));
  const descripcion = String(form.get("descripcion") ?? "").trim();
  if (!Number.isFinite(monto) || monto <= 0) {
    return { ok: false, error: "Indicá el monto del gasto." };
  }
  if (!descripcion) return { ok: false, error: "Contá qué compraste y por qué." };
  const foto = await subirFoto(gestionId, "gasto", form.get("foto") as File | null);
  if (!foto) {
    return { ok: false, error: "Subí la foto del ticket (JPG/PNG/WebP, máx 8MB) — sin evidencia no hay gasto." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("gastos_imprevistos").insert({
    gestion_id: gestionId,
    tecnico_id: ctx.actual.id,
    monto,
    descripcion,
    foto_path: foto,
  });
  if (error) return { ok: false, error: "No se pudo registrar el gasto." };

  await supabase.from("eventos_gestion").insert({
    gestion_id: gestionId,
    tipo: "gasto_enviado",
    actor_id: ctx.actual.id,
    detalle: { monto },
  });

  refrescarTablero(gestionId);
  return { ok: true };
}

export async function subirConformidad(
  gestionId: string,
  form: FormData
): Promise<ActionResult> {
  const ctx = await exigirTecnicoAsignado(gestionId);
  if (!ctx) return { ok: false, error: "No tenés permiso." };
  const terminando = ctx.gestion.etapa === "en_ejecucion";

  // STORY-934: para TERMINAR la obra el técnico rinde los materiales — total
  // gastado + foto general de todos los comprobantes (obligatoria). La
  // resubida de una conformidad rechazada no la vuelve a pedir.
  let rendicion: { total: number; foto: string } | null = null;
  if (terminando) {
    const total = Number(form.get("materiales_total"));
    if (!Number.isFinite(total) || total <= 0) {
      return { ok: false, error: "Indicá el total gastado en materiales." };
    }
    const fotoComprobantes = await subirFoto(
      gestionId,
      "comprobantes",
      form.get("foto_comprobantes") as File | null
    );
    if (!fotoComprobantes) {
      return { ok: false, error: "Subí la foto con todos los comprobantes de materiales (JPG/PNG/WebP, máx 8MB)." };
    }
    rendicion = { total, foto: fotoComprobantes };
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
      .update({ materiales_total: rendicion.total, materiales_foto_path: rendicion.foto })
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
  opciones: { motivo?: string; costo_final?: number }
): Promise<ActionResult> {
  const actual = await obtenerUsuarioActual();
  if (!actual) return { ok: false, error: "Sin sesión." };
  if (
    aprobar &&
    opciones.costo_final != null &&
    (!Number.isFinite(opciones.costo_final) || opciones.costo_final < 0)
  ) {
    return { ok: false, error: "El costo final no puede ser negativo." };
  }

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

  await supabase.from("eventos_gestion").insert({
    gestion_id: gestionId,
    tipo: aprobar ? "conformidad_aprobada" : "conformidad_rechazada",
    actor_id: actual.id,
    detalle: aprobar
      ? { costo_final: opciones.costo_final }
      : { motivo: opciones.motivo },
  });

  if (aprobar) {
    if (opciones.costo_final != null) {
      await supabase
        .from("gestiones")
        .update({ costo_final: opciones.costo_final })
        .eq("id", gestionId);
    }
    await emailEstadoGestion(gestionId, "resuelto");
    return avanzarEtapa(gestionId, "facturacion_cobro");
  }

  refrescarTablero(gestionId);
  return { ok: true };
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
