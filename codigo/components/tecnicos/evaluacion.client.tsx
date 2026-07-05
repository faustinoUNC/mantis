"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { aprobarTecnico, rechazarTecnico } from "@/features/tecnicos/service";

export function Evaluacion({ tecnicoId }: { tecnicoId: string }) {
  const router = useRouter();
  const [rechazando, setRechazando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function aprobar() {
    setEnviando(true);
    const r = await aprobarTecnico(tecnicoId);
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    router.refresh();
  }

  async function onRechazar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnviando(true);
    const form = new FormData(e.currentTarget);
    const r = await rechazarTecnico(tecnicoId, String(form.get("motivo")));
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    router.refresh();
  }

  return (
    <div className="mt-6">
      {rechazando ? (
        <form onSubmit={onRechazar} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-64">
            <Input label="Motivo del rechazo" name="motivo" required placeholder="Ej.: documentación ilegible" />
          </div>
          <Button type="submit" disabled={enviando} className="bg-error hover:bg-error/90">
            {enviando ? "Rechazando…" : "Confirmar rechazo"}
          </Button>
          <Button type="button" variante="fantasma" onClick={() => setRechazando(false)}>
            Cancelar
          </Button>
        </form>
      ) : (
        <div className="flex gap-3">
          <Button onClick={aprobar} disabled={enviando}>
            {enviando ? "Aprobando…" : "Aprobar técnico"}
          </Button>
          <Button variante="secundario" onClick={() => setRechazando(true)}>
            Rechazar
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-error">
          {error}
        </p>
      )}
    </div>
  );
}
