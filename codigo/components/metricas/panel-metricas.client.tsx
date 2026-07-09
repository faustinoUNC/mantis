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
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { RefrescoVivo } from "@/components/refresco-vivo.client";
import type { Metricas } from "@/features/metricas/service";

// STORY-914/919 — Dashboard de métricas graficadas, organizado en bloques
// temáticos (las relacionadas, juntas). Desktop-first (no lo ve el técnico).
// Filtro client-side por período; el período decide la granularidad
// temporal (semana/mes). Colores del contract: esmeralda=marca,
// ámbar=urgente, rojo=error + una escala de magnitud propia (verde→terracota)
// para "empeora", que NO usa el rojo de error.

const BRAND = "#059669";
const BRAND_D = "#065f46";
const AMBAR = "#d97706";
const ROJO = "#dc2626";
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
  facturacion_cobro: "Facturación",
  liquidacion_tecnico: "Liquidación",
  finalizado: "Finalizado",
};
const ORDEN_ETAPAS = Object.keys(ETAPA_LABEL);
const CAUSA_LABEL: Record<string, string> = { desgaste: "Desgaste", dano: "Daño", mejora: "Mejora" };
const PAGADOR_LABEL: Record<string, string> = { inquilino: "Inquilino", propietario: "Propietario" };
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

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
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted mb-3">{titulo}</h3>
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
            <span className="shrink-0 text-[11px] text-muted border border-border rounded-full px-2 py-px" title={alcance === "ahora" ? "Estado actual — no cambia con el período" : "Histórico — todas las gestiones, no cambia con el período"}>
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
      .filter((f) => f.etapa !== "finalizado" && f.etapa !== "cancelada")
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

  // ── Hoy: Pendientes de cobro (en facturación, hace cuántos días) ──
  const cobranza = useMemo(
    () =>
      filasEsp
        .filter((f) => f.etapa === "facturacion_cobro")
        .map((f) => ({
          id: f.id,
          direccion: f.direccion ?? f.descripcion,
          descripcion: f.descripcion,
          monto: Number(f.costoFinal ?? 0) + Number(f.cargoAdmin ?? 0),
          dias: diasEnEtapa(f, ultimaTransicion, ahora),
        }))
        .sort((a, b) => b.dias - a.dias),
    [filasEsp, ultimaTransicion, ahora]
  );

  // ── Hoy: Prioridad por valor (fee ya determinado, mayor→menor) ──
  // El fee (cargo_admin) se ancla al aprobar el presupuesto → aparece de
  // en_ejecucion en adelante (+ presupuesto con PDF borrador). Ordena por
  // plata para la casa: qué gestión activa conviene no dejar caer.
  const porFee = useMemo(
    () =>
      filasEsp
        .filter((f) => f.etapa !== "finalizado" && f.etapa !== "cancelada" && Number(f.cargoAdmin ?? 0) > 0)
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

  // ── Flujo: Embudo de conversión + cancelación ──
  const funnel = useMemo(() => {
    const maxPorGestion = new Map<string, number>();
    for (const f of filas) maxPorGestion.set(f.id, 0);
    for (const e of metricas.eventos) {
      if (!idsPeriodo.has(e.gestionId) || !e.aEtapa) continue;
      const i = ORDEN_ETAPAS.indexOf(e.aEtapa);
      if (i < 0) continue;
      maxPorGestion.set(e.gestionId, Math.max(maxPorGestion.get(e.gestionId) ?? 0, i));
    }
    const alcanzado = ORDEN_ETAPAS.map((etapa, i) => ({
      name: ETAPA_LABEL[etapa],
      value: [...maxPorGestion.values()].filter((mx) => mx >= i).length,
    })).filter((d) => d.value > 0);
    const canceladas = filas.filter((f) => f.etapa === "cancelada").length;
    return { alcanzado, canceladas, total: filas.length };
  }, [filas, idsPeriodo, metricas.eventos]);

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
      for (let k = 0; k < linea.length - 1; k++) {
        const dias = (linea[k + 1].at - linea[k].at) / 86400000;
        const cur = acum.get(linea[k].etapa) ?? { total: 0, n: 0 };
        acum.set(linea[k].etapa, { total: cur.total + dias, n: cur.n + 1 });
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
  const ejecucionPorGestion = useMemo(() => {
    const entrada = new Map<string, number>();
    const salida = new Map<string, number>();
    for (const e of metricas.eventos) {
      const t = new Date(e.creadoEn).getTime();
      if (e.aEtapa === "en_ejecucion" && t < (entrada.get(e.gestionId) ?? Infinity)) entrada.set(e.gestionId, t);
      if (e.deEtapa === "en_ejecucion" && t > (salida.get(e.gestionId) ?? 0)) salida.set(e.gestionId, t);
    }
    const dur = new Map<string, number>();
    for (const [id, ent] of entrada) {
      const sal = salida.get(id);
      if (sal != null && sal > ent) dur.set(id, (sal - ent) / 86400000);
    }
    return dur;
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
    const cubos = rangoCubos(desde ?? primera, ahora, gran);
    const ultimo = cubos.length - 1; // el período en curso es parcial → fuera de la tendencia
    const dias = cubos.map((c) => {
      const a = acum.get(c.key);
      return a ? Math.round((a.total / a.n) * 10) / 10 : null;
    });
    const completos = dias.slice(0, ultimo).filter((d): d is number => d != null);
    const tend = tendencia(completos);
    let ti = 0;
    const data = cubos.map((c, i) => ({ label: c.label, dias: dias[i], tend: i < ultimo && dias[i] != null && tend ? tend.yhat[ti++] : null }));
    const nonEmpty = dias.filter((d) => d != null).length;
    return { data, n: cerradas.length, pocos: nonEmpty < MIN_CUBOS_SERIE, diag: tend ? capTendencia(tend.m, gran, completos.length, "dias", false) : null };
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
    return [...acum.entries()]
      .map(([tecnico, { total, n, obras }]) => ({ tecnico, promedio: n ? Math.round((total / n) * 10) / 10 : null, n, obras }))
      .filter((r) => r.obras > 0 || r.n > 0)
      .sort((a, b) => (b.promedio ?? -1) - (a.promedio ?? -1));
  }, [filasEsp]);
  const nCalificadas = ranking.reduce((s, r) => s + r.n, 0);

  // ── Técnicos: Cumplimiento de presupuesto (desvío) por técnico ──
  const desvio = useMemo(() => {
    const acum = new Map<string, { total: number; n: number }>();
    for (const f of filasEsp) {
      if (f.costoFinal == null || !f.presupuestoAprobado || f.presupuestoAprobado <= 0 || !f.tecnicoNombre) continue;
      const pct = ((f.costoFinal - f.presupuestoAprobado) / f.presupuestoAprobado) * 100;
      const cur = acum.get(f.tecnicoNombre) ?? { total: 0, n: 0 };
      acum.set(f.tecnicoNombre, { total: cur.total + pct, n: cur.n + 1 });
    }
    return [...acum.entries()]
      .map(([tecnico, { total, n }]) => ({ tecnico, pct: Math.round((total / n) * 10) / 10, n }))
      .sort((a, b) => a.pct - b.pct);
  }, [filasEsp]);
  const nDesvio = desvio.reduce((s, d) => s + d.n, 0);
  const maxDesvio = Math.max(1, ...desvio.map((d) => Math.abs(d.pct)));

  // ── Técnicos: Cumplimiento de plazo (desvío de la obra vs plazo comprometido)
  // por técnico. Gemelo del de presupuesto pero en tiempo: días reales de
  // ejecución vs plazo_dias del presupuesto aprobado. Positivo = se pasó. ──
  const desvioPlazo = useMemo(() => {
    const acum = new Map<string, { total: number; n: number }>();
    for (const f of filasEsp) {
      const real = ejecucionPorGestion.get(f.id);
      if (!f.plazoDias || f.plazoDias <= 0 || real == null || !f.tecnicoNombre) continue;
      const pct = ((real - f.plazoDias) / f.plazoDias) * 100;
      const cur = acum.get(f.tecnicoNombre) ?? { total: 0, n: 0 };
      acum.set(f.tecnicoNombre, { total: cur.total + pct, n: cur.n + 1 });
    }
    return [...acum.entries()]
      .map(([tecnico, { total, n }]) => ({ tecnico, pct: Math.round((total / n) * 10) / 10, n }))
      .sort((a, b) => a.pct - b.pct);
  }, [filasEsp, ejecucionPorGestion]);
  const nDesvioPlazo = desvioPlazo.reduce((s, d) => s + d.n, 0);
  const maxDesvioPlazo = Math.max(1, ...desvioPlazo.map((d) => Math.abs(d.pct)));

  // ── Dinero: ingresos $ + gestiones cobradas por cubo (dos series, dos tarjetas) ──
  const dinero = useMemo(() => {
    const cobradas = filasEsp.filter((f) => f.cobradoEn && (!desde || new Date(f.cobradoEn).getTime() >= desde));
    if (cobradas.length === 0) return { data: [], n: 0, pocos: true, trendCant: false, diagTec: null as ReturnType<typeof capTendencia>, diagFee: null as ReturnType<typeof capTendencia>, diagCant: null as ReturnType<typeof capTendencia> };
    const acum = new Map<string, { tecnico: number; fee: number; cant: number }>();
    for (const f of cobradas) {
      const k = claveCubo(new Date(f.cobradoEn!).getTime(), gran);
      const fee = Number(f.cobradoFee ?? 0);
      const cur = acum.get(k) ?? { tecnico: 0, fee: 0, cant: 0 };
      cur.fee += fee;
      cur.tecnico += Number(f.cobradoMonto ?? 0) - fee;
      cur.cant += 1;
      acum.set(k, cur);
    }
    const primera = Math.min(...cobradas.map((f) => new Date(f.cobradoEn!).getTime()));
    const cubos = rangoCubos(desde ?? primera, ahora, gran);
    const ultimo = cubos.length - 1; // el período en curso es parcial → fuera de la tendencia
    const nComplete = ultimo; // cubos usados en la tendencia
    // Tendencia POR serie (no del total): solo se muestra al aislar una serie.
    const tendTec = tendencia(cubos.slice(0, ultimo).map((c) => acum.get(c.key)?.tecnico ?? 0));
    const tendFee = tendencia(cubos.slice(0, ultimo).map((c) => acum.get(c.key)?.fee ?? 0));
    const tendCant = tendencia(cubos.slice(0, ultimo).map((c) => acum.get(c.key)?.cant ?? 0));
    const data = cubos.map((c, i) => {
      const a = acum.get(c.key) ?? { tecnico: 0, fee: 0, cant: 0 };
      return {
        label: c.label, tecnico: a.tecnico, fee: a.fee, cant: a.cant,
        tendTec: i < ultimo && tendTec ? tendTec.yhat[i] : null,
        tendFee: i < ultimo && tendFee ? tendFee.yhat[i] : null,
        tendCant: i < ultimo && tendCant ? tendCant.yhat[i] : null,
      };
    });
    const nonEmpty = cubos.filter((c) => acum.has(c.key)).length;
    return {
      data, n: cobradas.length, pocos: nonEmpty < MIN_CUBOS_SERIE,
      trendCant: !!tendCant,
      diagTec: tendTec ? capTendencia(tendTec.m, gran, nComplete, "plata", true) : null,
      diagFee: tendFee ? capTendencia(tendFee.m, gran, nComplete, "plata", true) : null,
      diagCant: tendCant ? capTendencia(tendCant.m, gran, nComplete, "cant", true) : null,
    };
  }, [filasEsp, desde, gran, ahora]);

  // ── Dinero: caja pendiente (estado actual, sin período). "Por cobrar" se
  // descompone honestamente en trabajo (lo que se liquidará al técnico) + fee
  // de la casa; NO en materiales/mano de obra porque costo_final es un único
  // número (ese detalle solo vive en el presupuesto, que puede diferir). ──
  const pendiente = useMemo(() => {
    let cobrarTrabajo = 0, cobrarFee = 0, liquidar = 0, nCobrar = 0, nLiquidar = 0;
    for (const f of filasEsp) {
      if (f.etapa === "facturacion_cobro") {
        cobrarTrabajo += Number(f.costoFinal ?? 0);
        cobrarFee += Number(f.cargoAdmin ?? 0);
        nCobrar += 1;
      } else if (f.etapa === "liquidacion_tecnico") {
        liquidar += Number(f.costoFinal ?? 0);
        nLiquidar += 1;
      }
    }
    return { cobrarTrabajo, cobrarFee, cobrarTotal: cobrarTrabajo + cobrarFee, liquidar, nCobrar, nLiquidar };
  }, [filasEsp]);

  // ── Perfil: Composición causa × pagador ──
  const composicion = useMemo(() => {
    const causa = new Map<string, number>();
    const pagador = new Map<string, number>();
    for (const f of filas) {
      causa.set(f.causa, (causa.get(f.causa) ?? 0) + 1);
      if (f.pagador) pagador.set(f.pagador, (pagador.get(f.pagador) ?? 0) + 1);
    }
    return {
      causa: [...causa.entries()].map(([k, value]) => ({ name: CAUSA_LABEL[k] ?? k, value })),
      pagador: [...pagador.entries()].map(([k, value]) => ({ name: PAGADOR_LABEL[k] ?? k, value })),
    };
  }, [filas]);

  // ── Flujo: Rechazos desglosados (3 tipos, nunca mezclados) ──
  const rechazos = useMemo(() => {
    const conRechazoAsig = new Set<string>();
    for (const e of metricas.eventos) {
      if (e.tipo === "asignacion_rechazada" && idsPeriodo.has(e.gestionId)) conRechazoAsig.add(e.gestionId);
    }
    return [
      { tipo: "Presupuesto", cantidad: filas.filter((f) => f.presupuestos.includes("rechazado")).length },
      { tipo: "Conformidad", cantidad: filas.filter((f) => f.conformidades.includes("rechazada")).length },
      { tipo: "Asignación", cantidad: filas.filter((f) => conRechazoAsig.has(f.id)).length },
    ];
  }, [filas, idsPeriodo, metricas.eventos]);
  const totalRechazos = rechazos.reduce((s, r) => s + r.cantidad, 0);

  const donutColores = [BRAND_D, BRAND, "#6ee7b7", INK_MUTED];

  return (
    <section>
      <RefrescoVivo tabla="calificaciones" />
      <div className="mb-5">
        <h2 className="text-[15px] font-semibold tracking-tight">Informes</h2>
      </div>

      {/* ══ 1. Para resolver hoy ══ */}
      <Bloque titulo="Para resolver hoy">
        <MetricCard titulo="Gestiones estancadas" ayuda="Gestiones activas frenadas hace un día o más en su etapa — qué destrabar primero." n={estancadas.n} humildad={false}>
          <ul className="divide-y divide-border max-h-72 overflow-y-auto">
            {estancadas.lista.map((g) => (
              <FilaAccionable key={g.id} id={g.id} principal={g.direccion} secundario={`${g.etapa} · ${g.descripcion}`} dato={g.dias === 1 ? "1 día" : `${g.dias} días`} alerta={g.dias >= DIAS_ESTANCADA_AMBAR} color={rampaMagnitud(g.dias / estancadas.max)} />
            ))}
          </ul>
        </MetricCard>

        {/* Cobro unificado: resumen de plata (barra "Por cobrar") + lista de las
            gestiones en cobro, ordenadas por antigüedad. */}
        <MetricCard titulo="Gestiones pendientes de cobro" ayuda="Cuánta plata falta cobrar y hace cuánto espera cada gestión — qué cobrar primero." n={cobranza.length} humildad={false}>
          <div className="space-y-4">
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-muted">Por cobrar · {pendiente.nCobrar} gestión{pendiente.nCobrar === 1 ? "" : "es"}</span>
                <span className="text-xl font-semibold tabular-nums">{plata(pendiente.cobrarTotal)}</span>
              </div>
              {pendiente.cobrarTotal > 0 && (
                <>
                  <div className="flex h-3 rounded-full overflow-hidden mt-2 bg-surface-2">
                    <div style={{ width: `${(pendiente.cobrarTrabajo / pendiente.cobrarTotal) * 100}%`, background: BRAND }} />
                    <div style={{ width: `${(pendiente.cobrarFee / pendiente.cobrarTotal) * 100}%`, background: AMBAR }} />
                  </div>
                  <div className="flex flex-wrap items-center gap-4 mt-2 text-[12px] text-muted">
                    <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: BRAND }} />A técnicos {plata(pendiente.cobrarTrabajo)}</span>
                    <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: AMBAR }} />Fee de la casa {plata(pendiente.cobrarFee)}</span>
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

      {/* ══ 2. Prioridad por valor — dónde está la plata (fee) de la casa ══ */}
      <Bloque titulo="Prioridad por valor" cols={1}>
        <MetricCard titulo="Prioridad por valor" ayuda="Gestiones activas con fee ya definido, de mayor a menor — dónde está la plata que la casa va a ganar, para no dejarla caer en el camino." n={porFee.length} humildad={false}>
          <ul className="divide-y divide-border max-h-72 overflow-y-auto">
            {porFee.map((g) => (
              <FilaAccionable key={g.id} id={g.id} principal={g.direccion} secundario={`${g.etapa} · ${g.descripcion}`} dato={plata(g.fee)} alerta={false} color={BRAND} />
            ))}
          </ul>
        </MetricCard>
      </Bloque>

      {/* ══ Caja "En el período": el filtro de fechas gobierna SOLO lo de adentro ══ */}
      <div className="rounded-xl border border-border mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-border">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">En el período</h3>
          <div className="flex rounded-md border border-border overflow-hidden">
            {PERIODOS.map((p) => (
              <button key={p.id} onClick={() => setPeriodoId(p.id)} className={`text-sm px-2.5 py-1.5 transition-colors ${periodoId === p.id ? "bg-brand text-white" : "bg-surface text-muted hover:text-foreground"}`}>{p.label}</button>
            ))}
          </div>
        </div>
        <div className="p-5 pb-0">
      <Bloque titulo="Flujo del trabajo">
        <MetricCard titulo="Embudo de gestiones" ayuda={funnel.canceladas > 0 ? `Cuántas gestiones alcanzaron cada etapa. ${funnel.canceladas} cancelada${funnel.canceladas > 1 ? "s" : ""} (${Math.round((funnel.canceladas / funnel.total) * 100)}% del total).` : "Cuántas gestiones alcanzaron cada etapa."} n={funnel.total}>
          <ResponsiveContainer width="100%" height={248}>
            <BarChart data={funnel.alcanzado} layout="vertical" margin={{ left: 12, right: 28 }}>
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={{ stroke: GRID }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "rgba(24,24,27,0.04)" }} content={<TooltipCaja render={(p) => <p className="text-muted">{p[0].value} gestiones</p>} />} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
                {funnel.alcanzado.map((d, i) => (<Cell key={d.name} fill={i === funnel.alcanzado.length - 1 ? BRAND_D : BRAND} />))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </MetricCard>

        <MetricCard titulo="Rechazos por tipo" ayuda="Rechazos por instancia: presupuesto (el precio no se aprobó), conformidad (el trabajo se rechazó) o asignación (el técnico no tomó el trabajo)." n={totalRechazos}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={rechazos} margin={{ left: 8, right: 8 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="tipo" tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={{ stroke: GRID }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "rgba(24,24,27,0.04)" }} content={<TooltipCaja render={(p) => <p className="text-muted">{p[0].value} rechazos</p>} />} />
              <Bar dataKey="cantidad" fill={ROJO} radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </MetricCard>

        <MetricCard titulo="Tiempo de ciclo" ayuda="Días de creación a finalización sin el tiempo de obra — la eficiencia del circuito, no el tamaño del trabajo." n={ciclo.n}>
          {ciclo.pocos ? (
            <p className="text-sm text-muted py-16 text-center">Pocos datos en este período para ver la evolución. Probá un período más amplio.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={ciclo.data} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={{ stroke: GRID }} />
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

        <MetricCard titulo="Cuellos de botella" ayuda="Días promedio por etapa, sin el tiempo de ejecución — la del circuito más lenta es la que frena todo." n={filas.length}>
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
      <Bloque titulo="Dinero">
        <MetricCard titulo="Ingresos cobrados" ayuda="Lo cobrado por período, separando la ganancia de la casa (fee) del pago al técnico." n={dinero.n}>
          {dinero.pocos ? (
            <p className="text-sm text-muted py-16 text-center">Pocos cobros en este período. Probá un período más amplio.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={244}>
                <ComposedChart data={dinero.data} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={{ stroke: GRID }} />
                  <YAxis tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={false} tickFormatter={plataCorta} />
                  <Tooltip cursor={{ fill: "rgba(24,24,27,0.04)" }} content={<TooltipCaja render={(p) => {
                    const tecnico = p.find((r) => r.name === "tecnico")?.value ?? 0;
                    const fee = p.find((r) => r.name === "fee")?.value ?? 0;
                    return (<><p className="text-muted">Trabajo del técnico: {plata(tecnico)}</p><p className="text-muted">Ganancia inmobiliaria: {plata(fee)}</p><p className="font-medium mt-0.5">Total: {plata(tecnico + fee)}</p></>);
                  }} />} />
                  <Bar dataKey="tecnico" stackId="a" fill={BRAND} maxBarSize={48} hide={ingresosOcultas.tecnico} />
                  <Bar dataKey="fee" stackId="a" fill={AMBAR} radius={[3, 3, 0, 0]} maxBarSize={48} hide={ingresosOcultas.fee} />
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

        <MetricCard titulo="Gestiones cobradas" ayuda="Cuántas gestiones se cobraron por período — el volumen de trabajo que cierra el circuito." n={dinero.n}>
          {dinero.pocos ? (
            <p className="text-sm text-muted py-16 text-center">Pocos cobros en este período. Probá un período más amplio.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={244}>
                <LineChart data={dinero.data} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={{ stroke: GRID }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ stroke: GRID }} content={<TooltipCaja render={(p) => <p className="text-muted">{p.find((r) => r.name === "cant")?.value ?? "—"} gestiones cobradas</p>} />} />
                  <Line type="monotone" dataKey="cant" stroke={BRAND_D} strokeWidth={2} dot={{ r: 3, fill: BRAND_D }} />
                  {dinero.trendCant && <Line type="monotone" dataKey="tendCant" stroke={TENDENCIA} strokeWidth={1.5} strokeDasharray="4 4" dot={false} />}
                </LineChart>
              </ResponsiveContainer>
              <LeyendaTendencia diag={dinero.diagCant} />
            </>
          )}
        </MetricCard>
      </Bloque>

      {/* ══ Perfil del trabajo (según el período) ══ */}
      <Bloque titulo="Perfil del trabajo" cols={1}>
        <MetricCard titulo="Composición del trabajo" ayuda="Por qué entra el trabajo y quién lo paga — con qué tipo de gestión se llena la agenda." n={filas.length}>
          <div className="grid grid-cols-2 gap-6 max-w-2xl mx-auto">
            {(["causa", "pagador"] as const).map((clave) => (
              <div key={clave}>
                <p className="text-[12px] text-muted text-center mb-1 capitalize">{clave}</p>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={composicion[clave]} dataKey="value" nameKey="name" innerRadius={34} outerRadius={58} paddingAngle={2}>
                      {composicion[clave].map((_, i) => (<Cell key={i} fill={donutColores[i % donutColores.length]} />))}
                    </Pie>
                    <Tooltip content={<TooltipCaja render={(p) => <p className="text-muted">{p[0].name}: {p[0].value}</p>} />} />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="text-[12px] text-muted space-y-0.5 mt-1">
                  {composicion[clave].map((d, i) => (
                    <li key={d.name} className="flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded-full" style={{ background: donutColores[i % donutColores.length] }} />
                      {d.name} · {d.value}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </MetricCard>
      </Bloque>
        </div>
      </div>

      {/* ══ Histórico — acumulado de todas las gestiones (no sigue el período).
          Calificación a lo ancho; debajo las dos gemelas de cumplimiento. ══ */}
      <section className="mb-8">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted mb-3">Histórico · desempeño de técnicos</h3>
        <div className="grid gap-4 grid-cols-1 mb-4">
        <MetricCard titulo="Calificación de técnicos" ayuda="Promedio de estrellas y obras finalizadas por técnico — quién resuelve mejor y cuánto hizo." n={nCalificadas} unidad="calificaciones" alcance="historico">
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
                  <span className="text-sm font-medium tabular-nums w-32 text-right">
                    {r.promedio != null ? (<>{r.promedio.toFixed(1)} <span className="text-urgente">★</span></>) : (<span className="text-muted text-[12px]">sin calificar</span>)}
                    <span className="text-muted font-normal text-[12px]"> · {r.obras} obra{r.obras === 1 ? "" : "s"}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </MetricCard>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
        <MetricCard titulo="Cumplimiento de presupuesto" ayuda="Cuánto se desvía el costo final de lo presupuestado, por técnico — quién cotiza fino y quién se pasa." n={nDesvio} alcance="historico">
          {desvio.length === 0 ? (
            <p className="text-sm text-muted py-16 text-center">Faltan gestiones cerradas con presupuesto para medir.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(160, desvio.length * 42)}>
              <BarChart data={desvio} layout="vertical" margin={{ left: 12, right: 24 }}>
                <CartesianGrid stroke={GRID} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={{ stroke: GRID }} tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v}%`} />
                <YAxis type="category" dataKey="tecnico" width={96} tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "rgba(24,24,27,0.04)" }} content={<TooltipCaja render={(p) => <p className="text-muted">{p[0].value > 0 ? "+" : ""}{p[0].value}% de desvío</p>} />} />
                <Bar dataKey="pct" radius={[0, 4, 4, 0]} maxBarSize={18}>
                  {desvio.map((d) => (<Cell key={d.tecnico} fill={rampaMagnitud(Math.abs(d.pct) / maxDesvio)} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </MetricCard>

        <MetricCard titulo="Cumplimiento de plazo" ayuda="Cuánto se desvía la obra del plazo que el técnico comprometió — quién cumple los tiempos que promete." n={nDesvioPlazo} alcance="historico">
          {desvioPlazo.length === 0 ? (
            <p className="text-sm text-muted py-16 text-center">Faltan obras con plazo y ejecución medida.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(160, desvioPlazo.length * 42)}>
              <BarChart data={desvioPlazo} layout="vertical" margin={{ left: 12, right: 24 }}>
                <CartesianGrid stroke={GRID} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={{ stroke: GRID }} tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v}%`} />
                <YAxis type="category" dataKey="tecnico" width={96} tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "rgba(24,24,27,0.04)" }} content={<TooltipCaja render={(p) => <p className="text-muted">{p[0].value > 0 ? "+" : ""}{p[0].value}% de desvío</p>} />} />
                <Bar dataKey="pct" radius={[0, 4, 4, 0]} maxBarSize={18}>
                  {desvioPlazo.map((d) => (<Cell key={d.tecnico} fill={rampaMagnitud(Math.abs(d.pct) / maxDesvioPlazo)} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </MetricCard>
        </div>
      </section>
    </section>
  );
}
