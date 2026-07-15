"use server";

import {
  AUDITORIA_POR_PAGINA,
  type ActorAuditoria,
  type FiltrosAuditoria,
  type PaginaAuditoria,
} from "@/features/auditoria/types";
import type { Rol } from "@/features/auth/types";
import { obtenerUsuarioActual } from "@/features/auth/service";
import { nombrarSalientes } from "@/features/gestiones/salientes";
import { createAdminClient } from "@/shared/lib/supabase/admin";

// Solo admin (PRD §11). Admin client tras el rol-check: cruza actores de
// todos los roles y gestiones completas.
// STORY-974: filtros y paginación server-side — el límite fijo de 200 hacía
// que el filtro client-side "mintiera" (mostraba solo lo que caía en la
// ventana, pareciendo completo).
export async function historialGlobal(
  filtros: FiltrosAuditoria = {}
): Promise<PaginaAuditoria> {
  const actual = await obtenerUsuarioActual();
  if (actual?.rol !== "administrador") return { eventos: [], total: 0 };

  const admin = createAdminClient();

  // La búsqueda es por datos de la gestión (dirección/descripción), que viven
  // en tablas embebidas: se resuelven primero los ids que matchean.
  let gestionIds: string[] | null = null;
  const busqueda = filtros.busqueda?.trim();
  if (busqueda) {
    const patron = `%${busqueda}%`;
    const [porDescripcion, porDireccion] = await Promise.all([
      admin.from("gestiones").select("id").ilike("descripcion", patron),
      admin
        .from("gestiones")
        .select("id, propiedades!inner(id)")
        .ilike("propiedades.direccion", patron),
    ]);
    gestionIds = [
      ...new Set([
        ...(porDescripcion.data ?? []).map((g) => g.id),
        ...(porDireccion.data ?? []).map((g) => g.id),
      ]),
    ];
    if (gestionIds.length === 0) return { eventos: [], total: 0 };
  }

  const pagina = Math.max(1, filtros.pagina ?? 1);
  const desdeFila = (pagina - 1) * AUDITORIA_POR_PAGINA;

  let query = admin
    .from("eventos_gestion")
    .select(
      "id, tipo, de_etapa, a_etapa, detalle, creado_en, gestion_id, actor_id, gestiones(descripcion, propiedades(direccion))",
      { count: "exact" }
    );
  if (gestionIds) query = query.in("gestion_id", gestionIds);
  if (filtros.tipo) query = query.eq("tipo", filtros.tipo);
  if (filtros.actorId) query = query.eq("actor_id", filtros.actorId);
  // Offset fijo -03:00: Argentina no tiene horario de verano.
  if (filtros.desde) query = query.gte("creado_en", `${filtros.desde}T00:00:00-03:00`);
  if (filtros.hasta) query = query.lte("creado_en", `${filtros.hasta}T23:59:59.999-03:00`);

  const { data, count } = await query
    .order("creado_en", { ascending: false })
    .range(desdeFila, desdeFila + AUDITORIA_POR_PAGINA - 1);

  type Fila = {
    id: string;
    tipo: string;
    de_etapa: string | null;
    a_etapa: string | null;
    detalle: Record<string, unknown> | null;
    creado_en: string;
    gestion_id: string;
    actor_id: string;
    gestiones: {
      descripcion: string;
      propiedades: { direccion: string } | null;
    } | null;
  };
  const filas = await nombrarSalientes(
    (data ?? []) as unknown as Fila[],
    admin
  );

  const { data: actores } = await admin
    .from("usuarios")
    .select("id, nombre, rol")
    .in("id", [...new Set(filas.map((e) => e.actor_id).filter(Boolean))]);
  const actorPorId = new Map(
    (actores ?? []).map((a) => [a.id, { nombre: a.nombre, rol: a.rol as Rol }])
  );

  return {
    total: count ?? 0,
    eventos: filas.map((e) => ({
      id: e.id,
      tipo: e.tipo,
      de_etapa: e.de_etapa,
      a_etapa: e.a_etapa,
      detalle: e.detalle,
      creado_en: e.creado_en,
      gestion_id: e.gestion_id,
      gestion_descripcion: e.gestiones?.descripcion ?? "—",
      direccion: e.gestiones?.propiedades?.direccion ?? "—",
      actor_nombre: actorPorId.get(e.actor_id)?.nombre ?? "Sistema",
      actor_rol: actorPorId.get(e.actor_id)?.rol ?? null,
    })),
  };
}

// STORY-974: el eje "quién hizo qué" es el uso principal de la Auditoría —
// el filtro de persona ofrece los usuarios reales (también inactivos: la
// auditoría es historia).
export async function listarActores(): Promise<ActorAuditoria[]> {
  const actual = await obtenerUsuarioActual();
  if (actual?.rol !== "administrador") return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from("usuarios")
    .select("id, nombre, rol")
    .order("nombre");
  return (data ?? []) as ActorAuditoria[];
}
