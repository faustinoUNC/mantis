"use server";

// STORY-1051 — Acciones de la bandeja "Para revisar de fondo". La detección y
// el orden se computan client-side sobre `metricas.filas` (features/patrones-fondo/
// patrones.ts); acá viven solo las ESCRITURAS y la lectura de las revisiones.

import { obtenerUsuarioActual } from "@/features/auth/service";
import { createClient } from "@/shared/lib/supabase/server";
import type { ActionResult } from "@/features/empleados/types";
import type { RevisionFondo } from "./patrones";

// Las revisiones que ya existen, para derivar el ciclo de vida (ocultar/
// reaparecer). RLS scopea por rol; el alcance fino lo pone la bandeja al cruzar
// contra las gestiones que el usuario ve.
export async function listarRevisionesFondo(): Promise<RevisionFondo[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("revisiones_fondo")
    .select("propiedad_id, especialidad_id, atendida_en, resultado, gestion_fondo_id");
  return (data ?? []).map((r) => ({
    propiedadId: r.propiedad_id as string,
    especialidadId: r.especialidad_id as string,
    atendidaEn: r.atendida_en as string,
    resultado: r.resultado as RevisionFondo["resultado"],
    gestionFondoId: (r.gestion_fondo_id as string | null) ?? null,
  }));
}

// "No están relacionadas / coincidencia": marca el patrón como atendido. La fila
// sale de la bandeja y solo vuelve si entra una obra nueva de ese rubro después.
export async function descartarPatron(
  propiedadId: string,
  especialidadId: string
): Promise<ActionResult> {
  const actual = await obtenerUsuarioActual();
  if (!actual) return { ok: false, error: "Sin sesión." };

  const supabase = await createClient();
  const { error } = await supabase.from("revisiones_fondo").insert({
    propiedad_id: propiedadId,
    especialidad_id: especialidadId,
    resultado: "descartada",
    actor_id: actual.id,
  });
  if (error) return { ok: false, error: "No se pudo descartar el patrón." };
  return { ok: true };
}
