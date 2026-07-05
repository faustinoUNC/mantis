"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/features/empleados/types";
import { createClient } from "@/shared/lib/supabase/server";
import type { Legajo, Persona, Propiedad, TipoPersona } from "./types";

// RLS staff-only hace cumplir los permisos en las 4 tablas de cartera.

const COL_DOC: Record<TipoPersona, string> = {
  propietarios: "cuit",
  inquilinos: "dni",
};

// ── Propietarios e inquilinos (misma forma, tablas separadas) ──

export async function listarPersonas(tipo: TipoPersona): Promise<Persona[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from(tipo)
    .select(`id, nombre, email, telefono, documento:${COL_DOC[tipo]}, activo`)
    .order("nombre");
  return (data ?? []) as unknown as Persona[];
}

export async function guardarPersona(
  tipo: TipoPersona,
  datos: { nombre: string; email: string; telefono: string; documento: string },
  id?: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const fila = {
    nombre: datos.nombre,
    email: datos.email,
    telefono: datos.telefono || null,
    [COL_DOC[tipo]]: datos.documento || null,
  };
  const { error } = id
    ? await supabase.from(tipo).update(fila).eq("id", id)
    : await supabase.from(tipo).insert(fila);
  if (error) return { ok: false, error: "No se pudo guardar." };
  revalidatePath(`/cartera/${tipo}`);
  return { ok: true };
}

export async function cambiarEstadoPersona(
  tipo: TipoPersona,
  id: string,
  activo: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from(tipo).update({ activo }).eq("id", id);
  if (error) return { ok: false, error: "No se pudo actualizar el estado." };
  revalidatePath(`/cartera/${tipo}`);
  return { ok: true };
}

// ── Propiedades ──

export async function listarPropiedades(): Promise<Propiedad[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("propiedades")
    .select(
      "id, direccion, tipo, propietario_id, activa, propietarios(nombre), legajos(id, fecha_fin)"
    )
    .order("direccion");
  type Fila = {
    id: string;
    direccion: string;
    tipo: string | null;
    propietario_id: string;
    activa: boolean;
    propietarios: { nombre: string } | { nombre: string }[] | null;
    legajos: { id: string; fecha_fin: string | null }[];
  };
  return ((data ?? []) as unknown as Fila[]).map((p) => {
    const prop = Array.isArray(p.propietarios)
      ? p.propietarios[0]
      : p.propietarios;
    return {
      id: p.id,
      direccion: p.direccion,
      tipo: p.tipo,
      propietario_id: p.propietario_id,
      propietario_nombre: prop?.nombre ?? "—",
      activa: p.activa,
      ocupada: p.legajos.some((l) => l.fecha_fin === null),
    };
  });
}

export async function guardarPropiedad(
  datos: { direccion: string; tipo: string; propietario_id: string },
  id?: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const fila = {
    direccion: datos.direccion,
    tipo: datos.tipo || null,
    propietario_id: datos.propietario_id,
  };
  const { error } = id
    ? await supabase.from("propiedades").update(fila).eq("id", id)
    : await supabase.from("propiedades").insert(fila);
  if (error) return { ok: false, error: "No se pudo guardar la propiedad." };
  revalidatePath("/cartera/propiedades");
  return { ok: true };
}

export async function cambiarEstadoPropiedad(
  id: string,
  activa: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("propiedades")
    .update({ activa })
    .eq("id", id);
  if (error) return { ok: false, error: "No se pudo actualizar el estado." };
  revalidatePath("/cartera/propiedades");
  return { ok: true };
}

export async function obtenerPropiedad(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("propiedades")
    .select("id, direccion, tipo, activa, propietarios(id, nombre, email)")
    .eq("id", id)
    .single();
  return data;
}

// ── Legajos ──

export async function legajosDePropiedad(
  propiedadId: string
): Promise<Legajo[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("legajos")
    .select("id, propiedad_id, inquilino_id, fecha_inicio, fecha_fin, inquilinos(nombre)")
    .eq("propiedad_id", propiedadId)
    .order("fecha_inicio", { ascending: false });
  type Fila = Omit<Legajo, "inquilino_nombre"> & {
    inquilinos: { nombre: string } | null;
  };
  return ((data ?? []) as unknown as Fila[]).map((l) => ({
    ...l,
    inquilino_nombre: l.inquilinos?.nombre ?? "—",
  }));
}

export async function abrirLegajo(datos: {
  propiedad_id: string;
  inquilino_id: string;
  fecha_inicio: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("legajos").insert(datos);
  if (error) {
    return {
      ok: false,
      error: error.code === "23505"
        ? "Ya hay un legajo vigente en esta propiedad. Cerralo primero."
        : "No se pudo abrir el legajo.",
    };
  }
  revalidatePath(`/cartera/propiedades/${datos.propiedad_id}`);
  return { ok: true };
}

export async function cerrarLegajo(
  id: string,
  propiedadId: string,
  fechaFin: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("legajos")
    .update({ fecha_fin: fechaFin })
    .eq("id", id)
    .is("fecha_fin", null);
  if (error) {
    return {
      ok: false,
      error: error.code === "23514"
        ? "La fecha de fin no puede ser anterior al inicio."
        : "No se pudo cerrar el legajo.",
    };
  }
  revalidatePath(`/cartera/propiedades/${propiedadId}`);
  return { ok: true };
}
