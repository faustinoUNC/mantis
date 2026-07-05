"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/features/empleados/types";
import { createClient } from "@/shared/lib/supabase/server";
import type { Especialidad } from "./types";

// RLS hace cumplir los permisos (solo admin escribe) — server client normal.

export async function listarEspecialidades(): Promise<Especialidad[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("especialidades")
    .select("id, nombre, requiere_matricula, activa")
    .order("nombre");
  return (data ?? []) as Especialidad[];
}

export async function listarEspecialidadesActivas(): Promise<Especialidad[]> {
  return (await listarEspecialidades()).filter((e) => e.activa);
}

export async function crearEspecialidad(datos: {
  nombre: string;
  requiere_matricula: boolean;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("especialidades").insert(datos);
  if (error) {
    return {
      ok: false,
      error: error.code === "23505"
        ? "Ya existe una especialidad con ese nombre."
        : "No se pudo crear la especialidad.",
    };
  }
  revalidatePath("/admin/especialidades");
  return { ok: true };
}

export async function editarEspecialidad(
  id: string,
  cambios: { nombre: string; requiere_matricula: boolean }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("especialidades")
    .update(cambios)
    .eq("id", id);
  if (error) return { ok: false, error: "No se pudo actualizar." };
  revalidatePath("/admin/especialidades");
  return { ok: true };
}

export async function cambiarEstadoEspecialidad(
  id: string,
  activa: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("especialidades")
    .update({ activa })
    .eq("id", id);
  if (error) return { ok: false, error: "No se pudo actualizar el estado." };
  revalidatePath("/admin/especialidades");
  return { ok: true };
}
