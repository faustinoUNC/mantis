"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Paginador } from "@/components/ui/paginador.client";
import { Select } from "@/components/ui/select";
import type { EventoAuditoria } from "@/features/auditoria/service";
import { usePaginado } from "@/shared/hooks/use-paginado";

const LABEL: Record<string, string> = {
  creada: "Gestión creada",
  transicion: "Cambio de etapa",
  asignacion_solicitada: "Asignación enviada",
  asignacion_aceptada: "Asignación aceptada",
  asignacion_rechazada: "Asignación rechazada",
  presupuesto_enviado: "Presupuesto enviado",
  presupuesto_aprobado: "Presupuesto aprobado",
  presupuesto_rechazado: "Presupuesto rechazado",
  conformidad_aprobada: "Conformidad aprobada",
  conformidad_rechazada: "Conformidad rechazada",
  gestor_reasignado: "Gestor reasignado",
  nota_cobro_enviada: "Nota de cobro enviada",
  cobro_registrado: "Cobro registrado",
  liquidacion_registrada: "Liquidación registrada",
};

export function Auditoria({ eventos }: { eventos: EventoAuditoria[] }) {
  const [tipo, setTipo] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const filtrados = useMemo(
    () =>
      eventos.filter((e) => {
        if (tipo && e.tipo !== tipo) return false;
        if (busqueda) {
          const texto = `${e.gestion_descripcion} ${e.direccion} ${e.actor_nombre}`.toLowerCase();
          if (!texto.includes(busqueda.toLowerCase())) return false;
        }
        return true;
      }),
    [eventos, tipo, busqueda]
  );

  const { pageItems, setPagina, paginadorProps } = usePaginado(filtrados);
  useEffect(() => setPagina(1), [tipo, busqueda, setPagina]);

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

      <div className="flex flex-wrap gap-3 mb-4 max-w-2xl">
        <div className="flex-1 min-w-48">
          <Input
            label="Buscar"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Gestión, dirección o persona…"
          />
        </div>
        <div className="min-w-52">
          <Select label="Tipo de evento" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
      </div>

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
            {pageItems.map((e) => (
              <tr key={e.id} className="border-b border-border last:border-0 hover:bg-surface-2/60 transition-colors">
                <td className="px-4 py-2.5">
                  {LABEL[e.tipo] ?? e.tipo}
                  {e.tipo === "transicion" && (
                    <span className="text-muted text-[13px]"> · {e.de_etapa} → {e.a_etapa}</span>
                  )}
                </td>
                <td className="px-4 py-2.5 max-w-64">
                  <Link href={`/gestiones/${e.gestion_id}`} className="text-brand font-medium hover:text-brand-hover">
                    <span className="line-clamp-1">{e.gestion_descripcion}</span>
                  </Link>
                  <span className="text-[13px] text-muted line-clamp-1">{e.direccion}</span>
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
            ))}
          </tbody>
        </table>
      </Card>

      <Paginador {...paginadorProps} />
    </div>
  );
}
