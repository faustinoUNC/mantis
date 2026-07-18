"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FiltrosLista } from "@/components/ui/filtros-lista.client";
import type { Propiedad } from "@/features/cartera/types";
import { coincideCampo, type CampoBusqueda } from "@/shared/utils/filtros";

const CAMPOS_BUSQUEDA: CampoBusqueda<Propiedad>[] = [
  { id: "direccion", label: "Dirección", de: (p) => [p.direccion] },
  { id: "propietario", label: "Propietario", de: (p) => [p.propietario_nombre] },
  { id: "inquilino", label: "Inquilino", de: (p) => [p.inquilino_nombre] },
];

export function PropiedadesAbm({ propiedades }: { propiedades: Propiedad[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [campo, setCampo] = useState("todo");

  const filtradas = propiedades.filter((p) =>
    coincideCampo(busqueda, campo, CAMPOS_BUSQUEDA, p)
  );

  return (
    <div className="animate-aparecer">
      <div className="mb-5">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Administración</h1>
          <Link
            href="/cartera/nueva"
            className="inline-flex items-center justify-center gap-2 min-h-tap px-4 rounded-md font-medium text-[0.9375rem] bg-brand text-white hover:bg-brand-hover transition-colors"
          >
            Nueva administración
          </Link>
        </div>
        <p className="text-sm text-muted mt-1">
          Los edificios y las propiedades que administra la inmobiliaria.
        </p>
      </div>

      <FiltrosLista
        consulta={busqueda}
        onConsulta={setBusqueda}
        campos={CAMPOS_BUSQUEDA}
        campo={campo}
        onCampo={setCampo}
      />

      <Card className="overflow-x-auto">
        <table className="w-full text-[15px]">
          <thead>
            <tr className="border-b border-border text-left">
              {["Dirección", "Tipo", "Propietario", "Ocupación", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-[13px] font-medium text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted text-sm">
                  {busqueda ? "Sin resultados para esa búsqueda." : "Todavía no hay propiedades cargadas."}
                </td>
              </tr>
            )}
            {filtradas.map((p) => (
              <tr
                key={p.id}
                className={`border-b border-border last:border-0 hover:bg-surface-2/60 transition-colors ${
                  p.activa ? "" : "opacity-55"
                }`}
              >
                <td className="px-4 py-3 font-medium">{p.direccion}</td>
                <td className="px-4 py-3 text-muted">{p.tipo ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{p.propietario_nombre}</td>
                <td className="px-4 py-3">
                  <Badge tono={p.ocupada ? "brand" : "neutro"}>
                    {p.ocupada ? "Ocupada" : "Libre"}
                  </Badge>
                  {p.inquilino_nombre && (
                    <span className="ml-2 text-sm text-muted">{p.inquilino_nombre}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/cartera/propiedades/${p.id}`}
                    className="text-sm font-medium text-brand hover:text-brand-hover"
                  >
                    Ver detalle
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
