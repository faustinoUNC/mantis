"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
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

// STORY-982 v1.2 — Finanzas de un vistazo: stat cards de resumen, tarjetas
// en grilla en vez de filas (cada gestión es un objeto visual: monto grande,
// antigüedad como badge, dirección y persona) y meses cerrados colapsables
// (solo el más reciente abierto). Sin gráficos: eso vive en Informes.
// El server layer no cambia.

type Tab = "cobros" | "liquidaciones";

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

export function Finanzas({
  cobros,
  liquidaciones,
}: {
  cobros: CobrosData;
  liquidaciones: LiquidacionesData;
}) {
  const [tab, setTab] = useState<Tab>("cobros");
  const [busqueda, setBusqueda] = useState("");
  // Congelado al montar: define el "mes en curso" de las cards de resumen.
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

  return (
    <div className="animate-aparecer">
      <p className="text-[13px] font-medium text-muted">Finanzas</p>
      <h1 className="text-2xl font-semibold tracking-tight mt-0.5 mb-1">
        Cobros y liquidaciones
      </h1>
      <p className="text-sm text-muted mb-4">
        La plata pendiente y la cerrada, en un solo lugar. Tocá una tarjeta
        para ir a la gestión.
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
        <TabCobros cobros={cobros} busqueda={busqueda} />
      </div>
      <div className={tab === "liquidaciones" ? "" : "hidden"}>
        <TabLiquidaciones liquidaciones={liquidaciones} busqueda={busqueda} />
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

// ── Tarjetas (v1.2: cada gestión es un objeto visual, no una fila) ────────
function Grilla({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {children}
    </div>
  );
}

// Tarjeta de una gestión: el monto manda (es Finanzas), la antigüedad es un
// badge (ámbar si está demorada) o el medio de pago si ya cerró, y abajo la
// dirección y quién paga / quién ejecuta.
function TarjetaGestion({
  id,
  monto,
  descripcion,
  direccion,
  persona,
  antiguedad,
  alerta,
  medio,
}: {
  id: string;
  monto: number;
  descripcion: string;
  direccion: string;
  persona: string;
  antiguedad?: string; // pendientes
  alerta?: boolean;
  medio?: string; // cerradas
}) {
  return (
    <Link href={`/gestiones/${id}`} className="block">
      <Card className="p-4 h-full transition-colors hover:border-brand">
        <div className="flex items-start justify-between gap-3">
          <p className="text-lg font-semibold tabular-nums tracking-tight">
            {pesos(monto)}
          </p>
          {antiguedad && (
            <Badge tono={alerta ? "urgente" : "neutro"} className="text-[12px] shrink-0">
              {antiguedad}
            </Badge>
          )}
          {medio && (
            <span className="text-[12px] text-muted shrink-0 mt-1">{medio}</span>
          )}
        </div>
        <p className="text-sm font-medium mt-2 line-clamp-2">{descripcion}</p>
        <div className="mt-3 space-y-1">
          <p className="text-[13px] text-muted flex items-center gap-1.5 min-w-0">
            <Icono id="pin" size={13} />
            <span className="truncate">{direccion}</span>
          </p>
          <p className="text-[13px] text-muted flex items-center gap-1.5 min-w-0">
            <Icono id="perfil" size={13} />
            <span className="truncate">{persona}</span>
          </p>
        </div>
      </Card>
    </Link>
  );
}

function Vacio({ texto }: { texto: string }) {
  return (
    <Card>
      <p className="text-sm text-muted px-4 py-6 text-center">{texto}</p>
    </Card>
  );
}

// ── Histórico mensual: UN mes por vez (v1.4) ──────────────────────────────
// El histórico crece para siempre; en pantalla hay siempre un solo mes, con
// flechas para el mes vecino y un selector para saltar lejos — la vista no
// se alarga aunque el sistema se use años. Solo se listan meses con
// movimientos. Con búsqueda activa se muestran todos los meses con
// coincidencias (el largo lo acota la búsqueda, no el tiempo).
function HistorialMensual<T extends { fecha: string; monto: number; id: string }>({
  titulo,
  grupos,
  hayBusqueda,
  tarjeta,
}: {
  titulo: string;
  grupos: Grupo<T>[];
  hayBusqueda: boolean;
  tarjeta: (f: T) => React.ReactNode;
}) {
  const [idx, setIdx] = useState(0); // 0 = mes más reciente
  if (hayBusqueda) {
    return (
      <>
        {grupos.map((g) => (
          <div key={g.clave}>
            <EncabezadoGrupo
              titulo={g.label}
              cantidad={g.filas.length}
              total={g.total}
            />
            <Grilla>{g.filas.map(tarjeta)}</Grilla>
          </div>
        ))}
      </>
    );
  }

  const i = Math.min(idx, grupos.length - 1);
  const g = grupos[i];
  const botonMes =
    "p-1.5 rounded-md border border-border bg-surface text-muted hover:text-foreground hover:border-border-strong disabled:opacity-40 transition-colors";
  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-semibold">{titulo}</h2>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className={botonMes}
              disabled={i >= grupos.length - 1}
              onClick={() => setIdx(i + 1)}
              aria-label="Mes anterior"
            >
              <span className="block rotate-180">
                <Icono id="chevron" size={14} />
              </span>
            </button>
            <select
              value={g.clave}
              onChange={(e) =>
                setIdx(grupos.findIndex((x) => x.clave === e.target.value))
              }
              className="text-sm font-medium bg-surface border border-border rounded-md px-2 py-1.5"
              aria-label="Elegir mes"
            >
              {grupos.map((x) => (
                <option key={x.clave} value={x.clave}>
                  {x.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={botonMes}
              disabled={i <= 0}
              onClick={() => setIdx(i - 1)}
              aria-label="Mes siguiente"
            >
              <Icono id="chevron" size={14} />
            </button>
          </div>
        </div>
        <span className="text-sm">
          <span className="text-muted">
            {g.filas.length} {g.filas.length === 1 ? "gestión" : "gestiones"} ·{" "}
          </span>
          <span className="font-semibold tabular-nums">{pesos(g.total)}</span>
        </span>
      </div>
      <Grilla>{g.filas.map(tarjeta)}</Grilla>
    </div>
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
}: {
  cobros: CobrosData;
  busqueda: string;
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
      {pendientes.length === 0 ? (
        <Vacio
          texto={
            hayBusqueda
              ? "Ningún cobro pendiente coincide con la búsqueda."
              : "No hay cobros pendientes."
          }
        />
      ) : (
        <Grilla>
          {pendientes.map((f) => (
            <TarjetaGestion
              key={f.id}
              id={f.id}
              monto={f.total}
              descripcion={f.descripcion}
              direccion={f.direccion}
              persona={`${f.pagadorRotulo}: ${f.pagadorNombre}`}
              antiguedad={antiguedadLegible(f.diasPendiente)}
              alerta={f.diasPendiente != null && f.diasPendiente >= DIAS_ALERTA}
            />
          ))}
        </Grilla>
      )}

      {grupos.length === 0 ? (
        <>
          <EncabezadoGrupo titulo="Cobrados" cantidad={0} total={0} />
          <Vacio
            texto={
              hayBusqueda
                ? "Ningún cobro cerrado coincide con la búsqueda."
                : "Todavía no hay cobros registrados."
            }
          />
        </>
      ) : (
        <HistorialMensual
          titulo="Cobrados"
          grupos={grupos}
          hayBusqueda={hayBusqueda}
          tarjeta={(f) => (
            <TarjetaGestion
              key={f.id}
              id={f.id}
              monto={f.monto}
              descripcion={f.descripcion}
              direccion={f.direccion}
              persona={`${f.pagadorRotulo}: ${f.pagadorNombre}`}
              medio={f.medioLabel}
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
}: {
  liquidaciones: LiquidacionesData;
  busqueda: string;
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
      {pendientes.length === 0 ? (
        <Vacio
          texto={
            hayBusqueda
              ? "Ninguna liquidación pendiente coincide con la búsqueda."
              : "No hay liquidaciones pendientes."
          }
        />
      ) : (
        <Grilla>
          {pendientes.map((f) => (
            <TarjetaGestion
              key={f.id}
              id={f.id}
              monto={f.monto}
              descripcion={f.descripcion}
              direccion={f.direccion}
              persona={`Técnico: ${f.tecnicoNombre}`}
              antiguedad={antiguedadLegible(f.diasPendiente)}
              alerta={f.diasPendiente != null && f.diasPendiente >= DIAS_ALERTA}
            />
          ))}
        </Grilla>
      )}

      {grupos.length === 0 ? (
        <>
          <EncabezadoGrupo titulo="Liquidadas" cantidad={0} total={0} />
          <Vacio
            texto={
              hayBusqueda
                ? "Ninguna liquidación cerrada coincide con la búsqueda."
                : "Todavía no hay liquidaciones registradas."
            }
          />
        </>
      ) : (
        <HistorialMensual
          titulo="Liquidadas"
          grupos={grupos}
          hayBusqueda={hayBusqueda}
          tarjeta={(f) => (
            <TarjetaGestion
              key={f.id}
              id={f.id}
              monto={f.monto}
              descripcion={f.descripcion}
              direccion={f.direccion}
              persona={`Técnico: ${f.tecnicoNombre}`}
              medio={f.medioLabel}
            />
          )}
        />
      )}
    </>
  );
}
