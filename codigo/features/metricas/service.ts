"use server";

import { obtenerUsuarioActual } from "@/features/auth/service";
import { createClient } from "@/shared/lib/supabase/server";

export interface Metricas {
  rol: string;
  // Operativa (admin + gestor de mantenimiento — scope RLS)
  activas: number;
  urgentesDemoradas: number; // urgentes con +24h sin técnico
  primeraRespuestaHs: number | null; // mediana creada→asignación
  resolucionDias: number | null; // mediana creada→finalizado
  porEtapa: { etapa: string; cantidad: number }[];
  porEspecialidad: { especialidad: string; dias: number }[];
  // Finanzas (admin + gestor administrativo)
  pendientesCobro: number;
  montoPorCobrar: number;
  pendientesLiquidacion: number;
  montoPorLiquidar: number;
  // Desempeño del mes en curso (contexto temporal — no acumulados pelados)
  resueltasMes: number;
  cobradoMes: number;
  feeMes: number; // lo que la inmobiliaria GANÓ por gestión administrativa
}

const ETAPA_LABEL: Record<string, string> = {
  ingresado: "Ingresado",
  asignacion: "Asignación",
  presupuesto: "Presupuesto",
  en_ejecucion: "En ejecución",
  conformidad: "Conformidad",
  facturacion_cobro: "Facturación",
  liquidacion_tecnico: "Liquidación",
  finalizado: "Finalizado",
};

function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const orden = [...valores].sort((a, b) => a - b);
  const mitad = Math.floor(orden.length / 2);
  return orden.length % 2
    ? orden[mitad]
    : (orden[mitad - 1] + orden[mitad]) / 2;
}

// Session client: RLS scopea solo — el gestor de mantenimiento calcula
// sobre SUS gestiones (ownership), admin/administrativo sobre todas.
export async function obtenerMetricas(): Promise<Metricas | null> {
  const actual = await obtenerUsuarioActual();
  if (!actual || actual.rol === "tecnico") return null;

  const supabase = await createClient();
  const [{ data: gestiones }, { data: eventos }] = await Promise.all([
    supabase
      .from("gestiones")
      .select(
        "id, etapa, urgencia, tecnico_id, costo_final, cargo_admin, liq_monto, cobrado_en, liq_pagada_en, creado_en, especialidades(nombre)"
      ),
    supabase
      .from("eventos_gestion")
      .select("gestion_id, tipo, a_etapa, creado_en")
      .eq("tipo", "transicion"),
  ]);

  type G = {
    id: string;
    etapa: string;
    urgencia: string;
    tecnico_id: string | null;
    costo_final: number | null;
    cargo_admin: number | null;
    liq_monto: number | null;
    cobrado_en: string | null;
    liq_pagada_en: string | null;
    creado_en: string;
    especialidades: { nombre: string } | null;
  };
  const gs = (gestiones ?? []) as unknown as G[];
  const evs = eventos ?? [];

  const horas = (a: string, b: string) =>
    (new Date(b).getTime() - new Date(a).getTime()) / 3600000;

  const primeraAsignacion = new Map<string, string>();
  const finalizacion = new Map<string, string>();
  for (const e of evs) {
    if (e.a_etapa === "asignacion" && !primeraAsignacion.has(e.gestion_id)) {
      primeraAsignacion.set(e.gestion_id, e.creado_en);
    }
    if (e.a_etapa === "finalizado") finalizacion.set(e.gestion_id, e.creado_en);
  }

  const respuestas: number[] = [];
  const resoluciones: number[] = [];
  const porEspecialidad = new Map<string, number[]>();
  for (const g of gs) {
    const asignada = primeraAsignacion.get(g.id);
    if (asignada) respuestas.push(horas(g.creado_en, asignada));
    const fin = finalizacion.get(g.id);
    if (fin) {
      const dias = horas(g.creado_en, fin) / 24;
      resoluciones.push(dias);
      const esp = g.especialidades?.nombre ?? "Otros";
      porEspecialidad.set(esp, [...(porEspecialidad.get(esp) ?? []), dias]);
    }
  }

  // "Mes en curso" en hora argentina, no en la del server (Vercel corre en
  // UTC: sin esto, un cobro del 31 a la noche contaba para el mes siguiente)
  const hoyAR = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  }); // YYYY-MM-DD
  const inicioMes = new Date(`${hoyAR.slice(0, 7)}-01T00:00:00-03:00`).toISOString();
  const cobradasMes = gs.filter((g) => g.cobrado_en && g.cobrado_en >= inicioMes);

  const orden = Object.keys(ETAPA_LABEL);
  return {
    rol: actual.rol,
    activas: gs.filter((g) => g.etapa !== "finalizado").length,
    urgentesDemoradas: gs.filter(
      (g) =>
        g.urgencia === "urgente" &&
        !g.tecnico_id &&
        g.etapa !== "finalizado" &&
        horas(g.creado_en, new Date().toISOString()) > 24
    ).length,
    primeraRespuestaHs: mediana(respuestas),
    resolucionDias: mediana(resoluciones),
    porEtapa: orden.map((e) => ({
      etapa: ETAPA_LABEL[e],
      cantidad: gs.filter((g) => g.etapa === e).length,
    })),
    porEspecialidad: [...porEspecialidad.entries()]
      .map(([especialidad, dias]) => ({
        especialidad,
        dias: Math.round((mediana(dias) ?? 0) * 10) / 10,
      }))
      .sort((a, b) => b.dias - a.dias),
    pendientesCobro: gs.filter((g) => g.etapa === "facturacion_cobro").length,
    // Lo que se factura es trabajo + fee (igual que cobradoMes)
    montoPorCobrar: gs
      .filter((g) => g.etapa === "facturacion_cobro")
      .reduce((s, g) => s + Number(g.costo_final ?? 0) + Number(g.cargo_admin ?? 0), 0),
    pendientesLiquidacion: gs.filter((g) => g.etapa === "liquidacion_tecnico")
      .length,
    montoPorLiquidar: gs
      .filter((g) => g.etapa === "liquidacion_tecnico")
      .reduce((s, g) => s + Number(g.costo_final ?? 0), 0),
    resueltasMes: [...finalizacion.values()].filter((f) => f >= inicioMes).length,
    cobradoMes: cobradasMes.reduce(
      (s, g) => s + Number(g.costo_final ?? 0) + Number(g.cargo_admin ?? 0),
      0
    ),
    feeMes: cobradasMes.reduce((s, g) => s + Number(g.cargo_admin ?? 0), 0),
  };
}
