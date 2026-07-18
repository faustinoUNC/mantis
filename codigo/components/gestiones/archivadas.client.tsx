"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RefrescoVivo } from "@/components/refresco-vivo.client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FiltrosLista } from "@/components/ui/filtros-lista.client";
import { archivarGestion } from "@/features/gestiones/service";
import type { GestionResumen } from "@/features/gestiones/types";
import { coincideCampo, type CampoBusqueda } from "@/shared/utils/filtros";

// Archivo de finalizadas (STORY-935): lo que se sacó del tablero, sin
// perderlo. La RLS ya aplicó la división por roles en el server (el gestor
// de mantenimiento solo recibe las suyas).

type Archivada = GestionResumen & { archivada_en: string };

const CAMPOS_BUSQUEDA: CampoBusqueda<Archivada>[] = [
  { id: "descripcion", label: "Descripción", de: (g) => [g.descripcion] },
  { id: "direccion", label: "Dirección", de: (g) => [g.direccion] },
  { id: "propietario", label: "Propietario", de: (g) => [g.propietario_nombre] },
  { id: "inquilino", label: "Inquilino", de: (g) => [g.inquilino_nombre] },
  { id: "especialidad", label: "Especialidad", de: (g) => [g.especialidad] },
  { id: "tecnico", label: "Técnico", de: (g) => [g.tecnico_nombre] },
];

function fechaCorta(f: string) {
  const d = new Date(f);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function TarjetaArchivada({ gestion }: { gestion: Archivada }) {
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function desarchivar() {
    setError(null);
    setCargando(true);
    const r = await archivarGestion(gestion.id, false);
    setCargando(false);
    if (!r.ok) setError(r.error ?? "Error");
  }

  return (
    <Card className="p-4 flex flex-col gap-3">
      <Link href={`/gestiones/${gestion.id}`} className="group min-w-0">
        <p className="text-sm font-medium leading-snug truncate group-hover:text-brand-active transition-colors">
          {gestion.direccion}
        </p>
        <p className="text-[12px] text-muted mt-1 line-clamp-2">
          {gestion.descripcion}
        </p>
      </Link>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
        <Badge tono="neutro">{gestion.especialidad}</Badge>
        <span>Gestor: {gestion.gestor_nombre}</span>
        {gestion.tecnico_nombre && <span>Técnico: {gestion.tecnico_nombre}</span>}
      </div>
      <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-border/70">
        <span className="font-mono text-[12px] text-muted/80">
          Archivada el {fechaCorta(gestion.archivada_en)}
        </span>
        <Button variante="fantasma" disabled={cargando} onClick={desarchivar}>
          {cargando ? "Desarchivando…" : "Desarchivar"}
        </Button>
      </div>
      {error && <p className="text-sm font-medium text-error">{error}</p>}
    </Card>
  );
}

export function Archivadas({ gestiones }: { gestiones: Archivada[] }) {
  const [consulta, setConsulta] = useState("");
  const [campo, setCampo] = useState("todo");

  const filtradas = useMemo(
    () =>
      gestiones.filter((g) => coincideCampo(consulta, campo, CAMPOS_BUSQUEDA, g)),
    [gestiones, consulta, campo]
  );

  return (
    <div className="animate-aparecer">
      <RefrescoVivo tabla="gestiones" />
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Archivo</h1>
        <p className="text-sm text-muted mt-1">
          Las gestiones cerradas o canceladas, para consultarlas cuando haga falta.
        </p>
      </div>

      <FiltrosLista
        consulta={consulta}
        onConsulta={setConsulta}
        campos={CAMPOS_BUSQUEDA}
        campo={campo}
        onCampo={setCampo}
      />

      {filtradas.length === 0 ? (
        <div className="grid place-items-center rounded-lg border border-dashed border-border py-16">
          <p className="text-sm text-muted">
            {gestiones.length === 0
              ? "No hay gestiones archivadas — se archivan desde el detalle, en la etapa Finalizado."
              : "Nada coincide con la búsqueda."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtradas.map((g) => (
            <TarjetaArchivada key={g.id} gestion={g} />
          ))}
        </div>
      )}
    </div>
  );
}
