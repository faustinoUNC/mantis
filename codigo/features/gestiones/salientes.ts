// STORY-974: el evento de desasignación congela tecnico_saliente como UUID
// (avanzar_etapa guarda el id — el nombre puede cambiar, el id no). Para
// mostrarlo hay que traducirlo server-side. Sin "use server": exporta una
// función sync-compatible usada solo por services.

import type { SupabaseClient } from "@supabase/supabase-js";

export async function nombrarSalientes<T extends { detalle: unknown }>(
  eventos: T[],
  db: SupabaseClient
): Promise<T[]> {
  const saliente = (e: T) =>
    (e.detalle as Record<string, unknown> | null)?.tecnico_saliente;
  const ids = [
    ...new Set(
      eventos.map(saliente).filter((v): v is string => typeof v === "string")
    ),
  ];
  if (ids.length === 0) return eventos;

  const { data } = await db.from("usuarios").select("id, nombre").in("id", ids);
  const nombrePorId = new Map((data ?? []).map((u) => [u.id, u.nombre]));

  return eventos.map((e) => {
    const s = saliente(e);
    if (typeof s !== "string" || !nombrePorId.has(s)) return e;
    return {
      ...e,
      detalle: {
        ...(e.detalle as Record<string, unknown>),
        tecnico_saliente: nombrePorId.get(s),
      },
    };
  });
}
