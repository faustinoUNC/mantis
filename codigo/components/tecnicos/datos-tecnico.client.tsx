"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { editarDatosTecnico } from "@/features/tecnicos/service";
import { errorCuil } from "@/shared/utils/cuil";

// Edición de identidad de un técnico ya creado (staff mantenimiento,
// STORY-948, recortada por STORY-959): nombre y CUIL. El contacto
// (email/teléfono) lo cambia el técnico desde su propio perfil.
export function DatosTecnico({
  tecnicoId,
  nombre,
  email,
  telefono,
  cuil,
}: {
  tecnicoId: string;
  nombre: string;
  email: string;
  telefono: string | null;
  cuil: string | null;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [valores, setValores] = useState({ nombre, cuil: cuil ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  function empezarEdicion() {
    setValores({ nombre, cuil: cuil ?? "" });
    setError(null);
    setEditando(true);
  }

  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!valores.nombre.trim()) {
      return setError("Completá el nombre.");
    }
    const errCuil = errorCuil(valores.cuil, "CUIL/CUIT");
    if (errCuil) return setError(errCuil);
    setGuardando(true);
    const r = await editarDatosTecnico(tecnicoId, valores);
    setGuardando(false);
    if (!r.ok) return setError(r.error);
    setEditando(false);
    router.refresh();
  }

  if (!editando) {
    return (
      <div className="flex flex-col gap-1">
        <p>
          <span className="text-muted">Nombre:</span> {nombre}
        </p>
        <p>
          <span className="text-muted">Email:</span> {email}
        </p>
        <p>
          <span className="text-muted">Teléfono:</span> {telefono ?? "—"}
        </p>
        <p>
          <span className="text-muted">CUIL:</span> {cuil ?? "—"}
        </p>
        <Button
          variante="fantasma"
          className="self-start min-h-0 h-7 px-2 text-[13px]"
          onClick={empezarEdicion}
        >
          Editar datos
        </Button>
      </div>
    );
  }

  return (
    <Card className="p-4">
      <form onSubmit={guardar} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Nombre"
            required
            value={valores.nombre}
            onChange={(e) => setValores({ ...valores, nombre: e.target.value })}
          />
          <Input
            label="CUIL"
            required
            inputMode="numeric"
            value={valores.cuil}
            onChange={(e) => setValores({ ...valores, cuil: e.target.value })}
            placeholder="Sin guiones, ej. 20301234563"
          />
        </div>
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
        <p className="text-[13px] text-muted">
          El correo y el teléfono los actualiza el técnico desde su perfil.
        </p>
      </form>
    </Card>
  );
}
