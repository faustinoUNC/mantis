"use server";

import { revalidatePath } from "next/cache";
import { obtenerUsuarioActual } from "@/features/auth/service";
import type { Rol } from "@/features/auth/types";
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
    .order("creado_en", { ascending: true });
  return (data ?? []) as Empleado[];
}

export async function crearEmpleado(
  nuevo: NuevoEmpleado
): Promise<ActionResult> {
  const permiso = await exigirAdmin();
  if (!permiso.ok) return permiso;

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
  cambios: { nombre: string; rol: Rol }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("usuarios")
    .update(cambios)
    .eq("id", id);
  if (error) return { ok: false, error: "No se pudo actualizar." };

  revalidatePath("/admin/empleados");
  return { ok: true };
}
