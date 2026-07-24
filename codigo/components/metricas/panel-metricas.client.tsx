"use client";

import { type ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { RefrescoVivo } from "@/components/refresco-vivo.client";
import type { Metricas } from "@/features/metricas/service";
import { ETAPAS_TERMINALES } from "@/features/gestiones/types";
import { ejecucionParaPlazoDias, ultimaEjecucionDias } from "@/features/gestiones/ejecucion";

// STORY-914/919 — Dashboard de métricas graficadas, organizado en bloques
// temáticos (las relacionadas, juntas). Desktop-first (no lo ve el técnico).
// Filtro client-side por período; el período decide la granularidad
// temporal (semana/mes). Colores del contract: esmeralda=marca,
// ámbar=urgente, rojo=error + una escala de magnitud propia (verde→terracota)
// para "empeora", que NO usa el rojo de error.

const BRAND = "#059669";
const AMBAR = "#d97706";
const GRID = "#e4e4e7";
const INK_MUTED = "#71717a";
const TENDENCIA = "#52525b"; // neutro para la recta de tendencia (no es un acento)
const MAGNITUD_PEOR = "#c2410c"; // terracota (extremo "peor") — NO es el rojo de error
const N_MINIMO = 5;
const MIN_CUBOS_TENDENCIA = 6; // con menos puntos, una tendencia miente
const DIAS_ESTANCADA_AMBAR = 3;
const DIAS_COBRO_AMBAR = 15;

// Escala de magnitud (contract): verde-azulado calmo → ámbar → terracota.
const RAMPA: [number, number, number][] = [
  [13, 148, 136], // teal-600 (mejor)
  [217, 119, 6], // amber-600
  [194, 65, 12], // orange-800 (peor)
];
function rampaMagnitud(t: number): string {
  const c = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
  const seg = c < 0.5 ? 0 : 1;
  const local = c < 0.5 ? c / 0.5 : (c - 0.5) / 0.5;
  const [a, b] = [RAMPA[seg], RAMPA[seg + 1]];
  const mix = a.map((v, i) => Math.round(v + (b[i] - v) * local));
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
}

const ETAPA_LABEL: Record<string, string> = {
  ingresado: "Ingresado",
  asignacion: "Asignación",
  presupuesto: "Presupuesto",
  en_ejecucion: "En ejecución",
  conformidad: "Conformidad",
  facturacion_cobro: "Cobro",
  liquidacion_tecnico: "Liquidación",
  finalizado: "Finalizado",
};
const ORDEN_ETAPAS = Object.keys(ETAPA_LABEL);
const MESES =["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

type Gran = "semana" | "mes";
// Presets con nombre de granularidad (estilo iOS) y bucket FIJO por preset, para
// que la cantidad de barras siempre sea sana (nunca 4 fideos ni 90 palitos) y no
// cambie de forma sorpresiva al elegir período. STORY-919 / investigación.
const PERIODOS: { id: string; label: string; dias: number | null; gran: Gran }[] = [
  { id: "mes", label: "Mes", dias: 30, gran: "semana" },
  { id: "trimestre", label: "Trimestre", dias: 90, gran: "semana" },
  { id: "ano", label: "Año", dias: 365, gran: "mes" },
  { id: "todo", label: "Todo", dias: null, gran: "mes" },
];
const MIN_CUBOS_SERIE = 3; // menos que esto → "pocos datos", no dibujamos una serie que miente

function plata(n: number) {
  return `$ ${Math.round(n).toLocaleString("es-AR")}`;
}

// Días que la gestión lleva en su etapa actual (desde la última transición).
function diasEnEtapa(f: { id: string; creadoEn: string }, ultima: Map<string, number>, ahora: number) {
  return Math.floor((ahora - (ultima.get(f.id) ?? new Date(f.creadoEn).getTime())) / 86400000);
}
function plataCorta(v: number) {
  if (Math.abs(v) >= 1_000_000) return `${Math.round(v / 100000) / 10}M`;
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}k`;
  return String(v);
}

function lunes(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
function claveCubo(ms: number, gran: Gran): string {
  const d = new Date(ms);
  if (gran === "mes") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const l = lunes(d);
  return `${l.getFullYear()}-${String(l.getMonth() + 1).padStart(2, "0")}-${String(l.getDate()).padStart(2, "0")}`;
}
function labelCubo(key: string, gran: Gran): string {
  const p = key.split("-");
  return gran === "mes" ? `${MESES[Number(p[1]) - 1]} ${p[0].slice(2)}` : `${p[2]}/${p[1]}`;
}
function rangoCubos(primeraMs: number, ahora: number, gran: Gran): { key: string; label: string }[] {
  const cursor = gran === "mes" ? new Date(new Date(primeraMs).getFullYear(), new Date(primeraMs).getMonth(), 1) : lunes(new Date(primeraMs));
  const fin = new Date(ahora);
  const out: { key: string; label: string }[] = [];
  let guarda = 0;
  while (cursor <= fin && guarda++ < 600) {
    const key = claveCubo(cursor.getTime(), gran);
    out.push({ key, label: labelCubo(key, gran) });
    if (gran === "mes") cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + 7);
  }
  return out;
}
// Recorta la serie de cubos a la ventana que se puede leer sin engañar: saca
// los cubos vacíos del arranque (antes del primer dato → eje muerto + tendencia
// hundida por ceros que no son "cayó", sino "todavía no había sistema") y marca
// el último (período EN CURSO, siempre parcial): se DIBUJA para ver cómo viene
// el mes —pedido de Fausti, coherente con Walter (STORY-1026)— pero la
// tendencia no lo usa, porque un parcial siempre "cae" en falso.
function ventanaUtil<T extends { key: string }>(
  cubos: T[],
  acum: Map<string, unknown>
): (T & { enCurso: boolean })[] {
  const first = cubos.findIndex((c) => acum.has(c.key));
  if (first < 0) return [];
  const util = cubos.slice(first);
  return util.map((c, i) => ({ ...c, enCurso: i === util.length - 1 }));
}

// Regresión lineal (mínimos cuadrados) sobre el índice. Devuelve la línea
// ajustada (yhat) y la pendiente m (cambio por cubo). null si hay pocos puntos.
function tendencia(vals: number[]): { yhat: number[]; m: number } | null {
  const n = vals.length;
  if (n < MIN_CUBOS_TENDENCIA) return null;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  vals.forEach((y, x) => { sx += x; sy += y; sxy += x * y; sxx += x * x; });
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null;
  const m = (n * sxy - sx * sy) / denom;
  const b = (sy - m * sx) / n;
  return { yhat: vals.map((_, x) => Math.round(m * x + b)), m };
}

function num1(n: number) {
  return n.toFixed(1).replace(".", ",");
}
// Diagnóstico legible de la tendencia como TASA por cubo (no un % sin base):
// "+0,4 días por mes", "−$ 120.000 por mes", "+1,2 gestiones por semana", con la
// ventana explícita. Color: verde si mejora, terracota si empeora.
function capTendencia(
  m: number | null,
  gran: Gran,
  nCubos: number,
  kind: "dias" | "plata" | "cant",
  subeEsBueno: boolean
): { texto: string; color: string } | null {
  if (m == null) return null;
  const unidad = gran === "mes" ? "mes" : "semana";
  const ventana = `tendencia · ${nCubos} ${gran === "mes" ? "meses" : "semanas"}`;
  const abs = Math.abs(m);
  const cero = kind === "plata" ? abs < 500 : abs < 0.05;
  if (cero) return { texto: `→ estable (${ventana})`, color: TENDENCIA };
  const sube = m > 0;
  const mag =
    kind === "dias" ? `${num1(abs)} días por ${unidad} en cerrar`
    : kind === "plata" ? `${plata(abs)} por ${unidad}`
    : `${num1(abs)} gestiones por ${unidad}`;
  return {
    texto: `${sube ? "↑ +" : "↓ −"}${mag} (${ventana})`,
    color: (sube === subeEsBueno) ? BRAND : MAGNITUD_PEOR,
  };
}

function TooltipCaja({
  active,
  payload,
  label,
  render,
}: {
  active?: boolean;
  payload?: { value: number; name?: string; payload?: Record<string, unknown> }[];
  label?: string;
  render?: (p: { value: number; name?: string }[]) => ReactNode;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-md shadow-overlay px-3 py-2 text-sm">
      {label && <p className="font-medium mb-0.5">{label}</p>}
      {render ? render(payload) : <p className="text-muted">{payload[0].value}</p>}
    </div>
  );
}

// Fila de lista accionable (STORY-917): linkea al detalle. `color` pinta el dato
// (para la escala de magnitud); si no, usa ámbar-alerta / muted.
function FilaAccionable({
  id,
  principal,
  secundario,
  dato,
  alerta,
  color,
}: {
  id: string;
  principal: string;
  secundario: string;
  dato: string;
  alerta: boolean;
  color?: string;
}) {
  return (
    <li>
      <Link href={`/gestiones/${id}`} className="group flex items-center gap-3 py-2">
        <span className="flex-1 min-w-0">
          <span className="block text-sm truncate group-hover:text-brand transition-colors">{principal}</span>
          <span className="block text-[12px] text-muted truncate">{secundario}</span>
        </span>
        <span
          className={`text-sm font-medium tabular-nums whitespace-nowrap ${!color && alerta ? "text-urgente-fuerte" : !color ? "text-muted" : ""}`}
          style={color ? { color } : undefined}
        >
          {dato}
        </span>
      </Link>
    </li>
  );
}

// Leyenda de diagnóstico para la línea de tendencia (explica cómo leerla).
function LeyendaTendencia({ diag }: { diag: { texto: string; color: string } | null }) {
  if (!diag) return null;
  return (
    <p className="text-[12px] mt-2 flex items-center gap-1.5" style={{ color: diag.color }}>
      <span className="inline-block w-3 border-t border-dashed align-middle" style={{ borderColor: TENDENCIA }} />
      <span className="text-muted">Tendencia:</span> {diag.texto}
    </p>
  );
}

function Bloque({ titulo, children, cols = 2 }: { titulo: string; children: ReactNode; cols?: 1 | 2 }) {
  return (
    <section className="mb-8">
      <h3 className="text-[13px] font-semibold text-muted mb-3">{titulo}</h3>
      <div className={`grid gap-4 ${cols === 2 ? "lg:grid-cols-2" : "grid-cols-1"}`}>{children}</div>
    </section>
  );
}

function MetricCard({
  titulo,
  ayuda,
  n,
  humildad = true,
  unidad = "gestiones",
  alcance,
  children,
}: {
  titulo: string;
  ayuda?: string;
  n: number;
  humildad?: boolean;
  unidad?: string;
  // Marca las tarjetas que NO siguen el selector de período: "ahora" (estado
  // actual) o "historico" (acumulado de todas las gestiones). El resto lo sigue.
  alcance?: "ahora" | "historico";
  children: ReactNode;
}) {
  const humilde = humildad && n > 0 && n < N_MINIMO;
  return (
    <Card className="p-5 flex flex-col">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <div className="flex items-baseline gap-2 min-w-0">
          <h4 className="text-[15px] font-semibold tracking-tight truncate">{titulo}</h4>
          {alcance && (
            <span className="shrink-0 text-[12px] text-muted border border-border rounded-full px-2 py-px" title={alcance === "ahora" ? "Estado actual — no cambia con el período" : "Histórico — todas las gestiones, no cambia con el período"}>
              {alcance === "ahora" ? "ahora" : "histórico"}
            </span>
          )}
        </div>
        <span className="text-[12px] text-muted whitespace-nowrap">
          {n} {unidad}
        </span>
      </div>
      {ayuda && <p className="text-[12px] text-muted mb-3 leading-snug">{ayuda}</p>}
      {n === 0 ? (
        <p className="text-sm text-muted py-16 text-center">Todavía no hay datos para mostrar.</p>
      ) : (
        <div className={humilde ? "opacity-60" : ""}>
          {humilde && <p className="text-[12px] text-urgente-fuerte mb-2">Muestra chica — tomar con pinzas.</p>}
          {children}
        </div>
      )}
    </Card>
  );
}

export function PanelMetricas({ metricas }: { metricas: Metricas }) {
  const [periodoId, setPeriodoId] = useState("ano");
  const [ahora] = useState(() => Date.now());
  // Series ocultables del gráfico de ingresos (click en la leyenda para aislar).
  const [ingresosOcultas, setIngresosOcultas] = useState<Record<"tecnico" | "fee", boolean>>({ tecnico: false, fee: false });
  const toggleIngreso = (k: "tecnico" | "fee") => setIngresosOcultas((s) => ({ ...s, [k]: !s[k] }));
  const algunaOculta = ingresosOcultas.tecnico || ingresosOcultas.fee;
  const soloTecnico = ingresosOcultas.fee && !ingresosOcultas.tecnico; // aislada la serie del técnico
  const soloFee = ingresosOcultas.tecnico && !ingresosOcultas.fee; // aislada la serie del fee

  const periodo = PERIODOS.find((p) => p.id === periodoId) ?? PERIODOS[2];
  const desde = periodo.dias ? ahora - periodo.dias * 24 * 3600 * 1000 : null;
  const gran = periodo.gran;

  const filasEsp = metricas.filas;
  const filas = useMemo(
    () => filasEsp.filter((f) => !desde || new Date(f.creadoEn).getTime() >= desde),
    [filasEsp, desde]
  );
  const idsPeriodo = useMemo(() => new Set(filas.map((f) => f.id)), [filas]);

  // ── Última transición por gestión (base de estancadas/cobranza) ──
  const ultimaTransicion = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of metricas.eventos) {
      if (!e.aEtapa) continue;
      const t = new Date(e.creadoEn).getTime();
      if (t > (m.get(e.gestionId) ?? 0)) m.set(e.gestionId, t);
    }
    return m;
  }, [metricas.eventos]);

  // ── Hoy: Gestiones estancadas (solo las paradas ≥1 día en su etapa) ──
  const estancadas = useMemo(() => {
    const lista = filasEsp
      .filter((f) => !ETAPAS_TERMINALES.has(f.etapa))
      .map((f) => ({
        id: f.id,
        direccion: f.direccion ?? f.descripcion,
        descripcion: f.descripcion,
        etapa: ETAPA_LABEL[f.etapa] ?? f.etapa,
        dias: diasEnEtapa(f, ultimaTransicion, ahora),
      }))
      .filter((g) => g.dias >= 1)
      .sort((a, b) => b.dias - a.dias);
    return { lista, n: lista.length, max: lista[0]?.dias ?? 1 };
  }, [filasEsp, ultimaTransicion, ahora]);

  // ── Hoy: Reparto por gestor (STORY-1050, admin-only) ──
  // Estado presente: cuántas gestiones activas tiene cada Gestor Comercial.
  // Barra lisa (solo el total): el admin ve el balance de carga y rebalancea.
  // Solo cuenta dueños con rol gestor_mantenimiento — el admin (u otros roles)
  // puede quedar como gestor_id de una gestión, pero NO es un Gestor Comercial.
  const reparto = useMemo(() => {
    const porGestor = new Map<string, { nombre: string; total: number }>();
    for (const f of filasEsp) {
      if (ETAPAS_TERMINALES.has(f.etapa) || !f.gestorId) continue;
      if (f.gestorRol !== "gestor_mantenimiento") continue;
      const g = porGestor.get(f.gestorId) ?? { nombre: f.gestorNombre ?? "—", total: 0 };
      g.total += 1;
      porGestor.set(f.gestorId, g);
    }
    const data = [...porGestor.values()]
      .map((g) => ({ name: g.nombre, total: g.total }))
      .sort((a, b) => b.total - a.total);
    return { data, nGestores: data.length };
  }, [filasEsp]);

  // ── Hoy: Pendientes de cobro (en facturación, hace cuántos días) ──
  const cobranza = useMemo(
    () =>
      filasEsp
        .filter((f) => f.etapa === "facturacion_cobro")
        .map((f) => ({
          id: f.id,
          direccion: f.direccion ?? f.descripcion,
          descripcion: f.descripcion,
          // STORY-967: una cancelación con cargo vale su cargo, no el trabajo.
          monto:
            f.cargoCancelacion ?? Number(f.costoFinal ?? 0) + Number(f.cargoAdmin ?? 0),
          dias: diasEnEtapa(f, ultimaTransicion, ahora),
        }))
        .sort((a, b) => b.dias - a.dias),
    [filasEsp, ultimaTransicion, ahora]
  );

  // ── Hoy: Orden por valor (fee ya determinado, mayor→menor) ──
  // El fee (cargo_admin) se ancla al aprobar el presupuesto → aparece de
  // en_ejecucion en adelante (+ presupuesto con PDF borrador). Ordena por
  // plata para la casa: qué gestión activa conviene no dejar caer.
  const porFee = useMemo(
    () =>
      filasEsp
        .filter((f) => !ETAPAS_TERMINALES.has(f.etapa) && Number(f.cargoAdmin ?? 0) > 0)
        .map((f) => ({
          id: f.id,
          direccion: f.direccion ?? f.descripcion,
          descripcion: f.descripcion,
          etapa: ETAPA_LABEL[f.etapa] ?? f.etapa,
          fee: Number(f.cargoAdmin ?? 0),
        }))
        .sort((a, b) => b.fee - a.fee),
    [filasEsp]
  );

  // ── Flujo (ahora): Carga por etapa — cuántas gestiones ACTIVAS hay hoy en
  // cada etapa (STORY-1004). Snapshot sobre la etapa actual, no el período:
  // la barra más alta es el cuello de botella del momento. Activas = todo lo que
  // no está finalizado ni cancelado. Complementa a "Cuellos de botella" (días
  // promedio por etapa): el embudo cuenta cuántas, cuellos mide cuánto tardan. ──
  const funnel = useMemo(() => {
    const porEtapa = new Map<string, number>();
    for (const f of filasEsp) {
      if (f.etapa === "finalizado" || f.etapa === "cancelada") continue;
      porEtapa.set(f.etapa, (porEtapa.get(f.etapa) ?? 0) + 1);
    }
    const data = ORDEN_ETAPAS.filter((e) => e !== "finalizado" && porEtapa.has(e)).map((etapa) => ({
      name: ETAPA_LABEL[etapa],
      value: porEtapa.get(etapa)!,
    }));
    const max = Math.max(1, ...data.map((d) => d.value));
    const total = data.reduce((s, d) => s + d.value, 0);
    return { data, max, total };
  }, [filasEsp]);

  // ── Flujo: Cuellos de botella — tiempo promedio por etapa (días) ──
  const cuellos = useMemo(() => {
    const porGestion = new Map<string, { etapa: string; at: number }[]>();
    for (const f of filas) porGestion.set(f.id, [{ etapa: "ingresado", at: new Date(f.creadoEn).getTime() }]);
    const evs = metricas.eventos
      .filter((e) => idsPeriodo.has(e.gestionId) && e.aEtapa)
      .sort((a, b) => new Date(a.creadoEn).getTime() - new Date(b.creadoEn).getTime());
    for (const e of evs) porGestion.get(e.gestionId)?.push({ etapa: e.aEtapa!, at: new Date(e.creadoEn).getTime() });
    const acum = new Map<string, { total: number; n: number }>();
    for (const linea of porGestion.values()) {
      // STORY-966: con desasignación una gestión puede repetir etapa — cuenta
      // solo la ÚLTIMA visita de cada una (antes se sumaban todas y el cuello
      // se inflaba; ya pasaba con el retroceso presupuesto→asignación).
      const ultimaVisita = new Map<string, number>();
      for (let k = 0; k < linea.length - 1; k++) {
        ultimaVisita.set(linea[k].etapa, (linea[k + 1].at - linea[k].at) / 86400000);
      }
      for (const [etapa, dias] of ultimaVisita) {
        const cur = acum.get(etapa) ?? { total: 0, n: 0 };
        acum.set(etapa, { total: cur.total + dias, n: cur.n + 1 });
      }
    }
    // Se excluye "en_ejecucion": su duración es el trabajo físico (depende del
    // tamaño de la obra, no del circuito) y tapaba los cuellos administrativos.
    return ORDEN_ETAPAS.filter((e) => e !== "en_ejecucion" && acum.has(e))
      .map((e) => ({ etapa: ETAPA_LABEL[e], dias: Math.round((acum.get(e)!.total / acum.get(e)!.n) * 10) / 10 }))
      .sort((a, b) => b.dias - a.dias);
  }, [filas, idsPeriodo, metricas.eventos]);
  const maxCuello = cuellos[0]?.dias ?? 0;

  // ── Duración de la etapa en_ejecucion por gestión (entrada→salida), derivada
  // de los eventos. Base para excluir el tiempo de obra del ciclo y para el
  // cumplimiento de plazo. El tiempo físico depende del tamaño de la obra. ──
  const { ejecucionPorGestion, ejecucionPlazoPorGestion } = useMemo(() => {
    // STORY-966: última visita COMPLETA a en_ejecucion (con desasignación el
    // span primer-entrada→última-salida se tragaba etapas intermedias e
    // inflaba el desvío de plazo del técnico nuevo).
    const porGestion = new Map<string, { aEtapa: string | null; deEtapa: string | null; t: number }[]>();
    // STORY-1024: pausas por gestión — se descuentan del cumplimiento de plazo.
    const pausasPorGestion = new Map<string, { tipo: "inicio" | "fin"; t: number }[]>();
    for (const e of metricas.eventos) {
      if (e.tipo === "tecnico_no_continua" || e.tipo === "aviso_resuelto") {
        const lista = pausasPorGestion.get(e.gestionId) ?? [];
        lista.push({ tipo: e.tipo === "tecnico_no_continua" ? "inicio" : "fin", t: new Date(e.creadoEn).getTime() });
        pausasPorGestion.set(e.gestionId, lista);
        continue;
      }
      if (e.aEtapa !== "en_ejecucion" && e.deEtapa !== "en_ejecucion") continue;
      const lista = porGestion.get(e.gestionId) ?? [];
      lista.push({ aEtapa: e.aEtapa, deEtapa: e.deEtapa, t: new Date(e.creadoEn).getTime() });
      porGestion.set(e.gestionId, lista);
    }
    // STORY-984: dos lecturas del mismo historial — el ciclo resta la fracción
    // real de obra; el cumplimiento de plazo solo mira obras terminadas y con
    // piso de 1 día.
    const dur = new Map<string, number>();
    const durPlazo = new Map<string, number>();
    for (const [id, evs] of porGestion) {
      const dias = ultimaEjecucionDias(evs);
      if (dias != null) dur.set(id, dias);
      const diasPlazo = ejecucionParaPlazoDias(evs, pausasPorGestion.get(id) ?? []);
      if (diasPlazo != null) durPlazo.set(id, diasPlazo);
    }
    return { ejecucionPorGestion: dur, ejecucionPlazoPorGestion: durPlazo };
  }, [metricas.eventos]);

  // ── Flujo: Tiempo de ciclo (creación → finalización, sin obra) por cubo ──
  const ciclo = useMemo(() => {
    const finPorGestion = new Map<string, number>();
    for (const e of metricas.eventos) {
      if (e.aEtapa !== "finalizado") continue;
      const t = new Date(e.creadoEn).getTime();
      if (t > (finPorGestion.get(e.gestionId) ?? 0)) finPorGestion.set(e.gestionId, t);
    }
    const cerradas = filasEsp
      .map((f) => ({ fin: finPorGestion.get(f.id), creado: new Date(f.creadoEn).getTime(), ejec: ejecucionPorGestion.get(f.id) ?? 0 }))
      .filter((x): x is { fin: number; creado: number; ejec: number } => x.fin != null && (!desde || x.fin >= desde))
      .map((x) => ({ fin: x.fin, dias: Math.max(0, (x.fin - x.creado) / 86400000 - x.ejec) }));
    if (cerradas.length === 0) return { data: [], n: 0, pocos: true, diag: null as ReturnType<typeof capTendencia> };
    const acum = new Map<string, { total: number; n: number }>();
    for (const c of cerradas) {
      const k = claveCubo(c.fin, gran);
      const cur = acum.get(k) ?? { total: 0, n: 0 };
      acum.set(k, { total: cur.total + c.dias, n: cur.n + 1 });
    }
    const primera = Math.min(...cerradas.map((c) => c.fin));
    // El período EN CURSO se dibuja marcado "(en curso)"; la tendencia y el
    // umbral de "pocos datos" solo cuentan períodos completos.
    const cubos = ventanaUtil(rangoCubos(desde ?? primera, ahora, gran), acum);
    const dias = cubos.map((c) => {
      const a = acum.get(c.key);
      return a ? Math.round((a.total / a.n) * 10) / 10 : null;
    });
    const completos = cubos.flatMap((c, i) => (!c.enCurso && dias[i] != null ? [dias[i] as number] : []));
    const tend = tendencia(completos);
    let ti = 0;
    const data = cubos.map((c, i) => ({
      label: c.enCurso ? `${c.label} (en curso)` : c.label,
      dias: dias[i],
      tend: !c.enCurso && dias[i] != null && tend ? tend.yhat[ti++] : null,
    }));
    return { data, n: cerradas.length, pocos: completos.length < MIN_CUBOS_SERIE, diag: tend ? capTendencia(tend.m, gran, completos.length, "dias", false) : null };
  }, [filasEsp, desde, gran, ahora, metricas.eventos, ejecucionPorGestion]);

  // ── Técnicos: Calificación + obras realizadas (todos los técnicos con obra o nota) ──
  const ranking = useMemo(() => {
    const acum = new Map<string, { total: number; n: number; obras: number }>();
    for (const f of filasEsp) {
      if (!f.tecnicoNombre) continue;
      const cur = acum.get(f.tecnicoNombre) ?? { total: 0, n: 0, obras: 0 };
      if (f.estrellas != null) { cur.total += f.estrellas; cur.n += 1; }
      if (f.etapa === "finalizado") cur.obras += 1;
      acum.set(f.tecnicoNombre, cur);
    }
    // STORY-966: los abandonos vienen de los eventos congelados (el técnico
    // que abandonó ya no figura como tecnico_id de ninguna fila) — un técnico
    // solo-abandonos también debe aparecer en la lista.
    const abandonosPor = new Map(metricas.abandonos.map((a) => [a.tecnico, a.n]));
    for (const t of abandonosPor.keys()) {
      if (!acum.has(t)) acum.set(t, { total: 0, n: 0, obras: 0 });
    }
    return [...acum.entries()]
      .map(([tecnico, { total, n, obras }]) => ({
        tecnico,
        promedio: n ? Math.round((total / n) * 10) / 10 : null,
        n,
        obras,
        abandonos: abandonosPor.get(tecnico) ?? 0,
      }))
      .filter((r) => r.obras > 0 || r.n > 0 || r.abandonos > 0)
      .sort((a, b) => (b.promedio ?? -1) - (a.promedio ?? -1));
  }, [filasEsp, metricas.abandonos]);
  const nCalificadas = ranking.reduce((s, r) => s + r.n, 0);

  // ── Técnicos: Desvíos de presupuesto por técnico ──
  // STORY-937: SOLO materiales (la mano de obra es fija por diseño) y
  // ponderado por plata: Σ reales / Σ presupuestados − 1. Reales = rendición;
  // fallback para gestiones sin rendición: costo_final − mano de obra.
  const desvio = useMemo(() => {
    const acum = new Map<string, { reales: number; presup: number; n: number }>();
    for (const f of filasEsp) {
      if (!f.matPresupuestada || f.matPresupuestada <= 0 || !f.tecnicoNombre) continue;
      // STORY-1046: el gasto solo cuenta cuando la inmobiliaria aprobó la
      // conformidad. Antes de eso (rendido en etapa `conformidad`, o rechazado)
      // un typo del técnico inflaba su desvío sin decisión de la inmobiliaria.
      if (!f.conformidades.includes("aprobada")) continue;
      const reales =
        f.materialesTotal != null
          ? f.materialesTotal
          : f.costoFinal != null
            ? f.costoFinal - (f.moPresupuestada ?? 0)
            : null;
      if (reales == null || reales < 0) continue;
      const cur = acum.get(f.tecnicoNombre) ?? { reales: 0, presup: 0, n: 0 };
      acum.set(f.tecnicoNombre, {
        reales: cur.reales + reales,
        // STORY-1049: presupuestado = materiales autorizados (original +
        // ampliaciones aprobadas). Una ampliación aprobada no es sobrecosto.
        presup: cur.presup + f.matPresupuestada + f.ampliacionesAprobadas,
        n: cur.n + 1,
      });
    }
    return [...acum.entries()]
      .map(([tecnico, { reales, presup, n }]) => ({
        tecnico,
        pct: Math.round((reales / presup - 1) * 1000) / 10,
        n,
      }))
      .sort((a, b) => b.pct - a.pct); // el que más se pasó (costó de más), arriba
  }, [filasEsp]);
  const nDesvio = desvio.reduce((s, d) => s + d.n, 0);
  const maxDesvio = Math.max(1, ...desvio.map((d) => Math.abs(d.pct)));

  // ── Técnicos: Desvío de plazo (obra vs plazo comprometido) por técnico.
  // Gemelo del de presupuesto pero en tiempo: días reales de
  // ejecución vs plazo_dias del presupuesto aprobado. Positivo = se pasó. ──
  const desvioPlazo = useMemo(() => {
    const acum = new Map<string, { total: number; n: number }>();
    for (const f of filasEsp) {
      const real = ejecucionPlazoPorGestion.get(f.id);
      if (!f.plazoDias || f.plazoDias <= 0 || real == null || !f.tecnicoNombre) continue;
      const pct = ((real - f.plazoDias) / f.plazoDias) * 100;
      const cur = acum.get(f.tecnicoNombre) ?? { total: 0, n: 0 };
      acum.set(f.tecnicoNombre, { total: cur.total + pct, n: cur.n + 1 });
    }
    return [...acum.entries()]
      .map(([tecnico, { total, n }]) => ({ tecnico, pct: Math.round((total / n) * 10) / 10, n }))
      .filter((d) => d.pct > 0) // solo los que se pasaron; cumplir/adelantarse no es accionable
      .sort((a, b) => b.pct - a.pct); // el que más se pasó, arriba
  }, [filasEsp, ejecucionPlazoPorGestion]);
  const nDesvioPlazo = desvioPlazo.reduce((s, d) => s + d.n, 0);
  // Todos se pasaron (pct>0): rampa cálida según cuánto (ámbar→terracota).
  const maxPlazoPos = Math.max(1, ...desvioPlazo.map((d) => d.pct));
  const colorPlazo = (pct: number) => rampaMagnitud(0.5 + 0.5 * Math.min(1, pct / maxPlazoPos));

  // ── Dinero: ingresos $ por cubo (fee de la casa + trabajo del técnico) ──
  const dinero = useMemo(() => {
    const cobradas = filasEsp.filter((f) => f.cobradoEn && (!desde || new Date(f.cobradoEn).getTime() >= desde));
    if (cobradas.length === 0) return { data: [], n: 0, pocos: true, diagTec: null as ReturnType<typeof capTendencia>, diagFee: null as ReturnType<typeof capTendencia> };
    const acum = new Map<string, { tecnico: number; fee: number }>();
    for (const f of cobradas) {
      const k = claveCubo(new Date(f.cobradoEn!).getTime(), gran);
      const fee = Number(f.cobradoFee ?? 0);
      const cur = acum.get(k) ?? { tecnico: 0, fee: 0 };
      cur.fee += fee;
      cur.tecnico += Number(f.cobradoMonto ?? 0) - fee;
      acum.set(k, cur);
    }
    const primera = Math.min(...cobradas.map((f) => new Date(f.cobradoEn!).getTime()));
    // El período EN CURSO se dibuja (barra atenuada, "(en curso)" en el
    // tooltip); la tendencia y "pocos datos" solo cuentan períodos completos.
    const cubos = ventanaUtil(rangoCubos(desde ?? primera, ahora, gran), acum);
    const cubosCompletos = cubos.filter((c) => !c.enCurso);
    const nComplete = cubosCompletos.length; // cubos usados en la tendencia
    // Tendencia POR serie (no del total): solo se muestra al aislar una serie.
    const tendTec = tendencia(cubosCompletos.map((c) => acum.get(c.key)?.tecnico ?? 0));
    const tendFee = tendencia(cubosCompletos.map((c) => acum.get(c.key)?.fee ?? 0));
    const data = cubos.map((c, i) => {
      const a = acum.get(c.key) ?? { tecnico: 0, fee: 0 };
      return {
        label: c.enCurso ? `${c.label} (en curso)` : c.label,
        tecnico: a.tecnico, fee: a.fee, enCurso: c.enCurso,
        tendTec: !c.enCurso && tendTec ? tendTec.yhat[i] : null,
        tendFee: !c.enCurso && tendFee ? tendFee.yhat[i] : null,
      };
    });
    const nonEmpty = cubosCompletos.filter((c) => acum.has(c.key)).length;
    return {
      data, n: cobradas.length, pocos: nonEmpty < MIN_CUBOS_SERIE,
      diagTec: tendTec ? capTendencia(tendTec.m, gran, nComplete, "plata", true) : null,
      diagFee: tendFee ? capTendencia(tendFee.m, gran, nComplete, "plata", true) : null,
    };
  }, [filasEsp, desde, gran, ahora]);

  // ── Dinero: caja pendiente (estado actual, sin período). "Por cobrar" se
  // descompone honestamente en trabajo del técnico + fee de la casa; NO en
  // materiales/mano de obra porque costo_final es un único número (ese
  // detalle solo vive en el presupuesto, que puede diferir). STORY-982 v1.3:
  // misma fórmula que Finanzas — una cancelación con cargo vale su cargo
  // (STORY-967) y nunca pasa por liquidación (el cobro la cierra), así que
  // su cargo va entero a la casa. ──
  const pendiente = useMemo(() => {
    let cobrarTrabajo = 0, cobrarFee = 0, nCobrar = 0;
    for (const f of filasEsp) {
      if (f.etapa !== "facturacion_cobro") continue;
      nCobrar += 1;
      if (f.cargoCancelacion != null) {
        cobrarFee += Number(f.cargoCancelacion);
      } else {
        cobrarTrabajo += Number(f.costoFinal ?? 0);
        cobrarFee += Number(f.cargoAdmin ?? 0);
      }
    }
    return { cobrarTrabajo, cobrarFee, cobrarTotal: cobrarTrabajo + cobrarFee, nCobrar };
  }, [filasEsp]);

  // ── Hoy: Presión por especialidad — demanda activa vs. capacidad (STORY-954) ──
  // presión = gestiones ACTIVAS / técnicos disponibles de la especialidad (v1.2:
  // Fausti — la foto de hoy, no el histórico del período; la decisión es "¿tengo
  // con qué cubrir lo abierto ahora?"). Demanda sin técnicos va primera (estado).
  const presion = useMemo(() => {
    const demanda = new Map<string, number>();
    for (const f of filasEsp) {
      if (ETAPAS_TERMINALES.has(f.etapa)) continue;
      demanda.set(f.especialidad, (demanda.get(f.especialidad) ?? 0) + 1);
    }
    const tecnicos = new Map(metricas.capacidad.map((c) => [c.especialidad, c.tecnicos]));
    const todas = [...demanda.entries()].map(([esp, gest]) => {
      const tec = tecnicos.get(esp) ?? 0;
      return { esp, gest, tec, ratio: tec > 0 ? gest / tec : null };
    });
    const sinTecnicos = todas.filter((r) => r.ratio === null).sort((a, b) => b.gest - a.gest);
    const conTecnicos = todas.filter((r) => r.ratio !== null).sort((a, b) => b.ratio! - a.ratio!);
    const maxRatio = Math.max(1, ...conTecnicos.map((r) => r.ratio!));
    return { lista: [...sinTecnicos, ...conTecnicos], maxRatio };
  }, [filasEsp, metricas.capacidad]);

  return (
    <section>
      {/* El panel ya se refresca en vivo ante cambios de `gestiones` gracias a la
          suscripción de su contenedor `InicioRol` (router.refresh re-fetchea el
          payload de métricas). Acá solo hace falta escuchar `calificaciones`,
          que `InicioRol` no cubre — así se actualiza la card de Calificación al
          entrar una nueva. (No repetir `gestiones`: mismo canal `vivo-gestiones`
          → "cannot add postgres_changes callbacks after subscribe()".) */}
      <RefrescoVivo tabla="calificaciones" />
      <div className="mb-5">
        <h2 className="text-[15px] font-semibold tracking-tight">Informes</h2>
      </div>

      {/* ══ 1. Para resolver hoy ══ */}
      <Bloque titulo="Para resolver hoy">
        <MetricCard titulo="Gestiones estancadas" ayuda="Las que están frenadas hace un día o más en su etapa." n={estancadas.n} humildad={false}>
          <ul className="divide-y divide-border max-h-72 overflow-y-auto">
            {estancadas.lista.map((g) => (
              <FilaAccionable key={g.id} id={g.id} principal={g.direccion} secundario={`${g.etapa} · ${g.descripcion}`} dato={g.dias === 1 ? "1 día" : `${g.dias} días`} alerta={g.dias >= DIAS_ESTANCADA_AMBAR} color={rampaMagnitud(g.dias / estancadas.max)} />
            ))}
          </ul>
        </MetricCard>

        {/* Cobro unificado: resumen de plata (barra "Por cobrar") + lista de las
            gestiones en cobro, ordenadas por antigüedad. */}
        <MetricCard titulo="Gestiones pendientes de cobro" ayuda="Cuánta plata falta cobrar y desde cuándo espera cada una." n={cobranza.length} humildad={false}>
          <div className="space-y-4">
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-muted">Por cobrar · {pendiente.nCobrar} {pendiente.nCobrar === 1 ? "gestión" : "gestiones"}</span>
                <span className="text-xl font-semibold tabular-nums font-mono">{plata(pendiente.cobrarTotal)}</span>
              </div>
              {pendiente.cobrarTotal > 0 && (
                <>
                  <div className="flex h-3 rounded-full overflow-hidden mt-2 bg-surface-2">
                    <div style={{ width: `${(pendiente.cobrarTrabajo / pendiente.cobrarTotal) * 100}%`, background: BRAND }} />
                    <div style={{ width: `${(pendiente.cobrarFee / pendiente.cobrarTotal) * 100}%`, background: AMBAR }} />
                  </div>
                  <div className="flex flex-wrap items-center gap-4 mt-2 text-[12px] text-muted">
                    <span className="flex items-center gap-1.5 cursor-help" title="La parte de estos cobros que después irá a los técnicos. Recién cuando el cliente pague pasa a 'Por liquidar' en Finanzas."><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: BRAND }} />Trabajo del técnico {plata(pendiente.cobrarTrabajo)}</span>
                    <span className="flex items-center gap-1.5 cursor-help" title="La ganancia de la inmobiliaria dentro de lo que falta cobrar (incluye cargos por cancelación)."><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: AMBAR }} />Fee de la casa {plata(pendiente.cobrarFee)}</span>
                  </div>
                </>
              )}
            </div>
            {cobranza.length > 0 && (
              <ul className="divide-y divide-border border-t border-border max-h-72 overflow-y-auto">
                {cobranza.map((c) => (
                  <FilaAccionable key={c.id} id={c.id} principal={c.direccion} secundario={`${plata(c.monto)} · ${c.descripcion}`} dato={c.dias === 1 ? "1 día" : `${c.dias} días`} alerta={c.dias >= DIAS_COBRO_AMBAR} />
                ))}
              </ul>
            )}
          </div>
        </MetricCard>
      </Bloque>

      {/* ══ 1b. Reparto del trabajo — SOLO admin (STORY-1050). El Gestor
          Comercial se vería a sí mismo (RLS) y el Financiero no conduce el
          funnel. Eje persona: cuánto lleva cada gestor y cuánto espera su
          decisión. No se pisa con "estancadas" (lista plana cross-gestor). ══ */}
      {metricas.rol === "administrador" && (
      <Bloque titulo="Reparto del trabajo" cols={1}>
        <MetricCard titulo="Reparto por gestor" ayuda="Cuántas gestiones activas tiene cada Gestor Comercial. Para ver cómo está repartida la carga." n={reparto.nGestores} unidad="gestores" alcance="ahora" humildad={false}>
          <ResponsiveContainer width="100%" height={Math.max(140, reparto.data.length * 44 + 40)}>
            <BarChart data={reparto.data} layout="vertical" margin={{ left: 12, right: 28 }}>
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={{ stroke: GRID }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "rgba(24,24,27,0.04)" }} content={<TooltipCaja render={(p) => <p className="text-muted">{p[0].value} {Number(p[0].value) === 1 ? "gestión activa" : "gestiones activas"}</p>} />} />
              <Bar dataKey="total" fill={BRAND} maxBarSize={20} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </MetricCard>
      </Bloque>
      )}

      {/* ══ 2. Orden por valor — dónde está la plata (fee) de la casa ══ */}
      <Bloque titulo="Orden por valor" cols={1}>
        <MetricCard titulo="Gestiones ordenadas por fee" ayuda="Las gestiones abiertas ordenadas por lo que gana la inmobiliaria." n={porFee.length} humildad={false}>
          <ul className="divide-y divide-border max-h-72 overflow-y-auto">
            {porFee.map((g) => (
              <FilaAccionable key={g.id} id={g.id} principal={g.direccion} secundario={`${g.etapa} · ${g.descripcion}`} dato={plata(g.fee)} alerta={false} color={BRAND} />
            ))}
          </ul>
        </MetricCard>
      </Bloque>

      {/* ══ Cobertura de especialidades (STORY-954 v1.2): la carga abierta HOY
          vs. los técnicos disponibles para cubrirla. No sigue el período.
          Solo staff de mantenimiento: el administrativo no gestiona técnicos. ══ */}
      {metricas.rol !== "gestor_administrativo" && (
      <Bloque titulo="Cobertura de especialidades" cols={1}>
        <MetricCard titulo="Presión por especialidad" ayuda="Trabajo abierto por técnico disponible en cada rubro. En rojo: sin ningún técnico." n={presion.lista.length} unidad="especialidades" alcance="ahora" humildad={false}>
          <ul className="space-y-3 pt-1 max-h-72 overflow-y-auto">
            {presion.lista.map((r) => (
              <li key={r.esp} className="flex items-center gap-3">
                <span className="text-sm w-40 truncate">{r.esp}</span>
                <div className="flex-1 h-2.5 rounded-full bg-surface-2 overflow-hidden">
                  {r.ratio !== null && (
                    <div className="h-full rounded-full" style={{ width: `${(r.ratio / presion.maxRatio) * 100}%`, background: rampaMagnitud(r.ratio / presion.maxRatio) }} />
                  )}
                </div>
                <span className="text-sm font-medium tabular-nums w-52 text-right whitespace-nowrap">
                  {r.ratio === null ? (
                    <span className="text-error text-[13px] font-semibold">⚠ Sin técnicos</span>
                  ) : (
                    <>{r.ratio.toFixed(1).replace(".", ",")} <span className="text-muted font-normal text-[12px]">gest./téc.</span></>
                  )}
                  <span className="text-muted font-normal text-[12px]"> · {r.gest} gest. · {r.tec} téc.</span>
                </span>
              </li>
            ))}
          </ul>
        </MetricCard>
      </Bloque>
      )}

      {/* ══ Carga por etapa (STORY-1004): reparto ACTUAL de las gestiones activas
          por etapa. Snapshot "ahora", no sigue el período — la barra más alta es
          el cuello de botella de hoy. (No es un embudo: no hay conversión que se
          angoste, es la foto de dónde se amontona el trabajo.) ══ */}
      <Bloque titulo="Carga por etapa" cols={1}>
        <MetricCard titulo="Gestiones activas por etapa" ayuda="Dónde están HOY las gestiones abiertas. La barra más alta es el cuello de botella." n={funnel.total} alcance="ahora" humildad={false}>
          {funnel.data.length === 0 ? (
            <p className="text-sm text-muted py-16 text-center">No hay gestiones activas.</p>
          ) : (
            <ResponsiveContainer width="100%" height={248}>
              <BarChart data={funnel.data} layout="vertical" margin={{ left: 12, right: 28 }}>
                <CartesianGrid stroke={GRID} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={{ stroke: GRID }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "rgba(24,24,27,0.04)" }} content={<TooltipCaja render={(p) => <p className="text-muted">{p[0].value} {Number(p[0].value) === 1 ? "gestión" : "gestiones"}</p>} />} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
                  {funnel.data.map((d) => (<Cell key={d.name} fill={rampaMagnitud(d.value / funnel.max)} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </MetricCard>
      </Bloque>

      {/* ══ Caja "En el período": el filtro de fechas gobierna SOLO lo de adentro ══ */}
      <div className="rounded-lg border border-border mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-border">
          <h3 className="text-[13px] font-semibold text-muted">En el período</h3>
          <div className="flex rounded-md border border-border overflow-hidden">
            {PERIODOS.map((p) => (
              <button key={p.id} onClick={() => setPeriodoId(p.id)} className={`text-sm px-2.5 py-1.5 transition-colors ${periodoId === p.id ? "bg-brand text-white" : "bg-surface text-muted hover:text-foreground"}`}>{p.label}</button>
            ))}
          </div>
        </div>
        <div className="p-5 pb-0">
      <Bloque titulo="Flujo del trabajo">
        <MetricCard titulo="Tiempo de ciclo" ayuda="Días de principio a fin, sin contar el tiempo de obra." n={ciclo.n}>
          {ciclo.pocos ? (
            <p className="text-sm text-muted py-16 text-center">Pocos datos en este período para ver la evolución. Probá un período más amplio.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={ciclo.data} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  {/* El "(en curso)" queda para el tooltip; en el eje clipearía. */}
                  <XAxis dataKey="label" tickFormatter={(l: string) => l.replace(" (en curso)", "")} tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={{ stroke: GRID }} />
                  <YAxis tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}d`} />
                  <Tooltip cursor={{ stroke: GRID }} content={<TooltipCaja render={(p) => <p className="text-muted">{p.find((r) => r.name === "dias")?.value ?? "—"} días promedio</p>} />} />
                  <Line type="monotone" dataKey="dias" stroke={BRAND} strokeWidth={2} dot={{ r: 3, fill: BRAND }} connectNulls />
                  <Line type="monotone" dataKey="tend" stroke={TENDENCIA} strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
              <LeyendaTendencia diag={ciclo.diag} />
            </>
          )}
        </MetricCard>

        <MetricCard titulo="Cuellos de botella" ayuda="Días promedio en cada etapa. La más alta es la que frena todo." n={filas.length}>
          {cuellos.length === 0 ? (
            <p className="text-sm text-muted py-16 text-center">Faltan transiciones para medir.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={cuellos} layout="vertical" margin={{ left: 12, right: 16 }}>
                <CartesianGrid stroke={GRID} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={{ stroke: GRID }} />
                <YAxis type="category" dataKey="etapa" width={96} tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "rgba(24,24,27,0.04)" }} content={<TooltipCaja render={(p) => <p className="text-muted">{p[0].value} días</p>} />} />
                <Bar dataKey="dias" radius={[0, 4, 4, 0]} maxBarSize={18}>
                  {cuellos.map((c) => (<Cell key={c.etapa} fill={rampaMagnitud(c.dias / maxCuello)} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </MetricCard>
      </Bloque>

      {/* ══ Dinero (según el período) ══ */}
      <Bloque titulo="Dinero" cols={1}>
        <MetricCard titulo="Ingresos cobrados" ayuda="Lo cobrado en el período: ganancia de la casa vs. pago al técnico." n={dinero.n}>
          {dinero.pocos ? (
            <p className="text-sm text-muted py-16 text-center">Pocos cobros en este período. Probá un período más amplio.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={244}>
                <ComposedChart data={dinero.data} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  {/* El "(en curso)" queda para el tooltip; en el eje clipearía. */}
                  <XAxis dataKey="label" tickFormatter={(l: string) => l.replace(" (en curso)", "")} tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={{ stroke: GRID }} />
                  <YAxis tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={false} tickFormatter={plataCorta} />
                  <Tooltip cursor={{ fill: "rgba(24,24,27,0.04)" }} content={<TooltipCaja render={(p) => {
                    const tecnico = p.find((r) => r.name === "tecnico")?.value ?? 0;
                    const fee = p.find((r) => r.name === "fee")?.value ?? 0;
                    return (<><p className="text-muted">Trabajo del técnico: {plata(tecnico)}</p><p className="text-muted">Ganancia inmobiliaria: {plata(fee)}</p><p className="font-medium mt-0.5">Total: {plata(tecnico + fee)}</p></>);
                  }} />} />
                  <Bar dataKey="tecnico" stackId="a" fill={BRAND} maxBarSize={48} hide={ingresosOcultas.tecnico}>
                    {dinero.data.map((d) => (<Cell key={d.label} fillOpacity={d.enCurso ? 0.55 : 1} />))}
                  </Bar>
                  <Bar dataKey="fee" stackId="a" fill={AMBAR} radius={[3, 3, 0, 0]} maxBarSize={48} hide={ingresosOcultas.fee}>
                    {dinero.data.map((d) => (<Cell key={d.label} fillOpacity={d.enCurso ? 0.55 : 1} />))}
                  </Bar>
                  {/* La tendencia se muestra SOLO al aislar una serie (la de esa serie). */}
                  {soloTecnico && <Line type="monotone" dataKey="tendTec" stroke={TENDENCIA} strokeWidth={1.5} strokeDasharray="4 4" dot={false} />}
                  {soloFee && <Line type="monotone" dataKey="tendFee" stroke={TENDENCIA} strokeWidth={1.5} strokeDasharray="4 4" dot={false} />}
                </ComposedChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-[12px] text-muted">
                <button type="button" onClick={() => toggleIngreso("tecnico")} className={`flex items-center gap-1.5 transition-opacity hover:text-foreground ${ingresosOcultas.tecnico ? "opacity-40 line-through" : ""}`}>
                  <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: BRAND }} />Trabajo del técnico
                </button>
                <button type="button" onClick={() => toggleIngreso("fee")} className={`flex items-center gap-1.5 transition-opacity hover:text-foreground ${ingresosOcultas.fee ? "opacity-40 line-through" : ""}`}>
                  <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: AMBAR }} />Ganancia inmobiliaria (fee)
                </button>
              </div>
              {soloTecnico && <LeyendaTendencia diag={dinero.diagTec} />}
              {soloFee && <LeyendaTendencia diag={dinero.diagFee} />}
              {!algunaOculta && <p className="text-[12px] text-muted mt-2">Tocá una serie en la leyenda para aislarla y ver su tendencia.</p>}
            </>
          )}
        </MetricCard>

      </Bloque>

        </div>
      </div>

      {/* ══ Histórico — acumulado de todas las gestiones (no sigue el período).
          Calificación a lo ancho; debajo las dos gemelas de desvío. ══ */}
      <section className="mb-8">
        <h3 className="text-[13px] font-semibold text-muted mb-3">Histórico · desempeño de técnicos</h3>
        <div className="grid gap-4 grid-cols-1 mb-4">
        <MetricCard titulo="Calificación de técnicos" ayuda="Estrellas promedio y obras terminadas por técnico." n={nCalificadas} unidad="calificaciones" alcance="historico">
          {ranking.length === 0 ? (
            <p className="text-sm text-muted py-16 text-center">Todavía no hay técnicos con obra registrada.</p>
          ) : (
            <ul className="space-y-3 pt-1 max-h-72 overflow-y-auto">
              {ranking.map((r) => (
                <li key={r.tecnico} className="flex items-center gap-3">
                  <span className="text-sm w-28 truncate">{r.tecnico}</span>
                  <div className="flex-1 h-2.5 rounded-full bg-surface-2 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${((r.promedio ?? 0) / 5) * 100}%`, background: BRAND }} />
                  </div>
                  <span className="text-sm font-medium tabular-nums w-40 text-right">
                    {r.promedio != null ? (<>{r.promedio.toFixed(1)} <span className="text-urgente">★</span></>) : (<span className="text-muted text-[12px]">sin calificar</span>)}
                    <span className="text-muted font-normal text-[12px]"> · {r.obras} obra{r.obras === 1 ? "" : "s"}</span>
                    {r.abandonos > 0 && (
                      <span className="text-urgente-fuerte font-medium text-[12px]"> · {r.abandonos} abandono{r.abandonos === 1 ? "" : "s"}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </MetricCard>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
        <MetricCard titulo="Desvíos de presupuesto" ayuda="Por técnico: cuánto se pasó de lo presupuestado en materiales. +20% = gastó $120 por cada $100." n={nDesvio} alcance="historico">
          {desvio.length === 0 ? (
            <p className="text-sm text-muted py-16 text-center">Faltan gestiones cerradas con presupuesto para medir.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(160, desvio.length * 42)}>
              <BarChart data={desvio} layout="vertical" margin={{ left: 12, right: 24 }}>
                <CartesianGrid stroke={GRID} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={{ stroke: GRID }} tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v}%`} />
                <YAxis type="category" dataKey="tecnico" width={96} tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "rgba(24,24,27,0.04)" }} content={<TooltipCaja render={(p) => {
                  const v = Number(p[0].value);
                  return <p className="text-muted">{v > 0 ? `Costó ${v}% más que lo presupuestado` : v < 0 ? `Costó ${Math.abs(v)}% menos que lo presupuestado` : "Costó lo presupuestado"}</p>;
                }} />} />
                <Bar dataKey="pct" radius={[0, 4, 4, 0]} maxBarSize={18}>
                  {desvio.map((d) => (<Cell key={d.tecnico} fill={rampaMagnitud(Math.abs(d.pct) / maxDesvio)} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </MetricCard>

        <MetricCard titulo="Desvío de plazo" ayuda="Técnicos que tardaron más de lo que prometieron, y cuánto." n={nDesvioPlazo} alcance="historico">
          {desvioPlazo.length === 0 ? (
            <p className="text-sm text-muted py-16 text-center">Ningún técnico se pasó del plazo que comprometió.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={Math.max(160, desvioPlazo.length * 42)}>
                <BarChart data={desvioPlazo} layout="vertical" margin={{ left: 12, right: 24 }}>
                  <CartesianGrid stroke={GRID} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={{ stroke: GRID }} tickFormatter={(v: number) => `+${v}%`} />
                  <YAxis type="category" dataKey="tecnico" width={96} tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: "rgba(24,24,27,0.04)" }} content={<TooltipCaja render={(p) => <p className="text-muted">Tardó {Number(p[0].value)}% más de lo que prometió</p>} />} />
                  <Bar dataKey="pct" radius={[0, 4, 4, 0]} maxBarSize={18}>
                    {desvioPlazo.map((d) => (<Cell key={d.tecnico} fill={colorPlazo(d.pct)} />))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-[12px] text-muted mt-2">Más intenso = más se pasó del plazo comprometido.</p>
            </>
          )}
        </MetricCard>
        </div>
      </section>
    </section>
  );
}
