"use server";

import { obtenerUsuarioActual } from "@/features/auth/service";
import { createClient } from "@/shared/lib/supabase/server";

// STORY-914 — El service entrega datos GRANULARES (una fila por gestión +
// eventos + cobertura); el cliente arma los 8 gráficos y aplica los filtros
// (client-side, patrón STORY-910). Regla del contract: las históricas leen de
// hechos congelados (cobrado_monto), no recalculan sobre costo_final.

export interface FilaMetrica {
  id: string;
  descripcion: string; // STORY-917: para las listas accionables
  etapa: string;
  especialidad: string;
  causa: string; // desgaste | dano | mejora
  pagador: string | null; // inquilino | propietario
  tecnicoId: string | null;
  tecnicoNombre: string | null;
  propiedadId: string; // STORY-917: reincidencia por propiedad
  direccion: string | null;
  creadoEn: string;
  cobradoEn: string | null;
  cobradoMonto: number | null; // congelado al cobrar
  cobradoFee: number | null; // congelado al cobrar
  asignacionAceptada: boolean | null;
  presupuestos: string[]; // estados (enviado|aprobado|rechazado)
  conformidades: string[]; // estados (subida|aprobada|rechazada)
  estrellas: number | null; // calificación de esta gestión, si la hay
  costoFinal: number | null; // para el desvío de presupuesto
  cargoAdmin: number | null; // STORY-917: monto a cobrar = costo_final + cargo_admin
  presupuestoAprobado: number | null; // total del presupuesto aprobado
  plazoDias: number | null; // STORY-921: plazo de obra comprometido (del aprobado)
}

export interface EventoMetrica {
  gestionId: string;
  tipo: string; // transicion | asignacion_rechazada (STORY-919)
  deEtapa: string | null;
  aEtapa: string | null;
  creadoEn: string;
}

export interface Metricas {
  rol: string;
  // Tiles accionables del Inicio (se mantienen)
  activas: number;
  urgentesSinAsignar: number;
  pendientesCobro: number;
  montoPorCobrar: number;
  pendientesLiquidacion: number;
  montoPorLiquidar: number;
  // Dashboard STORY-914/919
  filas: FilaMetrica[];
  eventos: EventoMetrica[];
  especialidades: string[];
}

const TERMINALES = new Set(["finalizado", "cancelada"]);

// RLS scopea: el gestor de mantenimiento calcula sobre SUS gestiones, admin y
// administrativo sobre todas.
export async function obtenerMetricas(): Promise<Metricas | null> {
  const actual = await obtenerUsuarioActual();
  if (!actual || actual.rol === "tecnico") return null;

  const supabase = await createClient();
  const [{ data: gestiones }, { data: eventos }] = await Promise.all([
    supabase
      .from("gestiones")
      .select(
        "id, descripcion, etapa, urgencia, causa, pagador, tecnico_id, propiedad_id, costo_final, cargo_admin, cobrado_monto, cobrado_fee, cobrado_en, creado_en, asignacion_aceptada, propiedades(direccion), especialidades(nombre), tecnico:tecnicos!gestiones_tecnico_id_fkey(nombre), presupuestos(estado, monto_materiales, monto_mano_obra, plazo_dias), conformidades(estado), calificaciones(estrellas)"
      ),
    // STORY-919: sumamos los rechazos de asignación (viven como evento, no como
    // flag — el flujo real setea asignacion_aceptada=NULL al rechazar).
    supabase
      .from("eventos_gestion")
      .select("gestion_id, tipo, de_etapa, a_etapa, creado_en")
      .in("tipo", ["transicion", "asignacion_rechazada"]),
  ]);

  type G = {
    id: string;
    descripcion: string;
    etapa: string;
    urgencia: string;
    causa: string;
    pagador: string | null;
    tecnico_id: string | null;
    propiedad_id: string;
    costo_final: number | null;
    cargo_admin: number | null;
    cobrado_monto: number | null;
    cobrado_fee: number | null;
    cobrado_en: string | null;
    creado_en: string;
    asignacion_aceptada: boolean | null;
    propiedades: { direccion: string } | null;
    especialidades: { nombre: string } | null;
    tecnico: { nombre: string } | null;
    presupuestos: { estado: string; monto_materiales: number; monto_mano_obra: number; plazo_dias: number | null }[] | null;
    conformidades: { estado: string }[] | null;
    // PostgREST resuelve calificaciones como to-ONE (gestion_id es UNIQUE):
    // devuelve un objeto, no un array. Contemplamos ambas formas.
    calificaciones: { estrellas: number } | { estrellas: number }[] | null;
  };
  const gs = (gestiones ?? []) as unknown as G[];

  const filas: FilaMetrica[] = gs.map((g) => {
    const aprob = (g.presupuestos ?? []).find((p) => p.estado === "aprobado");
    const presupuestoAprobado = aprob
      ? Number(aprob.monto_materiales) + Number(aprob.monto_mano_obra)
      : null;
    const calif = Array.isArray(g.calificaciones) ? g.calificaciones[0] : g.calificaciones;
    return {
      id: g.id,
      descripcion: g.descripcion,
      etapa: g.etapa,
      especialidad: g.especialidades?.nombre ?? "Otros",
      causa: g.causa,
      pagador: g.pagador,
      tecnicoId: g.tecnico_id,
      tecnicoNombre: g.tecnico?.nombre ?? null,
      propiedadId: g.propiedad_id,
      direccion: g.propiedades?.direccion ?? null,
      creadoEn: g.creado_en,
      cobradoEn: g.cobrado_en,
      cobradoMonto: g.cobrado_monto,
      cobradoFee: g.cobrado_fee,
      asignacionAceptada: g.asignacion_aceptada,
      presupuestos: (g.presupuestos ?? []).map((p) => p.estado),
      conformidades: (g.conformidades ?? []).map((c) => c.estado),
      estrellas: calif?.estrellas ?? null,
      costoFinal: g.costo_final,
      cargoAdmin: g.cargo_admin,
      presupuestoAprobado,
      plazoDias: aprob?.plazo_dias ?? null,
    };
  });

  const especialidades = [...new Set(filas.map((f) => f.especialidad))].sort();

  // ── Tiles accionables (en vivo, no histórico) ──
  const activas = filas.filter((f) => !TERMINALES.has(f.etapa)).length;
  // Urgente + todavía sin arrancar (Ingresado o Asignación): el trabajo urgente
  // que aún no entró en presupuesto/ejecución es lo primero a mover.
  const urgentesSinAsignar = gs.filter(
    (g) => g.urgencia === "urgente" && (g.etapa === "ingresado" || g.etapa === "asignacion")
  ).length;
  const porCobrar = gs.filter((g) => g.etapa === "facturacion_cobro");
  const porLiquidar = gs.filter((g) => g.etapa === "liquidacion_tecnico");

  return {
    rol: actual.rol,
    activas,
    urgentesSinAsignar,
    pendientesCobro: porCobrar.length,
    montoPorCobrar: porCobrar.reduce(
      (s, g) => s + Number(g.costo_final ?? 0) + Number(g.cargo_admin ?? 0),
      0
    ),
    pendientesLiquidacion: porLiquidar.length,
    montoPorLiquidar: porLiquidar.reduce((s, g) => s + Number(g.costo_final ?? 0), 0),
    filas,
    eventos: (eventos ?? []).map((e) => ({
      gestionId: e.gestion_id,
      tipo: e.tipo,
      deEtapa: e.de_etapa,
      aEtapa: e.a_etapa,
      creadoEn: e.creado_en,
    })),
    especialidades,
  };
}
