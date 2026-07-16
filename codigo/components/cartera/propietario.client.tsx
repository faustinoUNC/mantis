"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cambiarPropietario } from "@/features/cartera/service";
import type { Persona } from "@/features/cartera/types";
import {
  FormEditarPersona,
  PERSONA_VACIA,
  refPersona,
  SelectorPersona,
  validarPersona,
  type Modo,
} from "./persona-campos.client";

// Propietario de la propiedad (STORY-941): sus datos se editan acá y el
// cambio de propietario (venta) se resuelve acá — no hay ABM suelto.

export function PropietarioSeccion({
  propiedadId,
  propietario,
  propietariosActivos,
}: {
  propiedadId: string;
  propietario: Persona | null;
  propietariosActivos: Persona[];
}) {
  const [editando, setEditando] = useState(false);
  const [cambiando, setCambiando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Candidatos al cambio: los activos menos el actual
  const candidatos = propietariosActivos.filter((p) => p.id !== propietario?.id);
  const [modo, setModo] = useState<Modo>(candidatos.length ? "existente" : "nuevo");
  // STORY-981: arranca vacío — con el combo buscable elegir es explícito.
  const [id, setId] = useState("");
  const [nuevo, setNuevo] = useState(PERSONA_VACIA);

  async function onCambiar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const eValidacion = validarPersona(modo, id, nuevo, "propietario");
    if (eValidacion) return setError(eValidacion);
    setError(null);
    setEnviando(true);
    const r = await cambiarPropietario(propiedadId, refPersona(modo, id, nuevo));
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    setCambiando(false);
    setNuevo(PERSONA_VACIA);
  }

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold tracking-tight mb-3">Propietario</h2>
      <Card className="p-5">
        {editando && propietario ? (
          <FormEditarPersona
            tipo="propietarios"
            persona={propietario}
            docLabel="CUIT / CUIL"
            onListo={() => setEditando(false)}
          />
        ) : cambiando ? (
          <form onSubmit={onCambiar} className="flex flex-col gap-4">
            <SelectorPersona
              personas={candidatos}
              quien="propietario"
              docLabel="CUIT / CUIL"
              modo={modo}
              onModo={setModo}
              id={id}
              onId={setId}
              nueva={nuevo}
              onNueva={setNuevo}
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={enviando}>
                {enviando ? "Cambiando…" : "Confirmar cambio"}
              </Button>
              <Button type="button" variante="fantasma" onClick={() => setCambiando(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">{propietario?.nombre ?? "—"}</p>
              <p className="text-sm text-muted mt-0.5">
                {propietario?.email ?? "—"}
                {propietario?.telefono ? ` · ${propietario.telefono}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              {propietario && (
                <Button
                  variante="fantasma"
                  className="min-h-0 h-8 px-2.5 text-sm"
                  onClick={() => setEditando(true)}
                >
                  Editar datos
                </Button>
              )}
              <Button
                variante="fantasma"
                className="min-h-0 h-8 px-2.5 text-sm"
                onClick={() => setCambiando(true)}
              >
                Cambiar propietario
              </Button>
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-error">
            {error}
          </p>
        )}
      </Card>
    </section>
  );
}
