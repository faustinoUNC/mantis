"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Icono } from "@/components/ui/iconos";
import { FiltrosLista } from "@/components/ui/filtros-lista.client";
import {
  DIAS_ALERTA,
  antiguedadLegible,
  claveMes,
  coincide,
  mesLabel,
  pesos,
  type CobrosData,
  type LiquidacionesData,
} from "@/features/finanzas/consultas-types";

// STORY-982 — Finanzas gráfico y de un vistazo: stat cards de resumen,
// gráfico de barras mensual por tab (patrón Informes) y meses cerrados
// colapsables (solo el más reciente abierto). El server layer no cambia.

type Tab = "cobros" | "liquidaciones";

// Colores del contract (mismos hex que panel-metricas). El par esmeralda/ámbar
// para dos series de dinero es el mismo que usa "Ingresos cobrados" de Informes.
const BRAND = "#059669";
const AMBAR = "#d97706";
const GRID = "#e4e4e7";
const INK_MUTED = "#71717a";
const MESES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MAX_MESES_GRAFICO = 12;

// Suma de un campo numérico de una lista de filas.
function sumar<T>(filas: T[], campo: (f: T) => number): number {
  return filas.reduce((acc, f) => acc + campo(f), 0);
}

type Grupo<T> = { clave: string; label: string; total: number; filas: T[] };

// Agrupa filas cerradas por mes (clave AAAA-MM), preservando el orden de
// entrada (ya vienen del server ordenadas por fecha desc = mes reciente 1º).
function agruparPorMes<T extends { fecha: string; monto: number }>(
  filas: T[]
): Grupo<T>[] {
  const orden: string[] = [];
  const mapa = new Map<string, T[]>();
  for (const f of filas) {
    const k = claveMes(f.fecha);
    if (!mapa.has(k)) {
      mapa.set(k, []);
      orden.push(k);
    }
    mapa.get(k)!.push(f);
  }
  return orden.map((k) => {
    const grupo = mapa.get(k)!;
    return {
      clave: k,
      label: mesLabel(grupo[0].fecha),
      total: sumar(grupo, (f) => f.monto),
      filas: grupo,
    };
  });
}

// Meses continuos entre dos claves AAAA-MM (inclusive) — los meses sin
// movimiento aparecen en $0, que acá es un cero real (ya había sistema).
function rangoMeses(desde: string, hasta: string): string[] {
  let [y, m] = desde.split("-").map(Number);
  const [y2, m2] = hasta.split("-").map(Number);
  const out: string[] = [];
  let guarda = 0;
  while ((y < y2 || (y === y2 && m <= m2)) && guarda++ < 120) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function mesCorto(clave: string): string {
  const [y, m] = clave.split("-");
  return `${MESES_CORTO[Number(m) - 1]} ${y.slice(2)}`;
}

function plataCorta(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${Math.round(v / 100000) / 10}M`;
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}k`;
  return String(v);
}

export function Finanzas({
  cobros,
  liquidaciones,
}: {
  cobros: CobrosData;
  liquidaciones: LiquidacionesData;
}) {
  const [tab, setTab] = useState<Tab>("cobros");
  const [busqueda, setBusqueda] = useState("");
  // Congelado al montar: define el "mes en curso" de las cards y el techo del
  // gráfico (mismo criterio que panel-metricas con Date.now()).
  const [ahoraIso] = useState(() => new Date().toISOString());
  const mesActual = claveMes(ahoraIso);
  const nombreMes = mesLabel(ahoraIso).split(" ")[0].toLowerCase();

  const TABS: { id: Tab; label: string }[] = [
    { id: "cobros", label: "Cobros" },
    { id: "liquidaciones", label: "Liquidaciones" },
  ];

  // ── Resumen (la foto de hoy — no lo afecta la búsqueda) ──
  const resumen = useMemo(() => {
    const cobradoMes = cobros.cerrados.filter((f) => claveMes(f.fecha) === mesActual);
    const liquidadoMes = liquidaciones.cerrados.filter((f) => claveMes(f.fecha) === mesActual);
    return {
      porCobrar: sumar(cobros.pendientes, (f) => f.total),
      nCobrar: cobros.pendientes.length,
      cobrarDemoradas: cobros.pendientes.filter(
        (f) => f.diasPendiente != null && f.diasPendiente >= DIAS_ALERTA
      ).length,
      porLiquidar: sumar(liquidaciones.pendientes, (f) => f.monto),
      nLiquidar: liquidaciones.pendientes.length,
      liquidarDemoradas: liquidaciones.pendientes.filter(
        (f) => f.diasPendiente != null && f.diasPendiente >= DIAS_ALERTA
      ).length,
      cobradoMes: sumar(cobradoMes, (f) => f.monto),
      nCobradoMes: cobradoMes.length,
      liquidadoMes: sumar(liquidadoMes, (f) => f.monto),
      nLiquidadoMes: liquidadoMes.length,
    };
  }, [cobros, liquidaciones, mesActual]);

  // Series mensuales completas (sin filtrar) para el gráfico combinado.
  const gruposCobros = useMemo(() => agruparPorMes(cobros.cerrados), [cobros.cerrados]);
  const gruposLiq = useMemo(
    () => agruparPorMes(liquidaciones.cerrados),
    [liquidaciones.cerrados]
  );

  return (
    <div className="animate-aparecer">
      <p className="text-[13px] font-medium text-muted">Finanzas</p>
      <h1 className="text-2xl font-semibold tracking-tight mt-0.5 mb-1">
        Cobros y liquidaciones
      </h1>
      <p className="text-sm text-muted mb-4">
        La plata pendiente y la cerrada, en un solo lugar. Tocá una fila para ir
        a la gestión.
      </p>

      {/* Resumen de un vistazo — tocar una card lleva a su pestaña */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard
          label="Por cobrar"
          monto={resumen.porCobrar}
          cantidad={resumen.nCobrar}
          demoradas={resumen.cobrarDemoradas}
          onClick={() => setTab("cobros")}
        />
        <StatCard
          label="Por liquidar"
          monto={resumen.porLiquidar}
          cantidad={resumen.nLiquidar}
          demoradas={resumen.liquidarDemoradas}
          onClick={() => setTab("liquidaciones")}
        />
        <StatCard
          label={`Cobrado en ${nombreMes}`}
          monto={resumen.cobradoMes}
          cantidad={resumen.nCobradoMes}
          onClick={() => setTab("cobros")}
        />
        <StatCard
          label={`Liquidado en ${nombreMes}`}
          monto={resumen.liquidadoMes}
          cantidad={resumen.nLiquidadoMes}
          onClick={() => setTab("liquidaciones")}
        />
      </div>

      <GraficoCombinado
        cobros={gruposCobros}
        liquidaciones={gruposLiq}
        mesActual={mesActual}
      />

      {/* Segmentado idéntico al de Auditoría */}
      <div className="flex rounded-md border border-border overflow-hidden w-fit mb-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`text-sm px-3.5 py-1.5 transition-colors ${
              tab === t.id
                ? "bg-brand text-white"
                : "bg-surface text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <FiltrosLista
        consulta={busqueda}
        onConsulta={setBusqueda}
        placeholder={
          tab === "cobros"
            ? "Gestión, dirección o pagador…"
            : "Gestión, dirección o técnico…"
        }
      />

      <div className={tab === "cobros" ? "" : "hidden"}>
        <TabCobros cobros={cobros} busqueda={busqueda} mesActual={mesActual} />
      </div>
      <div className={tab === "liquidaciones" ? "" : "hidden"}>
        <TabLiquidaciones
          liquidaciones={liquidaciones}
          busqueda={busqueda}
          mesActual={mesActual}
        />
      </div>
    </div>
  );
}

// ── Card de resumen ────────────────────────────────────────────────────────
function StatCard({
  label,
  monto,
  cantidad,
  demoradas = 0,
  onClick,
}: {
  label: string;
  monto: number;
  cantidad: number;
  demoradas?: number;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card className="p-4 h-full transition-colors hover:border-brand">
        <p className="text-[12px] font-medium text-muted">{label}</p>
        <p className="text-xl font-semibold tabular-nums tracking-tight mt-1">
          {pesos(monto)}
        </p>
        <p className="text-[12px] text-muted mt-0.5">
          {cantidad} {cantidad === 1 ? "gestión" : "gestiones"}
          {demoradas > 0 && (
            <span className="text-urgente font-medium">
              {" "}
              · {demoradas} {demoradas === 1 ? "demorada" : "demoradas"}
            </span>
          )}
        </p>
      </Card>
    </button>
  );
}

// ── Gráfico combinado: cobrado vs. liquidado por mes (v1.1) ────────────────
// La foto global entra-vs-sale — no depende del tab ni de la búsqueda. Barras
// agrupadas (no son partes de un todo). El tooltip NO muestra la resta como
// "ganancia": un cobro de julio puede liquidarse en agosto (honestidad de
// Informes). Con menos de dos meses con datos no se dibuja.
function GraficoCombinado({
  cobros,
  liquidaciones,
  mesActual,
}: {
  cobros: Grupo<{ fecha: string; monto: number }>[];
  liquidaciones: Grupo<{ fecha: string; monto: number }>[];
  mesActual: string;
}) {
  const data = useMemo(() => {
    const c = new Map(cobros.map((g) => [g.clave, g]));
    const l = new Map(liquidaciones.map((g) => [g.clave, g]));
    const claves = [...new Set([...c.keys(), ...l.keys()])].sort();
    if (claves.length < 2) return [];
    return rangoMeses(claves[0], mesActual)
      .slice(-MAX_MESES_GRAFICO)
      .map((k) => ({
        label: mesCorto(k),
        cobrado: c.get(k)?.total ?? 0,
        nCobrado: c.get(k)?.filas.length ?? 0,
        liquidado: l.get(k)?.total ?? 0,
        nLiquidado: l.get(k)?.filas.length ?? 0,
      }));
  }, [cobros, liquidaciones, mesActual]);
  if (data.length === 0) return null;

  return (
    <Card className="p-4 mb-5">
      <h2 className="text-sm font-semibold mb-3">Cobrado vs. liquidado por mes</h2>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ left: 8, right: 8 }} barGap={2}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: INK_MUTED }}
            tickLine={false}
            axisLine={{ stroke: GRID }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: INK_MUTED }}
            tickLine={false}
            axisLine={false}
            tickFormatter={plataCorta}
          />
          <Tooltip
            cursor={{ fill: "rgba(24,24,27,0.04)" }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as {
                cobrado: number;
                nCobrado: number;
                liquidado: number;
                nLiquidado: number;
              };
              return (
                <div className="bg-surface border border-border rounded-md shadow-overlay px-3 py-2 text-sm">
                  <p className="font-medium mb-0.5">{label}</p>
                  <p className="text-muted">
                    Cobrado: {pesos(p.cobrado)} · {p.nCobrado}{" "}
                    {p.nCobrado === 1 ? "gestión" : "gestiones"}
                  </p>
                  <p className="text-muted">
                    Liquidado: {pesos(p.liquidado)} · {p.nLiquidado}{" "}
                    {p.nLiquidado === 1 ? "gestión" : "gestiones"}
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="cobrado" fill={BRAND} radius={[3, 3, 0, 0]} maxBarSize={22} />
          <Bar dataKey="liquidado" fill={AMBAR} radius={[3, 3, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap items-center gap-4 mt-2 text-[12px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: BRAND }} />
          Cobrado (entra)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: AMBAR }} />
          Liquidado a técnicos (sale)
        </span>
      </div>
    </Card>
  );
}

// ── Encabezado de una sección con su total ────────────────────────────────
function EncabezadoGrupo({
  titulo,
  cantidad,
  total,
}: {
  titulo: string;
  cantidad: number;
  total: number;
}) {
  return (
    <div className="flex items-baseline justify-between mb-2 mt-6">
      <h2 className="text-sm font-semibold text-foreground">
        {titulo}{" "}
        <span className="text-muted font-normal">
          · {cantidad} {cantidad === 1 ? "gestión" : "gestiones"}
        </span>
      </h2>
      <span className="text-sm font-semibold tabular-nums">{pesos(total)}</span>
    </div>
  );
}

// ── Gráfico de barras mensual del tab (patrón Informes) ───────────────────
// Solo se muestra con búsqueda activa (v1.1): grafica lo buscado por mes —
// p. ej. cuánto se le liquidó a un técnico. Sin búsqueda duplicaría media
// serie del combinado de arriba. Con menos de dos meses con datos no se
// dibuja (una barra sola no es una serie).
function GraficoMensual<T extends { fecha: string; monto: number }>({
  titulo,
  grupos,
  mesActual,
}: {
  titulo: string;
  grupos: Grupo<T>[];
  mesActual: string;
}) {
  const data = useMemo(() => {
    if (grupos.length < 2) return [];
    const porClave = new Map(grupos.map((g) => [g.clave, g]));
    const desde = grupos[grupos.length - 1].clave;
    return rangoMeses(desde, mesActual)
      .slice(-MAX_MESES_GRAFICO)
      .map((k) => ({
        label: mesCorto(k),
        total: porClave.get(k)?.total ?? 0,
        n: porClave.get(k)?.filas.length ?? 0,
      }));
  }, [grupos, mesActual]);
  if (data.length === 0) return null;

  return (
    <Card className="p-4 mt-6">
      <h2 className="text-sm font-semibold mb-3">{titulo}</h2>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ left: 8, right: 8 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: INK_MUTED }}
            tickLine={false}
            axisLine={{ stroke: GRID }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: INK_MUTED }}
            tickLine={false}
            axisLine={false}
            tickFormatter={plataCorta}
          />
          <Tooltip
            cursor={{ fill: "rgba(24,24,27,0.04)" }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as { total: number; n: number };
              return (
                <div className="bg-surface border border-border rounded-md shadow-overlay px-3 py-2 text-sm">
                  <p className="font-medium mb-0.5">{label}</p>
                  <p className="text-muted">
                    {pesos(p.total)} · {p.n} {p.n === 1 ? "gestión" : "gestiones"}
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="total" fill={BRAND} radius={[3, 3, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

// ── Grupo de mes colapsable ────────────────────────────────────────────────
function GrupoMes({
  titulo,
  cantidad,
  total,
  abierto,
  forzado,
  onToggle,
  children,
}: {
  titulo: string;
  cantidad: number;
  total: number;
  abierto: boolean;
  forzado: boolean; // búsqueda activa: queda abierto (los resultados no se esconden)
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={forzado ? undefined : onToggle}
        className={`w-full flex items-baseline justify-between gap-4 mb-2 mt-6 group ${
          forzado ? "cursor-default" : ""
        }`}
      >
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          {!forzado && (
            <span
              className={`text-muted transition-transform ${abierto ? "rotate-90" : ""}`}
            >
              <Icono id="chevron" size={14} />
            </span>
          )}
          {titulo}{" "}
          <span className="text-muted font-normal">
            · {cantidad} {cantidad === 1 ? "gestión" : "gestiones"}
          </span>
        </h2>
        <span className="text-sm font-semibold tabular-nums">{pesos(total)}</span>
      </button>
      {abierto && <Card>{children}</Card>}
    </div>
  );
}

// ── Fila genérica (link a la gestión) ─────────────────────────────────────
function FilaGestion({
  id,
  titulo,
  subtitulo,
  monto,
  meta,
  alerta,
}: {
  id: string;
  titulo: string;
  subtitulo: string;
  monto: number;
  meta?: string;
  alerta?: boolean;
}) {
  return (
    <Link
      href={`/gestiones/${id}`}
      className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border last:border-b-0 hover:bg-surface-2 transition-colors"
    >
      <div className="min-w-0">
        <p className="text-[15px] font-medium truncate">{titulo}</p>
        <p className="text-[13px] text-muted truncate">{subtitulo}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[15px] font-semibold tabular-nums">{pesos(monto)}</p>
        {meta && (
          <p
            className={`text-[13px] ${
              alerta ? "text-urgente font-medium" : "text-muted"
            }`}
          >
            {meta}
          </p>
        )}
      </div>
    </Link>
  );
}

function Vacio({ texto }: { texto: string }) {
  return <p className="text-sm text-muted px-4 py-6 text-center">{texto}</p>;
}

// Grupos de meses colapsables: solo el más reciente arranca abierto; con
// búsqueda activa se muestran todos abiertos (forzados).
function GruposCerrados<T extends { fecha: string; monto: number; id: string }>({
  grupos,
  hayBusqueda,
  fila,
}: {
  grupos: Grupo<T>[];
  hayBusqueda: boolean;
  fila: (f: T) => React.ReactNode;
}) {
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});
  return (
    <>
      {grupos.map((g, i) => (
        <GrupoMes
          key={g.clave}
          titulo={g.label}
          cantidad={g.filas.length}
          total={g.total}
          abierto={hayBusqueda || (abiertos[g.clave] ?? i === 0)}
          forzado={hayBusqueda}
          onToggle={() =>
            setAbiertos((s) => ({ ...s, [g.clave]: !(s[g.clave] ?? i === 0) }))
          }
        >
          {g.filas.map(fila)}
        </GrupoMes>
      ))}
    </>
  );
}

// Pendientes: la más vieja primero (qué cobrar/liquidar primero — mismo
// criterio que Informes).
function porAntiguedad<T extends { diasPendiente: number | null }>(filas: T[]): T[] {
  return [...filas].sort(
    (a, b) => (b.diasPendiente ?? -1) - (a.diasPendiente ?? -1)
  );
}

// ── Pestaña COBROS ────────────────────────────────────────────────────────
function TabCobros({
  cobros,
  busqueda,
  mesActual,
}: {
  cobros: CobrosData;
  busqueda: string;
  mesActual: string;
}) {
  const pendientes = useMemo(
    () =>
      porAntiguedad(
        cobros.pendientes.filter((f) =>
          coincide(busqueda, [f.descripcion, f.direccion, f.pagadorNombre, f.pagadorRotulo])
        )
      ),
    [cobros.pendientes, busqueda]
  );
  const cerrados = useMemo(
    () =>
      cobros.cerrados.filter((f) =>
        coincide(busqueda, [
          f.descripcion,
          f.direccion,
          f.pagadorNombre,
          f.pagadorRotulo,
          f.medioLabel,
        ])
      ),
    [cobros.cerrados, busqueda]
  );
  const grupos = useMemo(() => agruparPorMes(cerrados), [cerrados]);
  const totalPend = sumar(pendientes, (f) => f.total);
  const hayBusqueda = busqueda.trim() !== "";

  return (
    <>
      <EncabezadoGrupo
        titulo="Por cobrar"
        cantidad={pendientes.length}
        total={totalPend}
      />
      <Card>
        {pendientes.length === 0 ? (
          <Vacio
            texto={
              hayBusqueda
                ? "Ningún cobro pendiente coincide con la búsqueda."
                : "No hay cobros pendientes."
            }
          />
        ) : (
          pendientes.map((f) => (
            <FilaGestion
              key={f.id}
              id={f.id}
              titulo={f.descripcion}
              subtitulo={`${f.direccion} · ${f.pagadorRotulo}: ${f.pagadorNombre}`}
              monto={f.total}
              meta={antiguedadLegible(f.diasPendiente)}
              alerta={f.diasPendiente != null && f.diasPendiente >= DIAS_ALERTA}
            />
          ))
        )}
      </Card>

      {hayBusqueda && (
        <GraficoMensual titulo="Cobrado por mes" grupos={grupos} mesActual={mesActual} />
      )}

      {grupos.length === 0 ? (
        <>
          <EncabezadoGrupo titulo="Cobrados" cantidad={0} total={0} />
          <Card>
            <Vacio
              texto={
                hayBusqueda
                  ? "Ningún cobro cerrado coincide con la búsqueda."
                  : "Todavía no hay cobros registrados."
              }
            />
          </Card>
        </>
      ) : (
        <GruposCerrados
          grupos={grupos}
          hayBusqueda={hayBusqueda}
          fila={(f) => (
            <FilaGestion
              key={f.id}
              id={f.id}
              titulo={f.descripcion}
              subtitulo={`${f.direccion} · ${f.pagadorRotulo}: ${f.pagadorNombre}`}
              monto={f.monto}
              meta={f.medioLabel}
            />
          )}
        />
      )}
    </>
  );
}

// ── Pestaña LIQUIDACIONES ─────────────────────────────────────────────────
function TabLiquidaciones({
  liquidaciones,
  busqueda,
  mesActual,
}: {
  liquidaciones: LiquidacionesData;
  busqueda: string;
  mesActual: string;
}) {
  const pendientes = useMemo(
    () =>
      porAntiguedad(
        liquidaciones.pendientes.filter((f) =>
          coincide(busqueda, [f.descripcion, f.direccion, f.tecnicoNombre])
        )
      ),
    [liquidaciones.pendientes, busqueda]
  );
  const cerrados = useMemo(
    () =>
      liquidaciones.cerrados.filter((f) =>
        coincide(busqueda, [f.descripcion, f.direccion, f.tecnicoNombre, f.medioLabel])
      ),
    [liquidaciones.cerrados, busqueda]
  );
  const grupos = useMemo(() => agruparPorMes(cerrados), [cerrados]);
  const totalPend = sumar(pendientes, (f) => f.monto);
  const hayBusqueda = busqueda.trim() !== "";

  return (
    <>
      <EncabezadoGrupo
        titulo="Por liquidar"
        cantidad={pendientes.length}
        total={totalPend}
      />
      <Card>
        {pendientes.length === 0 ? (
          <Vacio
            texto={
              hayBusqueda
                ? "Ninguna liquidación pendiente coincide con la búsqueda."
                : "No hay liquidaciones pendientes."
            }
          />
        ) : (
          pendientes.map((f) => (
            <FilaGestion
              key={f.id}
              id={f.id}
              titulo={f.descripcion}
              subtitulo={`${f.direccion} · Técnico: ${f.tecnicoNombre}`}
              monto={f.monto}
              meta={antiguedadLegible(f.diasPendiente)}
              alerta={f.diasPendiente != null && f.diasPendiente >= DIAS_ALERTA}
            />
          ))
        )}
      </Card>

      {hayBusqueda && (
        <GraficoMensual
          titulo="Liquidado por mes"
          grupos={grupos}
          mesActual={mesActual}
        />
      )}

      {grupos.length === 0 ? (
        <>
          <EncabezadoGrupo titulo="Liquidadas" cantidad={0} total={0} />
          <Card>
            <Vacio
              texto={
                hayBusqueda
                  ? "Ninguna liquidación cerrada coincide con la búsqueda."
                  : "Todavía no hay liquidaciones registradas."
              }
            />
          </Card>
        </>
      ) : (
        <GruposCerrados
          grupos={grupos}
          hayBusqueda={hayBusqueda}
          fila={(f) => (
            <FilaGestion
              key={f.id}
              id={f.id}
              titulo={f.descripcion}
              subtitulo={`${f.direccion} · Técnico: ${f.tecnicoNombre}`}
              monto={f.monto}
              meta={f.medioLabel}
            />
          )}
        />
      )}
    </>
  );
}
