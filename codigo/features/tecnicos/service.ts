"use server";

import { revalidatePath } from "next/cache";
import { registrarEventoSistema } from "@/features/auditoria/registrar";
import { linkCrearContrasena } from "@/features/auth/recovery";
import { obtenerUsuarioActual } from "@/features/auth/service";
import {
  emailResultadoTecnico,
  emailVerificacionTecnico,
} from "@/features/email/service";
import type { ActionResult } from "@/features/empleados/types";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { createClient } from "@/shared/lib/supabase/server";
import { baseUrl } from "@/shared/utils/base-url";
import { errorCuil, normalizarCuil } from "@/shared/utils/cuil";
import { duplicadoPersona, ERROR_DUPLICADO_DB } from "@/shared/utils/duplicados";
import { errorNombre } from "@/shared/utils/nombre";
import { errorTelefono, normalizarTelefono } from "@/shared/utils/telefono";
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

// Antes de crear nada: si un doc no se va a poder subir, que el error se vea
// (subirDoc devuelve null en silencio y el técnico quedaba sin documento).
function errorArchivo(etiqueta: string, archivo: File): string | null {
  if (!MIME_PERMITIDOS[archivo.type]) {
    return `${etiqueta} tiene un formato no permitido: subí JPG, PNG, WEBP o PDF.`;
  }
  if (archivo.size > MAX_DOC_BYTES) {
    return `${etiqueta} pesa más de 8 MB: subí un archivo más liviano.`;
  }
  return null;
}

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
  telefono: string;
  cuil: string;
  especialidadIds: string[];
}

function extraerDatos(form: FormData): DatosAlta {
  return {
    nombre: String(form.get("nombre") ?? "").trim(),
    email: String(form.get("email") ?? "").trim().toLowerCase(),
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
  // Teléfono obligatorio (STORY-947 v1.1): se valida el normalizado (solo
  // dígitos), así "abc" o espacios no lo bypasean.
  if (!datos.nombre || !datos.email || !datos.telefono) {
    return { ok: false, error: "Completá nombre, email y teléfono." };
  }
  const errNombre = errorNombre(datos.nombre);
  if (errNombre) {
    return { ok: false, error: errNombre };
  }
  const errTelefono = errorTelefono(datos.telefono);
  if (errTelefono) {
    return { ok: false, error: errTelefono };
  }
  if (datos.especialidadIds.length === 0) {
    return { ok: false, error: "Elegí al menos una especialidad." };
  }
  if (!datos.cuil) {
    return { ok: false, error: "El CUIL es obligatorio." };
  }
  const errCuil = errorCuil(datos.cuil);
  if (errCuil) {
    return { ok: false, error: errCuil };
  }
  const docDniArchivo = form.get("doc_dni") as File | null;
  if (!docDniArchivo || docDniArchivo.size === 0) {
    return { ok: false, error: "Subí la foto o PDF de tu DNI." };
  }
  const matriculas = form
    .getAll("doc_matricula")
    .filter((v): v is File => v instanceof File && v.size > 0);

  const errDni = errorArchivo("El DNI", docDniArchivo);
  if (errDni) return { ok: false, error: errDni };
  for (const m of matriculas) {
    const errMatricula = errorArchivo(`La matrícula "${m.name}"`, m);
    if (errMatricula) return { ok: false, error: errMatricula };
  }

  const admin = createAdminClient();

  // Reintento de registro (STORY-955): una solicitud pendiente SIN verificar
  // es un registro huérfano (típico: email propio mal tipeado — el link de
  // verificación nunca llega). Si el nuevo registro choca contra una de esas,
  // se pisa la vieja (borrar el usuario de auth cascadea tecnicos y
  // especialidades) en vez de bloquear al técnico para siempre.
  // Solicitudes reemplazables (STORY-955/958): una pendiente SIN verificar
  // es un registro huérfano (típico: email propio mal tipeado) que se pisa;
  // una RECHAZADA merece reintento y se REABRE en la misma fila (v2.0: así
  // el staff nunca la pierde de vista y conserva el motivo anterior). El
  // valor del usuario entra SOLO por .eq(campo, valor) — nunca dentro del
  // .or(), que es una condición constante (inyectaría filtros, v1.1).
  const esEnrolamiento = estado === "pendiente";
  const cuilNormalizado = normalizarCuil(datos.cuil);
  const buscarReemplazables = (campo: string, valor: string) =>
    admin
      .from("tecnicos")
      .select("id, email, estado, token_verificacion, doc_dni_path, doc_matricula_paths")
      .or("and(estado.eq.pendiente,email_verificado.eq.false),estado.eq.rechazado")
      .eq(campo, valor);
  const coincidencias = await Promise.all([
    buscarReemplazables("email", datos.email),
    buscarReemplazables("cuil", cuilNormalizado),
    ...(datos.telefono ? [buscarReemplazables("telefono", datos.telefono)] : []),
  ]);
  type Reemplazable = {
    id: string;
    email: string;
    estado: string;
    token: string | null;
    docs: string[];
  };
  const reemplazables = new Map<string, Reemplazable>();
  for (const { data } of coincidencias) {
    for (const t of data ?? []) {
      reemplazables.set(t.id as string, {
        id: t.id as string,
        email: t.email as string,
        estado: t.estado as string,
        token: t.token_verificacion as string | null,
        docs: [t.doc_dni_path, ...(t.doc_matricula_paths ?? [])].filter(
          (p): p is string => Boolean(p)
        ),
      });
    }
  }
  if (reemplazables.size > 0) {
    // Jamás tocar un técnico que alguna vez fue aprobado: tiene historial
    // colgando de su id (gestiones SET NULL, avances RESTRICT, calificaciones).
    const { data: conAcceso } = await admin
      .from("usuarios")
      .select("id")
      .in("id", [...reemplazables.keys()]);
    for (const u of conAcceso ?? []) reemplazables.delete(u.id);
  }
  let reabrir: Reemplazable | null = null;
  for (const viejo of reemplazables.values()) {
    // El reintento público reabre la rechazada; el alta manual del staff
    // (aprobado directo) la pisa como a las huérfanas.
    if (viejo.estado === "rechazado" && esEnrolamiento && !reabrir) {
      reabrir = viejo;
      continue;
    }
    if (viejo.docs.length) await admin.storage.from(BUCKET).remove(viejo.docs);
    // Notificaciones del staff sobre la solicitud pisada: quedarían en 404
    // desde la campanita (criterio STORY-951).
    await admin.from("notificaciones").delete().eq("ruta", `/tecnicos/${viejo.id}`);
    // Borrar el usuario de auth cascadea tecnicos y tecnico_especialidades.
    await admin.auth.admin.deleteUser(viejo.id);
  }

  const dup = await duplicadoPersona(
    admin,
    "tecnicos",
    {
      email: datos.email,
      cuil: cuilNormalizado,
      telefono: datos.telefono || null,
    },
    reabrir?.id
  );
  if (dup) return { ok: false, error: dup };

  // Matrícula obligatoria si alguna especialidad la exige (validación server)
  const { data: exigentes } = await admin
    .from("especialidades")
    .select("id")
    .in("id", datos.especialidadIds)
    .eq("requiere_matricula", true);
  if ((exigentes?.length ?? 0) > 0 && matriculas.length === 0) {
    return {
      ok: false,
      error: "Alguna especialidad elegida exige matrícula: subí el archivo.",
    };
  }

  // Reintento tras rechazo (STORY-958 v2.0): se reabre la MISMA solicitud —
  // mismo id/usuario de auth, datos y documentos nuevos, vuelve a "esperando
  // verificación" conservando motivo_rechazo como historial visible. Así el
  // staff nunca la pierde de vista y las notificaciones viejas no quedan 404.
  if (reabrir) {
    if (reabrir.email !== datos.email) {
      const { error: errorAuth } = await admin.auth.admin.updateUserById(
        reabrir.id,
        { email: datos.email, email_confirm: true }
      );
      if (errorAuth) {
        return {
          ok: false,
          error: errorAuth.message.includes("already")
            ? "Ya existe una cuenta con ese correo."
            : "No se pudo actualizar el correo.",
        };
      }
    }
    if (reabrir.docs.length) {
      await admin.storage.from(BUCKET).remove(reabrir.docs);
    }
    const [docDniNuevo, ...matriculasNuevas] = await Promise.all([
      subirDoc(reabrir.id, "dni", docDniArchivo),
      ...matriculas.map((m, i) => subirDoc(reabrir.id, `matricula-${i + 1}`, m)),
    ]);
    // Mismo email → se conserva el token: los links de los emails
    // anteriores del hilo siguen vivos (abrir un mail viejo no puede ser
    // un callejón sin salida). Email DISTINTO → token fresco: verificar
    // la casilla nueva solo puede hacerse desde la casilla nueva (los
    // links que fueron a la anterior dejan de valer).
    const mismoEmail = reabrir.email === datos.email;
    const tokenReintento =
      mismoEmail && reabrir.token ? reabrir.token : crypto.randomUUID();
    const { error: errorReabrir } = await admin
      .from("tecnicos")
      .update({
        nombre: datos.nombre,
        email: datos.email,
        telefono: datos.telefono || null,
        cuil: cuilNormalizado,
        estado: "pendiente",
        email_verificado: false,
        token_verificacion: tokenReintento,
        doc_dni_path: docDniNuevo,
        doc_matricula_paths: matriculasNuevas.filter(Boolean),
      })
      .eq("id", reabrir.id);
    if (errorReabrir) {
      return {
        ok: false,
        error:
          errorReabrir.code === "23505"
            ? ERROR_DUPLICADO_DB
            : "No se pudo reenviar la solicitud.",
      };
    }
    await admin.from("tecnico_especialidades").delete().eq("tecnico_id", reabrir.id);
    await admin.from("tecnico_especialidades").insert(
      datos.especialidadIds.map((especialidad_id) => ({
        tecnico_id: reabrir!.id,
        especialidad_id,
      }))
    );
    await emailVerificacionTecnico(
      { nombre: datos.nombre, email: datos.email },
      `${baseUrl()}/registro-tecnico/verificar?token=${tokenReintento}`
    );
    // STORY-980: el reintento tras rechazo también queda en la auditoría
    // de sistema (sin sesión → actor "Registro público").
    await registrarEventoSistema("tecnico_postulado", {
      afectado: datos.nombre,
      email: datos.email,
      reintento: true,
    });
    revalidatePath("/tecnicos");
    return { ok: true };
  }

  // Sin contraseña (STORY-955): el técnico la crea recién al ser aprobado,
  // vía link de recovery — hasta entonces no puede iniciar sesión.
  const { data: creado, error: errorAuth } = await admin.auth.admin.createUser({
    email: datos.email,
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

  const [docDni, ...docsMatricula] = await Promise.all([
    subirDoc(id, "dni", docDniArchivo),
    ...matriculas.map((m, i) => subirDoc(id, `matricula-${i + 1}`, m)),
  ]);

  // Enrolamiento público: la solicitud queda invisible para el staff hasta
  // que el técnico verifique su email con el token. Alta manual: el staff
  // responde por el dato — nace verificada.
  const token = esEnrolamiento ? crypto.randomUUID() : null;
  const { error: errorTecnico } = await admin.from("tecnicos").insert({
    id,
    nombre: datos.nombre,
    email: datos.email,
    telefono: datos.telefono || null,
    cuil: cuilNormalizado,
    estado,
    email_verificado: !esEnrolamiento,
    token_verificacion: token,
    doc_dni_path: docDni,
    doc_matricula_paths: docsMatricula.filter(Boolean),
  });
  if (errorTecnico) {
    await admin.auth.admin.deleteUser(id);
    return {
      ok: false,
      error: errorTecnico.code === "23505" ? ERROR_DUPLICADO_DB : "No se pudo guardar el técnico.",
    };
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

  if (esEnrolamiento) {
    await emailVerificacionTecnico(
      { nombre: datos.nombre, email: datos.email },
      `${baseUrl()}/registro-tecnico/verificar?token=${token}`
    );
  } else {
    // Alta manual: queda aprobado de una — va directo el email de
    // bienvenida con el link para crear su contraseña.
    const link = await linkCrearContrasena(datos.email);
    await emailResultadoTecnico(
      { nombre: datos.nombre, email: datos.email },
      "aprobado",
      { linkCrearContrasena: link ?? undefined }
    );
  }

  // STORY-980: postulación pública (sin sesión → actor "Registro público")
  // o alta manual del staff, según quién llegó hasta acá.
  await registrarEventoSistema(
    esEnrolamiento ? "tecnico_postulado" : "tecnico_alta_manual",
    { afectado: datos.nombre, email: datos.email }
  );

  revalidatePath("/tecnicos");
  return { ok: true };
}

// PÚBLICA (sin sesión): el link del email de verificación. El token es un
// uuid aleatorio de un solo propósito; si ya se usó, la respuesta es la
// misma (idempotente para el doble clic).
export async function verificarEmailTecnico(
  token: string
): Promise<"verificado" | "ya_verificado" | "invalido"> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return "invalido";
  const admin = createAdminClient();
  const { data: t } = await admin
    .from("tecnicos")
    .select("id, email_verificado")
    .eq("token_verificacion", token)
    .single();
  if (!t) return "invalido";
  if (t.email_verificado) return "ya_verificado";
  const { error } = await admin
    .from("tecnicos")
    .update({ email_verificado: true })
    .eq("id", t.id);
  if (error) return "invalido";
  // Sin revalidatePath: esto corre durante el render de la página de
  // verificación (no es un form action) y /tecnicos es dinámica igual.
  return "verificado";
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
        "id, nombre, email, telefono, estado, email_verificado, motivo_rechazo, creado_en, tecnico_especialidades(especialidades(nombre))"
      )
      // Una solicitud NUEVA sin email verificado todavía "no existe" para el
      // staff (STORY-955). Los reintentos tras rechazo (tienen motivo_rechazo,
      // STORY-958 v2) sí se muestran siempre — el staff ya los conocía.
      .or(
        "estado.neq.pendiente,email_verificado.eq.true,motivo_rechazo.not.is.null"
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
    email_verificado: boolean;
    motivo_rechazo: string | null;
    creado_en: string;
    tecnico_especialidades: { especialidades: { nombre: string } | null }[];
  };
  return ((tecnicos ?? []) as unknown as Fila[]).map((t) => ({
    id: t.id,
    nombre: t.nombre,
    email: t.email,
    telefono: t.telefono,
    estado: t.estado,
    email_verificado: t.email_verificado,
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
      "id, nombre, email, telefono, cuil, estado, email_verificado, creado_en, motivo_rechazo, doc_dni_path, doc_matricula_paths, tecnico_especialidades(especialidad_id, especialidades(nombre))"
    )
    .eq("id", id)
    .single();
  if (!t) return null;

  const admin = createAdminClient();
  const docs: TecnicoDetalle["docs"] = [];
  const paths: string[] = t.doc_matricula_paths ?? [];
  const rutas: [string, string | null][] = [
    ["DNI", t.doc_dni_path],
    ...paths.map(
      (path, i): [string, string] => [
        paths.length > 1 ? `Matrícula ${i + 1}` : "Matrícula",
        path,
      ]
    ),
  ];
  for (const [tipo, path] of rutas) {
    if (!path) continue;
    const { data } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(path, 3600);
    // `path` solo se expone para las matrículas: es lo que permite borrarlas
    // desde la UI (el DNI no se puede eliminar).
    if (data?.signedUrl)
      docs.push({ tipo, url: data.signedUrl, path: tipo !== "DNI" ? path : undefined });
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
    email_verificado: t.email_verificado,
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

  // El aprobado todavía no tiene contraseña (STORY-955): el email de
  // bienvenida lleva el link para crearla. Si generarlo falla, el email
  // sale igual — le queda "¿Olvidaste tu contraseña?" como salida.
  const link = await linkCrearContrasena(t.email);
  await emailResultadoTecnico(t, "aprobado", {
    linkCrearContrasena: link ?? undefined,
  });

  // STORY-980: la aprobación queda en la auditoría de sistema.
  await registrarEventoSistema("tecnico_aprobado", {
    afectado: t.nombre,
    email: t.email,
  });

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

  await emailResultadoTecnico(t, "rechazado", { motivo: motivo.trim() });

  // STORY-980: el rechazo queda en la auditoría de sistema, motivo incluido.
  await registrarEventoSistema("tecnico_rechazado", {
    afectado: t.nombre,
    email: t.email,
    motivo: motivo.trim(),
  });

  revalidatePath("/tecnicos");
  return { ok: true };
}

// Editar especialidades de un técnico ya creado (staff de mantenimiento).
// Si se agrega una que exige matrícula y el técnico no tiene ninguna
// cargada, el mismo form deja subir el archivo ahí mismo (STORY-948) — antes
// esto bloqueaba sin salida, y el gestor no tenía forma de resolverlo.
// STORY-1012: el bloqueo mira solo las especialidades EXIGENTES NUEVAS (que
// el técnico no tenía antes de este submit) — antes alcanzaba con que el
// técnico tuviera matrícula de CUALQUIER especialidad para dejar pasar una
// nueva sin pedir nada, porque `doc_matricula_paths` no distingue de cuál es.
export async function actualizarEspecialidadesTecnico(
  tecnicoId: string,
  form: FormData
): Promise<ActionResult> {
  const permiso = await exigirStaffMantenimiento();
  if (!permiso.ok) return permiso;
  const especialidadIds = form.getAll("especialidades").map(String);
  if (especialidadIds.length === 0) {
    return { ok: false, error: "El técnico debe tener al menos una especialidad." };
  }
  const nuevasMatriculas = form
    .getAll("doc_matricula")
    .filter((v): v is File => v instanceof File && v.size > 0);
  for (const m of nuevasMatriculas) {
    const errMatricula = errorArchivo(`La matrícula "${m.name}"`, m);
    if (errMatricula) return { ok: false, error: errMatricula };
  }

  const admin = createAdminClient();
  const [{ data: tecnico }, { data: exigentes }, { data: previas }] = await Promise.all([
    admin.from("tecnicos").select("doc_matricula_paths").eq("id", tecnicoId).single(),
    admin
      .from("especialidades")
      .select("id, nombre")
      .in("id", especialidadIds)
      .eq("requiere_matricula", true),
    admin.from("tecnico_especialidades").select("especialidad_id").eq("tecnico_id", tecnicoId),
  ]);
  if (!tecnico) return { ok: false, error: "Técnico no encontrado." };
  const existentes = tecnico.doc_matricula_paths ?? [];
  const idsPrevios = new Set((previas ?? []).map((p) => p.especialidad_id));
  const exigentesNuevas = (exigentes ?? []).filter((e) => !idsPrevios.has(e.id));
  if (exigentesNuevas.length > 0 && nuevasMatriculas.length === 0) {
    return {
      ok: false,
      error: `${exigentesNuevas.map((e) => e.nombre).join(", ")} exige matrícula: subí el archivo nuevo o sacá esa especialidad.`,
    };
  }

  if (nuevasMatriculas.length > 0) {
    const subidas = await Promise.all(
      nuevasMatriculas.map((m, i) =>
        subirDoc(tecnicoId, `matricula-${existentes.length + i + 1}`, m)
      )
    );
    const paths = [...existentes, ...subidas.filter((p): p is string => Boolean(p))];
    await admin.from("tecnicos").update({ doc_matricula_paths: paths }).eq("id", tecnicoId);
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

// Borrar una matrícula ya cargada (staff de mantenimiento). Falta desde que
// existe la carga: la administración podía agregar matrículas pero no sacar
// una vieja/errónea. Bloqueado si es la última y el técnico todavía tiene
// una especialidad que la exige — ahí primero hay que sacarle la especialidad.
export async function eliminarMatriculaTecnico(
  tecnicoId: string,
  path: string
): Promise<ActionResult> {
  const permiso = await exigirStaffMantenimiento();
  if (!permiso.ok) return permiso;

  const admin = createAdminClient();
  const { data: tecnico } = await admin
    .from("tecnicos")
    .select("doc_matricula_paths, tecnico_especialidades(especialidades(requiere_matricula))")
    .eq("id", tecnicoId)
    .single();
  if (!tecnico) return { ok: false, error: "Técnico no encontrado." };

  const existentes = tecnico.doc_matricula_paths ?? [];
  if (!existentes.includes(path)) {
    return { ok: false, error: "Esa matrícula ya no está." };
  }

  type TE = { especialidades: { requiere_matricula: boolean } | null };
  const exigeMatricula = (
    tecnico.tecnico_especialidades as unknown as TE[]
  ).some((te) => te.especialidades?.requiere_matricula);
  const restantes = existentes.filter((p: string) => p !== path);
  if (exigeMatricula && restantes.length === 0) {
    return {
      ok: false,
      error:
        "Es la última matrícula y el técnico tiene una especialidad que la exige: sacale esa especialidad o subí otra matrícula antes de borrar esta.",
    };
  }

  await admin.storage.from(BUCKET).remove([path]);
  const { error } = await admin
    .from("tecnicos")
    .update({ doc_matricula_paths: restantes })
    .eq("id", tecnicoId);
  if (error) return { ok: false, error: "No se pudo borrar la matrícula." };

  revalidatePath(`/tecnicos/${tecnicoId}`);
  return { ok: true };
}

// Editar datos de identidad de un técnico ya creado (STORY-948, recortada
// por STORY-959): la inmobiliaria corrige nombre y CUIL. El CONTACTO
// (email/teléfono) es del técnico y se edita solo desde su perfil.
export async function editarDatosTecnico(
  tecnicoId: string,
  datos: { nombre: string; cuil: string }
): Promise<ActionResult> {
  const permiso = await exigirStaffMantenimiento();
  if (!permiso.ok) return permiso;

  const nombre = datos.nombre.trim();
  if (!nombre) {
    return { ok: false, error: "Completá el nombre." };
  }
  const errNombre = errorNombre(nombre);
  if (errNombre) {
    return { ok: false, error: errNombre };
  }
  if (!datos.cuil.trim()) {
    return { ok: false, error: "El CUIL es obligatorio." };
  }
  const errCuil = errorCuil(datos.cuil);
  if (errCuil) return { ok: false, error: errCuil };
  const cuil = normalizarCuil(datos.cuil);

  const admin = createAdminClient();
  const dup = await duplicadoPersona(admin, "tecnicos", { cuil }, tecnicoId);
  if (dup) return { ok: false, error: dup };

  const { data: actual } = await admin
    .from("tecnicos")
    .select("estado")
    .eq("id", tecnicoId)
    .single();
  if (!actual) return { ok: false, error: "Técnico no encontrado." };

  const { error } = await admin
    .from("tecnicos")
    .update({ nombre, cuil })
    .eq("id", tecnicoId);
  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? ERROR_DUPLICADO_DB : "No se pudo guardar.",
    };
  }

  // Aprobado con acceso propio: usuarios.nombre queda en sync.
  if (actual.estado === "aprobado") {
    await admin.from("usuarios").update({ nombre }).eq("id", tecnicoId);
  }

  revalidatePath(`/tecnicos/${tecnicoId}`);
  revalidatePath("/tecnicos");
  return { ok: true };
}

// El CONTACTO es del propio técnico (STORY-959): email y teléfono se
// cambian desde /tecnico/perfil con su sesión. El email vive en auth.users
// — se actualiza ahí primero, con rollback si falla el guardado en
// tecnicos (mismo criterio de compensación que altaTecnico).
export async function actualizarMiContacto(datos: {
  email: string;
  telefono: string;
}): Promise<ActionResult> {
  const actual = await obtenerUsuarioActual();
  if (actual?.rol !== "tecnico") {
    return { ok: false, error: "No tenés permiso para hacer esto." };
  }

  const email = datos.email.trim().toLowerCase();
  const telefono = normalizarTelefono(datos.telefono);
  if (!email || !telefono) {
    return { ok: false, error: "Completá email y teléfono." };
  }
  const errTelefono = errorTelefono(telefono);
  if (errTelefono) {
    return { ok: false, error: errTelefono };
  }

  const admin = createAdminClient();
  const dup = await duplicadoPersona(
    admin,
    "tecnicos",
    { email, telefono },
    actual.id
  );
  if (dup) return { ok: false, error: dup };

  const cambiaEmail = actual.email !== email;
  if (cambiaEmail) {
    const { error: errorAuth } = await admin.auth.admin.updateUserById(actual.id, {
      email,
      email_confirm: true,
    });
    if (errorAuth) {
      return {
        ok: false,
        error: errorAuth.message.includes("already")
          ? "Ya existe una cuenta con ese correo."
          : "No se pudo actualizar el correo.",
      };
    }
  }

  const { error } = await admin
    .from("tecnicos")
    .update({ email, telefono })
    .eq("id", actual.id);
  if (error) {
    if (cambiaEmail) {
      await admin.auth.admin.updateUserById(actual.id, { email: actual.email });
    }
    return {
      ok: false,
      error: error.code === "23505" ? ERROR_DUPLICADO_DB : "No se pudo guardar.",
    };
  }

  await admin.from("usuarios").update({ email }).eq("id", actual.id);

  revalidatePath("/tecnico/perfil");
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

  // STORY-966: con gestiones operativas asignadas la baja se BLOQUEA (doctrina
  // STORY-924: nada de "continuar igual") — primero desasignar o cancelar.
  // Cobro/liquidación no bloquean: ahí el técnico ya no opera (el comprobante
  // le llega por email). Admin client a propósito: el gestor solo ve las suyas
  // por RLS y dejaría pasar gestiones de otros gestores.
  if (!activo) {
    const { data: enCurso } = await admin
      .from("gestiones")
      .select("id, propiedades(direccion)")
      .eq("tecnico_id", id)
      .in("etapa", ["asignacion", "presupuesto", "en_ejecucion", "conformidad"]);
    if (enCurso && enCurso.length > 0) {
      const direcciones = (enCurso as unknown as { propiedades: { direccion: string } | null }[])
        .map((g) => g.propiedades?.direccion)
        .filter(Boolean)
        .slice(0, 3)
        .join(", ");
      const n = enCurso.length;
      return {
        ok: false,
        error: `No se puede inhabilitar: tiene ${n} ${n === 1 ? "gestión" : "gestiones"} en curso (${direcciones}${n > 3 ? "…" : ""}). ${n === 1 ? "Desasignala o cancelala" : "Desasignalas o cancelalas"} primero.`,
      };
    }
  }

  const { data: u, error } = await admin
    .from("usuarios")
    .update({ esta_activo: activo })
    .eq("id", id)
    .eq("rol", "tecnico")
    .select("nombre, email")
    .single();
  if (error || !u) return { ok: false, error: "No se pudo actualizar el estado." };

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

  // STORY-980: el cambio de estado queda en la auditoría de sistema.
  await registrarEventoSistema(
    activo ? "tecnico_rehabilitado" : "tecnico_inhabilitado",
    { afectado: u.nombre, email: u.email }
  );

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
      "nombre, email, telefono, cuil, doc_dni_path, doc_matricula_paths, tecnico_especialidades(especialidades(nombre))"
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
    tiene_matricula: (t.doc_matricula_paths?.length ?? 0) > 0,
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
