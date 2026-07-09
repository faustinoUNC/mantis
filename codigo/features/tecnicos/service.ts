"use server";

import { revalidatePath } from "next/cache";
import { obtenerUsuarioActual } from "@/features/auth/service";
import { emailResultadoTecnico } from "@/features/email/service";
import type { ActionResult } from "@/features/empleados/types";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { createClient } from "@/shared/lib/supabase/server";
import { cuilValido, normalizarCuil } from "@/shared/utils/cuil";
import { normalizarTelefono } from "@/shared/utils/telefono";
import type {
  EstadoTecnico,
  Franja,
  TecnicoDetalle,
  TecnicoResumen,
} from "./types";

const BUCKET = "documentacion-tecnicos";

// Todo lo que usa Admin API verifica el rol del caller primero (patrón 103).
async function exigirStaffMantenimiento(): Promise<ActionResult> {
  const actual = await obtenerUsuarioActual();
  if (
    actual?.rol !== "administrador" &&
    actual?.rol !== "gestor_mantenimiento"
  ) {
    return { ok: false, error: "No tenés permiso para hacer esto." };
  }
  return { ok: true };
}

const MIME_PERMITIDOS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_DOC_BYTES = 8 * 1024 * 1024;

async function subirDoc(
  tecnicoId: string,
  tipo: string,
  archivo: File | null
): Promise<string | null> {
  if (!archivo || archivo.size === 0) return null;
  if (archivo.size > MAX_DOC_BYTES) return null;
  const ext = MIME_PERMITIDOS[archivo.type];
  if (!ext) return null;
  const path = `${tecnicoId}/${tipo}.${ext}`;
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, archivo, { upsert: true, contentType: archivo.type });
  return error ? null : path;
}

interface DatosAlta {
  nombre: string;
  email: string;
  password: string;
  telefono: string;
  cuil: string;
  especialidadIds: string[];
}

function extraerDatos(form: FormData): DatosAlta {
  return {
    nombre: String(form.get("nombre") ?? "").trim(),
    email: String(form.get("email") ?? "").trim().toLowerCase(),
    password: String(form.get("password") ?? ""),
    telefono: normalizarTelefono(String(form.get("telefono") ?? "")),
    cuil: String(form.get("cuil") ?? "").trim(),
    especialidadIds: form.getAll("especialidades").map(String),
  };
}

// Alta compartida entre enrolamiento público y alta manual del staff.
async function altaTecnico(
  form: FormData,
  estado: EstadoTecnico
): Promise<ActionResult> {
  const datos = extraerDatos(form);
  if (!datos.nombre || !datos.email || datos.password.length < 8) {
    return { ok: false, error: "Completá nombre, email y contraseña (8+)." };
  }
  if (datos.especialidadIds.length === 0) {
    return { ok: false, error: "Elegí al menos una especialidad." };
  }
  if (!datos.cuil) {
    return { ok: false, error: "El CUIL es obligatorio." };
  }
  if (!cuilValido(datos.cuil)) {
    return { ok: false, error: "El CUIL no es válido (11 dígitos)." };
  }
  const docDniArchivo = form.get("doc_dni") as File | null;
  if (!docDniArchivo || docDniArchivo.size === 0) {
    return { ok: false, error: "Subí la foto o PDF de tu DNI." };
  }

  const admin = createAdminClient();

  // Matrícula obligatoria si alguna especialidad la exige (validación server)
  const { data: exigentes } = await admin
    .from("especialidades")
    .select("id")
    .in("id", datos.especialidadIds)
    .eq("requiere_matricula", true);
  const matricula = form.get("doc_matricula") as File | null;
  if ((exigentes?.length ?? 0) > 0 && (!matricula || matricula.size === 0)) {
    return {
      ok: false,
      error: "Alguna especialidad elegida exige matrícula: subí el archivo.",
    };
  }

  const { data: creado, error: errorAuth } = await admin.auth.admin.createUser({
    email: datos.email,
    password: datos.password,
    email_confirm: true,
  });
  if (errorAuth || !creado.user) {
    return {
      ok: false,
      error: errorAuth?.message.includes("already")
        ? "Ya existe una cuenta con ese correo."
        : "No se pudo crear la cuenta.",
    };
  }
  const id = creado.user.id;

  const [docDni, docMatricula] = await Promise.all([
    subirDoc(id, "dni", form.get("doc_dni") as File | null),
    subirDoc(id, "matricula", matricula),
  ]);

  const { error: errorTecnico } = await admin.from("tecnicos").insert({
    id,
    nombre: datos.nombre,
    email: datos.email,
    telefono: datos.telefono || null,
    cuil: normalizarCuil(datos.cuil),
    estado,
    doc_dni_path: docDni,
    doc_matricula_path: docMatricula,
  });
  if (errorTecnico) {
    await admin.auth.admin.deleteUser(id);
    return { ok: false, error: "No se pudo guardar el técnico." };
  }

  await admin.from("tecnico_especialidades").insert(
    datos.especialidadIds.map((especialidad_id) => ({
      tecnico_id: id,
      especialidad_id,
    }))
  );

  // Aprobado directo (alta manual) → fila en usuarios con acceso
  if (estado === "aprobado") {
    await admin.from("usuarios").insert({
      id,
      nombre: datos.nombre,
      email: datos.email,
      rol: "tecnico",
    });
  }

  revalidatePath("/tecnicos");
  return { ok: true };
}

export async function crearTecnicoManual(form: FormData): Promise<ActionResult> {
  const permiso = await exigirStaffMantenimiento();
  if (!permiso.ok) return permiso;
  return altaTecnico(form, "aprobado");
}

// PÚBLICO (sin sesión): la RLS de especialidades exige usuario autenticado,
// así que el registro las lee con admin client (solo activas, solo id+nombre).
export async function especialidadesParaRegistro() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("especialidades")
    .select("id, nombre, requiere_matricula, activa")
    .eq("activa", true)
    .order("nombre");
  return data ?? [];
}

// Freno simple en memoria para el registro público: crea usuarios y sube
// archivos con service role, así que sin esto es abusable en masa. Por
// instancia serverless (suficiente para frenar scripts, sin infra extra).
const enrolamientos: number[] = [];
const ENROL_MAX = 10;
const ENROL_VENTANA_MS = 60 * 60 * 1000;

// PÚBLICO (sin sesión): registro del técnico → solicitud pendiente.
export async function enrolarTecnico(form: FormData): Promise<ActionResult> {
  const ahora = Date.now();
  while (enrolamientos.length && ahora - enrolamientos[0] > ENROL_VENTANA_MS) {
    enrolamientos.shift();
  }
  if (enrolamientos.length >= ENROL_MAX) {
    return {
      ok: false,
      error: "Recibimos muchas solicitudes seguidas. Probá de nuevo en un rato.",
    };
  }
  enrolamientos.push(ahora);
  return altaTecnico(form, "pendiente");
}

export async function listarTecnicos(): Promise<TecnicoResumen[]> {
  const permiso = await exigirStaffMantenimiento();
  if (!permiso.ok) return [];
  const supabase = await createClient();
  const [{ data: tecnicos }, { data: usuarios }] = await Promise.all([
    supabase
      .from("tecnicos")
      .select(
        "id, nombre, email, telefono, estado, creado_en, tecnico_especialidades(especialidades(nombre))"
      )
      .order("creado_en", { ascending: false }),
    supabase.from("usuarios").select("id, esta_activo").eq("rol", "tecnico"),
  ]);
  const activos = new Map(
    (usuarios ?? []).map((u) => [u.id, u.esta_activo as boolean])
  );
  type Fila = {
    id: string;
    nombre: string;
    email: string;
    telefono: string | null;
    estado: EstadoTecnico;
    creado_en: string;
    tecnico_especialidades: { especialidades: { nombre: string } | null }[];
  };
  return ((tecnicos ?? []) as unknown as Fila[]).map((t) => ({
    id: t.id,
    nombre: t.nombre,
    email: t.email,
    telefono: t.telefono,
    estado: t.estado,
    creado_en: t.creado_en,
    especialidades: t.tecnico_especialidades
      .map((te) => te.especialidades?.nombre)
      .filter(Boolean) as string[],
    esta_activo: activos.get(t.id) ?? null,
  }));
}

export async function obtenerTecnico(
  id: string
): Promise<TecnicoDetalle | null> {
  const permiso = await exigirStaffMantenimiento();
  if (!permiso.ok) return null;
  const supabase = await createClient();
  const { data: t } = await supabase
    .from("tecnicos")
    .select(
      "id, nombre, email, telefono, cuil, estado, creado_en, motivo_rechazo, doc_dni_path, doc_matricula_path, tecnico_especialidades(especialidad_id, especialidades(nombre))"
    )
    .eq("id", id)
    .single();
  if (!t) return null;

  const admin = createAdminClient();
  const docs: TecnicoDetalle["docs"] = [];
  const rutas: [TecnicoDetalle["docs"][number]["tipo"], string | null][] = [
    ["DNI", t.doc_dni_path],
    ["Matrícula", t.doc_matricula_path],
  ];
  for (const [tipo, path] of rutas) {
    if (!path) continue;
    const { data } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(path, 3600);
    if (data?.signedUrl) docs.push({ tipo, url: data.signedUrl });
  }

  type TE = { especialidad_id: string; especialidades: { nombre: string } | null };
  const tes = t.tecnico_especialidades as unknown as TE[];
  return {
    id: t.id,
    nombre: t.nombre,
    email: t.email,
    telefono: t.telefono,
    cuil: t.cuil,
    estado: t.estado as EstadoTecnico,
    creado_en: t.creado_en,
    motivo_rechazo: t.motivo_rechazo,
    especialidades: tes.map((te) => te.especialidades?.nombre).filter(Boolean) as string[],
    especialidad_ids: tes.map((te) => te.especialidad_id),
    esta_activo: null,
    docs,
  };
}

export async function aprobarTecnico(id: string): Promise<ActionResult> {
  const permiso = await exigirStaffMantenimiento();
  if (!permiso.ok) return permiso;

  const admin = createAdminClient();
  const { data: t } = await admin
    .from("tecnicos")
    .select("nombre, email")
    .eq("id", id)
    .single();
  if (!t) return { ok: false, error: "Técnico no encontrado." };

  const { error } = await admin
    .from("usuarios")
    .upsert({ id, nombre: t.nombre, email: t.email, rol: "tecnico", esta_activo: true });
  if (error) return { ok: false, error: "No se pudo habilitar el acceso." };

  await admin
    .from("tecnicos")
    .update({ estado: "aprobado", motivo_rechazo: null })
    .eq("id", id);

  await emailResultadoTecnico(t, "aprobado");

  revalidatePath("/tecnicos");
  return { ok: true };
}

export async function rechazarTecnico(
  id: string,
  motivo: string
): Promise<ActionResult> {
  const permiso = await exigirStaffMantenimiento();
  if (!permiso.ok) return permiso;
  if (!motivo.trim()) return { ok: false, error: "Indicá el motivo." };

  const admin = createAdminClient();
  const { data: t, error } = await admin
    .from("tecnicos")
    .update({ estado: "rechazado", motivo_rechazo: motivo.trim() })
    .eq("id", id)
    .select("nombre, email")
    .single();
  if (error || !t) return { ok: false, error: "No se pudo rechazar." };

  await emailResultadoTecnico(t, "rechazado", motivo.trim());

  revalidatePath("/tecnicos");
  return { ok: true };
}

// Editar especialidades de un técnico ya creado (staff de mantenimiento).
// Si se agrega una que exige matrícula y el técnico no la tiene cargada,
// se rechaza (coherente con la validación del registro).
export async function actualizarEspecialidadesTecnico(
  tecnicoId: string,
  especialidadIds: string[]
): Promise<ActionResult> {
  const permiso = await exigirStaffMantenimiento();
  if (!permiso.ok) return permiso;
  if (especialidadIds.length === 0) {
    return { ok: false, error: "El técnico debe tener al menos una especialidad." };
  }

  const admin = createAdminClient();
  const [{ data: tecnico }, { data: exigentes }] = await Promise.all([
    admin.from("tecnicos").select("doc_matricula_path").eq("id", tecnicoId).single(),
    admin
      .from("especialidades")
      .select("id, nombre")
      .in("id", especialidadIds)
      .eq("requiere_matricula", true),
  ]);
  if (!tecnico) return { ok: false, error: "Técnico no encontrado." };
  if ((exigentes?.length ?? 0) > 0 && !tecnico.doc_matricula_path) {
    return {
      ok: false,
      error: `${exigentes!.map((e) => e.nombre).join(", ")} exige matrícula y este técnico no tiene una cargada.`,
    };
  }

  // Reemplazo completo del set (simple e idempotente)
  await admin.from("tecnico_especialidades").delete().eq("tecnico_id", tecnicoId);
  const { error } = await admin.from("tecnico_especialidades").insert(
    especialidadIds.map((especialidad_id) => ({
      tecnico_id: tecnicoId,
      especialidad_id,
    }))
  );
  if (error) return { ok: false, error: "No se pudieron guardar las especialidades." };

  revalidatePath(`/tecnicos/${tecnicoId}`);
  revalidatePath("/tecnicos");
  return { ok: true };
}

// Inhabilitar/habilitar técnicos también lo puede el gestor de mantenimiento
// (la policy de usuarios es admin-only → admin client con rol-check).
export async function cambiarEstadoTecnico(
  id: string,
  activo: boolean
): Promise<ActionResult> {
  const permiso = await exigirStaffMantenimiento();
  if (!permiso.ok) return permiso;

  const admin = createAdminClient();
  const { error } = await admin
    .from("usuarios")
    .update({ esta_activo: activo })
    .eq("id", id)
    .eq("rol", "tecnico");
  if (error) return { ok: false, error: "No se pudo actualizar el estado." };

  if (!activo) {
    await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${id}/logout`,
      {
        method: "POST",
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    ).catch(() => {});
  }

  revalidatePath("/tecnicos");
  return { ok: true };
}

// Para el login: estado de la solicitud del técnico con sesión pero sin
// fila activa en usuarios (RLS: lee solo su propia fila de tecnicos).
export async function estadoSolicitudActual(): Promise<{
  estado: EstadoTecnico;
  motivo: string | null;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("tecnicos")
    .select("estado, motivo_rechazo")
    .eq("id", user.id)
    .single();
  if (!data) return null;
  return { estado: data.estado as EstadoTecnico, motivo: data.motivo_rechazo };
}

// Perfil del propio técnico (STORY-901): RLS le permite leer su fila.
export async function miPerfilTecnico() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: t } = await supabase
    .from("tecnicos")
    .select(
      "nombre, email, telefono, cuil, doc_dni_path, doc_matricula_path, tecnico_especialidades(especialidades(nombre))"
    )
    .eq("id", user.id)
    .single();
  if (!t) return null;

  type TE = { especialidades: { nombre: string } | null };
  return {
    nombre: t.nombre,
    email: t.email,
    telefono: t.telefono,
    cuil: t.cuil,
    tiene_dni: Boolean(t.doc_dni_path),
    tiene_matricula: Boolean(t.doc_matricula_path),
    especialidades: ((t.tecnico_especialidades as unknown as TE[]) ?? [])
      .map((te) => te.especialidades?.nombre)
      .filter(Boolean) as string[],
  };
}

// ── Agenda ──

export async function misFranjas(): Promise<Franja[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("franjas_disponibilidad")
    .select("id, dia_semana, hora_desde, hora_hasta")
    .order("dia_semana")
    .order("hora_desde");
  return (data ?? []) as Franja[];
}

export async function agregarFranja(datos: {
  dia_semana: number;
  hora_desde: string;
  hora_hasta: string;
}): Promise<ActionResult> {
  const actual = await obtenerUsuarioActual();
  if (!actual) return { ok: false, error: "Sin sesión." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("franjas_disponibilidad")
    .insert({ ...datos, tecnico_id: actual.id });
  if (error) {
    return {
      ok: false,
      error: error.code === "23505"
        ? "Ya tenés una franja que arranca a esa hora ese día."
        : error.code === "23514"
          ? "La hora de fin debe ser mayor a la de inicio."
          : "No se pudo agregar la franja.",
    };
  }
  revalidatePath("/tecnico/agenda");
  return { ok: true };
}

export async function borrarFranja(id: string): Promise<ActionResult> {
  const actual = await obtenerUsuarioActual();
  if (!actual) return { ok: false, error: "Sin sesión." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("franjas_disponibilidad")
    .delete()
    .eq("id", id)
    .eq("tecnico_id", actual.id);
  if (error) return { ok: false, error: "No se pudo borrar." };
  revalidatePath("/tecnico/agenda");
  return { ok: true };
}
