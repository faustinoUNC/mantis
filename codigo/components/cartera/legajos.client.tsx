"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { abrirLegajo, cerrarLegajo } from "@/features/cartera/service";
import type { Legajo, Persona } from "@/features/cartera/types";
import {
  FormEditarPersona,
  PERSONA_VACIA,
  refPersona,
  SelectorPersona,
  validarPersona,
  type Modo,
} from "./persona-campos.client";

// STORY-985: esta sección quedó solo para las ACCIONES del legajo (abrir,
// cerrar, editar inquilino). Las obras, los legajos históricos y los PDF
// viven en el Historial de la propiedad.

function fechaCorta(f: string) {
  return new Date(`${f}T00:00:00`).toLocaleDateString("es-AR");
}

export function Legajos({
  propiedadId,
  legajos,
  inquilinosActivos,
}: {
  propiedadId: string;
  legajos: Legajo[];
  inquilinosActivos: Persona[];
}) {
  const vigente = legajos.find((l) => l.fecha_fin === null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [editandoInquilino, setEditandoInquilino] = useState(false);

  // El inquilino puede ser uno de la cartera o uno nuevo cargado acá mismo
  // (STORY-941 — no hay ABM suelto de inquilinos).
  const [modo, setModo] = useState<Modo>(inquilinosActivos.length ? "existente" : "nuevo");
  // STORY-981: arranca vacío — con el combo buscable elegir es explícito.
  const [inquilinoId, setInquilinoId] = useState("");
  const [nuevo, setNuevo] = useState(PERSONA_VACIA);

  async function onAbrir(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const eValidacion = validarPersona(modo, inquilinoId, nuevo, "inquilino");
    if (eValidacion) return setError(eValidacion);
    setError(null);
    setEnviando(true);
    const form = new FormData(e.currentTarget);
    const r = await abrirLegajo({
      propiedad_id: propiedadId,
      inquilino: refPersona(modo, inquilinoId, nuevo),
      fecha_inicio: String(form.get("fecha_inicio")),
    });
    setEnviando(false);
    if (!r.ok) setError(r.error);
    else setNuevo(PERSONA_VACIA);
  }

  async function onCerrar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!vigente) return;
    setError(null);
    setEnviando(true);
    const form = new FormData(e.currentTarget);
    const r = await cerrarLegajo(
      vigente.id,
      propiedadId,
      String(form.get("fecha_fin"))
    );
    setEnviando(false);
    if (!r.ok) setError(r.error);
    else setCerrando(false);
  }

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold tracking-tight mb-3">Legajos</h2>

      {vigente ? (
        <Card className="p-5 border-brand-soft-border bg-brand-soft/40">
          {editandoInquilino && vigente.inquilino ? (
            <FormEditarPersona
              tipo="inquilinos"
              persona={vigente.inquilino}
              docLabel="CUIL"
              onListo={() => setEditandoInquilino(false)}
            />
          ) : (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Badge tono="brand">Vigente</Badge>
                <p className="font-medium mt-2">{vigente.inquilino_nombre}</p>
                <p className="text-sm text-muted mt-0.5">
                  {vigente.inquilino?.email}
                  {vigente.inquilino?.telefono ? ` · ${vigente.inquilino.telefono}` : ""}
                </p>
                <p className="text-sm text-muted mt-0.5">
                  Desde el <span className="font-mono text-[13px]">{fechaCorta(vigente.fecha_inicio)}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {vigente.inquilino && (
                  <Button
                    variante="fantasma"
                    className="min-h-0 h-8 px-2.5 text-sm"
                    onClick={() => setEditandoInquilino(true)}
                  >
                    Editar datos
                  </Button>
                )}
              {cerrando ? (
                <form onSubmit={onCerrar} className="flex items-end gap-3">
                  <Input label="Fecha de fin" name="fecha_fin" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
                  <Button type="submit" disabled={enviando}>
                    {enviando ? "Cerrando…" : "Confirmar cierre"}
                  </Button>
                  <Button type="button" variante="fantasma" onClick={() => setCerrando(false)}>
                    Cancelar
                  </Button>
                </form>
              ) : (
                <Button variante="secundario" onClick={() => setCerrando(true)}>
                  Cerrar legajo
                </Button>
              )}
              </div>
            </div>
          )}
        </Card>
      ) : (
        <Card className="p-5">
          <p className="text-sm text-muted mb-4">
            Propiedad libre — abrí un legajo cuando entre un inquilino. Si no
            está en la cartera, cargalo acá mismo.
          </p>
          <form onSubmit={onAbrir} className="flex flex-col gap-4">
            <SelectorPersona
              personas={inquilinosActivos}
              quien="inquilino"
              docLabel="CUIL"
              modo={modo}
              onModo={setModo}
              id={inquilinoId}
              onId={setInquilinoId}
              nueva={nuevo}
              onNueva={setNuevo}
            />
            <div className="flex flex-wrap items-end gap-3">
              <Input label="Fecha de inicio" name="fecha_inicio" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
              <Button type="submit" disabled={enviando}>
                {enviando ? "Abriendo…" : "Abrir legajo"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-error">
          {error}
        </p>
      )}
    </section>
  );
}
