"use server";

import { obtenerUsuarioActual } from "@/features/auth/service";
import { createAdminClient } from "@/shared/lib/supabase/admin";

export interface EventoAuditoria {
  id: string;
  tipo: string;
  de_etapa: string | null;
  a_etapa: string | null;
  detalle: Record<string, unknown> | null;
  creado_en: string;
  gestion_id: string;
  gestion_descripcion: string;
  direccion: string;
  actor_nombre: string;
}

// Solo admin (PRD §11). Admin client tras el rol-check: cruza actores de
// todos los roles y gestiones completas.
export async function historialGlobal(): Promise<EventoAuditoria[]> {
  const actual = await obtenerUsuarioActual();
  if (actual?.rol !== "administrador") return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from("eventos_gestion")
    .select(
      "id, tipo, de_etapa, a_etapa, detalle, creado_en, gestion_id, gestiones(descripcion, propiedades(direccion))"
    )
    .order("creado_en", { ascending: false })
    .limit(200);

  const actorIds = new Set<string>();
  const { data: eventosRaw } = await admin
    .from("eventos_gestion")
    .select("id, actor_id")
    .order("creado_en", { ascending: false })
    .limit(200);
  (eventosRaw ?? []).forEach((e) => actorIds.add(e.actor_id));
  const { data: actores } = await admin
    .from("usuarios")
    .select("id, nombre")
    .in("id", [...actorIds]);
  const nombrePorId = new Map((actores ?? []).map((a) => [a.id, a.nombre]));
  const actorPorEvento = new Map(
    (eventosRaw ?? []).map((e) => [e.id, e.actor_id])
  );

  type Fila = {
    id: string;
    tipo: string;
    de_etapa: string | null;
    a_etapa: string | null;
    detalle: Record<string, unknown> | null;
    creado_en: string;
    gestion_id: string;
    gestiones: {
      descripcion: string;
      propiedades: { direccion: string } | null;
    } | null;
  };

  return ((data ?? []) as unknown as Fila[]).map((e) => ({
    id: e.id,
    tipo: e.tipo,
    de_etapa: e.de_etapa,
    a_etapa: e.a_etapa,
    detalle: e.detalle,
    creado_en: e.creado_en,
    gestion_id: e.gestion_id,
    gestion_descripcion: e.gestiones?.descripcion ?? "—",
    direccion: e.gestiones?.propiedades?.direccion ?? "—",
    actor_nombre: nombrePorId.get(actorPorEvento.get(e.id) ?? "") ?? "Sistema",
  }));
}
