"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { FiltrosLista } from "@/components/ui/filtros-lista.client";
import { Icono } from "@/components/ui/iconos";
import { Input } from "@/components/ui/input";
import { Paginador } from "@/components/ui/paginador.client";
import { Select } from "@/components/ui/select";
import {
  LABEL_EVENTO_SISTEMA,
  detalleSistemaLegible,
} from "@/features/auditoria/eventos-sistema";
import { historialGlobal, historialSistema } from "@/features/auditoria/service";
import {
  AUDITORIA_POR_PAGINA,
  type ActorAuditoria,
  type PaginaAuditoria,
  type PaginaSistema,
} from "@/features/auditoria/types";
import { NOMBRE_ROL } from "@/features/auth/types";
import {
  LABEL_EVENTO,
  detalleLegible,
  etiquetaEtapa,
} from "@/features/gestiones/eventos";

// Formato manual determinístico (doctrina STORY-973): toLocaleString difiere
// entre Node y el navegador → error de hidratación.
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function diaLegible(f: string) {
  const d = new Date(f);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const aa = String(d.getFullYear() % 100).padStart(2, "0");
  return `${DIAS[d.getDay()]} ${dd}/${mm}/${aa}`;
}

function hora(f: string) {
  const d = new Date(f);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

type Tab = "gestiones" | "sistema";

// STORY-980: dos logs con columnas distintas no se mezclan en una tabla —
// tab Gestiones (eventos_gestion, intacto) y tab Sistema (eventos_sistema:
// ABM de empleados y técnicos). Ambos quedan montados: cambiar de tab no
// pierde filtros ni página.
export function Auditoria({
  inicial,
  inicialSistema,
  actores,
  tabInicial,
}: {
  inicial: PaginaAuditoria;
  inicialSistema: PaginaSistema;
  actores: ActorAuditoria[];
  tabInicial: Tab;
}) {
  const [tab, setTab] = useState<Tab>(tabInicial);
  const TABS: { id: Tab; label: string }[] = [
    { id: "gestiones", label: "Gestiones" },
    { id: "sistema", label: "Sistema" },
  ];

  return (
    <div className="animate-aparecer">
      <p className="text-[13px] font-medium text-muted">Trazabilidad</p>
      <h1 className="text-2xl font-semibold tracking-tight mt-0.5 mb-1">
        Auditoría
      </h1>
      <p className="text-sm text-muted mb-4">
        Quién hizo qué y cuándo — los timestamps del event log sirven como
        evidencia de plazos.
      </p>

      {/* Mismo segmentado que el selector de período de Informes */}
      <div className="flex rounded-md border border-border overflow-hidden w-fit mb-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`text-sm px-3.5 py-1.5 transition-colors ${tab === t.id ? "bg-brand text-white" : "bg-surface text-muted hover:text-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={tab === "gestiones" ? "" : "hidden"}>
        <TabGestiones inicial={inicial} actores={actores} />
      </div>
      <div className={tab === "sistema" ? "" : "hidden"}>
        <TabSistema inicial={inicialSistema} actores={actores} />
      </div>
    </div>
  );
}

function TabGestiones({
  inicial,
  actores,
}: {
  inicial: PaginaAuditoria;
  actores: ActorAuditoria[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const [actorId, setActorId] = useState("");
  const [tipo, setTipo] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState(inicial);
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  // `pedido` descarta respuestas viejas que lleguen tarde.
  const primera = useRef(true);
  const pedido = useRef(0);
  const cargar = useCallback(() => {
    const id = ++pedido.current;
    startTransition(async () => {
      const res = await historialGlobal({
        busqueda: busqueda || undefined,
        actorId: actorId || undefined,
        tipo: tipo || undefined,
        desde: desde || undefined,
        hasta: hasta || undefined,
        pagina,
      });
      if (id === pedido.current) setDatos(res);
    });
  }, [busqueda, actorId, tipo, desde, hasta, pagina]);

  // La primera página ya viene renderizada del server; el efecto solo corre
  // ante cambios de filtros/página, con debounce para el tipeo.
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    const t = setTimeout(cargar, 300);
    return () => clearTimeout(t);
  }, [cargar]);

  // Cambiar un filtro vuelve a página 1 (mismo render: React batchea).
  const filtrar = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPagina(1);
  };

  const totalPaginas = Math.max(1, Math.ceil(datos.total / AUDITORIA_POR_PAGINA));
  const desdeFila = datos.total === 0 ? 0 : (pagina - 1) * AUDITORIA_POR_PAGINA + 1;
  const hastaFila = Math.min(pagina * AUDITORIA_POR_PAGINA, datos.total);

  return (
    <>
      <FiltrosLista
        consulta={busqueda}
        onConsulta={filtrar(setBusqueda)}
        placeholder="Dirección o descripción…"
        extra={
          <>
            <div className="w-56">
              <Select
                label="Persona"
                value={actorId}
                onChange={(e) => filtrar(setActorId)(e.target.value)}
              >
                <option value="">Todas</option>
                {actores.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre} — {NOMBRE_ROL[a.rol]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-56">
              <Select
                label="Tipo de evento"
                value={tipo}
                onChange={(e) => filtrar(setTipo)(e.target.value)}
              >
                <option value="">Todos</option>
                {Object.entries(LABEL_EVENTO).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-38">
              <Input
                label="Desde"
                type="date"
                value={desde}
                onChange={(e) => filtrar(setDesde)(e.target.value)}
              />
            </div>
            <div className="w-38">
              <Input
                label="Hasta"
                type="date"
                value={hasta}
                onChange={(e) => filtrar(setHasta)(e.target.value)}
              />
            </div>
          </>
        }
      />

      <ContadorConActualizar total={datos.total} pendiente={pendiente} onActualizar={cargar} />

      <Card className={`overflow-x-auto transition-opacity ${pendiente ? "opacity-60" : ""}`}>
        <table className="w-full text-[15px]">
          <thead>
            <tr className="border-b border-border text-left">
              {["Evento", "Gestión", "Quién", "Hora"].map((h) => (
                <th key={h} className="px-4 py-3 text-[13px] font-medium text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {datos.eventos.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted text-sm">
                  Sin eventos para ese filtro.
                </td>
              </tr>
            )}
            {datos.eventos.map((e, i) => {
              const detalle = detalleLegible(e.detalle);
              const abierto = abiertoId === e.id;
              const dia = diaLegible(e.creado_en);
              const separador =
                i === 0 || dia !== diaLegible(datos.eventos[i - 1].creado_en);
              return (
                <FilaConDia key={e.id} separador={separador ? dia : null}>
                  <tr
                    className={`border-b border-border last:border-0 hover:bg-surface-2/60 transition-colors ${detalle ? "cursor-pointer" : ""}`}
                    onClick={detalle ? () => setAbiertoId(abierto ? null : e.id) : undefined}
                    title={detalle && !abierto ? "Ver detalle completo" : undefined}
                  >
                    <td className="px-4 py-2.5 max-w-72">
                      {LABEL_EVENTO[e.tipo] ?? e.tipo}
                      {e.tipo === "transicion" && (
                        <span className="text-muted text-[13px]">
                          {" "}· {etiquetaEtapa(e.de_etapa)} → {etiquetaEtapa(e.a_etapa)}
                        </span>
                      )}
                      {detalle && (
                        <span
                          className={`block text-[13px] text-muted ${abierto ? "" : "line-clamp-1"}`}
                        >
                          {detalle}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 max-w-64">
                      {/* Dirección primero: misma jerarquía que las cards del tablero y el Inicio */}
                      <Link
                        href={`/gestiones/${e.gestion_id}`}
                        className="text-brand font-medium hover:text-brand-hover"
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        <span className="line-clamp-1">{e.direccion}</span>
                      </Link>
                      <span className="text-[13px] text-muted line-clamp-1">{e.gestion_descripcion}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      {e.actor_nombre}
                      {e.actor_rol && (
                        <span className="block text-[12px] text-muted">
                          {NOMBRE_ROL[e.actor_rol]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[12px] text-muted whitespace-nowrap">
                      {hora(e.creado_en)}
                    </td>
                  </tr>
                </FilaConDia>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Paginador
        pagina={pagina}
        totalPaginas={totalPaginas}
        total={datos.total}
        desde={desdeFila}
        hasta={hastaFila}
        onAnterior={() => setPagina((p) => Math.max(1, p - 1))}
        onSiguiente={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
      />
    </>
  );
}

// STORY-980: log de acciones administrativas — ABM de empleados y técnicos.
// Mismo esqueleto que TabGestiones (debounce, descarte de respuestas viejas,
// separadores por día, count con denominador), columnas propias: acá el eje
// es el AFECTADO, no la gestión.
function TabSistema({
  inicial,
  actores,
}: {
  inicial: PaginaSistema;
  actores: ActorAuditoria[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const [actorId, setActorId] = useState("");
  const [tipo, setTipo] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState(inicial);
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const primera = useRef(true);
  const pedido = useRef(0);
  const cargar = useCallback(() => {
    const id = ++pedido.current;
    startTransition(async () => {
      const res = await historialSistema({
        busqueda: busqueda || undefined,
        actorId: actorId || undefined,
        tipo: tipo || undefined,
        desde: desde || undefined,
        hasta: hasta || undefined,
        pagina,
      });
      if (id === pedido.current) setDatos(res);
    });
  }, [busqueda, actorId, tipo, desde, hasta, pagina]);

  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    const t = setTimeout(cargar, 300);
    return () => clearTimeout(t);
  }, [cargar]);

  const filtrar = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPagina(1);
  };

  const totalPaginas = Math.max(1, Math.ceil(datos.total / AUDITORIA_POR_PAGINA));
  const desdeFila = datos.total === 0 ? 0 : (pagina - 1) * AUDITORIA_POR_PAGINA + 1;
  const hastaFila = Math.min(pagina * AUDITORIA_POR_PAGINA, datos.total);

  return (
    <>
      <FiltrosLista
        consulta={busqueda}
        onConsulta={filtrar(setBusqueda)}
        placeholder="Nombre del afectado…"
        extra={
          <>
            <div className="w-56">
              <Select
                label="Persona"
                value={actorId}
                onChange={(e) => filtrar(setActorId)(e.target.value)}
              >
                <option value="">Todas</option>
                {actores.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre} — {NOMBRE_ROL[a.rol]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-56">
              <Select
                label="Tipo de evento"
                value={tipo}
                onChange={(e) => filtrar(setTipo)(e.target.value)}
              >
                <option value="">Todos</option>
                {Object.entries(LABEL_EVENTO_SISTEMA).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-38">
              <Input
                label="Desde"
                type="date"
                value={desde}
                onChange={(e) => filtrar(setDesde)(e.target.value)}
              />
            </div>
            <div className="w-38">
              <Input
                label="Hasta"
                type="date"
                value={hasta}
                onChange={(e) => filtrar(setHasta)(e.target.value)}
              />
            </div>
          </>
        }
      />

      <ContadorConActualizar total={datos.total} pendiente={pendiente} onActualizar={cargar} />

      <Card className={`overflow-x-auto transition-opacity ${pendiente ? "opacity-60" : ""}`}>
        <table className="w-full text-[15px]">
          <thead>
            <tr className="border-b border-border text-left">
              {["Evento", "Afectado", "Quién", "Hora"].map((h) => (
                <th key={h} className="px-4 py-3 text-[13px] font-medium text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {datos.eventos.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted text-sm">
                  Sin eventos para ese filtro.
                </td>
              </tr>
            )}
            {datos.eventos.map((e, i) => {
              const detalle = detalleSistemaLegible(e.detalle);
              const abierto = abiertoId === e.id;
              const dia = diaLegible(e.creado_en);
              const separador =
                i === 0 || dia !== diaLegible(datos.eventos[i - 1].creado_en);
              return (
                <FilaConDia key={e.id} separador={separador ? dia : null}>
                  <tr
                    className={`border-b border-border last:border-0 hover:bg-surface-2/60 transition-colors ${detalle ? "cursor-pointer" : ""}`}
                    onClick={detalle ? () => setAbiertoId(abierto ? null : e.id) : undefined}
                    title={detalle && !abierto ? "Ver detalle completo" : undefined}
                  >
                    <td className="px-4 py-2.5 max-w-72">
                      {LABEL_EVENTO_SISTEMA[e.tipo] ?? e.tipo}
                      {detalle && (
                        <span
                          className={`block text-[13px] text-muted ${abierto ? "" : "line-clamp-1"}`}
                        >
                          {detalle}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 max-w-64">
                      <span className="line-clamp-1 font-medium">{e.afectado}</span>
                      {e.afectado_email && (
                        <span className="text-[13px] text-muted line-clamp-1">
                          {e.afectado_email}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {e.actor_nombre}
                      {e.actor_rol && (
                        <span className="block text-[12px] text-muted">
                          {NOMBRE_ROL[e.actor_rol]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[12px] text-muted whitespace-nowrap">
                      {hora(e.creado_en)}
                    </td>
                  </tr>
                </FilaConDia>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Paginador
        pagina={pagina}
        totalPaginas={totalPaginas}
        total={datos.total}
        desde={desdeFila}
        hasta={hastaFila}
        onAnterior={() => setPagina((p) => Math.max(1, p - 1))}
        onSiguiente={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
      />
    </>
  );
}

// Denominador siempre visible (STORY-974) + refresh manual (v1.1): trae lo
// nuevo sin perder los filtros (se descartó el realtime, no la actualización).
function ContadorConActualizar({
  total,
  pendiente,
  onActualizar,
}: {
  total: number;
  pendiente: boolean;
  onActualizar: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-2">
      <p className="text-[13px] text-muted tabular-nums">
        {total} evento{total === 1 ? "" : "s"}
      </p>
      <button
        type="button"
        onClick={onActualizar}
        disabled={pendiente}
        aria-label="Actualizar"
        title="Actualizar"
        className="grid place-items-center h-9 w-9 rounded-lg border border-border text-muted hover:text-foreground hover:bg-surface-2/60 transition-colors disabled:opacity-50"
      >
        <span className={pendiente ? "animate-spin" : ""}>
          <Icono id="refrescar" size={15} />
        </span>
      </button>
    </div>
  );
}

// Separador por día: el log se lee cronológicamente (STORY-974).
function FilaConDia({
  separador,
  children,
}: {
  separador: string | null;
  children: React.ReactNode;
}) {
  return (
    <>
      {separador && (
        <tr className="border-b border-border bg-surface-2/40">
          <td colSpan={4} className="px-4 py-1.5 text-[12px] font-medium text-muted">
            {separador}
          </td>
        </tr>
      )}
      {children}
    </>
  );
}
