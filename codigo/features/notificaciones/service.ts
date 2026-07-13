"use server";

import { createClient } from "@/shared/lib/supabase/server";

export interface Notificacion {
  id: string;
  gestion_id: string | null;
  // STORY-953: a dónde navegar al hacer clic. La arma el trigger que la
  // crea (ahí ya se sabe si es una gestión, un reporte de inbox o una
  // solicitud de técnico) — el frontend solo la usa, no la deriva.
  ruta: string | null;
  titulo: string;
  cuerpo: string | null;
  leida_en: string | null;
  creado_en: string;
}

export async function misNotificaciones(): Promise<Notificacion[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notificaciones")
    .select("id, gestion_id, ruta, titulo, cuerpo, leida_en, creado_en")
    .order("creado_en", { ascending: false })
    .limit(30);
  return (data ?? []) as Notificacion[];
}

export async function marcarLeidas(): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("notificaciones")
    .update({ leida_en: new Date().toISOString() })
    .is("leida_en", null);
}
