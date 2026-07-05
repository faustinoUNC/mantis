"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Especialidad } from "@/features/especialidades/types";
import {
  crearTecnicoManual,
  enrolarTecnico,
} from "@/features/tecnicos/service";

function CampoArchivo({
  label,
  name,
  requerido,
}: {
  label: string;
  name: string;
  requerido?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-muted">
        {label}
        {requerido && <span className="text-error"> *</span>}
      </label>
      <input
        type="file"
        name={name}
        accept="image/*,.pdf"
        className="text-sm text-muted file:mr-3 file:min-h-9 file:px-3 file:rounded-md file:border file:border-border-strong file:bg-surface file:text-sm file:font-medium file:text-foreground hover:file:bg-surface-2 file:transition-colors file:cursor-pointer"
      />
    </div>
  );
}

export function TecnicoForm({
  especialidades,
  modo,
  onExito,
}: {
  especialidades: Especialidad[];
  modo: "manual" | "enrolamiento";
  onExito: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());

  const exigeMatricula = especialidades.some(
    (e) => seleccionadas.has(e.id) && e.requiere_matricula
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    const form = new FormData(e.currentTarget);
    const accion = modo === "manual" ? crearTecnicoManual : enrolarTecnico;
    const r = await accion(form);
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    onExito();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Nombre" name="nombre" required placeholder="Nombre y apellido" />
        <Input label="Correo electrónico" name="email" type="email" required placeholder="tu@correo.com" />
        <Input label="Contraseña" name="password" type="password" required minLength={8} placeholder="Mínimo 8 caracteres" />
        <Input label="Teléfono" name="telefono" placeholder="Opcional" />
        <Input label="DNI" name="dni" placeholder="Opcional" />
      </div>

      <fieldset>
        <legend className="text-[13px] font-medium text-muted mb-2">
          Especialidades <span className="text-error">*</span>
        </legend>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
          {especialidades.map((esp) => (
            <label
              key={esp.id}
              className="flex items-center gap-2 min-h-tap text-sm cursor-pointer select-none"
            >
              <input
                type="checkbox"
                name="especialidades"
                value={esp.id}
                className="size-4 accent-(--color-brand)"
                onChange={(e) => {
                  const s = new Set(seleccionadas);
                  if (e.target.checked) s.add(esp.id);
                  else s.delete(esp.id);
                  setSeleccionadas(s);
                }}
              />
              {esp.nombre}
              {esp.requiere_matricula && (
                <span className="text-[11px] text-urgente-fuerte">(matríc.)</span>
              )}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <CampoArchivo label="DNI (foto/PDF)" name="doc_dni" />
        <CampoArchivo label="Matrícula" name="doc_matricula" requerido={exigeMatricula} />
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-error">
          {error}
        </p>
      )}

      <Button type="submit" disabled={enviando} className="sm:self-start sm:px-10">
        {enviando
          ? "Enviando…"
          : modo === "manual"
            ? "Dar de alta"
            : "Enviar solicitud"}
      </Button>
    </form>
  );
}
