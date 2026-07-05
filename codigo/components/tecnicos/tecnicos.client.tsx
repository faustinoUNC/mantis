"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TecnicoForm } from "@/components/tecnicos/form-tecnico.client";
import type { Especialidad } from "@/features/especialidades/types";
import { cambiarEstadoTecnico } from "@/features/tecnicos/service";
import type { EstadoTecnico, TecnicoResumen } from "@/features/tecnicos/types";

const TONO_ESTADO: Record<EstadoTecnico, "urgente" | "brand" | "error"> = {
  pendiente: "urgente",
  aprobado: "brand",
  rechazado: "error",
};

const LABEL_ESTADO: Record<EstadoTecnico, string> = {
  pendiente: "Pendiente de evaluación",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

function Fila({ tecnico }: { tecnico: TecnicoResumen }) {
  const [guardando, setGuardando] = useState(false);
  const inactivo = tecnico.esta_activo === false;

  return (
    <tr
      className={`border-b border-border last:border-0 hover:bg-surface-2/60 transition-colors ${
        inactivo || tecnico.estado === "rechazado" ? "opacity-55" : ""
      }`}
    >
      <td className="px-4 py-3 font-medium">{tecnico.nombre}</td>
      <td className="px-4 py-3 text-muted">{tecnico.email}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {tecnico.especialidades.map((e) => (
            <Badge key={e} tono="neutro">
              {e}
            </Badge>
          ))}
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge tono={inactivo ? "error" : TONO_ESTADO[tecnico.estado]}>
          {inactivo ? "Inhabilitado" : LABEL_ESTADO[tecnico.estado]}
        </Badge>
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <Link
          href={`/tecnicos/${tecnico.id}`}
          className="text-sm font-medium text-brand hover:text-brand-hover mr-3"
        >
          Ver detalle
        </Link>
        {tecnico.estado === "aprobado" && tecnico.esta_activo !== null && (
          <Button
            variante="fantasma"
            disabled={guardando}
            className={`min-h-0 h-8 px-2.5 text-sm ${
              tecnico.esta_activo ? "text-error hover:text-error" : ""
            }`}
            onClick={async () => {
              setGuardando(true);
              await cambiarEstadoTecnico(tecnico.id, !tecnico.esta_activo);
              setGuardando(false);
            }}
          >
            {tecnico.esta_activo ? "Inhabilitar" : "Habilitar"}
          </Button>
        )}
      </td>
    </tr>
  );
}

export function Tecnicos({
  tecnicos,
  especialidades,
}: {
  tecnicos: TecnicoResumen[];
  especialidades: Especialidad[];
}) {
  const [creando, setCreando] = useState(false);
  const pendientes = tecnicos.filter((t) => t.estado === "pendiente").length;
  const ordenados = [...tecnicos].sort(
    (a, b) => (a.estado === "pendiente" ? -1 : 1) - (b.estado === "pendiente" ? -1 : 1)
  );

  return (
    <div className="animate-aparecer">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[13px] font-medium text-muted">Red de técnicos</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-0.5 flex items-center gap-3">
            Técnicos
            {pendientes > 0 && (
              <Badge tono="urgente">
                {pendientes} solicitud{pendientes > 1 ? "es" : ""} pendiente{pendientes > 1 ? "s" : ""}
              </Badge>
            )}
          </h1>
        </div>
        <Button onClick={() => setCreando(!creando)} variante={creando ? "secundario" : "primario"}>
          {creando ? "Cerrar" : "Alta manual"}
        </Button>
      </div>

      {creando && (
        <Card className="animate-aparecer p-5 mb-4">
          <TecnicoForm
            especialidades={especialidades}
            modo="manual"
            onExito={() => setCreando(false)}
          />
        </Card>
      )}

      <Card className="overflow-x-auto">
        <table className="w-full text-[15px]">
          <thead>
            <tr className="border-b border-border text-left">
              {["Nombre", "Correo", "Especialidades", "Estado", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-[13px] font-medium text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordenados.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted text-sm">
                  Todavía no hay técnicos. Cargalos con “Alta manual” o esperá registros nuevos.
                </td>
              </tr>
            )}
            {ordenados.map((t) => (
              <Fila key={t.id} tecnico={t} />
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
