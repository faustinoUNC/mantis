"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputArchivo } from "@/components/ui/input-archivo.client";
import type { Especialidad } from "@/features/especialidades/types";
import {
  crearTecnicoManual,
  enrolarTecnico,
} from "@/features/tecnicos/service";
import { errorNombre } from "@/shared/utils/nombre";

// Los PDFs no se comprimen y el body del request tiene techo (~4.5 MB en Vercel).
export const MAX_ARCHIVO_BYTES = 4 * 1024 * 1024;

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
    // Validación acá y no solo en el server: con fotos de cámara el request
    // puede morir por tamaño antes de que el server llegue a validar (STORY-945).
    if (seleccionadas.size === 0) {
      return setError("Elegí al menos una especialidad.");
    }
    const form = new FormData(e.currentTarget);
    const errNombre = errorNombre(String(form.get("nombre") ?? ""));
    if (errNombre) {
      return setError(errNombre);
    }
    for (const valor of form.values()) {
      if (valor instanceof File && valor.size > MAX_ARCHIVO_BYTES) {
        return setError(
          `"${valor.name}" pesa demasiado: cada archivo puede tener hasta 4 MB.`
        );
      }
    }
    setEnviando(true);
    try {
      const accion = modo === "manual" ? crearTecnicoManual : enrolarTecnico;
      const r = await accion(form);
      if (!r.ok) return setError(r.error);
      onExito();
    } catch {
      setError(
        "No pudimos enviar la solicitud. Revisá tu conexión y que los archivos no sean demasiado pesados."
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Nombre" name="nombre" required placeholder="Nombre y apellido" onChange={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/\d/g, ""); }} />
        <Input label="Correo electrónico" name="email" type="email" required placeholder="tu@correo.com" />
        <Input label="Teléfono" name="telefono" required inputMode="numeric" placeholder="Solo números" onChange={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/\D/g, ""); }} />
        <Input label="CUIL" name="cuil" required inputMode="numeric" placeholder="Sin guiones, ej. 20301234563" />
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
                <span className="text-[12px] text-urgente-fuerte">(matríc.)</span>
              )}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <InputArchivo label="DNI (foto/PDF)" name="doc_dni" required accept="image/*,.pdf" />
        <InputArchivo
          label="Matrícula (podés subir más de una)"
          name="doc_matricula"
          required={exigeMatricula}
          accept="image/*,.pdf"
          multiple
        />
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
