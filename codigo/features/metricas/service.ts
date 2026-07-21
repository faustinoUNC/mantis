"use server";

import { obtenerUsuarioActual } from "@/features/auth/service";
import { ETAPAS_TERMINALES } from "@/features/gestiones/types";
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
  pagador: string | null; // inquilino | propietario
  tecnicoId: string | null;
  tecnicoNombre: string | null;
  // STORY-1026: dimensión gestor para los cruces dinámicos de Walter.
  gestorId: string | null;
  gestorNombre: string | null;
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
  costoFinal: number | null;
  cargoAdmin: number | null; // STORY-917: monto a cobrar = costo_final + cargo_admin
  cargoCancelacion: number | null; // STORY-967: si está, el monto a cobrar es ESTE
  presupuestoAprobado: number | null; // total del presupuesto aprobado
  plazoDias: number | null; // STORY-921: plazo de obra comprometido (del aprobado)
  // STORY-937: desvío de presupuesto medido SOLO sobre materiales
  materialesTotal: number | null; // rendición del técnico (STORY-934)
  matPresupuestada: number | null; // monto_materiales del aprobado
  moPresupuestada: number | null; // monto_mano_obra del aprobado (para el fallback)
}

export interface EventoMetrica {
  gestionId: string;
  // transicion | tecnico_no_continua | aviso_resuelto (STORY-1024: las pausas
  // viajan para descontarlas del cumplimiento de plazo del técnico).
  tipo: string;
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
  // STORY-954 v1.1: técnicos aprobados Y activos por especialidad (mismo
  // criterio que la asignación). La card se oculta al gestor administrativo
  // (su RLS no lee usuarios de técnicos y la gestión de técnicos no es su área).
  capacidad: { especialidad: string; tecnicos: number }[];
  // STORY-966: abandonos por técnico (desasignaciones imputadas al técnico),
  // leídos de los eventos congelados — el tecnico_id de la gestión se pisa.
  abandonos: { tecnico: string; n: number }[];
}

// STORY-1024: los eventos superaron el tope de 1000 filas por request de
// PostgREST y el panel calculaba sobre historial truncado en silencio —
// se traen paginados (orden estable por creado_en).
async function todosLosEventos(supabase: Awaited<ReturnType<typeof createClient>>) {
  const PAGINA = 1000;
  const filas: { gestion_id: string; tipo: string; de_etapa: string | null; a_etapa: string | null; creado_en: string }[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data } = await supabase
      .from("eventos_gestion")
      .select("gestion_id, tipo, de_etapa, a_etapa, creado_en")
      .in("tipo", ["transicion", "tecnico_no_continua", "aviso_resuelto"])
      .order("creado_en")
      .order("id")
      .range(desde, desde + PAGINA - 1);
    filas.push(...(data ?? []));
    if (!data || data.length < PAGINA) break;
  }
  return filas;
}

// RLS scopea: el gestor de mantenimiento calcula sobre SUS gestiones, admin y
// administrativo sobre todas.
export async function obtenerMetricas(): Promise<Metricas | null> {
  const actual = await obtenerUsuarioActual();
  if (!actual || actual.rol === "tecnico") return null;

  const supabase = await createClient();
  const [{ data: gestiones }, eventos, { data: cobertura }, { data: usuariosTec }, { data: eventosAbandono }] = await Promise.all([
    supabase
      .from("gestiones")
      .select(
        "id, descripcion, etapa, urgencia, pagador, tecnico_id, gestor_id, propiedad_id, costo_final, cargo_admin, cargo_cancelacion, materiales_total, cobrado_monto, cobrado_fee, cobrado_en, creado_en, asignacion_aceptada, propiedades(direccion), especialidades(nombre), tecnico:tecnicos!gestiones_tecnico_id_fkey(nombre), gestor:usuarios!gestiones_gestor_id_fkey(nombre), presupuestos(estado, monto_materiales, monto_mano_obra, plazo_dias), conformidades(estado), calificaciones(estrellas)"
      ),
    todosLosEventos(supabase),
    // STORY-954: capacidad = técnicos aprobados y activos por especialidad.
    supabase
      .from("tecnico_especialidades")
      .select("tecnico_id, especialidades(nombre), tecnicos!inner(estado)")
      .eq("tecnicos.estado", "aprobado"),
    supabase.from("usuarios").select("id, esta_activo").eq("rol", "tecnico"),
    // STORY-966: desasignaciones imputadas al técnico (misma RLS que el resto:
    // el gestor cuenta abandonos sobre SUS gestiones; admin sobre todas).
    supabase
      .from("eventos_gestion")
      .select("detalle")
      .eq("tipo", "transicion")
      .eq("a_etapa", "asignacion")
      .eq("detalle->>imputado", "tecnico"),
  ]);

  type G = {
    id: string;
    descripcion: string;
    etapa: string;
    urgencia: string;
    pagador: string | null;
    tecnico_id: string | null;
    gestor_id: string | null;
    propiedad_id: string;
    costo_final: number | null;
    cargo_admin: number | null;
    cargo_cancelacion: number | null;
    materiales_total: number | null;
    cobrado_monto: number | null;
    cobrado_fee: number | null;
    cobrado_en: string | null;
    creado_en: string;
    asignacion_aceptada: boolean | null;
    propiedades: { direccion: string } | null;
    especialidades: { nombre: string } | null;
    tecnico: { nombre: string } | null;
    gestor: { nombre: string } | null;
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
      pagador: g.pagador,
      tecnicoId: g.tecnico_id,
      tecnicoNombre: g.tecnico?.nombre ?? null,
      gestorId: g.gestor_id,
      gestorNombre: g.gestor?.nombre ?? null,
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
      cargoCancelacion: g.cargo_cancelacion == null ? null : Number(g.cargo_cancelacion),
      presupuestoAprobado,
      plazoDias: aprob?.plazo_dias ?? null,
      materialesTotal: g.materiales_total == null ? null : Number(g.materiales_total),
      matPresupuestada: aprob ? Number(aprob.monto_materiales) : null,
      moPresupuestada: aprob ? Number(aprob.monto_mano_obra) : null,
    };
  });

  const especialidades = [...new Set(filas.map((f) => f.especialidad))].sort();

  // STORY-954 v1.1: cuenta de técnicos aprobados y activos por especialidad.
  const activos = new Set((usuariosTec ?? []).filter((u) => u.esta_activo).map((u) => u.id));
  const porEspecialidad = new Map<string, number>();
  type Cob = { tecnico_id: string; especialidades: { nombre: string } | null };
  for (const c of (cobertura ?? []) as unknown as Cob[]) {
    const nombre = c.especialidades?.nombre;
    if (nombre && activos.has(c.tecnico_id))
      porEspecialidad.set(nombre, (porEspecialidad.get(nombre) ?? 0) + 1);
  }
  const capacidad = [...porEspecialidad.entries()].map(([especialidad, tecnicos]) => ({
    especialidad,
    tecnicos,
  }));

  // STORY-966: abandonos por técnico, con nombre (los eventos guardan el UUID
  // del saliente; el nombre sale de la tabla tecnicos).
  const abandonosPorId = new Map<string, number>();
  for (const e of (eventosAbandono ?? []) as { detalle: { tecnico_saliente?: string } | null }[]) {
    const t = e.detalle?.tecnico_saliente;
    if (t) abandonosPorId.set(t, (abandonosPorId.get(t) ?? 0) + 1);
  }
  let abandonos: Metricas["abandonos"] = [];
  if (abandonosPorId.size > 0) {
    const { data: nombres } = await supabase
      .from("tecnicos")
      .select("id, nombre")
      .in("id", [...abandonosPorId.keys()]);
    abandonos = (nombres ?? [])
      .map((t) => ({ tecnico: t.nombre, n: abandonosPorId.get(t.id) ?? 0 }))
      .filter((a) => a.n > 0)
      .sort((a, b) => b.n - a.n);
  }

  // ── Tiles accionables (en vivo, no histórico) ──
  const activas = filas.filter((f) => !ETAPAS_TERMINALES.has(f.etapa)).length;
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
    // STORY-967: una cancelación con cargo en Cobro vale su cargo, no el
    // costo del trabajo (que quedó anulado).
    montoPorCobrar: porCobrar.reduce(
      (s, g) =>
        s +
        (g.cargo_cancelacion != null
          ? Number(g.cargo_cancelacion)
          : Number(g.costo_final ?? 0) + Number(g.cargo_admin ?? 0)),
      0
    ),
    pendientesLiquidacion: porLiquidar.length,
    montoPorLiquidar: porLiquidar.reduce((s, g) => s + Number(g.costo_final ?? 0), 0),
    filas,
    eventos: eventos.map((e) => ({
      gestionId: e.gestion_id,
      tipo: e.tipo,
      deEtapa: e.de_etapa,
      aEtapa: e.a_etapa,
      creadoEn: e.creado_en,
    })),
    especialidades,
    capacidad,
    abandonos,
  };
}
