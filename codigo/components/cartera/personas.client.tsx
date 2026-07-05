"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  cambiarEstadoPersona,
  guardarPersona,
} from "@/features/cartera/service";
import type { Persona, TipoPersona } from "@/features/cartera/types";

type Config = { titulo: string; singular: string; docLabel: string };

const CONFIG: Record<TipoPersona, Config> = {
  propietarios: { titulo: "Propietarios", singular: "propietario", docLabel: "CUIT" },
  inquilinos: { titulo: "Inquilinos", singular: "inquilino", docLabel: "DNI" },
};

function Formulario({
  tipo,
  persona,
  onListo,
}: {
  tipo: TipoPersona;
  persona?: Persona;
  onListo: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const { docLabel } = CONFIG[tipo];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    const form = new FormData(e.currentTarget);
    const r = await guardarPersona(
      tipo,
      {
        nombre: String(form.get("nombre")),
        email: String(form.get("email")),
        telefono: String(form.get("telefono") ?? ""),
        documento: String(form.get("documento") ?? ""),
      },
      persona?.id
    );
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    onListo();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
      <Input label="Nombre" name="nombre" required defaultValue={persona?.nombre} placeholder="Nombre y apellido" />
      <Input label="Correo electrónico" name="email" type="email" required defaultValue={persona?.email} placeholder="correo@ejemplo.com" />
      <Input label="Teléfono" name="telefono" defaultValue={persona?.telefono ?? ""} placeholder="Opcional" />
      <Input label={docLabel} name="documento" defaultValue={persona?.documento ?? ""} placeholder="Opcional" />
      {error && (
        <p role="alert" className="text-sm font-medium text-error sm:col-span-2 lg:col-span-4">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={enviando}>
          {enviando ? "Guardando…" : "Guardar"}
        </Button>
        {persona && (
          <Button type="button" variante="fantasma" onClick={onListo}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}

function Fila({ tipo, persona }: { tipo: TipoPersona; persona: Persona }) {
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  if (editando) {
    return (
      <tr className="border-b border-border bg-surface-2/50">
        <td colSpan={5} className="px-4 py-3">
          <Formulario tipo={tipo} persona={persona} onListo={() => setEditando(false)} />
        </td>
      </tr>
    );
  }

  return (
    <tr
      className={`border-b border-border last:border-0 hover:bg-surface-2/60 transition-colors ${
        persona.activo ? "" : "opacity-55"
      }`}
    >
      <td className="px-4 py-3 font-medium">{persona.nombre}</td>
      <td className="px-4 py-3 text-muted">{persona.email}</td>
      <td className="px-4 py-3 text-muted">{persona.telefono ?? "—"}</td>
      <td className="px-4 py-3 font-mono text-[13px] text-muted">{persona.documento ?? "—"}</td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <Button variante="fantasma" className="min-h-0 h-8 px-2.5 text-sm" onClick={() => setEditando(true)}>
          Editar
        </Button>
        <Button
          variante="fantasma"
          disabled={guardando}
          className="min-h-0 h-8 px-2.5 text-sm"
          onClick={async () => {
            setGuardando(true);
            await cambiarEstadoPersona(tipo, persona.id, !persona.activo);
            setGuardando(false);
          }}
        >
          {persona.activo ? "Desactivar" : "Reactivar"}
        </Button>
      </td>
    </tr>
  );
}

export function PersonasAbm({
  tipo,
  personas,
}: {
  tipo: TipoPersona;
  personas: Persona[];
}) {
  const [creando, setCreando] = useState(false);
  const { titulo, singular } = CONFIG[tipo];

  return (
    <div className="animate-aparecer">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[13px] font-medium text-muted">Cartera</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-0.5">{titulo}</h1>
        </div>
        <Button onClick={() => setCreando(!creando)} variante={creando ? "secundario" : "primario"}>
          {creando ? "Cerrar" : `Nuevo ${singular}`}
        </Button>
      </div>

      {creando && (
        <Card className="animate-aparecer p-5 mb-4">
          <Formulario tipo={tipo} onListo={() => setCreando(false)} />
        </Card>
      )}

      <Card className="overflow-x-auto">
        <table className="w-full text-[15px]">
          <thead>
            <tr className="border-b border-border text-left">
              {["Nombre", "Correo", "Teléfono", CONFIG[tipo].docLabel, ""].map((h) => (
                <th key={h} className="px-4 py-3 text-[13px] font-medium text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {personas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted text-sm">
                  Todavía no hay {titulo.toLowerCase()} cargados.
                </td>
              </tr>
            )}
            {personas.map((p) => (
              <Fila key={p.id} tipo={tipo} persona={p} />
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
