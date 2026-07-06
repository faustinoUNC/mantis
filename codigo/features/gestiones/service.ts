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
  const propiedad = g.propiedades as { direccion: string } | null;
  const especialidad = g.especialidades as { nombre: string } | null;
  const gestor = g.gestor as { nombre: string } | null;
  const tecnico = g.tecnico as { nombre: string } | null;
  return {
    id: g.id as string,
    descripcion: g.descripcion as string,
    etapa: g.etapa as Etapa,
    urgencia: g.urgencia as Urgencia,
    especialidad: especialidad?.nombre ?? "—",
    direccion: propiedad?.direccion ?? "—",
    gestor_nombre: gestor?.nombre ?? "—",
    tecnico_nombre: tecnico?.nombre ?? null,
    asignacion_aceptada: (g.asignacion_aceptada as boolean | null) ?? null,
    creado_en: g.creado_en as string,
  };
}

const SELECT_RESUMEN =
  "id, descripcion, etapa, urgencia, asignacion_aceptada, creado_en, propiedades(direccion), especialidades(nombre), gestor:usuarios!gestiones_gestor_id_fkey(nombre), tecnico:tecnicos!gestiones_tecnico_id_fkey(nombre)";

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
}): Promise<ActionResult> {
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
  return { ok: true, data: undefined };
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
      `${SELECT_RESUMEN}, causa, pagador_sugerido, pagador, costo_final, cargo_admin, nota_emitida_en, gestor_id, tecnico_id, propiedad_id, especialidad_id`
    )
    .eq("id", id)
    .single();
  if (!g) return null;

  const [{ data: eventos }, { data: presupuestos }, { data: avances }, { data: conformidades }] =
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
    ]);

  const base = normalizarFila(g as unknown as Record<string, unknown>);
  const fila = g as unknown as {
    causa: Causa;
    pagador_sugerido: Pagador;
    pagador: Pagador | null;
    costo_final: number | null;
    cargo_admin: number | null;
    nota_emitida_en: string | null;
    gestor_id: string;
    tecnico_id: string | null;
    propiedad_id: string;
    especialidad_id: string;
  };

  return {
    ...base,
    causa: fila.causa,
    pagador_sugerido: fila.pagador_sugerido,
    pagador: fila.pagador,
    costo_final: fila.costo_final,
    cargo_admin: fila.cargo_admin,
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

// ── Asignación (STORY-404) ──

export async function tecnicosDisponibles(
  especialidadId: string
): Promise<TecnicoDisponible[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tecnicos")
    .select(
      "id, nombre, estado, tecnico_especialidades!inner(especialidad_id), franjas_disponibilidad(dia_semana, hora_desde, hora_hasta)"
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
    franjas_disponibilidad: TecnicoDisponible["franjas"];
  };
  return ((data ?? []) as unknown as Fila[])
    .filter((t) => idsActivos.has(t.id))
    .map((t) => ({
      id: t.id,
      nombre: t.nombre,
      franjas: t.franjas_disponibilidad ?? [],
    }));
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
  refrescarTablero(gestionId);
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

  const supabase = await createClient();
  const { error } = await supabase.from("presupuestos").insert({
    gestion_id: gestionId,
    monto_materiales: datos.monto_materiales,
    monto_mano_obra: datos.monto_mano_obra,
    descripcion_trabajo: datos.descripcion_trabajo.trim(),
    plazo_dias: datos.plazo_dias,
    notas: datos.notas || null,
  });
  if (error) return { ok: false, error: "No se pudo enviar el presupuesto." };

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
  opciones: { pagador?: Pagador; motivo?: string }
): Promise<ActionResult> {
  const actual = await obtenerUsuarioActual();
  if (!actual) return { ok: false, error: "Sin sesión." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("presupuestos")
    .update(
      aprobar
        ? { estado: "aprobado" }
        : { estado: "rechazado", motivo_rechazo: opciones.motivo ?? null }
    )
    .eq("id", presupuestoId);
  if (error) return { ok: false, error: "No se pudo resolver el presupuesto." };

  await supabase.from("eventos_gestion").insert({
    gestion_id: gestionId,
    tipo: aprobar ? "presupuesto_aprobado" : "presupuesto_rechazado",
    actor_id: actual.id,
    detalle: aprobar ? { pagador: opciones.pagador } : { motivo: opciones.motivo },
  });

  if (aprobar) {
    if (!opciones.pagador) {
      return { ok: false, error: "Confirmá quién paga la obra." };
    }
    await supabase
      .from("gestiones")
      .update({ pagador: opciones.pagador })
      .eq("id", gestionId);
    return avanzarEtapa(gestionId, "en_ejecucion");
  }

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

export async function subirConformidad(
  gestionId: string,
  form: FormData
): Promise<ActionResult> {
  const ctx = await exigirTecnicoAsignado(gestionId);
  if (!ctx) return { ok: false, error: "No tenés permiso." };

  const foto = await subirFoto(gestionId, "conformidad", form.get("foto") as File | null);
  if (!foto) return { ok: false, error: "Subí la foto de la conformidad (JPG/PNG/WebP, máx 8MB)." };

  const supabase = await createClient();
  const { error } = await supabase.from("conformidades").insert({
    gestion_id: gestionId,
    foto_path: foto,
  });
  if (error) return { ok: false, error: "No se pudo subir la conformidad." };

  if (ctx.gestion.etapa === "en_ejecucion") {
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

  const supabase = await createClient();
  const { error } = await supabase
    .from("conformidades")
    .update(
      aprobar
        ? { estado: "aprobada" }
        : { estado: "rechazada", motivo_rechazo: opciones.motivo ?? null }
    )
    .eq("id", conformidadId);
  if (error) return { ok: false, error: "No se pudo resolver la conformidad." };

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
