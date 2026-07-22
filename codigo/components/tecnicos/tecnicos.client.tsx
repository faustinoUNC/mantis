"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RefrescoVivo } from "@/components/refresco-vivo.client";
import { Badge } from "@/components/ui/badge";
import { BotonIcono } from "@/components/ui/boton-icono.client";
import { ConTooltip } from "@/components/ui/con-tooltip.client";
import { Icono } from "@/components/ui/iconos";
import { Card } from "@/components/ui/card";
import { FiltrosLista } from "@/components/ui/filtros-lista.client";
import { Paginador } from "@/components/ui/paginador.client";
import { TecnicoForm } from "@/components/tecnicos/form-tecnico.client";
import type { Especialidad } from "@/features/especialidades/types";
import { cambiarEstadoTecnico } from "@/features/tecnicos/service";
import type { EstadoTecnico, TecnicoResumen } from "@/features/tecnicos/types";
import { usePaginado } from "@/shared/hooks/use-paginado";
import { coincideCampo, type CampoBusqueda } from "@/shared/utils/filtros";

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
  // STORY-966: la baja puede bloquearse (gestiones en curso) — el resultado
  // ya no se traga, se muestra (mismo bug de silencio que STORY-924).
  const [error, setError] = useState<string | null>(null);
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
        {/* pendiente sin verificar = reintento tras rechazo (STORY-958 v2):
            visible pero todavía no evaluable. */}
        {tecnico.estado === "pendiente" && !tecnico.email_verificado ? (
          <Badge tono="neutro">Reintento — esperando verificación</Badge>
        ) : (
          <div className="flex flex-wrap gap-1">
            <Badge tono={inactivo ? "error" : TONO_ESTADO[tecnico.estado]}>
              {inactivo ? "Inhabilitado" : LABEL_ESTADO[tecnico.estado]}
            </Badge>
            {/* STORY-1034: aviso de que el técnico no recibe solicitudes. */}
            {tecnico.estado === "aprobado" && !inactivo && tecnico.en_vacaciones && (
              <Badge tono="urgente">De vacaciones</Badge>
            )}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-1">
          <ConTooltip ayuda="Ver detalle" pos="abajo-der">
            <Link
              href={`/tecnicos/${tecnico.id}`}
              aria-label="Ver detalle"
              className="grid place-items-center size-11 rounded-md text-muted hover:text-foreground hover:bg-surface-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <Icono id="ojo" size={18} />
            </Link>
          </ConTooltip>
          {tecnico.estado === "aprobado" && tecnico.esta_activo !== null && (
            <BotonIcono
              icono={tecnico.esta_activo ? "inhabilitar" : "check"}
              titulo={tecnico.esta_activo ? "Inhabilitar" : "Habilitar"}
              variante="fantasma"
              pos="abajo-der"
              disabled={guardando}
              className={tecnico.esta_activo ? "text-error hover:text-error" : ""}
              onClick={async () => {
                setGuardando(true);
                setError(null);
                const r = await cambiarEstadoTecnico(tecnico.id, !tecnico.esta_activo);
                setGuardando(false);
                if (!r.ok) setError(r.error);
              }}
            />
          )}
        </div>
        {error && (
          <p role="alert" className="mt-1.5 max-w-72 text-[12px] font-medium text-error text-right whitespace-normal">
            {error}
          </p>
        )}
      </td>
    </tr>
  );
}

const CAMPOS_BUSQUEDA: CampoBusqueda<TecnicoResumen>[] = [
  { id: "nombre", label: "Nombre", de: (t) => [t.nombre] },
  { id: "correo", label: "Correo", de: (t) => [t.email] },
  { id: "especialidad", label: "Especialidad", de: (t) => [t.especialidades.join(" ")] },
];

// STORY-998: filtro por estado (mismo segmentado que Auditoría/Finanzas).
const ESTADOS_FILTRO: { id: "todas" | EstadoTecnico; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "pendiente", label: "Pendientes" },
  { id: "aprobado", label: "Aprobados" },
  { id: "rechazado", label: "Rechazados" },
];

export function Tecnicos({
  tecnicos,
  especialidades,
}: {
  tecnicos: TecnicoResumen[];
  especialidades: Especialidad[];
}) {
  const [creando, setCreando] = useState(false);
  const [consulta, setConsulta] = useState("");
  const [campo, setCampo] = useState("todo");
  const [estadoFiltro, setEstadoFiltro] = useState<"todas" | EstadoTecnico>("todas");
  const pendientes = tecnicos.filter((t) => t.estado === "pendiente").length;

  // Filtra por estado + búsqueda y ordena pendientes primero.
  const filtrados = useMemo(
    () =>
      tecnicos
        .filter((t) => estadoFiltro === "todas" || t.estado === estadoFiltro)
        .filter((t) => coincideCampo(consulta, campo, CAMPOS_BUSQUEDA, t))
        .sort(
          (a, b) =>
            (a.estado === "pendiente" ? -1 : 1) - (b.estado === "pendiente" ? -1 : 1)
        ),
    [tecnicos, consulta, campo, estadoFiltro]
  );

  const { pageItems, setPagina, paginadorProps } = usePaginado(filtrados);
  useEffect(() => setPagina(1), [consulta, campo, estadoFiltro, setPagina]);

  return (
    <div className="animate-aparecer">
      <div className="mb-5">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-3">
            Técnicos
            {pendientes > 0 && (
              <Badge tono="urgente">
                {pendientes} solicitud{pendientes > 1 ? "es" : ""} pendiente{pendientes > 1 ? "s" : ""}
              </Badge>
            )}
          </h1>
          <BotonIcono
            icono={creando ? "cerrar" : "mas"}
            titulo={creando ? "Cerrar" : "Alta manual"}
            variante={creando ? "secundario" : "primario"}
            pos="abajo-der"
            onClick={() => setCreando(!creando)}
          />
        </div>
        <p className="text-sm text-muted mt-1">
          La red de técnicos: especialidades, desempeño y solicitudes nuevas.
        </p>
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

      <div className="flex rounded-md border border-border overflow-hidden w-fit mb-4">
        {ESTADOS_FILTRO.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => setEstadoFiltro(e.id)}
            className={`text-sm px-3.5 py-1.5 transition-colors ${
              estadoFiltro === e.id
                ? "bg-brand text-white"
                : "bg-surface text-muted hover:text-foreground"
            }`}
          >
            {e.label}
          </button>
        ))}
      </div>

      <FiltrosLista
        consulta={consulta}
        onConsulta={setConsulta}
        campos={CAMPOS_BUSQUEDA}
        campo={campo}
        onCampo={setCampo}
      />

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
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted text-sm">
                  {tecnicos.length === 0
                    ? "Todavía no hay técnicos. Cargalos con “Alta manual” o esperá registros nuevos."
                    : "Ningún técnico coincide con los filtros."}
                </td>
              </tr>
            )}
            {pageItems.map((t) => (
              <Fila key={t.id} tecnico={t} />
            ))}
          </tbody>
        </table>
      </Card>

      <Paginador {...paginadorProps} />
      {/* La lista aparece/cambia con eventos de otros (solicitud verificada,
          aprobación de otro gestor) — refresco en vivo (STORY-957). */}
      <RefrescoVivo tabla="tecnicos" />
    </div>
  );
}
