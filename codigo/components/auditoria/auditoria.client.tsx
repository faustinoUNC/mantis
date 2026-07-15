"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { FiltrosLista } from "@/components/ui/filtros-lista.client";
import { Input } from "@/components/ui/input";
import { Paginador } from "@/components/ui/paginador.client";
import { Select } from "@/components/ui/select";
import { historialGlobal } from "@/features/auditoria/service";
import {
  AUDITORIA_POR_PAGINA,
  type ActorAuditoria,
  type PaginaAuditoria,
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

export function Auditoria({
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

  // La primera página ya viene renderizada del server; el efecto solo corre
  // ante cambios. `pedido` descarta respuestas viejas que lleguen tarde.
  const primera = useRef(true);
  const pedido = useRef(0);
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    const id = ++pedido.current;
    const t = setTimeout(() => {
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
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda, actorId, tipo, desde, hasta, pagina]);

  // Cambiar un filtro vuelve a página 1 (mismo render: React batchea).
  const filtrar = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPagina(1);
  };

  const totalPaginas = Math.max(1, Math.ceil(datos.total / AUDITORIA_POR_PAGINA));
  const desdeFila = datos.total === 0 ? 0 : (pagina - 1) * AUDITORIA_POR_PAGINA + 1;
  const hastaFila = Math.min(pagina * AUDITORIA_POR_PAGINA, datos.total);

  return (
    <div className="animate-aparecer">
      <p className="text-[13px] font-medium text-muted">Trazabilidad</p>
      <h1 className="text-2xl font-semibold tracking-tight mt-0.5 mb-1">
        Auditoría
      </h1>
      <p className="text-sm text-muted mb-5">
        Quién hizo qué y cuándo — los timestamps del event log sirven como
        evidencia de plazos.
      </p>

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

      {/* Denominador siempre visible: el resultado dice cuán completo es. */}
      <p className="text-[13px] text-muted tabular-nums mb-2">
        {datos.total} evento{datos.total === 1 ? "" : "s"}
      </p>

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
