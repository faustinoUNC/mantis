"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { FiltrosLista } from "@/components/ui/filtros-lista.client";
import { Paginador } from "@/components/ui/paginador.client";
import { Select } from "@/components/ui/select";
import type { EventoAuditoria } from "@/features/auditoria/service";
import { ETAPAS } from "@/features/gestiones/types";
import { usePaginado } from "@/shared/hooks/use-paginado";
import { coincideCampo, type CampoBusqueda } from "@/shared/utils/filtros";

const LABEL: Record<string, string> = {
  creada: "Gestión creada",
  transicion: "Cambio de etapa",
  asignacion_solicitada: "Asignación enviada",
  asignacion_aceptada: "Asignación aceptada",
  asignacion_rechazada: "Asignación rechazada",
  asignacion_cancelada: "Asignación cancelada",
  presupuesto_enviado: "Presupuesto enviado",
  presupuesto_enviado_pagador: "Presupuesto enviado al pagador",
  presupuesto_aprobado: "Presupuesto aprobado",
  presupuesto_rechazado: "Presupuesto rechazado",
  conformidad_aprobada: "Conformidad aprobada",
  conformidad_rechazada: "Conformidad rechazada",
  gasto_enviado: "Gasto imprevisto registrado",
  gasto_aprobado: "Gasto imprevisto aprobado",
  gasto_rechazado: "Gasto imprevisto rechazado",
  gestor_reasignado: "Gestor reasignado",
  nota_cobro_enviada: "Nota de cobro enviada",
  cobro_registrado: "Cobro registrado",
  liquidacion_registrada: "Liquidación registrada",
};

// Cancelada está fuera del funnel (STORY-914) pero aparece en transiciones.
const ETIQUETA_ETAPA: Record<string, string> = {
  ...Object.fromEntries(ETAPAS.map((e) => [e.id, e.label])),
  cancelada: "Cancelada",
};
const etapaLegible = (id: string | null) => (id ? (ETIQUETA_ETAPA[id] ?? id) : "");

const plata = (n: unknown) =>
  `$ ${Number(n).toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;

// Resumen humano del JSON `detalle` — la mitad del valor de auditoría vive ahí.
function resumenDetalle(d: Record<string, unknown> | null): string {
  if (!d) return "";
  const partes: string[] = [];
  if (d.tecnico) partes.push(String(d.tecnico));
  if (d.nuevo_gestor) partes.push(`nuevo gestor: ${d.nuevo_gestor}`);
  if (d.para) partes.push(`al ${d.para}`);
  if (d.pagador) partes.push(`paga ${d.pagador}`);
  if (d.total != null) partes.push(plata(d.total));
  if (d.monto != null) partes.push(plata(d.monto));
  if (d.costo_final != null) partes.push(`costo final ${plata(d.costo_final)}`);
  if (d.cargo_admin != null) partes.push(`cargo adm. ${plata(d.cargo_admin)}`);
  if (d.plazo_dias != null) partes.push(`${d.plazo_dias} día${Number(d.plazo_dias) === 1 ? "" : "s"}`);
  if (d.medio) partes.push(String(d.medio));
  if (d.factura_ref) partes.push(`fact. ${d.factura_ref}`);
  if (d.motivo) partes.push(`“${d.motivo}”`);
  return partes.join(" · ");
}

const CAMPOS_BUSQUEDA: CampoBusqueda<EventoAuditoria>[] = [
  { id: "direccion", label: "Dirección", de: (e) => [e.direccion] },
  { id: "descripcion", label: "Descripción", de: (e) => [e.gestion_descripcion] },
  { id: "persona", label: "Persona", de: (e) => [e.actor_nombre] },
];

export function Auditoria({ eventos }: { eventos: EventoAuditoria[] }) {
  const [tipo, setTipo] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [campo, setCampo] = useState("todo");

  const filtrados = useMemo(
    () =>
      eventos.filter(
        (e) =>
          (!tipo || e.tipo === tipo) &&
          coincideCampo(busqueda, campo, CAMPOS_BUSQUEDA, e)
      ),
    [eventos, tipo, busqueda, campo]
  );

  const { pageItems, setPagina, paginadorProps } = usePaginado(filtrados);
  useEffect(() => setPagina(1), [tipo, busqueda, campo, setPagina]);

  return (
    <div className="animate-aparecer">
      <p className="text-[13px] font-medium text-muted">Trazabilidad</p>
      <h1 className="text-2xl font-semibold tracking-tight mt-0.5 mb-1">
        Auditoría
      </h1>
      <p className="text-sm text-muted mb-5">
        Quién hizo qué y cuándo — los timestamps del event log sirven como
        evidencia de plazos. Últimos 200 eventos.
      </p>

      <FiltrosLista
        consulta={busqueda}
        onConsulta={setBusqueda}
        campos={CAMPOS_BUSQUEDA}
        campo={campo}
        onCampo={setCampo}
        extra={
          <div className="w-52">
            <Select label="Tipo de evento" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      <Card className="overflow-x-auto">
        <table className="w-full text-[15px]">
          <thead>
            <tr className="border-b border-border text-left">
              {["Evento", "Gestión", "Quién", "Cuándo"].map((h) => (
                <th key={h} className="px-4 py-3 text-[13px] font-medium text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted text-sm">
                  Sin eventos para ese filtro.
                </td>
              </tr>
            )}
            {pageItems.map((e) => {
              const detalle = resumenDetalle(e.detalle);
              return (
                <tr key={e.id} className="border-b border-border last:border-0 hover:bg-surface-2/60 transition-colors">
                  <td className="px-4 py-2.5 max-w-72">
                    {LABEL[e.tipo] ?? e.tipo}
                    {e.tipo === "transicion" && (
                      <span className="text-muted text-[13px]">
                        {" "}· {etapaLegible(e.de_etapa)} → {etapaLegible(e.a_etapa)}
                      </span>
                    )}
                    {detalle && (
                      <span className="block text-[13px] text-muted line-clamp-1">
                        {detalle}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 max-w-64">
                    {/* Dirección primero: misma jerarquía que las cards del tablero y el Inicio */}
                    <Link href={`/gestiones/${e.gestion_id}`} className="text-brand font-medium hover:text-brand-hover">
                      <span className="line-clamp-1">{e.direccion}</span>
                    </Link>
                    <span className="text-[13px] text-muted line-clamp-1">{e.gestion_descripcion}</span>
                  </td>
                  <td className="px-4 py-2.5 text-muted">{e.actor_nombre}</td>
                  <td className="px-4 py-2.5 font-mono text-[12px] text-muted whitespace-nowrap">
                    {new Date(e.creado_en).toLocaleString("es-AR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Paginador {...paginadorProps} />
    </div>
  );
}
