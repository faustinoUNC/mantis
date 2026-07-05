"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Especialidad } from "@/features/especialidades/types";
import { actualizarEspecialidadesTecnico } from "@/features/tecnicos/service";

// Edición de especialidades de un técnico ya creado (staff mantenimiento).
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

  async function guardar() {
    setError(null);
    setGuardando(true);
    const r = await actualizarEspecialidadesTecnico(tecnicoId, [...seleccionadas]);
    setGuardando(false);
    if (!r.ok) return setError(r.error);
    setEditando(false);
    router.refresh();
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
      <p className="text-[13px] font-medium text-muted mb-2">
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
              <span className="text-[11px] text-urgente-fuerte">(matríc.)</span>
            )}
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-error">
          {error}
        </p>
      )}
      <div className="flex gap-2 mt-3">
        <Button disabled={guardando} onClick={guardar}>
          {guardando ? "Guardando…" : "Guardar"}
        </Button>
        <Button variante="fantasma" onClick={() => setEditando(false)}>
          Cancelar
        </Button>
      </div>
    </Card>
  );
}
