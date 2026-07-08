"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FiltrosLista } from "@/components/ui/filtros-lista.client";
import { Input } from "@/components/ui/input";
import { Paginador } from "@/components/ui/paginador.client";
import {
  cambiarEstadoEspecialidad,
  crearEspecialidad,
  editarEspecialidad,
} from "@/features/especialidades/service";
import type { Especialidad } from "@/features/especialidades/types";
import { usePaginado } from "@/shared/hooks/use-paginado";
import { coincideTexto } from "@/shared/utils/filtros";

function CheckMatricula({ defaultChecked }: { defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 min-h-tap text-sm font-medium text-muted cursor-pointer select-none">
      <input
        type="checkbox"
        name="requiere_matricula"
        defaultChecked={defaultChecked}
        className="size-4 accent-(--color-brand)"
      />
      Requiere matrícula
    </label>
  );
}

function FormNueva({ onListo }: { onListo: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    const form = new FormData(e.currentTarget);
    const r = await crearEspecialidad({
      nombre: String(form.get("nombre")),
      requiere_matricula: form.get("requiere_matricula") === "on",
    });
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    onListo();
  }

  return (
    <Card className="animate-aparecer p-5 mb-4">
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-52">
          <Input label="Nombre" name="nombre" required placeholder="Ej.: Ascensores" />
        </div>
        <CheckMatricula />
        {error && (
          <p role="alert" className="text-sm font-medium text-error w-full">
            {error}
          </p>
        )}
        <Button type="submit" disabled={enviando}>
          {enviando ? "Creando…" : "Crear especialidad"}
        </Button>
      </form>
    </Card>
  );
}

function Fila({ especialidad }: { especialidad: Especialidad }) {
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGuardando(true);
    const form = new FormData(e.currentTarget);
    const r = await editarEspecialidad(especialidad.id, {
      nombre: String(form.get("nombre")),
      requiere_matricula: form.get("requiere_matricula") === "on",
    });
    setGuardando(false);
    if (r.ok) setEditando(false);
  }

  async function toggleEstado() {
    setGuardando(true);
    await cambiarEstadoEspecialidad(especialidad.id, !especialidad.activa);
    setGuardando(false);
  }

  if (editando) {
    return (
      <tr className="border-b border-border bg-surface-2/50">
        <td colSpan={4} className="px-4 py-3">
          <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-52">
              <Input label="Nombre" name="nombre" defaultValue={especialidad.nombre} required />
            </div>
            <CheckMatricula defaultChecked={especialidad.requiere_matricula} />
            <Button type="submit" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </Button>
            <Button type="button" variante="fantasma" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr
      className={`border-b border-border last:border-0 hover:bg-surface-2/60 transition-colors ${
        especialidad.activa ? "" : "opacity-55"
      }`}
    >
      <td className="px-4 py-3 font-medium">{especialidad.nombre}</td>
      <td className="px-4 py-3">
        {especialidad.requiere_matricula && (
          <Badge tono="urgente">Requiere matrícula</Badge>
        )}
      </td>
      <td className="px-4 py-3">
        <Badge tono={especialidad.activa ? "brand" : "neutro"}>
          {especialidad.activa ? "Activa" : "Inactiva"}
        </Badge>
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <Button variante="fantasma" className="min-h-0 h-8 px-2.5 text-sm" onClick={() => setEditando(true)}>
          Editar
        </Button>
        <Button
          variante="fantasma"
          disabled={guardando}
          className="min-h-0 h-8 px-2.5 text-sm"
          onClick={toggleEstado}
        >
          {especialidad.activa ? "Desactivar" : "Reactivar"}
        </Button>
      </td>
    </tr>
  );
}

export function Especialidades({
  especialidades,
}: {
  especialidades: Especialidad[];
}) {
  const [creando, setCreando] = useState(false);
  const [consulta, setConsulta] = useState("");

  const filtradas = useMemo(
    () => especialidades.filter((e) => coincideTexto(consulta, e.nombre)),
    [especialidades, consulta]
  );
  const { pageItems, setPagina, paginadorProps } = usePaginado(filtradas);
  useEffect(() => setPagina(1), [consulta, setPagina]);

  return (
    <div className="animate-aparecer">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[13px] font-medium text-muted">Mantenedor</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-0.5">
            Especialidades
          </h1>
        </div>
        <Button onClick={() => setCreando(!creando)} variante={creando ? "secundario" : "primario"}>
          {creando ? "Cerrar" : "Nueva especialidad"}
        </Button>
      </div>

      {creando && <FormNueva onListo={() => setCreando(false)} />}

      <FiltrosLista
        consulta={consulta}
        onConsulta={setConsulta}
        placeholder="Buscar especialidad…"
      />

      <Card className="overflow-x-auto">
        <table className="w-full text-[15px]">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-[13px] font-medium text-muted">Nombre</th>
              <th className="px-4 py-3 text-[13px] font-medium text-muted">Matrícula</th>
              <th className="px-4 py-3 text-[13px] font-medium text-muted">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted text-sm">
                  Ninguna especialidad coincide con la búsqueda.
                </td>
              </tr>
            )}
            {pageItems.map((e) => (
              <Fila key={e.id} especialidad={e} />
            ))}
          </tbody>
        </table>
      </Card>

      <Paginador {...paginadorProps} />
    </div>
  );
}
