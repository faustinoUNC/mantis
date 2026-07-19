"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MAX_ARCHIVO_BYTES } from "@/components/tecnicos/form-tecnico.client";
import { InputArchivo } from "@/components/ui/input-archivo.client";
import type { Especialidad } from "@/features/especialidades/types";
import { actualizarEspecialidadesTecnico } from "@/features/tecnicos/service";

// Edición de especialidades de un técnico ya creado (staff mantenimiento).
// Si se agrega una especialidad que exige matrícula y el técnico todavía no
// la tenía, el mismo form deja subir su matrícula (STORY-948, STORY-1012).
export function EspecialidadesTecnico({
  tecnicoId,
  actuales,
  nombresActuales,
  catalogo,
}: {
  tecnicoId: string;
  actuales: string[];
  nombresActuales: string[];
  catalogo: Especialidad[];
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set(actuales));
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const exigeMatricula = catalogo.some(
    (e) => seleccionadas.has(e.id) && e.requiere_matricula
  );
  // STORY-1012: obligatorio cuando se agrega una especialidad exigente que
  // el técnico NO tenía antes de abrir este formulario — sin importar que ya
  // tenga matrícula cargada de otra especialidad (esa no sirve para la nueva).
  const faltaMatricula = catalogo.some(
    (e) => seleccionadas.has(e.id) && e.requiere_matricula && !actuales.includes(e.id)
  );

  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    // Validación acá y no solo en el server: un PDF de matrícula pesado mata
    // el request antes de que el server llegue a validar (STORY-945).
    for (const valor of form.values()) {
      if (valor instanceof File && valor.size > MAX_ARCHIVO_BYTES) {
        return setError(
          `"${valor.name}" pesa demasiado: cada archivo puede tener hasta 4 MB.`
        );
      }
    }
    setGuardando(true);
    try {
      const r = await actualizarEspecialidadesTecnico(tecnicoId, form);
      if (!r.ok) return setError(r.error);
      setEditando(false);
      router.refresh();
    } catch {
      setError(
        "No pudimos guardar los cambios. Revisá tu conexión y que los archivos no sean demasiado pesados."
      );
    } finally {
      setGuardando(false);
    }
  }

  if (!editando) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {nombresActuales.map((e) => (
          <Badge key={e} tono="neutro">
            {e}
          </Badge>
        ))}
        <Button
          variante="fantasma"
          className="min-h-0 h-7 px-2 text-[13px]"
          onClick={() => {
            setSeleccionadas(new Set(actuales));
            setEditando(true);
          }}
        >
          Editar especialidades
        </Button>
      </div>
    );
  }

  return (
    <Card className="mt-4 p-4">
      <form onSubmit={guardar} className="flex flex-col gap-3">
        <p className="text-[13px] font-medium text-muted">
          Especialidades del técnico
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
          {catalogo.map((esp) => (
            <label
              key={esp.id}
              className="flex items-center gap-2 min-h-tap text-sm cursor-pointer select-none"
            >
              <input
                type="checkbox"
                name="especialidades"
                value={esp.id}
                checked={seleccionadas.has(esp.id)}
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
        {exigeMatricula && (
          <InputArchivo
            label={
              faltaMatricula
                ? "Matrícula (obligatoria para la especialidad elegida)"
                : "Sumar otra matrícula (opcional)"
            }
            name="doc_matricula"
            required={faltaMatricula}
            accept="image/*,.pdf"
            multiple
          />
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-error">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit" disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
          <Button type="button" variante="fantasma" onClick={() => setEditando(false)}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}
