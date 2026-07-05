"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { agregarFranja, borrarFranja } from "@/features/tecnicos/service";
import { DIAS, type Franja } from "@/features/tecnicos/types";

function hora(h: string) {
  return h.slice(0, 5);
}

export function Agenda({ franjas }: { franjas: Franja[] }) {
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onAgregar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    const form = new FormData(e.currentTarget);
    const r = await agregarFranja({
      dia_semana: Number(form.get("dia_semana")),
      hora_desde: String(form.get("hora_desde")),
      hora_hasta: String(form.get("hora_hasta")),
    });
    setEnviando(false);
    if (!r.ok) setError(r.error);
  }

  // Lunes a domingo (1..6, 0)
  const ordenDias = [1, 2, 3, 4, 5, 6, 0];

  return (
    <div className="animate-aparecer max-w-lg">
      <p className="text-[13px] font-medium text-muted">Mi disponibilidad</p>
      <h1 className="text-2xl font-semibold tracking-tight mt-0.5 mb-1">
        Agenda semanal
      </h1>
      <p className="text-sm text-muted mb-5">
        Cargá tus franjas: el equipo las ve antes de asignarte un trabajo.
      </p>

      <Card className="p-4 sm:p-5 mb-5">
        <form onSubmit={onAgregar} className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
          <div className="col-span-2 sm:col-span-1">
            <Select label="Día" name="dia_semana" defaultValue="1">
              {ordenDias.map((d) => (
                <option key={d} value={d}>
                  {DIAS[d]}
                </option>
              ))}
            </Select>
          </div>
          <Input label="Desde" name="hora_desde" type="time" required defaultValue="09:00" />
          <Input label="Hasta" name="hora_hasta" type="time" required defaultValue="18:00" />
          <Button type="submit" disabled={enviando}>
            {enviando ? "…" : "Agregar"}
          </Button>
        </form>
        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-error">
            {error}
          </p>
        )}
      </Card>

      {franjas.length === 0 ? (
        <p className="text-sm text-muted">
          Todavía no cargaste franjas — agregá la primera arriba.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {ordenDias
            .filter((d) => franjas.some((f) => f.dia_semana === d))
            .map((dia) => (
              <div key={dia}>
                <h2 className="text-[13px] font-medium text-muted mb-2">
                  {DIAS[dia]}
                </h2>
                <div className="flex flex-col gap-2">
                  {franjas
                    .filter((f) => f.dia_semana === dia)
                    .map((f) => (
                      <Card
                        key={f.id}
                        className="flex items-center justify-between px-4 py-2.5"
                      >
                        <span className="font-mono text-[15px]">
                          {hora(f.hora_desde)} — {hora(f.hora_hasta)}
                        </span>
                        <Button
                          variante="fantasma"
                          className="min-h-tap px-3 text-sm text-error hover:text-error"
                          onClick={() => borrarFranja(f.id)}
                        >
                          Borrar
                        </Button>
                      </Card>
                    ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
