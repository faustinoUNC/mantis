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
  type AdelantosData,
  type CobrosData,
  type FilaAdelantoSaldado,
  type GrupoAdelantosTecnico,
  type ItemAdelantoAResolver,
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
  pagador: "inquilino" | "propietario" | "compartido" | null,
  propiedades: { propietarios: { nombre: string } | null } | null,
  legajos: { inquilinos: { nombre: string } | null } | null,
  pctInquilino?: number | null
): { nombre: string; rotulo: string } {
  if (pagador === "propietario") {
    return { nombre: propiedades?.propietarios?.nombre ?? "—", rotulo: "Propietario" };
  }
  if (pagador === "inquilino") {
    return { nombre: legajos?.inquilinos?.nombre ?? "—", rotulo: "Inquilino" };
  }
  // STORY-1031: pago compartido — ambos nombres con su % (el cobro sigue
  // siendo uno solo; el reparto es informativo).
  if (pagador === "compartido") {
    const inq = legajos?.inquilinos?.nombre ?? "—";
    const prop = propiedades?.propietarios?.nombre ?? "—";
    const pct = pctInquilino ?? 50;
    return { nombre: `${inq} (${pct}%) + ${prop} (${100 - pct}%)`, rotulo: "Compartido" };
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
      "id, descripcion, pagador, pagador_pct_inquilino, costo_final, cargo_admin, cargo_cancelacion, propiedades(direccion, propietarios(nombre)), legajos(inquilinos(nombre))"
    )
    .eq("etapa", "facturacion_cobro")
    .is("cobrado_en", null);

  type PendFila = {
    id: string;
    descripcion: string;
    pagador: "inquilino" | "propietario" | "compartido" | null;
    pagador_pct_inquilino: number | null;
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
      g.legajos,
      g.pagador_pct_inquilino
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
      "id, descripcion, pagador, pagador_pct_inquilino, cobrado_en, cobrado_monto, medio_cobro, medio_cobro_2, propiedades(direccion, propietarios(nombre)), legajos(inquilinos(nombre))"
    )
    .not("cobrado_en", "is", null)
    .order("cobrado_en", { ascending: false });

  type CerrFila = {
    id: string;
    descripcion: string;
    pagador: "inquilino" | "propietario" | "compartido" | null;
    pagador_pct_inquilino: number | null;
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
      g.legajos,
      g.pagador_pct_inquilino
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

// ── ADELANTOS (STORY-1019) ──────────────────────────────────────────────
// LA derivación de los tres estados del ciclo de vida del adelanto. Vive SOLO
// acá: la pestaña de Finanzas, el perfil del técnico, el aviso de liquidación
// y la tool de Walter leen esta función — la lógica no se repite en ningún
// componente (read-model sobre hechos congelados, patrón historial STORY-985).
//   EN OBRA     = columna adelanto_materiales viva en gestión activa.
//   A RESOLVER  = desasignación (neto de devolución en el acto), cancelación
//                 con adelanto y sobrante de liquidación — mientras el
//                 pendiente (monto − Σ saldados) siga > 0 (STORY-1032:
//                 el descuento desde una liquidación puede ser parcial).
//   SALDADO     = por liquidación (el descuento ES el saldado, automático),
//                 por retención en la liquidación de otra gestión
//                 (via "liquidacion", STORY-1032) o manual (con nota).
async function derivarAdelantos(): Promise<AdelantosData> {
  const admin = createAdminClient();

  type Ev = { id: string; gestion_id: string; creado_en: string; detalle: Record<string, unknown> | null };
  const [{ data: evDesasigRaw }, { data: evLiqRaw }, { data: evSaldadoRaw }, { data: vivasRaw }] =
    await Promise.all([
      admin
        .from("eventos_gestion")
        .select("id, gestion_id, creado_en, detalle")
        .not("detalle->adelanto_saliente", "is", null),
      admin
        .from("eventos_gestion")
        .select("id, gestion_id, creado_en, detalle")
        .eq("tipo", "liquidacion_registrada")
        .not("detalle->sobrante", "is", null),
      admin
        .from("eventos_gestion")
        .select("id, gestion_id, creado_en, detalle")
        .eq("tipo", "adelanto_saldado"),
      admin.from("gestiones").select("id").gt("adelanto_materiales", 0),
    ]);
  const evDesasig = (evDesasigRaw ?? []) as unknown as Ev[];
  const evLiq = (evLiqRaw ?? []) as unknown as Ev[];
  const evSaldado = (evSaldadoRaw ?? []) as unknown as Ev[];

  // Info de TODAS las gestiones involucradas, una sola query.
  const ids = [
    ...new Set([
      ...((vivasRaw ?? []) as { id: string }[]).map((g) => g.id),
      ...evDesasig.map((e) => e.gestion_id),
      ...evLiq.map((e) => e.gestion_id),
      ...evSaldado.map((e) => e.gestion_id),
    ]),
  ];
  type Info = {
    id: string;
    descripcion: string;
    etapa: string;
    adelanto_materiales: number | null;
    liq_pagada_en: string | null;
    tecnico_id: string | null;
    propiedades: { direccion: string } | null;
    tecnico: { nombre: string } | null;
  };
  const info = new Map<string, Info>();
  if (ids.length > 0) {
    const { data } = await admin
      .from("gestiones")
      .select(
        "id, descripcion, etapa, adelanto_materiales, liq_pagada_en, tecnico_id, propiedades(direccion), tecnico:tecnicos!gestiones_tecnico_id_fkey(nombre)"
      )
      .in("id", ids);
    for (const g of (data ?? []) as unknown as Info[]) info.set(g.id, g);
  }

  // Nombres de los salientes (el evento congela el UUID).
  const salienteIds = [
    ...new Set(
      evDesasig
        .map((e) => String(e.detalle?.tecnico_saliente ?? ""))
        .filter((s) => /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(s))
    ),
  ];
  const nombreTecnico = new Map<string, string>();
  if (salienteIds.length > 0) {
    const { data } = await admin.from("tecnicos").select("id, nombre").in("id", salienteIds);
    for (const t of (data ?? []) as { id: string; nombre: string }[]) nombreTecnico.set(t.id, t.nombre);
  }

  // Saldados: cuánto se recuperó de cada origen. STORY-1032 permite el
  // descuento PARCIAL desde una liquidación, así que ya no alcanza con la
  // existencia del evento — se SUMAN los montos y el ítem sigue "a resolver"
  // mientras quede pendiente (> 0). El saldado manual sigue cerrando todo el
  // resto (registra el pendiente del momento como monto).
  const saldadoPorEvento = new Map<string, number>();
  const saldadoCancelacion = new Map<string, number>();
  for (const e of evSaldado) {
    const m = Number(e.detalle?.monto ?? 0);
    const origenEventoId = String(e.detalle?.origen_evento_id ?? "");
    if (origenEventoId) {
      saldadoPorEvento.set(origenEventoId, (saldadoPorEvento.get(origenEventoId) ?? 0) + m);
    } else if (e.detalle?.origen === "cancelacion") {
      saldadoCancelacion.set(e.gestion_id, (saldadoCancelacion.get(e.gestion_id) ?? 0) + m);
    }
  }

  // ── EN OBRA ──
  const enObra = [...info.values()]
    .filter(
      (g) =>
        Number(g.adelanto_materiales ?? 0) > 0 &&
        g.etapa !== "cancelada" &&
        g.liq_pagada_en == null
    )
    .map((g) => ({
      id: g.id,
      descripcion: g.descripcion,
      direccion: g.propiedades?.direccion ?? "—",
      tecnicoNombre: g.tecnico?.nombre ?? "—",
      monto: Number(g.adelanto_materiales),
    }));

  // ── A RESOLVER ──
  const items: ItemAdelantoAResolver[] = [];
  for (const e of evDesasig) {
    const monto = Number(e.detalle?.adelanto_saliente ?? 0);
    const devuelto = Number(e.detalle?.devolucion_adelanto ?? 0);
    const pendiente = Math.max(monto - devuelto - (saldadoPorEvento.get(e.id) ?? 0), 0);
    if (pendiente <= 0) continue;
    const g = info.get(e.gestion_id);
    const tecnicoId = String(e.detalle?.tecnico_saliente ?? "") || null;
    items.push({
      gestionId: e.gestion_id,
      descripcion: g?.descripcion ?? "—",
      direccion: g?.propiedades?.direccion ?? "—",
      tecnicoId,
      tecnicoNombre: (tecnicoId && nombreTecnico.get(tecnicoId)) || "El técnico saliente",
      monto: pendiente,
      origen: "desasignacion",
      origenEventoId: e.id,
      diasPendiente: diasDesde(e.creado_en),
    });
  }
  for (const g of info.values()) {
    if (g.etapa !== "cancelada" || Number(g.adelanto_materiales ?? 0) <= 0) continue;
    const pendiente = Math.max(
      Number(g.adelanto_materiales) - (saldadoCancelacion.get(g.id) ?? 0),
      0
    );
    if (pendiente <= 0) continue;
    items.push({
      gestionId: g.id,
      descripcion: g.descripcion,
      direccion: g.propiedades?.direccion ?? "—",
      tecnicoId: g.tecnico_id,
      tecnicoNombre: g.tecnico?.nombre ?? "—",
      monto: pendiente,
      origen: "cancelacion",
      origenEventoId: null,
      diasPendiente: null, // la fecha de cancelación vive en el evento de transición; sin alarma acá
    });
  }
  for (const e of evLiq) {
    const pendiente = Math.max(
      Number(e.detalle?.sobrante ?? 0) - (saldadoPorEvento.get(e.id) ?? 0),
      0
    );
    if (pendiente <= 0) continue;
    const g = info.get(e.gestion_id);
    items.push({
      gestionId: e.gestion_id,
      descripcion: g?.descripcion ?? "—",
      direccion: g?.propiedades?.direccion ?? "—",
      tecnicoId: g?.tecnico_id ?? null,
      tecnicoNombre: g?.tecnico?.nombre ?? "—",
      monto: pendiente,
      origen: "sobrante",
      origenEventoId: e.id,
      diasPendiente: diasDesde(e.creado_en),
    });
  }
  // Agrupado por técnico, mayor deuda primero; adentro, lo más viejo primero.
  const porTecnico = new Map<string, GrupoAdelantosTecnico>();
  for (const it of items) {
    const clave = it.tecnicoId ?? "—";
    const grupo = porTecnico.get(clave) ?? {
      tecnicoId: it.tecnicoId,
      tecnicoNombre: it.tecnicoNombre,
      total: 0,
      items: [],
    };
    grupo.total += it.monto;
    grupo.items.push(it);
    porTecnico.set(clave, grupo);
  }
  const aResolver = [...porTecnico.values()]
    .map((g) => ({
      ...g,
      items: [...g.items].sort((a, b) => (b.diasPendiente ?? -1) - (a.diasPendiente ?? -1)),
    }))
    .sort((a, b) => b.total - a.total);

  // ── SALDADOS ──
  const sobrantePorGestion = new Map<string, number>();
  for (const e of evLiq)
    sobrantePorGestion.set(e.gestion_id, Number(e.detalle?.sobrante ?? 0));
  const saldados: FilaAdelantoSaldado[] = [];
  for (const g of info.values()) {
    const adelanto = Number(g.adelanto_materiales ?? 0);
    if (g.liq_pagada_en == null || adelanto <= 0) continue;
    const recuperado = adelanto - (sobrantePorGestion.get(g.id) ?? 0);
    if (recuperado <= 0) continue;
    saldados.push({
      id: `liq-${g.id}`,
      gestionId: g.id,
      descripcion: g.descripcion,
      direccion: g.propiedades?.direccion ?? "—",
      tecnicoNombre: g.tecnico?.nombre ?? "—",
      monto: recuperado,
      modo: "liquidacion",
      nota: null,
      fecha: g.liq_pagada_en,
    });
  }
  for (const e of evSaldado) {
    const g = info.get(e.gestion_id);
    saldados.push({
      id: e.id,
      gestionId: e.gestion_id,
      descripcion: g?.descripcion ?? "—",
      direccion: g?.propiedades?.direccion ?? "—",
      tecnicoNombre: String(e.detalle?.tecnico ?? "") || (g?.tecnico?.nombre ?? "—"),
      monto: Number(e.detalle?.monto ?? 0),
      // STORY-1032: la deuda retenida de la liquidación de otra gestión se
      // distingue del saldado a mano.
      modo: e.detalle?.via === "liquidacion" ? "descuento" : "manual",
      nota: String(e.detalle?.nota ?? "") || null,
      fecha: e.creado_en,
    });
  }
  saldados.sort((a, b) => b.fecha.localeCompare(a.fecha));

  return { enObra, aResolver, saldados };
}

// Pestaña "Adelantos" de Finanzas (solo admin + gestor administrativo).
export async function listarAdelantos(): Promise<AdelantosData> {
  if (!(await permitido())) return { enObra: [], aResolver: [], saldados: [] };
  return derivarAdelantos();
}

// Perfil staff del técnico + aviso en la pantalla de liquidación: la MISMA
// derivación, filtrada por técnico. La ve todo el staff (es el dato con el
// que se decide si darle otra obra); el técnico no.
export async function adelantosAResolverDeTecnico(
  tecnicoId: string
): Promise<ItemAdelantoAResolver[]> {
  const actual = await obtenerUsuarioActual();
  if (!actual || actual.rol === "tecnico") return [];
  const data = await derivarAdelantos();
  return data.aResolver
    .filter((g) => g.tecnicoId === tecnicoId)
    .flatMap((g) => g.items);
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
