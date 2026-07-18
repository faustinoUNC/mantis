"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icono } from "@/components/ui/iconos";
import { Select } from "@/components/ui/select";
import { FiltrosLista } from "@/components/ui/filtros-lista.client";
import { coincideCampo, type CampoBusqueda } from "@/shared/utils/filtros";
import {
  DIAS_ALERTA,
  antiguedadLegible,
  claveMes,
  mesLabel,
  pesos,
  type CobrosData,
  type FilaCobroCerrado,
  type FilaCobroPendiente,
  type FilaLiquidacionCerrada,
  type FilaLiquidacionPendiente,
  type LiquidacionesData,
} from "@/features/finanzas/consultas-types";

// STORY-982 — Finanzas de un vistazo: stat cards de resumen con tooltips,
// tarjetas en grilla en vez de filas (v1.2/v1.5: monto grande, dirección
// principal y descripción secundaria como en tablero/archivo), histórico de
// UN mes por vez (v1.4, no crece con los años) y buscador con "Buscar por"
// + orden de pendientes (v1.5, patrón STORY-927). Sin gráficos: eso vive en
// Informes. El server layer no cambia.

type Tab = "cobros" | "liquidaciones";
type OrdenPendientes = "antiguedad" | "monto";

// "Buscar por" (patrón STORY-927, mismo criterio que el tablero). El medio de
// pago solo existe en cerradas: con ese campo elegido, ningún pendiente pasa.
type FilaCobro = FilaCobroPendiente | FilaCobroCerrado;
type FilaLiquidacion = FilaLiquidacionPendiente | FilaLiquidacionCerrada;
const CAMPOS_COBROS: CampoBusqueda<FilaCobro>[] = [
  { id: "direccion", label: "Dirección", de: (f) => [f.direccion] },
  { id: "descripcion", label: "Descripción", de: (f) => [f.descripcion] },
  { id: "pagador", label: "Pagador", de: (f) => [f.pagadorNombre, f.pagadorRotulo] },
  { id: "medio", label: "Medio de pago", de: (f) => ["medioLabel" in f ? f.medioLabel : null] },
];
const CAMPOS_LIQUIDACIONES: CampoBusqueda<FilaLiquidacion>[] = [
  { id: "direccion", label: "Dirección", de: (f) => [f.direccion] },
  { id: "descripcion", label: "Descripción", de: (f) => [f.descripcion] },
  { id: "tecnico", label: "Técnico", de: (f) => [f.tecnicoNombre] },
  { id: "medio", label: "Medio de pago", de: (f) => ["medioLabel" in f ? f.medioLabel : null] },
];

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
  const [campo, setCampo] = useState("todo");
  const [orden, setOrden] = useState<OrdenPendientes>("antiguedad");
  // Al cambiar de pestaña el campo elegido puede no existir (Pagador/Técnico).
  const irATab = (t: Tab) => {
    setTab(t);
    setCampo("todo");
  };
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
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Finanzas</h1>
        <p className="text-sm text-muted mt-1">
          Lo que falta cobrar y lo que ya se cerró, en un solo lugar.
        </p>
      </div>

      {/* Resumen de un vistazo — tocar una card lleva a su pestaña */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard
          label="Por cobrar"
          hint="Trabajos terminados (o cancelaciones con cargo) esperando el pago del cliente. Se puede cobrar hoy."
          monto={resumen.porCobrar}
          cantidad={resumen.nCobrar}
          demoradas={resumen.cobrarDemoradas}
          onClick={() => irATab("cobros")}
        />
        <StatCard
          label="Por liquidar"
          hint="Cobros que ya entraron y falta pagarle al técnico. Descuenta los adelantos de materiales ya entregados."
          monto={resumen.porLiquidar}
          cantidad={resumen.nLiquidar}
          demoradas={resumen.liquidarDemoradas}
          onClick={() => irATab("liquidaciones")}
        />
        <StatCard
          label={`Cobrado en ${nombreMes}`}
          hint="La plata que entró este mes."
          monto={resumen.cobradoMes}
          cantidad={resumen.nCobradoMes}
          onClick={() => irATab("cobros")}
        />
        <StatCard
          label={`Liquidado en ${nombreMes}`}
          hint="La plata pagada a los técnicos este mes."
          monto={resumen.liquidadoMes}
          cantidad={resumen.nLiquidadoMes}
          onClick={() => irATab("liquidaciones")}
        />
      </div>

      {/* Segmentado idéntico al de Auditoría */}
      <div className="flex rounded-md border border-border overflow-hidden w-fit mb-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => irATab(t.id)}
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
        campos={tab === "cobros" ? CAMPOS_COBROS : CAMPOS_LIQUIDACIONES}
        campo={campo}
        onCampo={setCampo}
        extra={
          <div className="w-52">
            <Select
              label="Orden de pendientes"
              value={orden}
              onChange={(e) => setOrden(e.target.value as OrdenPendientes)}
            >
              <option value="antiguedad">Más antiguas primero</option>
              <option value="monto">Mayor monto primero</option>
            </Select>
          </div>
        }
      />

      <div className={tab === "cobros" ? "" : "hidden"}>
        <TabCobros cobros={cobros} busqueda={busqueda} campo={campo} orden={orden} />
      </div>
      <div className={tab === "liquidaciones" ? "" : "hidden"}>
        <TabLiquidaciones
          liquidaciones={liquidaciones}
          busqueda={busqueda}
          campo={campo}
          orden={orden}
        />
      </div>
    </div>
  );
}

// ── Card de resumen ────────────────────────────────────────────────────────
function StatCard({
  label,
  hint,
  monto,
  cantidad,
  demoradas = 0,
  onClick,
}: {
  label: string;
  hint: string; // tooltip ⓘ — mismo patrón que los tiles del Inicio
  monto: number;
  cantidad: number;
  demoradas?: number;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card className="p-4 h-full transition-colors hover:border-brand">
        <p className="text-[12px] font-medium text-muted flex items-center">
          {label}
          <span className="relative group/tip ml-1 inline-flex">
            <span className="text-muted/50 cursor-help">ⓘ</span>
            <span className="pointer-events-none absolute left-1/2 bottom-full z-20 mb-1.5 hidden group-hover/tip:block w-max max-w-[220px] -translate-x-1/2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[12px] font-normal leading-snug text-foreground shadow-overlay">
              {hint}
            </span>
          </span>
        </p>
        <p className="text-xl font-semibold tabular-nums font-mono tracking-tight mt-1">
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
      <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
        {titulo}{" "}
        <span className="text-muted font-normal">
          · {cantidad} {cantidad === 1 ? "gestión" : "gestiones"}
        </span>
      </h2>
      <span className="text-sm font-semibold tabular-nums font-mono">{pesos(total)}</span>
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
// badge (ámbar si está demorada) o el medio de pago si ya cerró; después la
// dirección como principal y la descripción más chica — mismo orden que las
// cards del tablero y del archivo (consistencia, v1.5).
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
    <Link href={`/gestiones/${id}`} className="group block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
      <Card className="p-4 h-full transition-colors hover:border-brand group-focus-visible:border-brand">
        <div className="flex items-start justify-between gap-3">
          <p className="text-lg font-semibold tabular-nums font-mono tracking-tight">
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
        <p className="text-sm font-medium leading-snug truncate mt-2 group-hover:text-brand-active transition-colors">
          {direccion}
        </p>
        <p className="text-[12px] text-muted mt-1 line-clamp-2">{descripcion}</p>
        <p className="text-[12px] text-muted mt-2">{persona}</p>
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
          <h2 className="text-[15px] font-semibold tracking-tight">{titulo}</h2>
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
          <span className="font-semibold tabular-nums font-mono">{pesos(g.total)}</span>
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

// Pendientes: por antigüedad (la más vieja primero) o por monto, según el
// selector de orden.
function ordenarPendientes<T extends { diasPendiente: number | null }>(
  filas: T[],
  orden: OrdenPendientes,
  monto: (f: T) => number
): T[] {
  return orden === "monto"
    ? [...filas].sort((a, b) => monto(b) - monto(a))
    : porAntiguedad(filas);
}

// ── Pestaña COBROS ────────────────────────────────────────────────────────
function TabCobros({
  cobros,
  busqueda,
  campo,
  orden,
}: {
  cobros: CobrosData;
  busqueda: string;
  campo: string;
  orden: OrdenPendientes;
}) {
  const pendientes = useMemo(
    () =>
      ordenarPendientes(
        cobros.pendientes.filter((f) =>
          coincideCampo(busqueda, campo, CAMPOS_COBROS, f)
        ),
        orden,
        (f) => f.total
      ),
    [cobros.pendientes, busqueda, campo, orden]
  );
  const cerrados = useMemo(
    () =>
      cobros.cerrados.filter((f) => coincideCampo(busqueda, campo, CAMPOS_COBROS, f)),
    [cobros.cerrados, busqueda, campo]
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
  campo,
  orden,
}: {
  liquidaciones: LiquidacionesData;
  busqueda: string;
  campo: string;
  orden: OrdenPendientes;
}) {
  const pendientes = useMemo(
    () =>
      ordenarPendientes(
        liquidaciones.pendientes.filter((f) =>
          coincideCampo(busqueda, campo, CAMPOS_LIQUIDACIONES, f)
        ),
        orden,
        (f) => f.monto
      ),
    [liquidaciones.pendientes, busqueda, campo, orden]
  );
  const cerrados = useMemo(
    () =>
      liquidaciones.cerrados.filter((f) =>
        coincideCampo(busqueda, campo, CAMPOS_LIQUIDACIONES, f)
      ),
    [liquidaciones.cerrados, busqueda, campo]
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
