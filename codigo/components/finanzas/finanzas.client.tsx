"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
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

type Tab = "cobros" | "liquidaciones";

// Suma de un campo numérico de una lista de filas.
function sumar<T>(filas: T[], campo: (f: T) => number): number {
  return filas.reduce((acc, f) => acc + campo(f), 0);
}

// Agrupa filas cerradas por mes (clave AAAA-MM), preservando el orden de
// entrada (ya vienen del server ordenadas por fecha desc = mes reciente 1º).
function agruparPorMes<T extends { fecha: string; monto: number }>(
  filas: T[]
): { clave: string; label: string; total: number; filas: T[] }[] {
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
  const TABS: { id: Tab; label: string }[] = [
    { id: "cobros", label: "Cobros" },
    { id: "liquidaciones", label: "Liquidaciones" },
  ];

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
      cobros.pendientes.filter((f) =>
        coincide(busqueda, [f.descripcion, f.direccion, f.pagadorNombre, f.pagadorRotulo])
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
  const grupos = agruparPorMes(cerrados);
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
        grupos.map((g) => (
          <div key={g.clave}>
            <EncabezadoGrupo
              titulo={`Cobrados · ${g.label}`}
              cantidad={g.filas.length}
              total={g.total}
            />
            <Card>
              {g.filas.map((f) => (
                <FilaGestion
                  key={f.id}
                  id={f.id}
                  titulo={f.descripcion}
                  subtitulo={`${f.direccion} · ${f.pagadorRotulo}: ${f.pagadorNombre}`}
                  monto={f.monto}
                  meta={f.medioLabel}
                />
              ))}
            </Card>
          </div>
        ))
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
      liquidaciones.pendientes.filter((f) =>
        coincide(busqueda, [f.descripcion, f.direccion, f.tecnicoNombre])
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
  const grupos = agruparPorMes(cerrados);
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
        grupos.map((g) => (
          <div key={g.clave}>
            <EncabezadoGrupo
              titulo={`Liquidadas · ${g.label}`}
              cantidad={g.filas.length}
              total={g.total}
            />
            <Card>
              {g.filas.map((f) => (
                <FilaGestion
                  key={f.id}
                  id={f.id}
                  titulo={f.descripcion}
                  subtitulo={`${f.direccion} · Técnico: ${f.tecnicoNombre}`}
                  monto={f.monto}
                  meta={f.medioLabel}
                />
              ))}
            </Card>
          </div>
        ))
      )}
    </>
  );
}
