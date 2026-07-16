"use server";

import { obtenerUsuarioActual } from "@/features/auth/service";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import {
  MEDIO_COBRO_LABEL,
  MEDIO_LIQUIDACION_LABEL,
  type MedioCobro,
  type MedioLiquidacion,
} from "./medios";
import {
  diasDesde,
  type CobrosData,
  type LiquidacionesData,
} from "./consultas-types";

// Solo admin y gestor administrativo ven finanzas (defensa en profundidad:
// el layout ya gatea, pero el service también corta).
async function permitido(): Promise<boolean> {
  const actual = await obtenerUsuarioActual();
  return (
    actual?.rol === "administrador" || actual?.rol === "gestor_administrativo"
  );
}

function medioCobroLabel(m1: string | null, m2: string | null): string {
  if (!m1) return "—";
  const l1 = MEDIO_COBRO_LABEL[m1 as MedioCobro] ?? m1;
  if (!m2) return l1;
  const l2 = MEDIO_COBRO_LABEL[m2 as MedioCobro] ?? m2;
  return `${l1} + ${l2}`;
}

// Compartido entre pendientes y cerrados: el pagador se busca igual en los
// dos (permite filtrar cobros cerrados por quién pagó, no solo pendientes).
function resolverPagador(
  pagador: "inquilino" | "propietario" | null,
  propiedades: { propietarios: { nombre: string } | null } | null,
  legajos: { inquilinos: { nombre: string } | null } | null
): { nombre: string; rotulo: string } {
  if (pagador === "propietario") {
    return { nombre: propiedades?.propietarios?.nombre ?? "—", rotulo: "Propietario" };
  }
  if (pagador === "inquilino") {
    return { nombre: legajos?.inquilinos?.nombre ?? "—", rotulo: "Inquilino" };
  }
  return { nombre: "—", rotulo: "—" };
}

// ── COBROS ────────────────────────────────────────────────────────────────
export async function listarCobros(): Promise<CobrosData> {
  if (!(await permitido())) return { pendientes: [], cerrados: [] };
  const admin = createAdminClient();

  // Pendientes: en la etapa de cobro y sin cobrar todavía.
  const { data: pendRaw } = await admin
    .from("gestiones")
    .select(
      "id, descripcion, pagador, costo_final, cargo_admin, cargo_cancelacion, propiedades(direccion, propietarios(nombre)), legajos(inquilinos(nombre))"
    )
    .eq("etapa", "facturacion_cobro")
    .is("cobrado_en", null);

  type PendFila = {
    id: string;
    descripcion: string;
    pagador: "inquilino" | "propietario" | null;
    costo_final: number | null;
    cargo_admin: number | null;
    cargo_cancelacion: number | null;
    propiedades: {
      direccion: string;
      propietarios: { nombre: string } | null;
    } | null;
    legajos: { inquilinos: { nombre: string } | null } | null;
  };
  const pendFilas = (pendRaw ?? []) as unknown as PendFila[];

  // Antigüedad: momento de entrada a facturacion_cobro (event log), una query.
  const ids = pendFilas.map((g) => g.id);
  const entroPorId = new Map<string, string>();
  if (ids.length > 0) {
    const { data: ev } = await admin
      .from("eventos_gestion")
      .select("gestion_id, creado_en")
      .in("gestion_id", ids)
      .eq("a_etapa", "facturacion_cobro")
      .order("creado_en", { ascending: false });
    for (const e of (ev ?? []) as { gestion_id: string; creado_en: string }[]) {
      if (!entroPorId.has(e.gestion_id)) entroPorId.set(e.gestion_id, e.creado_en);
    }
  }

  const pendientes = pendFilas.map((g) => {
    const total =
      g.cargo_cancelacion != null
        ? Number(g.cargo_cancelacion)
        : Number(g.costo_final ?? 0) + Number(g.cargo_admin ?? 0);
    const { nombre: pagadorNombre, rotulo: pagadorRotulo } = resolverPagador(
      g.pagador,
      g.propiedades,
      g.legajos
    );
    const entro = entroPorId.get(g.id);
    return {
      id: g.id,
      descripcion: g.descripcion,
      direccion: g.propiedades?.direccion ?? "—",
      pagadorNombre,
      pagadorRotulo,
      total,
      diasPendiente: entro ? diasDesde(entro) : null,
    };
  });

  // Cerrados: ya cobrados (monto congelado en cobrado_monto). Trae también
  // el pagador — permite buscar un cobro cerrado por quién pagó.
  const { data: cerrRaw } = await admin
    .from("gestiones")
    .select(
      "id, descripcion, pagador, cobrado_en, cobrado_monto, medio_cobro, medio_cobro_2, propiedades(direccion, propietarios(nombre)), legajos(inquilinos(nombre))"
    )
    .not("cobrado_en", "is", null)
    .order("cobrado_en", { ascending: false });

  type CerrFila = {
    id: string;
    descripcion: string;
    pagador: "inquilino" | "propietario" | null;
    cobrado_en: string;
    cobrado_monto: number | null;
    medio_cobro: string | null;
    medio_cobro_2: string | null;
    propiedades: {
      direccion: string;
      propietarios: { nombre: string } | null;
    } | null;
    legajos: { inquilinos: { nombre: string } | null } | null;
  };
  const cerrados = ((cerrRaw ?? []) as unknown as CerrFila[]).map((g) => {
    const { nombre: pagadorNombre, rotulo: pagadorRotulo } = resolverPagador(
      g.pagador,
      g.propiedades,
      g.legajos
    );
    return {
      id: g.id,
      descripcion: g.descripcion,
      direccion: g.propiedades?.direccion ?? "—",
      pagadorNombre,
      pagadorRotulo,
      monto: Number(g.cobrado_monto ?? 0),
      medioLabel: medioCobroLabel(g.medio_cobro, g.medio_cobro_2),
      fecha: g.cobrado_en,
    };
  });

  return { pendientes, cerrados };
}

// ── LIQUIDACIONES ───────────────────────────────────────────────────────
export async function listarLiquidaciones(): Promise<LiquidacionesData> {
  if (!(await permitido())) return { pendientes: [], cerrados: [] };
  const admin = createAdminClient();

  // Pendientes: en la etapa de liquidación y sin liquidar todavía.
  const { data: pendRaw } = await admin
    .from("gestiones")
    .select(
      "id, descripcion, cobrado_en, costo_final, materiales_total, adelanto_materiales, propiedades(direccion), tecnico:tecnicos!gestiones_tecnico_id_fkey(nombre), presupuestos(monto_mano_obra, estado)"
    )
    .eq("etapa", "liquidacion_tecnico")
    .is("liq_pagada_en", null);

  type PendFila = {
    id: string;
    descripcion: string;
    cobrado_en: string | null;
    costo_final: number | null;
    materiales_total: number | null;
    adelanto_materiales: number | null;
    propiedades: { direccion: string } | null;
    tecnico: { nombre: string } | null;
    presupuestos: { monto_mano_obra: number; estado: string }[];
  };
  const pendientes = ((pendRaw ?? []) as unknown as PendFila[]).map((g) => {
    const aprobado = g.presupuestos?.find((p) => p.estado === "aprobado");
    const manoObra = aprobado ? Number(aprobado.monto_mano_obra) : 0;
    const base =
      g.materiales_total != null
        ? Number(g.materiales_total) + manoObra
        : Number(g.costo_final ?? 0);
    const monto = Math.max(base - Number(g.adelanto_materiales ?? 0), 0);
    return {
      id: g.id,
      descripcion: g.descripcion,
      direccion: g.propiedades?.direccion ?? "—",
      tecnicoNombre: g.tecnico?.nombre ?? "—",
      monto,
      diasPendiente: g.cobrado_en ? diasDesde(g.cobrado_en) : null,
    };
  });

  // Cerradas: ya liquidadas (monto congelado en liq_monto).
  const { data: cerrRaw } = await admin
    .from("gestiones")
    .select(
      "id, descripcion, liq_monto, liq_medio, liq_pagada_en, propiedades(direccion), tecnico:tecnicos!gestiones_tecnico_id_fkey(nombre)"
    )
    .not("liq_pagada_en", "is", null)
    .order("liq_pagada_en", { ascending: false });

  type CerrFila = {
    id: string;
    descripcion: string;
    liq_monto: number | null;
    liq_medio: string | null;
    liq_pagada_en: string;
    propiedades: { direccion: string } | null;
    tecnico: { nombre: string } | null;
  };
  const cerrados = ((cerrRaw ?? []) as unknown as CerrFila[]).map((g) => ({
    id: g.id,
    descripcion: g.descripcion,
    direccion: g.propiedades?.direccion ?? "—",
    tecnicoNombre: g.tecnico?.nombre ?? "—",
    monto: Number(g.liq_monto ?? 0),
    medioLabel: g.liq_medio
      ? (MEDIO_LIQUIDACION_LABEL[g.liq_medio as MedioLiquidacion] ?? g.liq_medio)
      : "—",
    fecha: g.liq_pagada_en,
  }));

  return { pendientes, cerrados };
}
