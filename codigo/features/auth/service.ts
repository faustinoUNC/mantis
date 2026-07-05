"use server";

import { createClient } from "@/shared/lib/supabase/server";
import type { UsuarioActual } from "./types";

// Usuario autenticado + su fila de `usuarios`. Null si no hay sesión,
// no tiene fila o está inactivo (RLS solo le deja ver su propia fila).
export async function obtenerUsuarioActual(): Promise<UsuarioActual | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("usuarios")
    .select("id, nombre, email, rol, esta_activo")
    .eq("id", user.id)
    .single();

  if (!data || !data.esta_activo) return null;
  return data as UsuarioActual;
}

export async function cerrarSesion(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
