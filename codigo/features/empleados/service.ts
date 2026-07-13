"use server";

import { revalidatePath } from "next/cache";
import { linkCrearContrasena } from "@/features/auth/recovery";
import { obtenerUsuarioActual } from "@/features/auth/service";
import type { Rol } from "@/features/auth/types";
import { emailRecuperarContrasena } from "@/features/email/service";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { createClient } from "@/shared/lib/supabase/server";
import type { ActionResult, Empleado, NuevoEmpleado } from "./types";

// Los services que tocan la Admin API bypasean RLS: SIEMPRE verificar
// el rol del caller primero (STORY-103, nota de seguridad).
async function exigirAdmin(): Promise<ActionResult> {
  const actual = await obtenerUsuarioActual();
  if (actual?.rol !== "administrador") {
    return { ok: false, error: "Solo el administrador puede hacer esto." };
  }
  return { ok: true };
}

export async function listarEmpleados(): Promise<Empleado[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("usuarios")
    .select("id, nombre, email, rol, esta_activo, creado_en")
    .neq("rol", "tecnico") // los técnicos viven en su propia sección
    .order("creado_en", { ascending: true });
  return (data ?? []) as Empleado[];
}

export async function crearEmpleado(
  nuevo: NuevoEmpleado
): Promise<ActionResult> {
  const permiso = await exigirAdmin();
  if (!permiso.ok) return permiso;
  if (nuevo.rol === "tecnico") {
    return { ok: false, error: "Los técnicos se gestionan desde la sección Técnicos." };
  }

  const admin = createAdminClient();
  const { data: creado, error: errorAuth } = await admin.auth.admin.createUser({
    email: nuevo.email,
    password: nuevo.password,
    email_confirm: true,
  });
  if (errorAuth || !creado.user) {
    return {
      ok: false,
      error: errorAuth?.message.includes("already")
        ? "Ya existe un usuario con ese correo."
        : "No se pudo crear el usuario.",
    };
  }

  const { error: errorFila } = await admin.from("usuarios").insert({
    id: creado.user.id,
    nombre: nuevo.nombre,
    email: nuevo.email,
    rol: nuevo.rol,
  });
  if (errorFila) {
    // Rollback: sin fila en usuarios el login quedaría huérfano.
    await admin.auth.admin.deleteUser(creado.user.id);
    return { ok: false, error: "No se pudo guardar el empleado." };
  }

  revalidatePath("/admin/empleados");
  return { ok: true };
}

export async function cambiarEstadoEmpleado(
  id: string,
  activo: boolean
): Promise<ActionResult> {
  const actual = await obtenerUsuarioActual();
  if (actual?.rol !== "administrador") {
    return { ok: false, error: "Solo el administrador puede hacer esto." };
  }
  if (id === actual.id) {
    return { ok: false, error: "No podés inhabilitar tu propia cuenta." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("usuarios")
    .update({ esta_activo: activo })
    .eq("id", id);
  if (error) return { ok: false, error: "No se pudo actualizar el estado." };

  if (!activo) {
    // Capa dura del bloqueo: revocar refresh tokens (GoTrue Admin API;
    // supabase-js no expone logout por id).
    await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${id}/logout`,
      {
        method: "POST",
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    ).catch(() => {
      // El update ya cortó el acceso vía RLS/guards; la revocación es refuerzo.
    });
  }

  revalidatePath("/admin/empleados");
  return { ok: true };
}

export async function editarEmpleado(
  id: string,
  cambios: { nombre: string; rol: Rol; email: string }
): Promise<ActionResult> {
  // RLS ya restringe el UPDATE a admin; el chequeo explícito evita la falla
  // silenciosa (0 filas) y la whitelist evita campos extra en el payload.
  const permiso = await exigirAdmin();
  if (!permiso.ok) return permiso;
  if (cambios.rol === "tecnico") {
    return { ok: false, error: "Los técnicos se gestionan desde la sección Técnicos." };
  }
  const email = cambios.email.trim().toLowerCase();
  if (!cambios.nombre.trim() || !email) {
    return { ok: false, error: "Completá nombre y correo." };
  }

  // El email vive en auth.users: se actualiza ahí primero y, si después
  // falla la fila de usuarios, se revierte — mismo patrón de compensación
  // que editarDatosTecnico (STORY-948/956).
  const admin = createAdminClient();
  const { data: actual } = await admin
    .from("usuarios")
    .select("email")
    .eq("id", id)
    .single();
  if (!actual) return { ok: false, error: "Empleado no encontrado." };

  const cambiaEmail = actual.email !== email;
  if (cambiaEmail) {
    const { error: errorAuth } = await admin.auth.admin.updateUserById(id, {
      email,
      email_confirm: true,
    });
    if (errorAuth) {
      return {
        ok: false,
        error: errorAuth.message.includes("already")
          ? "Ya existe un usuario con ese correo."
          : "No se pudo actualizar el correo.",
      };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("usuarios")
    .update({ nombre: cambios.nombre, rol: cambios.rol, email })
    .eq("id", id);
  if (error) {
    if (cambiaEmail) {
      await admin.auth.admin.updateUserById(id, { email: actual.email });
    }
    return {
      ok: false,
      error: error.code === "23505" ? "Ya existe un usuario con ese correo." : "No se pudo actualizar.",
    };
  }

  revalidatePath("/admin/empleados");
  return { ok: true };
}

// Blanqueo de contraseña (STORY-956): el admin no tipea ninguna — se le
// envía al empleado el link de recovery a /crear-contrasena (STORY-955).
// La contraseña vieja sigue sirviendo hasta que elija la nueva (para
// bloquear el acceso ya existe Inhabilitar).
export async function restablecerContrasenaEmpleado(
  id: string
): Promise<ActionResult> {
  const permiso = await exigirAdmin();
  if (!permiso.ok) return permiso;

  const admin = createAdminClient();
  const { data: empleado } = await admin
    .from("usuarios")
    .select("nombre, email, rol")
    .eq("id", id)
    .single();
  if (!empleado || empleado.rol === "tecnico") {
    return { ok: false, error: "Empleado no encontrado." };
  }

  const link = await linkCrearContrasena(empleado.email);
  if (!link) return { ok: false, error: "No se pudo generar el link." };
  await emailRecuperarContrasena(
    { nombre: empleado.nombre, email: empleado.email },
    link,
    "restablecer_contrasena"
  );
  return { ok: true };
}
